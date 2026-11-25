import { declarationIr, stylesheetIr } from "../ir/factories.js";
import type {
  DeclarationIr,
  MediaConditionIr,
  NativeBlockIr,
  RuleIr,
  StylesheetIr,
} from "../ir/types.js";
import { buildMediaAliasTable, resolveMediaCondition } from "../lowering/index.js";
import { declarationSegmentSpans, modifierAliasSpans } from "../lowering/spans.js";
import type { ModuleGraph, ScopedToken } from "../resolver/index.js";
import type { Declaration } from "../types/ast.js";
import type { Diagnostic } from "../types/diagnostics.js";
import { error } from "../types/diagnostics.js";
import type { Span } from "../types/span.js";
import { astReferences, segmentValueTokens } from "./ast.js";
import { expandValue, resolveReference } from "./expand.js";
import type { ExpansionHooks, ValueOrigin } from "./expand.js";
import { effectivePrefix, runtimePropertyName } from "./naming.js";
import type { VariableNamingOptions } from "./naming.js";
import { mapIrDeclarations, rootRule } from "./walk.js";

/**
 * Runtime token emission (SPECIFICATION.md §6.2).
 *
 * `@runtime` declarations become native custom properties:
 *
 * ```css
 * :root { --ui-primary: #2563eb; }
 * @media (prefers-color-scheme: dark) { :root { --ui-primary: #60a5fa; } }
 * ```
 *
 * Naming rule: `--<prefix>-<name>`, or `--<name>` when the effective prefix is
 * empty (`naming.prefix` wins over `prefix`, matching §7.2). The prefix is
 * authored configuration and is never sanitized here (P4/A09 owns CSS identifier
 * validation).
 *
 * Emission ownership (MVP, §6.2): runtime tokens visible to the entry module —
 * its own `@runtime` declarations, unqualified imports and any namespaced member
 * referenced by the entry or by reachable token modules — are emitted in every
 * consuming entrypoint and deduplicated by custom-property name. Two distinct
 * definitions for one name are CHIKX2001 and the first wins, so the output is
 * deterministic and never silently ambiguous. Cross-entrypoint collision
 * reporting is P5 project work.
 *
 * Inline variants on runtime tokens become conditional `:root` override rules.
 * Conditions are resolved with the same alias table and AND semantics as
 * lowering (A05), so keys and query text are identical. Declarations are grouped
 * by resolved query in first-appearance order: base declarations first, then one
 * `:root` rule per condition. This preserves each property's authored order
 * while letting the native custom-property cascade do the work — conditional
 * *reference* splitting is deliberately not performed.
 *
 * References inside declaration values are rewritten to `var(--...)`; a compile
 * reference that reaches this pass is expanded textually in its defining module
 * (the pass is safe to call without `substitute`, and idempotent after it).
 */

/** Options for {@link emitRuntimeTokens}. */
export interface RuntimeEmitOptions extends VariableNamingOptions {
  /** Project-level media alias overrides, merged before file `@media-types` (ADR-0006). */
  readonly media?: Readonly<Record<string, string>>;
  /**
   * Rule-bearing (`styles`) modules merged into this build, in emission order
   * (ADR-0014). Their rule-level runtime references register custom properties
   * too, because their declarations are emitted in this build even though their
   * `$references` were authored in another file.
   */
  readonly ruleModules?: readonly string[];
}

/** Result of {@link emitRuntimeTokens}. */
export interface RuntimeEmitResult {
  /** IR with `:root` rules prepended and runtime references rewritten. */
  readonly ir: StylesheetIr;
  /** CHIKX2001 runtime-name conflicts and CHIKX3001 condition errors, in walk order. */
  readonly diagnostics: Diagnostic[];
}

interface EmittedToken {
  readonly property: string;
  readonly token: ScopedToken;
}

interface ConditionGroup {
  readonly condition: MediaConditionIr;
  readonly declarations: DeclarationIr[];
}

