/**
 * Definition, references and rename tests for the pure navigation layer.
 *
 * Rename must use parser spans: strings, comments, selectors (including
 * `:global(...)` classes) and import paths are never rewritten, and namespace
 * members are refused with guidance instead of a partial cross-file edit.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnalyzeOptions,
  type AnalyzeResult,
  type DocumentState,
  type Range,
  type SourceText,
  analyzeDocument,
} from "../../packages/vscode/src/analysis.ts";
import {
  definitionsAt,
  referencesAt,
  renameAt,
  tokenAt,
} from "../../packages/vscode/src/intelligence.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const CANONICAL = "tests/fixtures/canonical/button/input.cssx";

function readModule(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

async function analyze(
  text: string,
  path = "rename.cssx",
  options: AnalyzeOptions = {},
): Promise<{ state: DocumentState; text: string }> {
  const source: SourceText = { text, path: join(ROOT, path), version: 1 };
  return {
    state: await analyzeDocument(source, { workspaceRoot: ROOT, readModule, ...options }),
    text,
  };
}

function offsetAt(analysis: AnalyzeResult, position: { line: number; character: number }): number {
  return (analysis.lineStarts[position.line] ?? 0) + position.character;
}

function rangeToOffsets(analysis: AnalyzeResult, range: Range): { start: number; end: number } {
  return { start: offsetAt(analysis, range.start), end: offsetAt(analysis, range.end) };
}

const TOKEN_DOCUMENT = [
  '@setup { prefix: "ui"; }',
  "@variables { gap: 8px; }",
  ".card {",
  '  content: "$gap";',
  "  padding: $gap;",
  "  &:global(.gap) { margin: $gap; }",
  '  background: url("$gap.png");',
  "}",
].join("\n");

describe("definition and references", () => {
  test("local tokens jump to their @variables declaration", async () => {
    const { state } = await analyze(TOKEN_DOCUMENT);
    const offset = TOKEN_DOCUMENT.indexOf("padding: $gap") + "padding: $".length;
    const targets = definitionsAt(TOKEN_DOCUMENT, offset, { analysis: state.analysis });
    expect(targets).toHaveLength(1);
    const declarationOffset = TOKEN_DOCUMENT.indexOf("@variables { gap") + "@variables { ".length;
    const target = targets[0];
    if (target === undefined) throw new Error("expected a definition target");
    expect(rangeToOffsets(state.analysis, target.range)).toEqual({
      start: declarationOffset,
      end: declarationOffset + "$gap".length - 1,
    });
  });

  test("namespace members jump into the imported module", async () => {
    const text = readFileSync(join(ROOT, CANONICAL), "utf8");
    const { state } = await analyze(text, CANONICAL);
    const offset = text.indexOf("$theme.primary") + 1;
    const targets = definitionsAt(text, offset, { analysis: state.analysis });
    expect(targets[0]?.file.endsWith("theme.cssx")).toBe(true);
    expect(targets[0]?.name).toBe("primary");
  });

  test("references return the declaration and every value usage", async () => {
    const { state } = await analyze(TOKEN_DOCUMENT);
    const offset = TOKEN_DOCUMENT.indexOf("padding: $gap") + "padding: $".length;
    const targets = referencesAt(TOKEN_DOCUMENT, offset, { analysis: state.analysis });
    expect(targets).toHaveLength(3);
    const offsets = targets.map((target) => rangeToOffsets(state.analysis, target.range).start);
    expect(new Set(offsets).size).toBe(3);
    expect(
      offsets.every(
        (start) =>
          TOKEN_DOCUMENT.startsWith("$gap", start) || TOKEN_DOCUMENT.startsWith("gap", start),
      ),
    ).toBe(true);
  });

  test("the cursor on a class or a string has no token target", async () => {
    const { state } = await analyze(TOKEN_DOCUMENT);
    const classOffset = TOKEN_DOCUMENT.indexOf(".gap") + 1;
    expect(tokenAt(TOKEN_DOCUMENT, classOffset, state.analysis)).toBeUndefined();
    const stringOffset = TOKEN_DOCUMENT.indexOf('"$gap"') + 2;
    expect(tokenAt(TOKEN_DOCUMENT, stringOffset, state.analysis)).toBeUndefined();
  });
});

describe("token rename", () => {
  test("renames the declaration and usages but never strings, urls or :global classes", async () => {
    const { state } = await analyze(TOKEN_DOCUMENT);
    const offset = TOKEN_DOCUMENT.indexOf("padding: $gap") + "padding: $".length;
    const plan = renameAt(TOKEN_DOCUMENT, offset, "space", { analysis: state.analysis });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const declarationOffset = TOKEN_DOCUMENT.indexOf("@variables { gap") + "@variables { ".length;
    const edits = plan.edits.map((edit) => ({
      ...rangeToOffsets(state.analysis, edit.range),
      newText: edit.newText,
    }));
    expect(edits).toHaveLength(3);
    expect(edits.map((edit) => edit.newText)).toEqual(["space", "$space", "$space"]);
    expect(edits.map((edit) => edit.start).sort((left, right) => left - right)).toEqual(
      [
        declarationOffset,
        TOKEN_DOCUMENT.indexOf("padding: $gap") + "padding: ".length,
        TOKEN_DOCUMENT.indexOf("margin: $gap") + "margin: ".length,
      ].sort((left, right) => left - right),
    );

    // No edit overlaps the authored string, the url() content or the global class.
    const untouched = [
      { start: TOKEN_DOCUMENT.indexOf('"$gap"'), end: TOKEN_DOCUMENT.indexOf('"$gap"') + 7 },
      { start: TOKEN_DOCUMENT.indexOf("$gap.png"), end: TOKEN_DOCUMENT.indexOf("$gap.png") + 4 },
      { start: TOKEN_DOCUMENT.indexOf(".gap"), end: TOKEN_DOCUMENT.indexOf(".gap") + 4 },
    ];
    for (const edit of edits) {
      for (const range of untouched) {
        expect(edit.start >= range.end || edit.end <= range.start).toBe(true);
      }
    }
  });

  test("refuses cross-module member rename with guidance", async () => {
    const text = readFileSync(join(ROOT, CANONICAL), "utf8");
    const { state } = await analyze(text, CANONICAL);
    const plan = renameAt(text, text.indexOf("$theme.primary") + 1, "accent", {
      analysis: state.analysis,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain("Cross-module rename");
  });

  test("refuses class rename and invalid token names", async () => {
    const { state } = await analyze(TOKEN_DOCUMENT);
    const classPlan = renameAt(TOKEN_DOCUMENT, TOKEN_DOCUMENT.indexOf(".gap") + 1, "other", {
      analysis: state.analysis,
    });
    expect(classPlan.ok).toBe(false);

    const offset = TOKEN_DOCUMENT.indexOf("padding: $gap") + "padding: $".length;
    const invalid = renameAt(TOKEN_DOCUMENT, offset, "1bad", { analysis: state.analysis });
    expect(invalid.ok).toBe(false);
  });

  test("runtime tokens rename their custom-property declaration and usages", async () => {
    const text = [
      '@setup { prefix: "ui"; }',
      "@runtime { primary: #2563eb; }",
      ".card { color: $primary; }",
    ].join("\n");
    const { state } = await analyze(text);
    const plan = renameAt(text, text.indexOf("color: $primary") + "color: $".length, "brand", {
      analysis: state.analysis,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.edits.map((edit) => edit.newText)).toEqual(["brand", "$brand"]);
  });
});
