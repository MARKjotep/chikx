/**
 * Pure editor intelligence over an analyzed document: completions, hover,
 * definition, references, rename, outline and color helpers.
 *
 * This module deliberately avoids the `vscode` import. The extension providers
 * are thin adapters over these functions, and `bun test` exercises the same
 * code paths with plain text and offsets.
 */

import type {
  AnalyzeResult,
  ClassOccurrence,
  ColorOccurrence,
  ImportedModule,
  Range,
  TokenReference,
  TokenSymbol,
} from "./analysis.js";
import {
  BOOLEAN_SETUP_KEYS,
  SETUP_KEYS,
  collectTokenReferences,
  positionAt,
  rangeAt,
} from "./analysis.js";
import { dirnamePath } from "./paths.js";

/** Completion item kinds understood by the adapter. */
export type SuggestionKind =
  | "property"
  | "value"
  | "alias"
  | "directive"
  | "token"
  | "runtime-token"
  | "member"
  | "setup-key"
  | "setup-value"
  | "import-path"
  | "selector"
  | "pseudo";

/** One completion suggestion. */
export interface CompletionSuggestion {
  readonly label: string;
  readonly kind: SuggestionKind;
  readonly detail?: string;
  readonly documentation?: string;
  readonly insertText: string;
}

/** Completion outcome with the range the editor should replace. */
export interface CompletionResult {
  readonly items: readonly CompletionSuggestion[];
  readonly replaceStart: number;
  readonly replaceEnd: number;
}

/** Hover text plus the range it applies to. */
export interface HoverContent {
  readonly range: Range;
  readonly markdown: string;
}

/** A jump target inside the current document or an imported module. */
export interface DefinitionTarget {
  readonly file: string;
  readonly name: string;
  readonly range: Range;
}

/** Rename plan; every edit is single-file in this MVP. */
export type RenamePlan =
  | {
      readonly ok: true;
      readonly placeholder: string;
      readonly edits: readonly { readonly range: Range; readonly newText: string }[];
    }
  | { readonly ok: false; readonly reason: string };

/** Outline node mirroring a `DocumentSymbol` tree. */
export interface OutlineNode {
  readonly name: string;
  readonly detail?: string;
  readonly kind:
    | "setup"
    | "use"
    | "variables"
    | "runtime"
    | "media-types"
    | "token"
    | "rule"
    | "declaration"
    | "alias"
    | "native";
  readonly range: Range;
  readonly children: readonly OutlineNode[];
}

/** Contexts that drive completion. */
export type CompletionContext =
  | { readonly kind: "none" }
  | { readonly kind: "directive"; readonly word: string; readonly inSelector: boolean }
  | { readonly kind: "token"; readonly word: string }
  | { readonly kind: "member"; readonly namespace: string; readonly word: string }
  | { readonly kind: "import-path"; readonly typed: string }
  | { readonly kind: "setup-key"; readonly word: string }
  | { readonly kind: "setup-value"; readonly key: string; readonly word: string }
  | { readonly kind: "property"; readonly word: string }
  | { readonly kind: "value"; readonly property?: string; readonly word: string }
  | { readonly kind: "selector"; readonly word: string }
  | { readonly kind: "pseudo"; readonly word: string };

/** Options shared by the intelligence functions. */
export interface IntelligenceOptions {
  readonly analysis: AnalyzeResult;
  /** Generated class map from a compile, preferred over the local prefix guess. */
  readonly classMap?: Readonly<Record<string, string>>;
  /** Directory lister for import-path completion (`@use "`). */
  readonly listDirectory?: (absoluteDirectory: string) => readonly string[];
}

/** Common CSS properties offered inside rule bodies. */
const CSS_PROPERTIES: readonly string[] = Object.freeze([
  "align-content",
  "align-items",
  "align-self",
  "animation",
  "animation-delay",
  "animation-duration",
  "appearance",
  "aspect-ratio",
  "backdrop-filter",
  "background",
  "background-clip",
  "background-color",
  "background-image",
  "background-position",
  "background-size",
  "border",
  "border-bottom",
  "border-collapse",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "bottom",
  "box-shadow",
  "box-sizing",
  "caret-color",
  "clip-path",
  "color",
  "column-gap",
  "content",
  "cursor",
  "display",
  "filter",
  "flex",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "float",
  "font",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "grid",
  "grid-area",
  "grid-column",
  "grid-row",
  "grid-template-areas",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "inset",
  "justify-content",
  "justify-items",
  "justify-self",
  "left",
  "letter-spacing",
  "line-height",
  "list-style",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "opacity",
  "order",
  "outline",
  "overflow",
  "overflow-x",
  "overflow-y",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "place-items",
  "pointer-events",
  "position",
  "resize",
  "right",
  "row-gap",
  "scroll-behavior",
  "text-align",
  "text-decoration",
  "text-overflow",
  "text-transform",
  "top",
  "transform",
  "transition",
  "user-select",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "word-break",
  "z-index",
]);