/**
 * Canonical path list of the modules reachable from `entry` through `@use`.
 *
 * Entry first, then `ModuleGraph.order` (dependencies before importers, path
 * ties) restricted to reachable modules, then any remaining reachable module
 * (cycle members are absent from `order`) sorted by path. Deterministic for a
 * given graph.
 */
function reachableModules(graph: ModuleGraph, entry: string): string[] {
  const reachable = new Set<string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (reachable.has(file)) continue;
    const record = graph.modules.get(file);
    if (record === undefined) continue;
    reachable.add(file);
    for (const dependency of record.dependencies) queue.push(dependency);
  }

  const ordered: string[] = [];
  for (const file of graph.order) {
    if (reachable.has(file)) ordered.push(file);
  }
  const seen = new Set(ordered);
  const leftovers = [...reachable].filter((file) => !seen.has(file)).sort();
  return [...ordered, ...leftovers];
}

/**
 * Emit `@runtime` custom properties and rewrite runtime references in `ir`.
 *
 * Signature note (deviation from the task sketch): the input IR is required.
 * Producing `:root` rules alone would leave declaration values untouched, so
 * the prescribed `(graph, entryFile, options)` shape cannot satisfy
 * "references become `var(--...)`" without re-reading the AST.
 *
 * Runtime rules are inserted after leading statement at-rules (`@charset`,
 * `@import`, `@layer a, b;`) so emitted CSS stays valid, and before authored
 * rules. The pass is pure, deterministic and never mutates the input IR; it
 * returns the input instance when there is nothing to add.
 */
