import { nativeBlockIr, ruleIr, stylesheetIr } from "../ir/factories.js";
import type {
  DeclarationIr,
  NativeBlockChild,
  NativeBlockIr,
  RuleIr,
  StylesheetIr,
} from "../ir/types.js";
import type { Diagnostic } from "../types/diagnostics.js";
import { error } from "../types/diagnostics.js";
import type { Span } from "../types/span.js";
import { scanSelector, splitSelectorList } from "./scan.js";
import type { Specificity } from "./specificity.js";
import { addSpecificity, compareSpecificity, specificityOfItem } from "./specificity.js";

/**
 * Nested-selector flattening (ADR-0002, ADR-0012, SPECIFICATION.md §7.1).
 *
 * `flattenSelector` is pure: it takes the raw authored selector of one rule
 * and the raw authored selectors of its enclosing rules (outermost-first) and
 * returns a flat selector list. It never reads the AST, mutates its input or
 * throws.
 *
 * Policy summary:
 *
 * - A nested selector without `&` is a descendant: `parent + " " + child`
 *   (ADR-0002).
 * - `&` is substituted in any position, including trailing and repeated
 *   (ADR-0012). A backslash-escaped `\&` stays literal, and `&` inside strings,
 *   comments and attribute selectors is never rewritten.
 * - A parent that resolves to one selector substitutes directly. A complex
 *   parent (contains a top-level combinator) is wrapped in `:is(...)` when `&`
 *   is attached to a prefix such as `.x&` or `&&`, because plain concatenation
 *   would change meaning.
 * - A parent selector list with equal, known specificity expands as the CSS
 *   cross-product in authored order. A parent list with mixed or unknown
 *   specificity substitutes `:is(list)`, which is exactly native nesting
 *   specificity. Mixed-specificity lists containing pseudo-elements are
 *   rejected because `:is()` cannot accept them.
 * - A nested rule's own selector list expands as a cross-product: each child
 *   item is expanded against every parent alternative in authored order.
 * - Rejected cases return a reason: `&` outside a nested rule, empty selector
 *   list items, unbalanced structures, leading combinators (relative nested
 *   selectors need an explicit `&` per §7.1) and the pseudo-element case
 *   above. The emitter turns a rejection into CHIKX1001.
 */

/** One flat alternative plus its estimated specificity. */
interface Alternative {
  readonly selector: string;
  readonly specificity: Specificity | null;
}

/** Successful flattening. */
export interface FlattenedSelector {
  readonly ok: true;
  /** Flat selector list, items joined with `", "`. */
  readonly selector: string;
}

/** Rejected flattening with a user-facing reason for the emitter diagnostic. */
export interface FlattenFailure {
  readonly ok: false;
  readonly reason: string;
}

/** Result of {@link flattenSelector}. */
export type FlattenResult = FlattenedSelector | FlattenFailure;

type ItemResult = { readonly ok: true; readonly items: readonly Alternative[] } | FlattenFailure;

function failure(reason: string): FlattenFailure {
  return { ok: false, reason };
}

function diagnosticFor(selector: string, reason: string, span: Span): Diagnostic {
  return error("CHIKX1001", `Cannot flatten selector "${selector}": ${reason}`, span);
}

/** True when `parent` has no top-level combinator and is therefore one compound. */
function isCompound(parent: string): boolean {
  const scan = scanSelector(parent);
  return scan.ok && !scan.hasTopLevelCombinator;
}

/**
 * True when the `&` at `position` is attached to a preceding simple selector
 * (for example `.x&`, `:not(.y)&` or `&&`) rather than starting a compound.
 */