/** General value keywords offered after a property colon. */
const CSS_VALUES: readonly string[] = Object.freeze([
  "absolute",
  "auto",
  "block",
  "border-box",
  "center",
  "contents",
  "currentColor",
  "flex",
  "flex-end",
  "flex-start",
  "grid",
  "hidden",
  "inherit",
  "initial",
  "inline",
  "inline-block",
  "inline-flex",
  "none",
  "normal",
  "pointer",
  "relative",
  "revert",
  "solid",
  "space-between",
  "stretch",
  "transparent",
  "unset",
  "visible",
]);

/** Property-specific value hints. */
const PROPERTY_VALUES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  display: ["block", "flex", "grid", "inline", "inline-block", "inline-flex", "none"],
  position: ["static", "relative", "absolute", "fixed", "sticky"],
  "text-align": ["left", "center", "right", "justify"],
  cursor: ["pointer", "default", "not-allowed", "text", "grab"],
  "font-weight": ["400", "500", "600", "700"],
  overflow: ["visible", "hidden", "auto", "scroll"],
  "flex-direction": ["row", "column", "row-reverse", "column-reverse"],
  "align-items": ["flex-start", "center", "flex-end", "stretch", "baseline"],
  "justify-content": ["flex-start", "center", "flex-end", "space-between", "space-around"],
});

/** Common pseudo-classes and pseudo-elements. */
const PSEUDOS: readonly string[] = Object.freeze([
  ":active",
  ":checked",
  ":disabled",
  ":enabled",
  ":first-child",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":hover",
  ":is(",
  ":last-child",
  ":not(",
  ":nth-child(",
  ":placeholder-shown",
  ":where(",
  "::after",
  "::before",
  "::placeholder",
  "::selection",
]);

/** Nested-selector starters. */
const SELECTOR_STARTERS: readonly string[] = Object.freeze([
  "&",
  "&:focus-visible",
  "&:hover",
  "&:disabled",
  "& > ",
  "& + ",
]);

/** Directives offered after `@` at a statement start. */
const DIRECTIVES: readonly { readonly name: string; readonly documentation: string }[] =
  Object.freeze([
    { name: "setup", documentation: "File-level output, prefix and emission settings." },
    { name: "use", documentation: 'Import a token-only module: `@use "./theme.cssx" as theme;`.' },
    { name: "variables", documentation: "Compile-time tokens substituted into declarations." },
    { name: "runtime", documentation: "Tokens emitted as native CSS custom properties." },
    { name: "media-types", documentation: "File-local media alias definitions." },
  ]);

/** Setup key documentation shown as completion documentation. */
const SETUP_DOCS: Readonly<Record<string, string>> = Object.freeze({
  prefix: "Class name prefix (e.g. `ui` produces `ui-button`).",
  "css-dir": "CSS output directory, resolved relative to the source file.",
  "css-name": "Optional CSS basename (must end with `.css`).",
  "map-dir": "JS class map output directory, relative to the source file.",
  "map-name": "Optional JS map basename (must end in `.js`).",
  "emit-css": "Write the stylesheet (default true).",
  "emit-map": "Write the JS class map (default true).",
  "emit-types": "Write `.d.ts` beside the JS map (default true).",
  "source-map": "Write a CSS source map (default false).",
  "import-css": "Include the relative CSS import in the JS map (default true).",
  minify: "Compact generated CSS whitespace (default false).",
  module:
    "Rule-bearing module: imported for its rules only, so the file plans no artifacts of its own (ADR-0014).",
});

function skipString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === quote) return index + 1;
    index += 1;
  }
  return text.length;
}

/** Offset of the string or comment containing `offset`, if any. */
function enclosingString(text: string, offset: number): number | undefined {
  let index = 0;
  while (index < offset && index < text.length) {
    const char = text[index];
    if (char === '"' || char === "'") {
      const end = skipString(text, index);
      if (offset <= end) return index;
      index = end;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      const close = text.indexOf("*/", index + 2);
      const end = close < 0 ? text.length : close + 2;
      if (offset <= end) return index;
      index = end;
      continue;
    }
    if (char === "/" && text[index + 1] === "/") {
      const close = text.indexOf("\n", index + 2);
      const end = close < 0 ? text.length : close + 1;
      if (offset <= end) return index;
      index = end;
      continue;
    }
    index += 1;
  }
  return undefined;
}