export function emitRuntimeTokens(
  ir: StylesheetIr,
  graph: ModuleGraph,
  entryFile: string,
  options: RuntimeEmitOptions = {},
): RuntimeEmitResult {
  const entry = graph.modules.get(entryFile);
  const diagnostics: Diagnostic[] = [];
  if (entry === undefined) return { ir, diagnostics };

  const prefix = effectivePrefix(options);
  const table = buildMediaAliasTable(entry.ast, options.media);

  const emitted: EmittedToken[] = [];
  const byProperty = new Map<string, ScopedToken>();
  const register = (token: ScopedToken, span: Span): void => {
    if (token.tokenType !== "runtime") return;
    const property = runtimePropertyName(token.name, prefix);
    const existing = byProperty.get(property);
    if (existing !== undefined) {
      if (existing.module !== token.module || existing.name !== token.name) {
        diagnostics.push(
          error(
            "CHIKX2001",
            `Runtime custom property "${property}" would be defined by both "${existing.module}" and "${token.module}"; the first definition wins (SPECIFICATION.md §6.2).`,
            span,
          ),
        );
      }
      return;
    }
    byProperty.set(property, token);
    emitted.push({ property, token });
  };

  // 1. Unqualified runtime surface of the entry itself: locals in authored
  //    order, then unqualified imports (the A07 scope shape).
  for (const token of entry.runtimeScope.tokens.values()) register(token, token.span);

  // 2. Runtime tokens actually consumed through a reference, either by the
  //    entry's rules or by any reachable token module.
  const registerReferences = (file: string, includeRules: boolean): void => {
    const record = graph.modules.get(file);
    if (record === undefined) return;
    for (const reference of astReferences(record.ast, { includeRules })) {
      const resolution = resolveReference(reference.reference, file, graph, reference.span);
      if (resolution.kind === "runtime") register(resolution.token, reference.span);
    }
  };

  registerReferences(entryFile, true);
  for (const file of reachableModules(graph, entryFile)) {
    if (file === entryFile) continue;
    registerReferences(file, false);
  }
  // Rule-merge imports (ADR-0014): the merged module's own rules are emitted in
  // this build, so their runtime references need a custom property here.
  for (const file of options.ruleModules ?? []) {
    if (file === entryFile) continue;
    registerReferences(file, true);
  }

  const hooks: ExpansionHooks = {
    runtimeRef: (token) => {
      register(token, token.span);
      return `var(${runtimePropertyName(token.name, prefix)})`;
    },
    report: (diagnostic) => diagnostics.push(diagnostic),
  };

  // 3. Defensive value rewrite: after `substitute` there are no `$` references
  //    left, but a standalone call still resolves and rewrites them here.
  const segments = segmentValueTokens(entry.ast);
  const originFor = (declaration: DeclarationIr): ValueOrigin => {
    const tokens = segments.get(declaration.span.start);
    return { module: entryFile, start: tokens?.[0]?.start ?? null, fallback: declaration.span };
  };
  const mapped = mapIrDeclarations(ir, (declaration) => {
    if (!declaration.value.includes("$")) return declaration;
    const expanded = expandValue(declaration.value, originFor(declaration), graph, hooks);
    if (expanded === null) return null;
    if (expanded === declaration.value) return declaration;
    return declarationIr(declaration.property, expanded, declaration.span, declaration.important);
  });

  // 4. Render each runtime token (the list can grow while values expand, so a
  //    plain index loop reaches a fixed point deterministically).
  const baseDeclarations: DeclarationIr[] = [];
  const groups: ConditionGroup[] = [];
  const groupByQuery = new Map<string, ConditionGroup>();

  for (let index = 0; index < emitted.length; index++) {
    const emittedToken = emitted[index];
    if (emittedToken === undefined) continue;
    const token = emittedToken.token;
    const declaration = token.declaration;
    if (token.tokenType !== "runtime" || !("variants" in declaration)) continue;

    const spans = declarationSegmentSpans(declaration);
    const baseValue = expandValue(
      declaration.value,
      { module: token.module, start: declaration.tokens?.[0]?.start ?? null, fallback: spans.base },
      graph,
      hooks,
    );
    if (baseValue === null) continue;
    baseDeclarations.push(
      declarationIr(emittedToken.property, baseValue, spans.base, declaration.important),
    );

    for (let variantIndex = 0; variantIndex < declaration.variants.length; variantIndex++) {
      const variant = declaration.variants[variantIndex];
      if (variant === undefined) continue;
      const span = spans.variants[variantIndex] ?? declaration.span;
      const value = expandValue(
        variant.value,
        { module: token.module, start: variant.tokens?.[0]?.start ?? null, fallback: span },
        graph,
        hooks,
      );
      if (value === null) continue;

      const resolution = resolveMediaCondition(modifierAliasSpans(variant), table, variant.span);
      if (!resolution.ok) {
        diagnostics.push(resolution.diagnostic);
        continue;
      }

      const rewritten = declarationIr(emittedToken.property, value, span, variant.important);
      let group = groupByQuery.get(resolution.condition.query);
      if (group === undefined) {
        group = { condition: resolution.condition, declarations: [] };
        groupByQuery.set(resolution.condition.query, group);
        groups.push(group);
      }
      group.declarations.push(rewritten);
    }
  }

  const runtimeRules: RuleIr[] = [];
  if (baseDeclarations.length > 0) runtimeRules.push(rootRule(baseDeclarations, null));
  for (const group of groups) {
    if (group.declarations.length > 0)
      runtimeRules.push(rootRule(group.declarations, group.condition));
  }

  if (runtimeRules.length === 0) return { ir: mapped.ir, diagnostics };

  // Keep `@charset`/`@import`/statement `@layer` first; CSS requires at-rule
  // statements before qualified rules.
  const nodes: (RuleIr | NativeBlockIr)[] = [...mapped.ir.rules];
  let insertAt = 0;
  while (insertAt < nodes.length) {
    const node = nodes[insertAt];
    if (node !== undefined && !("declarations" in node) && node.statement === true) insertAt++;
    else break;
  }

  return {
    ir: stylesheetIr([...nodes.slice(0, insertAt), ...runtimeRules, ...nodes.slice(insertAt)]),
    diagnostics,
  };
}
