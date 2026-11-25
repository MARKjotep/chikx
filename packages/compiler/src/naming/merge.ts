/**
 * Merged class tables for rule-bearing (`styles`) imports (ADR-0014).
 *
 * A merged build has ONE class map and ONE `.d.ts` for the importing file,
 * covering the entry's own classes plus every class contributed by
 * style-imported modules. Each module was renamed with its OWN `@setup` prefix
 * before merging, so the merge is a pure table union, not a re-naming pass.
 *
 * Policy (owner decision of 2026-11-25, strict):
 *
 * - The same original class name resolving to the same emitted name in several
 *   modules is allowed and unifies into one entry at its first position.
 * - The same original class name resolving to different emitted names is
 *   CHIKX4001: a single map key cannot have two values, and silently picking one
 *   would make `className` usage wrong in one of the modules. The first
 *   occurrence wins for deterministic recovery after the error.
 * - A `:global(...)` reference and a local class of the same name are not a
 *   conflict: the local definition upgrades the entry in place exactly as the
 *   single-module rewrite does, and globals still never reach the map.
 * - camelCase named-export alias uniqueness across the merged table is enforced
 *   afterwards by `generateClassMap`, which sees the merged table as one table.
 *
 * The pass is pure, deterministic and never mutates its inputs.
 */

import type { Diagnostic } from "../types/diagnostics.js";
import { error } from "../types/diagnostics.js";
import type { ClassEntry, ClassTable } from "./types.js";

/** One renamed module table plus an optional human label for diagnostics. */
export interface ClassTableSource {
  /** Table produced by `renameClasses` for one module (or the entry). */
  readonly table: ClassTable;
  /**
   * Module identity used in conflict messages, normally the workspace-relative
   * POSIX source path. Omitted for synthetic tables.
   */
  readonly label?: string;
}

/** Result of {@link mergeClassTables}. */
export interface MergedClassTable {
  /** Union table in first-appearance order: style modules first, then the entry. */
  readonly table: ClassTable;
  /** CHIKX4001 diagnostics for same-name/different-emitted conflicts. */
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Merge renamed class tables into the one table a merged build exports.
 *
 * @param sources Renamed tables in emission order (style-imported modules
 *   depth-first, then the importing entry).
 * @returns The union table plus any CHIKX4001 conflicts.
 */
export function mergeClassTables(sources: readonly ClassTableSource[]): MergedClassTable {
  const entries: ClassEntry[] = [];
  const indexes = new Map<string, number>();
  const owners = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];

  for (const source of sources) {
    const label = source.label ?? "an unnamed source";
    for (const entry of source.table.entries) {
      const existingIndex = indexes.get(entry.name);
      if (existingIndex === undefined) {
        indexes.set(entry.name, entries.length);
        owners.set(entry.name, label);
        entries.push(entry);
        continue;
      }

      const existing = entries[existingIndex];
      if (existing === undefined) {
        throw new Error("merged class table index out of range");
      }

      if (existing.global && !entry.global) {
        // A local definition replaces a global-only reference in place: the
        // class is exported once, from its first position (ADR-0010).
        entries[existingIndex] = entry;
        owners.set(entry.name, label);
        continue;
      }
      if (entry.global || existing.emitted === entry.emitted) continue;

      diagnostics.push(
        error(
          "CHIKX4001",
          `Class "${entry.name}" is emitted as both "${existing.emitted}" (${owners.get(entry.name) ?? "an unnamed source"}) and "${entry.emitted}" (${label}); a merged build has one class map, so the first name wins (ADR-0014).`,
          entry.span,
        ),
      );
    }
  }

  return {
    table: Object.freeze({ entries: Object.freeze(entries) }),
    diagnostics,
  };
}