function scanBackWord(text: string, offset: number): { start: number; word: string } {
  let start = offset;
  while (start > 0) {
    const char = text[start - 1];
    if (char !== undefined && /[A-Za-z0-9_@$.-]/.test(char)) start -= 1;
    else break;
  }
  return { start, word: text.slice(start, offset) };
}

function statementStart(text: string, offset: number): number {
  for (let index = offset - 1; index >= 0; index -= 1) {
    const char = text[index];
    if (char === ";" || char === "{" || char === "}") return index;
  }
  return -1;
}

interface SpanLike {
  readonly start: number;
  readonly end: number;
}

interface RuleLike {
  readonly selector: string;
  readonly selectorSpan: SpanLike;
  readonly span: SpanLike;
  readonly body: readonly unknown[];
}

function findEnclosingRule(analysis: AnalyzeResult, offset: number): RuleLike | undefined {
  let found: RuleLike | undefined;
  const visit = (node: unknown): void => {
    const candidate = node as Partial<RuleLike> & { kind?: string };
    if (candidate.kind !== "rule" || candidate.span === undefined) return;
    if (offset < candidate.span.start || offset > candidate.span.end) return;
    found = candidate as RuleLike;
    for (const child of candidate.body ?? []) visit(child);
  };
  for (const item of analysis.ast.items) visit(item);
  return found;
}

function findEnclosingSetup(analysis: AnalyzeResult, offset: number): SpanLike | undefined {
  for (const item of analysis.ast.items) {
    if (item.kind === "setup" && offset >= item.span.start && offset <= item.span.end)
      return item.span;
  }
  return undefined;
}

function findEnclosingDeclaration(
  analysis: AnalyzeResult,
  offset: number,
): { readonly span: SpanLike; readonly property: string } | undefined {
  let found: { span: SpanLike; property: string } | undefined;
  const visit = (node: unknown): void => {
    const candidate = node as {
      kind?: string;
      span?: SpanLike;
      property?: string;
      body?: readonly unknown[];
      declarations?: readonly unknown[];
    };
    if (
      candidate.kind === "declaration" &&
      candidate.property !== undefined &&
      candidate.span !== undefined
    ) {
      if (offset >= candidate.span.start && offset <= candidate.span.end) {
        found = { span: candidate.span, property: candidate.property };
      }
      return;
    }
    for (const child of candidate.body ?? []) visit(child);
    for (const child of candidate.declarations ?? []) visit(child);
  };
  for (const item of analysis.ast.items) visit(item);
  return found;
}

function importByAlias(analysis: AnalyzeResult, alias: string): ImportedModule | undefined {
  return analysis.imports.find((entry) => entry.alias === alias);
}

