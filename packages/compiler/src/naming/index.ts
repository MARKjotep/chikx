/**
 * Class naming and export generation (P4, SPECIFICATION.md §7.2 / §8).
 *
 * Two pure passes complete the naming story of the pipeline:
 *
 * 1. {@link renameClasses} — walks the lowered IR after {@link substitute},
 *    rebuilds every rule selector with the naming table applied (prefix strategy,
 *    `:global(...)` escape), and returns the first-appearance class table.
 * 2. `generateClassMap` — turns that table into an ESM class map plus matching
 *    TypeScript declarations, with the strict CHIKX4001 collision policy,
 *    reserved/invalid-identifier warnings and `__proto__`-safe keys.
 * 3. {@link mergeClassTables} — unions the renamed tables of a rule-bearing
 *    (`styles`) module graph into the single table the importing build exports
 *    (ADR-0014), enforcing the strict same-name/different-emitted conflict.
 *
 * Canonical pipeline position for consumers:
 *
 * ```text
 * parse → buildModuleGraph → (per module) lower → substitute → renameClasses
 *       → mergeClassTables → emitRuntimeTokens → groupRuns → flattenIr → emitCss
 *       (→ generateClassMap for the JS map and .d.ts)
 * ```
 *
 * `renameClasses` only rewrites selectors, so it is independent of the single
 * merged-build runtime emission; the class table is identical either way.
 *
 * Every pass is deterministic, frozen-output and filesystem-free; they never
 * mutate their inputs and never throw on malformed IR. Barrel wiring is
 * lead-directed; import this facade until integration.
 */

export { renameClasses } from "./rewrite.js";
export { generateClassMap } from "./mapgen.js";
export { mergeClassTables } from "./merge.js";
export type {
  ClassEntry,
  ClassMapOptions,
  ClassMapResult,
  ClassNamingOptions,
  ClassTable,
  RenameOptions,
  RenameResult,
} from "./types.js";
export type { ClassTableSource, MergedClassTable } from "./merge.js";
