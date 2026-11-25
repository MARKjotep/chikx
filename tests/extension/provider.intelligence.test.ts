/**
 * Pure intelligence-layer tests: completion contexts, hover values, colors and
 * the outline, all without the `vscode` module.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnalyzeOptions,
  type AnalyzeResult,
  type DocumentState,
  type SourceText,
  analyzeDocument,
  computeLineStarts,
  positionAt,
} from "../../packages/vscode/src/analysis.ts";
import {
  colorsOf,
  completionsAt,
  contextAt,
  documentSymbols,
  hexColorToRgba,
  hoverAt,
  rgbaToHex,
} from "../../packages/vscode/src/intelligence.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const CANONICAL = "tests/fixtures/canonical/button/input.cssx";

function fixture(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

function readModule(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

async function analyze(
  text: string,
  options: AnalyzeOptions = {},
  path = "example.cssx",
): Promise<DocumentState> {
  const source: SourceText = { text, path: join(ROOT, path), version: 1 };
  return analyzeDocument(source, { workspaceRoot: ROOT, readModule, ...options });
}

function labels(items: readonly { label: string }[]): string[] {
  return items.map((item) => item.label);
}

function aliasLabels(analysis: AnalyzeResult, text: string, offset: number): string[] {
  return labels(completionsAt(text, offset, { analysis }).items);
}

describe("completion contexts", () => {
  test("built-in and document media aliases complete after @ (including @2xl)", async () => {
    const text = [
      "@media-types { compact: (max-width: 500px); }",
      ".card { padding: 10px @ }",
    ].join("\n");
    const state = await analyze(text);
    const offset = text.indexOf("@ }") + 1;
    const context = contextAt(text, offset, state.analysis);
    expect(context.kind).toBe("directive");
    const items = completionsAt(text, offset, { analysis: state.analysis }).items;
    const byLabel = new Map(items.map((item) => [item.label, item]));
    expect(byLabel.get("@2xl")?.detail).toContain("(min-width: 1536px)");
    expect(byLabel.get("@md")?.detail).toContain("(min-width: 768px)");
    expect(byLabel.get("@compact")?.detail).toContain("(max-width: 500px)");
  });

  test("$ completes local tokens and namespaces, and ns. completes members", async () => {
    const canonical = fixture(CANONICAL);
    const text = `${canonical}\n.extra { color: $theme. }`;
    const state = await analyze(text, {}, CANONICAL);
    const memberOffset = text.lastIndexOf("$theme.") + "$theme.".length;
    expect(contextAt(text, memberOffset, state.analysis)).toEqual({
      kind: "member",
      namespace: "theme",
      word: "",
    });
    const members = completionsAt(text, memberOffset, { analysis: state.analysis }).items;
    expect(labels(members)).toEqual(["primary"]);

    const tokenText = "@variables { gap: 8px; }\n.card { padding: $gap; }";
    const tokens = await analyze(tokenText);
    const tokenOffset = tokenText.indexOf("$") + 1;
    expect(aliasLabels(tokens.analysis, tokenText, tokenOffset)).toContain("$gap");
  });

  test("setup keys and boolean setup values complete", async () => {
    const keyText = "@setup {\n  pre";
    const keyState = await analyze(keyText);
    const keyOffset = keyText.length;
    expect(contextAt(keyText, keyOffset, keyState.analysis)).toEqual({
      kind: "setup-key",
      word: "pre",
    });
    expect(aliasLabels(keyState.analysis, keyText, keyOffset)).toContain("prefix");

    const valueText = "@setup {\n  emit-css: ";
    const valueState = await analyze(valueText);
    expect(contextAt(valueText, valueText.length, valueState.analysis)).toEqual({
      kind: "setup-value",
      key: "emit-css",
      word: "",
    });
    expect(
      labels(completionsAt(valueText, valueText.length, { analysis: valueState.analysis }).items),
    ).toEqual(["true", "false"]);
  });

  test("import paths complete inside @use strings through the injected lister", async () => {
    const text = '@use "./';
    const state = await analyze(text);
    const offset = text.length;
    expect(contextAt(text, offset, state.analysis)).toEqual({ kind: "import-path", typed: "./" });
    const items = completionsAt(text, offset, {
      analysis: state.analysis,
      listDirectory: () => ["theme.cssx", "layout.cssx", "sub"],
    }).items;
    expect(labels(items)).toEqual(["./layout.cssx", "./sub/", "./theme.cssx"]);
  });

  test("property, value, selector and pseudo contexts are distinguished", async () => {
    const propertyText = ".a {\n  dis";
    const propertyState = await analyze(propertyText);
    expect(aliasLabels(propertyState.analysis, propertyText, propertyText.length)).toContain(
      "display",
    );

    const valueText = ".a {\n  display: f;\n}";
    const valueState = await analyze(valueText);
    const valueOffset = valueText.indexOf("f;") + 1;
    expect(contextAt(valueText, valueOffset, valueState.analysis)).toMatchObject({
      kind: "value",
      property: "display",
    });
    expect(aliasLabels(valueState.analysis, valueText, valueOffset)).toContain("flex");

    const selectorText = ".a {\n  & { color: red; }\n}";
    const selectorState = await analyze(selectorText);
    const ampersand = selectorText.indexOf("&") + 1;
    expect(contextAt(selectorText, ampersand, selectorState.analysis)).toMatchObject({
      kind: "selector",
    });
    expect(aliasLabels(selectorState.analysis, selectorText, ampersand)).toContain("&:hover");

    const pseudoText = ".a {\n  &: { color: red; }\n}";
    const pseudoState = await analyze(pseudoText);
    const colon = pseudoText.indexOf(":") + 1;
    expect(contextAt(pseudoText, colon, pseudoState.analysis)).toMatchObject({ kind: "pseudo" });
    const pseudos = aliasLabels(pseudoState.analysis, pseudoText, colon);
    expect(pseudos).toContain(":hover");
    expect(pseudos).toContain("::before");
  });
});

describe("hover", () => {
  test("compile-time tokens show the resolved value", async () => {
    const text = fixture(CANONICAL);
    const state = await analyze(text, {}, CANONICAL);
    const offset = text.indexOf("$spacing") + 1;
    const hover = hoverAt(text, offset, { analysis: state.analysis });
    expect(hover?.markdown).toContain("compile-time token");
    expect(hover?.markdown).toContain("12px");
  });

  test("runtime tokens show the custom property and variants", async () => {
    const text = [
      '@setup { prefix: "ui"; }',
      "@runtime { primary: #2563eb @dark #60a5fa; }",
      ".card { color: $primary; }",
    ].join("\n");
    const state = await analyze(text);
    const hover = hoverAt(text, text.indexOf("$primary") + 1, { analysis: state.analysis });
    expect(hover?.markdown).toContain("--ui-primary");
    expect(hover?.markdown).toContain("#2563eb");
    expect(hover?.markdown).toContain("`@dark`: `#60a5fa`");
  });

  test("namespace members resolve through the imported module", async () => {
    const text = fixture(CANONICAL);
    const state = await analyze(text, {}, CANONICAL);
    const hover = hoverAt(text, text.indexOf("$theme.primary") + 1, { analysis: state.analysis });
    expect(hover?.markdown).toContain("$theme.primary");
    expect(hover?.markdown).toContain("#2563eb");
    expect(hover?.markdown).toContain("./theme.cssx");
  });

  test("media aliases show the resolved condition", async () => {
    const text = ".card { padding: 1px @md 2px; }";
    const state = await analyze(text);
    const hover = hoverAt(text, text.indexOf("@md") + 1, { analysis: state.analysis });
    expect(hover?.markdown).toContain("(min-width: 768px)");
    expect(hover?.markdown).toContain("builtin");
  });

  test("combined aliases show the AND expression", async () => {
    const text = ".card { color: red @xl+dark blue; }";
    const state = await analyze(text);
    const hover = hoverAt(text, text.indexOf("@xl+dark") + 1, { analysis: state.analysis });
    expect(hover?.markdown).toContain("(min-width: 1280px) and (prefers-color-scheme: dark)");
  });

  test("selector classes show the generated class from the compile", async () => {
    const text = fixture(CANONICAL);
    const state = await analyze(text, {}, CANONICAL);
    const hover = hoverAt(text, text.indexOf(".button") + 1, {
      analysis: state.analysis,
      ...(state.compiled === undefined ? {} : { classMap: state.compiled.classes }),
    });
    expect(hover?.markdown).toContain("ui-button");
  });

  test("properties return no hover (css-languageservice deferred)", async () => {
    const text = ".card { display: flex; }";
    const state = await analyze(text);
    expect(
      hoverAt(text, text.indexOf("display") + 1, { analysis: state.analysis }),
    ).toBeUndefined();
  });
});

describe("colors and outline", () => {
  test("hex colors convert to RGBA and back", () => {
    expect(hexColorToRgba("#fff")).toEqual({ red: 1, green: 1, blue: 1, alpha: 1 });
    const rgba = hexColorToRgba("#2563eb80");
    expect(rgba?.alpha).toBeCloseTo(0.502, 2);
    expect(rgbaToHex(0, 0, 0, 1)).toBe("#000000");
  });

  test("colorsOf exposes value ranges from declarations", async () => {
    const text = fixture(CANONICAL);
    const state = await analyze(text, {}, CANONICAL);
    const colors = colorsOf(state.analysis);
    expect(colors.map((color) => color.value)).toContain("#1e40af");
    const lineStarts = computeLineStarts(text);
    const expected = positionAt(lineStarts, text.indexOf("#1e40af"));
    expect(colors.find((color) => color.value === "#1e40af")?.range.start).toEqual(expected);
  });

  test("outline nests directives and rules", async () => {
    const text = fixture(CANONICAL);
    const state = await analyze(text, {}, CANONICAL);
    const symbols = documentSymbols(state.analysis);
    const names = symbols.map((symbol) => symbol.name);
    expect(names).toContain("@setup");
    expect(names).toContain("@use ./theme.cssx");
    expect(names).toContain("@variables");
    const button = symbols.find((symbol) => symbol.name === ".button");
    expect(button?.children.map((child) => child.name)).toContain("&:hover");
    expect(button?.children.map((child) => child.name)).toContain("padding");
  });
});