/** Detect the completion context at `offset`. */
export function contextAt(
  text: string,
  offset: number,
  analysis: AnalyzeResult,
): CompletionContext {
  const stringStart = enclosingString(text, offset);
  if (stringStart !== undefined) {
    const head = text.slice(Math.max(0, stringStart - 64), stringStart);
    if (/@use\s*$/.test(head)) {
      return { kind: "import-path", typed: text.slice(stringStart + 1, offset) };
    }
    return { kind: "none" };
  }

  const { word } = scanBackWord(text, offset);

  if (word.startsWith("@")) {
    const rule = findEnclosingRule(analysis, offset);
    return { kind: "directive", word: word.slice(1), inSelector: rule !== undefined };
  }
  if (word.startsWith("$")) {
    const inner = word.slice(1);
    const dot = inner.indexOf(".");
    if (dot >= 0) {
      return { kind: "member", namespace: inner.slice(0, dot), word: inner.slice(dot + 1) };
    }
    return { kind: "token", word: inner };
  }
  const wordDot = word.indexOf(".");
  if (wordDot > 0) {
    const namespace = word.slice(0, wordDot);
    if (importByAlias(analysis, namespace) !== undefined) {
      return { kind: "member", namespace, word: word.slice(wordDot + 1) };
    }
  }

  const setup = findEnclosingSetup(analysis, offset);
  if (setup !== undefined) {
    const head = text.slice(setup.start, offset);
    const colon = head.lastIndexOf(":");
    if (colon >= 0) {
      const key = head.slice(0, colon).replace(/[{}]/g, " ").trim().split(/\s+/).pop();
      return { kind: "setup-value", key: key ?? "", word };
    }
    return { kind: "setup-key", word };
  }

  const declaration = findEnclosingDeclaration(analysis, offset);
  if (declaration !== undefined) {
    const colon = text.indexOf(":", declaration.span.start);
    if (colon >= 0 && offset > colon) {
      return { kind: "value", property: declaration.property, word };
    }
    return { kind: "property", word };
  }

  const rule = findEnclosingRule(analysis, offset);
  if (rule !== undefined) {
    if (offset >= rule.selectorSpan.start && offset <= rule.selectorSpan.end) {
      if (word.startsWith(":") || text[offset - 1] === ":") return { kind: "pseudo", word };
      return { kind: "selector", word };
    }
    if (text[offset - 1] === ":") return { kind: "pseudo", word };
    const boundary = statementStart(text, offset);
    const trimmed = text.slice(boundary + 1, offset).trimStart();
    if (trimmed === "") return { kind: "property", word };
    if (/^[&.#[:*>]/.test(trimmed)) {
      if (trimmed.endsWith(":") || /:\s*$/.test(trimmed)) return { kind: "pseudo", word };
      return { kind: "selector", word };
    }
    return { kind: "property", word };
  }

  if (word.startsWith("@")) return { kind: "directive", word: word.slice(1), inSelector: false };
  return { kind: "none" };
}

function aliasItem(alias: {
  name: string;
  condition: string;
  layer: string;
}): CompletionSuggestion {
  return {
    label: `@${alias.name}`,
    kind: "alias",
    detail: `${alias.condition} — ${alias.layer}`,
    insertText: `@${alias.name}`,
  };
}

function tokenItem(token: TokenSymbol): CompletionSuggestion {
  return {
    label: `$${token.name}`,
    kind: token.kind === "runtime" ? "runtime-token" : "token",
    detail: token.kind === "runtime" ? "runtime token (custom property)" : "compile-time token",
    documentation:
      token.kind === "runtime"
        ? `Custom property reference — authored value \`${token.value}\`.`
        : `Authored value: \`${token.value}\`.`,
    insertText: `$${token.name}`,
  };
}

function setupKeyItem(key: string): CompletionSuggestion {
  return {
    label: key,
    kind: "setup-key",
    detail: "Chikx @setup key",
    documentation: SETUP_DOCS[key] ?? "",
    insertText: `${key}: `,
  };
}

function importPathItems(
  analysis: AnalyzeResult,
  typed: string,
  listDirectory: ((directory: string) => readonly string[]) | undefined,
): readonly CompletionSuggestion[] {
  if (typed.startsWith("../")) return [];
  const base = dirnamePath(analysis.file);
  const slash = typed.lastIndexOf("/");
  const directoryPart = slash < 0 ? "" : typed.slice(0, slash + 1);
  const partial = slash < 0 ? typed : typed.slice(slash + 1);
  const target = directoryPart === "" ? base : `${base}/${directoryPart}`;
  const relativeTyped = typed.startsWith("./") || typed.startsWith("../");
  const prefix = typed === "" || !relativeTyped ? `./${directoryPart}` : directoryPart;
  const items: CompletionSuggestion[] = [];
  if (listDirectory === undefined) {
    items.push({ label: "./", kind: "import-path", insertText: "./" });
    return items;
  }
  let entries: readonly string[] = [];
  try {
    entries = listDirectory(target);
  } catch {
    entries = [];
  }
  for (const entry of [...entries].sort()) {
    if (entry.startsWith(".")) continue;
    if (partial !== "" && !entry.toLowerCase().startsWith(partial.toLowerCase())) continue;
    const isModule = entry.endsWith(".cssx");
    const suffix = isModule ? "" : "/";
    items.push({
      label: `${prefix}${entry}${suffix}`,
      kind: "import-path",
      detail: isModule ? "Chikx module" : "Directory",
      insertText: `${prefix}${entry}${suffix}`,
    });
  }
  return items;
}

/**
 * Context-aware completion at one document offset.
 *
 * The manifest trigger characters are `@`, `$`, `.`, `:`, `/`; property, value
 * and selector contexts also complete without a trigger.
 */
export function completionsAt(
  text: string,
  offset: number,
  options: IntelligenceOptions,
): CompletionResult {
  const { analysis } = options;
  const context = contextAt(text, offset, analysis);
  const result = (
    items: readonly CompletionSuggestion[],
    replaceStart: number,
  ): CompletionResult => ({ items, replaceStart, replaceEnd: offset });

  switch (context.kind) {
    case "directive": {
      const replaceStart = offset - context.word.length - 1;
      const aliases = analysis.mediaAliases
        .filter((alias) => context.word === "" || alias.name.startsWith(context.word))
        .map(aliasItem);
      const directives =
        context.inSelector || context.word !== ""
          ? []
          : DIRECTIVES.map<CompletionSuggestion>((directive) => ({
              label: `@${directive.name}`,
              kind: "directive",
              detail: "Chikx directive",
              documentation: directive.documentation,
              insertText: `@${directive.name} `,
            }));
      return result([...aliases, ...directives], replaceStart);
    }
    case "token": {
      const replaceStart = offset - context.word.length - 1;
      const items: CompletionSuggestion[] = [];
      for (const token of analysis.tokens) {
        if (token.namespace !== undefined) continue;
        if (context.word !== "" && !token.name.startsWith(context.word)) continue;
        items.push(tokenItem(token));
      }
      for (const imported of analysis.imports) {
        if (imported.alias === undefined) continue;
        items.push({
          label: `${imported.alias}.`,
          kind: "token",
          detail: `namespace for ${imported.specifier}`,
          insertText: `${imported.alias}.`,
        });
      }
      return result(items, replaceStart);
    }
    case "member": {
      const replaceStart = offset - context.word.length;
      const imported = importByAlias(analysis, context.namespace);
      if (imported === undefined) return result([], replaceStart);
      const items = imported.tokens
        .filter((token) => context.word === "" || token.name.startsWith(context.word))
        .map<CompletionSuggestion>((token) => ({
          label: token.name,
          kind: "member",
          detail:
            token.kind === "runtime"
              ? `runtime member of ${imported.specifier}`
              : `compile-time member of ${imported.specifier}`,
          documentation: `Authored value: \`${token.value}\`.`,
          insertText: token.name,
        }));
      return result(items, replaceStart);
    }
    case "import-path":
      return result(
        importPathItems(analysis, context.typed, options.listDirectory),
        offset - context.typed.length,
      );
    case "setup-key": {
      const replaceStart = offset - context.word.length;
      return result(
        SETUP_KEYS.filter((key) => context.word === "" || key.startsWith(context.word)).map(
          setupKeyItem,
        ),
        replaceStart,
      );
    }
    case "setup-value": {
      const replaceStart = offset - context.word.length;
      if (!BOOLEAN_SETUP_KEYS.includes(context.key)) return result([], replaceStart);
      return result(
        [
          { label: "true", kind: "setup-value", insertText: "true" },
          { label: "false", kind: "setup-value", insertText: "false" },
        ],
        replaceStart,
      );
    }
    case "property": {
      const replaceStart = offset - context.word.length;
      return result(
        CSS_PROPERTIES.filter(
          (property) => context.word === "" || property.startsWith(context.word),
        ).map<CompletionSuggestion>((property) => ({
          label: property,
          kind: "property",
          detail: "CSS property",
          insertText: `${property}: `,
        })),
        replaceStart,
      );
    }
    case "value": {
      const replaceStart = offset - context.word.length;
      const values = new Set<string>(CSS_VALUES);
      for (const value of PROPERTY_VALUES[context.property ?? ""] ?? []) values.add(value);
      const items: CompletionSuggestion[] = [...values]
        .filter((value) => context.word === "" || value.startsWith(context.word))
        .sort()
        .map<CompletionSuggestion>((value) => ({
          label: value,
          kind: "value",
          detail: "CSS value",
          insertText: value,
        }));
      items.push({
        label: "var(--...)",
        kind: "value",
        detail: "native custom property reference",
        insertText: "var(--",
      });
      return result(items, replaceStart);
    }
    case "selector": {
      const replaceStart = offset - context.word.length;
      const items: CompletionSuggestion[] = SELECTOR_STARTERS.map((starter) => ({
        label: starter.trim(),
        kind: "selector",
        insertText: starter,
      }));
      for (const occurrence of analysis.classes) {
        items.push({
          label: `.${occurrence.name}`,
          kind: "selector",
          detail:
            occurrence.generated === occurrence.name
              ? undefined
              : `generated class .${occurrence.generated}`,
          insertText: occurrence.name,
        });
      }
      return result(items, replaceStart);
    }
    case "pseudo": {
      const replaceStart = offset - context.word.length;
      return result(
        PSEUDOS.filter((pseudo) => context.word === "" || pseudo.startsWith(context.word)).map(
          (pseudo) => ({ label: pseudo, kind: "pseudo" as const, insertText: pseudo }),
        ),
        replaceStart,
      );
    }
    default:
      return result([], offset);
  }
}

function offsetAt(
  lineStarts: readonly number[],
  position: { readonly line: number; readonly character: number },
): number {
  return (lineStarts[Math.min(position.line, lineStarts.length - 1)] ?? 0) + position.character;
}

function rangeContains(analysis: AnalyzeResult, range: Range, offset: number): boolean {
  return (
    offsetAt(analysis.lineStarts, range.start) <= offset &&
    offset <= offsetAt(analysis.lineStarts, range.end)
  );
}

/** Token symbol under the cursor, including its reference range when present. */
export function tokenAt(
  text: string,
  offset: number,
  analysis: AnalyzeResult,
):
  | { readonly symbol: TokenSymbol; readonly namespace?: ImportedModule; readonly range?: Range }
  | undefined {
  const reference = collectTokenReferences(text, analysis.ast).find(
    (candidate) => offset >= candidate.start && offset <= candidate.end,
  );
  if (reference !== undefined) {
    const range = rangeAt(analysis.lineStarts, reference.start, reference.end);
    if (reference.namespace !== undefined) {
      const imported = importByAlias(analysis, reference.namespace);
      const symbol = imported?.tokens.find((token) => token.name === reference.name);
      return symbol === undefined ? undefined : { symbol, namespace: imported, range };
    }
    const local = analysis.tokens.find(
      (token) => token.namespace === undefined && token.name === reference.name,
    );
    return local === undefined ? undefined : { symbol: local, range };
  }
  for (const token of analysis.tokens) {
    if (token.namespace !== undefined) continue;
    if (rangeContains(analysis, token.declaration, offset)) return { symbol: token };
  }
  return undefined;
}

function aliasTokenAt(
  text: string,
  offset: number,
): { readonly text: string; readonly start: number; readonly end: number } | undefined {
  let start = offset;
  while (start > 0) {
    const char = text[start - 1];
    if (char !== undefined && /[A-Za-z0-9_+-]/.test(char)) start -= 1;
    else break;
  }
  if (text[start - 1] !== "@") return undefined;
  let end = offset;
  while (end < text.length) {
    const char = text[end];
    if (char !== undefined && /[A-Za-z0-9_+-]/.test(char)) end += 1;
    else break;
  }
  return { text: text.slice(start, end), start: start - 1, end };
}

function classAt(analysis: AnalyzeResult, offset: number): ClassOccurrence | undefined {
  return analysis.classes.find((occurrence) => rangeContains(analysis, occurrence.range, offset));
}

/**
 * Hover content for `$tokens`, media aliases and selector classes.
 *
 * Standard CSS property documentation is deliberately deferred until the
 * css-languageservice projection lands (A13 report), because guessing property
 * docs is worse than no hover.
 */
export function hoverAt(
  text: string,
  offset: number,
  options: IntelligenceOptions,
): HoverContent | undefined {
  const { analysis, classMap } = options;
  const token = tokenAt(text, offset, analysis);
  if (token !== undefined) {
    const { symbol, namespace } = token;
    const qualified =
      namespace === undefined ? `$${symbol.name}` : `$${namespace.alias}.${symbol.name}`;
    const lines: string[] = [];
    if (symbol.kind === "compile") {
      lines.push(`**${qualified}** — compile-time token`, "", `Value: \`${symbol.value}\``);
    } else {
      const customProperty = `--${analysis.prefix === "" ? symbol.name : `${analysis.prefix}-${symbol.name}`}`;
      lines.push(
        `**${qualified}** — runtime token`,
        "",
        `Custom property: \`${customProperty}\``,
        `Base value: \`${symbol.value}\``,
      );
      for (const variant of symbol.variants) {
        lines.push(`\`@${variant.aliases.join("+")}\`: \`${variant.value}\``);
      }
    }
    if (namespace !== undefined) lines.push("", `Module: \`${namespace.specifier}\``);
    return {
      markdown: lines.join("\n"),
      range: token.range ?? symbol.declaration,
    };
  }

  const alias = aliasTokenAt(text, offset);
  if (alias !== undefined) {
    const names = alias.text
      .replace(/^@/, "")
      .split("+")
      .filter((name) => name !== "");
    const parts: string[] = [];
    const conditions: string[] = [];
    let known = true;
    for (const name of names) {
      const resolved = analysis.mediaAliases.find((entry) => entry.name === name);
      if (resolved === undefined) {
        known = false;
        parts.push(`\`@${name}\` is not defined.`);
      } else {
        conditions.push(resolved.condition);
        parts.push(`\`@${name}\` → \`${resolved.condition}\` (${resolved.layer})`);
      }
    }
    const lines: string[] = [];
    if (!known) lines.push("**Unknown media alias**", "");
    if (known && names.length > 1) {
      lines.push(
        `**${alias.text}** — combined media condition`,
        "",
        `\`${conditions.join(" and ")}\``,
      );
    } else {
      lines.push(...parts);
    }
    return {
      markdown: lines.join("\n"),
      range: rangeAt(analysis.lineStarts, alias.start, alias.end),
    };
  }

  const occurrence = classAt(analysis, offset);
  if (occurrence !== undefined) {
    const generated = classMap?.[occurrence.name] ?? occurrence.generated;
    const markdown = occurrence.global
      ? `**\`.${occurrence.name}\`** — global class, not renamed.`
      : `**\`.${occurrence.name}\`** — generated class: \`${generated}\``;
    return { markdown, range: occurrence.range };
  }

  return undefined;
}

/** Definition targets for the token under the cursor. */
export function definitionsAt(
  text: string,
  offset: number,
  options: IntelligenceOptions,
): readonly DefinitionTarget[] {
  const token = tokenAt(text, offset, options.analysis);
  if (token === undefined) return [];
  return [{ file: token.symbol.file, name: token.symbol.name, range: token.symbol.declaration }];
}

/** References (declaration plus usages) for a token; module members stay read-only. */
export function referencesAt(
  text: string,
  offset: number,
  options: IntelligenceOptions,
): readonly DefinitionTarget[] {
  const { analysis } = options;
  const token = tokenAt(text, offset, analysis);
  if (token === undefined) return [];
  const { symbol } = token;
  const targets: DefinitionTarget[] = [
    { file: symbol.file, name: symbol.name, range: symbol.declaration },
  ];
  for (const reference of collectTokenReferences(text, analysis.ast)) {
    if (reference.name !== symbol.name) continue;
    if ((reference.namespace ?? undefined) !== symbol.namespace) continue;
    targets.push({
      file: analysis.file,
      name: symbol.name,
      range: rangeAt(analysis.lineStarts, reference.start, reference.end),
    });
  }
  return targets;
}

const TOKEN_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Single-file token rename driven by parser spans.
 *
 * Only `$` references collected from declaration value segments are edited, so
 * selectors (including `:global(...)` classes), strings, comments and import
 * paths are never rewritten. Namespace members are refused with guidance.
 */
export function renameAt(
  text: string,
  offset: number,
  newName: string,
  options: IntelligenceOptions,
): RenamePlan {
  const { analysis } = options;
  const token = tokenAt(text, offset, analysis);
  if (token === undefined) {
    return { ok: false, reason: "Place the cursor on a Chikx token to rename it." };
  }
  if (token.symbol.namespace !== undefined) {
    return {
      ok: false,
      reason: "Cross-module rename is not supported yet; rename the token in its defining module.",
    };
  }
  if (!TOKEN_NAME_PATTERN.test(newName)) {
    return {
      ok: false,
      reason:
        "Token names must start with a letter or underscore and contain letters, digits, `_` or `-`.",
    };
  }
  const edits: { range: Range; newText: string }[] = [
    { range: token.symbol.declaration, newText: newName },
  ];
  for (const reference of collectTokenReferences(text, analysis.ast)) {
    if (reference.namespace !== undefined) continue;
    if (reference.name !== token.symbol.name) continue;
    edits.push({
      range: rangeAt(analysis.lineStarts, reference.start, reference.end),
      newText: `$${newName}`,
    });
  }
  return { ok: true, placeholder: token.symbol.name, edits };
}

/** Parse a CSS hex color into 0–1 RGBA channels. */
export function hexColorToRgba(hex: string):
  | {
      readonly red: number;
      readonly green: number;
      readonly blue: number;
      readonly alpha: number;
    }
  | undefined {
  const body = hex.replace(/^#/, "");
  if (!/^[0-9A-Fa-f]+$/.test(body)) return undefined;
  const expand = (value: string): string =>
    value
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  const normalized = body.length === 3 || body.length === 4 ? expand(body) : body;
  if (normalized.length !== 6 && normalized.length !== 8) return undefined;
  const channel = (start: number): number =>
    Number.parseInt(normalized.slice(start, start + 2), 16) / 255;
  return {
    red: channel(0),
    green: channel(2),
    blue: channel(4),
    alpha: normalized.length === 8 ? channel(6) : 1,
  };
}

/** Format RGBA channels as authored hex (`#rrggbb` or `#rrggbbaa`). */
export function rgbaToHex(red: number, green: number, blue: number, alpha: number): string {
  const channel = (value: number): string =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, "0");
  const base = `#${channel(red)}${channel(green)}${channel(blue)}`;
  return alpha >= 1 ? base : `${base}${channel(alpha)}`;
}

/** Colors authored in the analyzed declaration values. */
export function colorsOf(analysis: AnalyzeResult): readonly ColorOccurrence[] {
  return analysis.colors;
}

function spanRange(analysis: AnalyzeResult, span: SpanLike): Range {
  return rangeAt(analysis.lineStarts, span.start, span.end);
}

/** Outline tree: directives, tokens and nested rules. */
export function documentSymbols(analysis: AnalyzeResult): readonly OutlineNode[] {
  const { ast } = analysis;
  const nodes: OutlineNode[] = [];

  const ruleNode = (rule: RuleLike): OutlineNode => {
    const children: OutlineNode[] = [];
    for (const item of rule.body) {
      const child = item as {
        kind?: string;
        span?: SpanLike;
        selector?: string;
        selectorSpan?: SpanLike;
        body?: readonly unknown[];
        property?: string;
        value?: string;
        variant?: { aliases: readonly string[] };
      };
      if (child.kind === "rule" && child.selector !== undefined && child.span !== undefined) {
        children.push(
          ruleNode({
            selector: child.selector,
            selectorSpan: child.selectorSpan ?? child.span,
            span: child.span,
            body: child.body ?? [],
          }),
        );
      } else if (child.kind === "conditional-block" && child.span !== undefined) {
        const aliases = child.variant?.aliases ?? [];
        children.push({
          name: `@${aliases.join("+")}`,
          detail: "conditional block",
          kind: "rule",
          range: spanRange(analysis, child.span),
          children: (child.body ?? [])
            .filter((nested) => (nested as { kind?: string }).kind === "rule")
            .map((nested) => {
              const nestedRule = nested as {
                selector: string;
                selectorSpan?: SpanLike;
                span: SpanLike;
                body?: readonly unknown[];
              };
              return ruleNode({
                selector: nestedRule.selector,
                selectorSpan: nestedRule.selectorSpan ?? nestedRule.span,
                span: nestedRule.span,
                body: nestedRule.body ?? [],
              });
            }),
        });
      } else if (
        child.kind === "declaration" &&
        child.property !== undefined &&
        child.span !== undefined
      ) {
        children.push({
          name: child.property,
          ...(child.value === undefined ? {} : { detail: child.value.trim() }),
          kind: "declaration",
          range: spanRange(analysis, child.span),
          children: [],
        });
      }
    }
    return {
      name: rule.selector,
      kind: "rule",
      range: spanRange(analysis, rule.span),
      children,
    };
  };

  for (const item of ast.items) {
    switch (item.kind) {
      case "setup":
        nodes.push({
          name: "@setup",
          kind: "setup",
          range: spanRange(analysis, item.span),
          children: item.settings.map((setting) => ({
            name: setting.key,
            detail: setting.value,
            kind: "declaration" as const,
            range: spanRange(analysis, setting.span),
            children: [],
          })),
        });
        break;
      case "use":
        nodes.push({
          name: `@use ${item.path}`,
          ...(item.alias === undefined ? {} : { detail: `as ${item.alias}` }),
          kind: "use",
          range: spanRange(analysis, item.span),
          children: [],
        });
        break;
      case "variables":
        nodes.push({
          name: "@variables",
          kind: "variables",
          range: spanRange(analysis, item.span),
          children: item.tokens.map((token) => ({
            name: `$${token.name}`,
            detail: token.value,
            kind: "token" as const,
            range: spanRange(analysis, token.span),
            children: [],
          })),
        });
        break;
      case "runtime":
        nodes.push({
          name: "@runtime",
          kind: "runtime",
          range: spanRange(analysis, item.span),
          children: item.declarations.map((declaration) => ({
            name: declaration.property,
            detail: declaration.value,
            kind: "token" as const,
            range: spanRange(analysis, declaration.span),
            children: [],
          })),
        });
        break;
      case "media-types":
        nodes.push({
          name: "@media-types",
          kind: "media-types",
          range: spanRange(analysis, item.span),
          children: item.aliases.map((alias) => ({
            name: alias.name,
            detail: alias.media,
            kind: "alias" as const,
            range: spanRange(analysis, alias.span),
            children: [],
          })),
        });
        break;
      case "rule":
        nodes.push(
          ruleNode({
            selector: item.selector,
            selectorSpan: item.selectorSpan,
            span: item.span,
            body: item.body,
          }),
        );
        break;
      case "native-at-rule":
        nodes.push({
          name: `@${item.name}`,
          ...(item.prelude === "" ? {} : { detail: item.prelude }),
          kind: "native",
          range: spanRange(analysis, item.span),
          children: [],
        });
        break;
      default:
        break;
    }
  }
  return nodes;
}

/** Position of an absolute offset (test helper). */
export function positionFor(
  analysis: AnalyzeResult,
  offset: number,
): { line: number; character: number } {
  return positionAt(analysis.lineStarts, offset);
}

/** Token reference type re-export for provider adapters. */
export type { TokenReference };
