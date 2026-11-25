import { declarationIr } from "../ir/factories.js";
import type { DeclarationIr, StylesheetIr } from "../ir/types.js";
import type { ModuleGraph } from "../resolver/index.js";
import type { Diagnostic } from "../types/diagnostics.js";
import { segmentValueTokens } from "./ast.js";
import { expandValue } from "./expand.js";
import type { ExpansionHooks, ValueOrigin } from "./expand.js";
import { effectivePrefix, runtimePropertyName } from "./naming.js";
import type { VariableNamingOptions } from "./naming.js";
import { mapIrDeclarations } from "./walk.js";

/**
 * Compile-time variable substitution (SPECIFICATION.md §6.1).
 *
 * Pure post-lowering pass: for every {@link DeclarationIr} value that contains a
 * `$`, the authored slice is re-scanned with the A03 lexer, each `$name` /
 * `$name.member` reference is resolved against the entry module's A07 scopes, and
 * compile-time values are spliced in textually. (Values without `$` are passed
 * through untouched: a `dollar-ref` token always contains `$`.) Runtime
 * references become `var(--<prefix>-<name>)` so `@runtime` tokens keep their
 * native cascade (`emitRuntimeTokens` emits the custom-property rules).
 *
 * Policies, all deterministic:
 *
 * - An unresolvable reference (undefined token, unknown namespace or member, a
 *   bare namespace, a reference cycle or an over-deep chain) is CHIKX2001 at
 *   the reference span, and the **declaration segment** is omitted. A `$` never
 *   leaks into CSS.
 * - The built-in `keyframes` namespace (ADR-0015) is not a variable:
 *   `$keyframes.<name>` expands to the authored name text of a visible
 *   `@keyframes` block.
 * - A rule whose declarations are all omitted is dropped, and a native block
 *   whose children are all dropped is dropped too, so no empty shells that
 *   could change cascade or at-rule validity are emitted. Statement at-rules
 *   (`@import`, ...) are always kept.
 * - Spans are unchanged. The IR carries no value-offset field, so the exact
 *   reference offset is recovered from the AST's parsed value tokens (ADR-0005,
 *   keyed by segment start); when an IR node has no authored counterpart the
 *   segment span is reported instead.
 * - Only the value text changes; `property`, `important`, conditions, native
 *   contexts, selectors and node order are preserved byte for byte.
 */

/** Result of {@link substitute}. */
export interface SubstituteResult {
  /** Rewritten, re-frozen stylesheet IR (the input instance when nothing changed). */
  readonly ir: StylesheetIr;
  /** CHIKX2001 diagnostics in IR order, one per rejected reference. */
  readonly diagnostics: Diagnostic[];
}

/**
 * Substitute every compile-time variable reference in `ir`.
 *
 * @param ir Lowered IR of `entryFile` (parse → `buildModuleGraph` → `lower`).
 * @param graph Module graph produced by A07; supplies scopes and token values.
 * @param entryFile Canonical path of the module that owns `ir`.
 * @param options Runtime custom-property prefix used to render `var(...)`
 *   references. It must match the prefix passed to `emitRuntimeTokens`.
 */
export function substitute(
  ir: StylesheetIr,
  graph: ModuleGraph,
  entryFile: string,
  options: VariableNamingOptions = {},
): SubstituteResult {
  const prefix = effectivePrefix(options);
  const diagnostics: Diagnostic[] = [];
  const hooks: ExpansionHooks = {
    runtimeRef: (token) => `var(${runtimePropertyName(token.name, prefix)})`,
    report: (diagnostic) => diagnostics.push(diagnostic),
  };
  const segments = segmentValueTokens(graph.modules.get(entryFile)?.ast);

  const originFor = (declaration: DeclarationIr): ValueOrigin => {
    const tokens = segments.get(declaration.span.start);
    return {
      module: entryFile,
      start: tokens?.[0]?.start ?? null,
      fallback: declaration.span,
    };
  };

  const mapped = mapIrDeclarations(ir, (declaration) => {
    if (!declaration.value.includes("$")) return declaration;
    const expanded = expandValue(declaration.value, originFor(declaration), graph, hooks);
    if (expanded === null) return null;
    if (expanded === declaration.value) return declaration;
    return declarationIr(declaration.property, expanded, declaration.span, declaration.important);
  });

  return { ir: mapped.ir, diagnostics };
}