function isPrefixAttached(text: string, position: number): boolean {
  if (position === 0) return false;
  const previous = text.charAt(position - 1);
  return previous !== "" && !/[\s>+~|,(]/.test(previous);
}

function substitute(
  item: string,
  ampersands: readonly number[],
  parent: readonly Alternative[],
): ItemResult {
  if (parent.length === 0) return failure('"&" has no enclosing rule to resolve against');

  const first = parent[0];
  if (first === undefined) return failure('"&" has no enclosing rule to resolve against');
  if (parent.length === 1) {
    const needsIs =
      !isCompound(first.selector) &&
      ampersands.some((position) => isPrefixAttached(item, position));
    const replacement = needsIs ? `:is(${first.selector})` : first.selector;
    let result = "";
    let cursor = 0;
    for (const position of ampersands) {
      result += item.slice(cursor, position) + replacement;
      cursor = position + 1;
    }
    result += item.slice(cursor);
    return {
      ok: true,
      items: [{ selector: result, specificity: specificityOfItem(result) }],
    };
  }

  let partial: string[] = [""];
  let cursor = 0;
  for (const position of ampersands) {
    const literal = item.slice(cursor, position);
    const choices: string[] = [];
    for (const alternative of parent) {
      const wrap = !isCompound(alternative.selector) && isPrefixAttached(item, position);
      choices.push(wrap ? `:is(${alternative.selector})` : alternative.selector);
    }
    const next: string[] = [];
    for (const prefix of partial) {
      for (const choice of choices) next.push(prefix + literal + choice);
    }
    partial = next;
    cursor = position + 1;
  }

  const tail = item.slice(cursor);
  const items = partial.map((prefix) => {
    const selector = prefix + tail;
    return { selector, specificity: specificityOfItem(selector) };
  });
  return { ok: true, items };
}

function descend(item: string, parent: readonly Alternative[]): readonly Alternative[] {
  const childSpecificity = specificityOfItem(item);
  return parent.map((alternative) => ({
    selector: `${alternative.selector} ${item}`,
    specificity: addSpecificity(alternative.specificity, childSpecificity),
  }));
}

function flattenAgainstParent(text: string, parent: readonly Alternative[] | null): ItemResult {
  const list = splitSelectorList(text);
  if (!list.ok) return failure(list.reason);

  const results: Alternative[] = [];
  for (const item of list.items) {
    const scan = scanSelector(item);
    if (!scan.ok) return failure(scan.reason);
    if (scan.leadingCombinator) {
      return failure(
        'a selector starting with a combinator requires an explicit "&" (SPECIFICATION.md §7.1)',
      );
    }

    if (parent === null) {
      if (scan.ampersands.length > 0) {
        return failure('"&" has no enclosing rule to resolve against');
      }
      results.push({ selector: item, specificity: specificityOfItem(item) });
      continue;
    }

    if (scan.ampersands.length > 0) {
      const substituted = substitute(item, scan.ampersands, parent);
      if (!substituted.ok) return substituted;
      results.push(...substituted.items);
    } else {
      results.push(...descend(item, parent));
    }
  }

  return { ok: true, items: results };
}

/**
 * Normalize a resolved ancestor list before it is used as a substitution
 * parent. Equal, known specificity may stay a list (cross-product); a mixed or
 * unknown list collapses to one `:is(...)` alternative.
 */
function normalizeParent(
  parent: readonly Alternative[],
): { readonly ok: true; readonly parent: readonly Alternative[] } | FlattenFailure {
  if (parent.length <= 1) return { ok: true, parent };

  const firstSpecificity = parent[0]?.specificity ?? null;
  const equal =
    firstSpecificity !== null &&
    parent.every(
      (alternative) =>
        alternative.specificity !== null &&
        compareSpecificity(alternative.specificity, firstSpecificity) === 0,
    );
  if (equal) return { ok: true, parent };

  for (const alternative of parent) {
    const scan = scanSelector(alternative.selector);
    if (scan.ok && scan.hasPseudoElement) {
      return failure(
        "mixed-specificity parent selector lists containing pseudo-elements cannot be represented with :is(...)",
      );
    }
  }

  let maximum: Specificity | null = null;
  let unknown = false;
  for (const alternative of parent) {
    if (alternative.specificity === null) {
      unknown = true;
      break;
    }
    if (maximum === null || compareSpecificity(alternative.specificity, maximum) > 0) {
      maximum = alternative.specificity;
    }
  }

  const joined = parent.map((alternative) => alternative.selector).join(", ");
  return {
    ok: true,
    parent: [{ selector: `:is(${joined})`, specificity: unknown ? null : maximum }],
  };
}

function resolveAncestors(
  ancestors: readonly string[],
): { readonly ok: true; readonly parent: readonly Alternative[] | null } | FlattenFailure {
  let resolved: readonly Alternative[] | null = null;
  for (const ancestor of ancestors) {
    const normalized = resolved === null ? null : normalizeParent(resolved);
    if (normalized !== null && !normalized.ok) return normalized;
    const folded = flattenAgainstParent(ancestor, normalized === null ? null : normalized.parent);
    if (!folded.ok) return folded;
    resolved = folded.items;
  }
  if (resolved === null) return { ok: true, parent: null };
  const normalized = normalizeParent(resolved);
  if (!normalized.ok) return normalized;
  return { ok: true, parent: normalized.parent };
}

/**
 * Flatten one authored selector against its authored ancestor selectors.
 *
 * Pure and deterministic: the returned selector list preserves authored item
 * order, cross-product order and all non-`&` tokens. A rejection carries a
 * reason suitable for a CHIKX1001-family diagnostic.
 */
export function flattenSelector(selector: string, ancestors: readonly string[]): FlattenResult {
  const resolved = resolveAncestors(ancestors);
  if (!resolved.ok) return resolved;
  const folded = flattenAgainstParent(selector, resolved.parent);
  if (!folded.ok) return folded;
  return {
    ok: true,
    selector: folded.items.map((item) => item.selector).join(", "),
  };
}

function flattenRuleNode(rule: RuleIr, diagnostics: Diagnostic[]): RuleIr | null {
  const flattened = flattenSelector(rule.selector, rule.ancestors);
  if (!flattened.ok) {
    diagnostics.push(diagnosticFor(rule.selector, flattened.reason, rule.span));
    return null;
  }
  return ruleIr({
    selector: flattened.selector,
    ancestors: [],
    declarations: rule.declarations,
    condition: rule.condition,
    context: rule.context,
    span: rule.span,
  });
}

function flattenNativeNode(block: NativeBlockIr, diagnostics: Diagnostic[]): NativeBlockIr {
  return nativeBlockIr({
    name: block.name,
    prelude: block.prelude,
    ...(block.statement === true ? { statement: true } : {}),
    children: flattenChildren(block.children, diagnostics),
    span: block.span,
  });
}

function flattenChildren(
  children: readonly NativeBlockChild[],
  diagnostics: Diagnostic[],
): readonly NativeBlockChild[] {
  const flattened: NativeBlockChild[] = [];
  for (const child of children) {
    if ("children" in child) {
      flattened.push(flattenNativeNode(child, diagnostics));
      continue;
    }
    if ("declarations" in child) {
      const rule = flattenRuleNode(child, diagnostics);
      if (rule !== null) flattened.push(rule);
      continue;
    }
    flattened.push(child as DeclarationIr);
  }
  return flattened;
}

/**
 * Flatten every rule selector in a stylesheet IR and clear `ancestors`.
 *
 * This is the explicit pipeline step between `groupRuns` and `emitCss`. Rules
 * whose selector cannot be flattened are omitted with a CHIKX1001 diagnostic;
 * callers that emit the original IR instead get the same rejection from
 * `emitCss` directly. Declaration, condition, context and span data are
 * preserved unchanged.
 */
export function flattenIr(ir: StylesheetIr): {
  readonly ir: StylesheetIr;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const rules: (RuleIr | NativeBlockIr)[] = [];
  for (const node of ir.rules) {
    if ("children" in node) {
      rules.push(flattenNativeNode(node, diagnostics));
      continue;
    }
    const rule = flattenRuleNode(node, diagnostics);
    if (rule !== null) rules.push(rule);
  }
  return { ir: stylesheetIr(rules), diagnostics: Object.freeze(diagnostics) };
}
