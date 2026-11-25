import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { emitCss } from "../../packages/compiler/src/emitter/index.ts";
import { format } from "../../packages/compiler/src/formatter/index.ts";
import { parse } from "../../packages/compiler/src/index.ts";
import { groupRuns, lower } from "../../packages/compiler/src/lowering/index.ts";
import { renameClasses } from "../../packages/compiler/src/naming/index.ts";
import { flattenIr } from "../../packages/compiler/src/selectors/index.ts";
import type { Stylesheet } from "../../packages/compiler/src/types/ast.ts";

/**
 * Canonical formatter contract: idempotence on every fixture, deterministic
 * directive/conditional/nested layout, comment preservation, safe error
 * fallback, and compilation invariance (formatting never changes CSS output).
 */

const fixturesRoot = join(import.meta.dir, "..", "fixtures");

function collectFixtures(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (existsSync(join(path, "input.cssx"))) {
      found.push(path);
      continue;
    }
    found.push(...collectFixtures(path));
  }
  return found;
}

function setupPrefix(ast: Stylesheet): string {
  let prefix = "";
  for (const item of ast.items) {
    if (item.kind !== "setup") continue;
    for (const setting of item.settings) {
      if (setting.key !== "prefix") continue;
      const raw = setting.value.trim();
      prefix = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    }
  }
  return prefix;
}

interface Compiled {
  readonly css: string;
  readonly diagnostics: readonly string[];
}

function compileCss(source: string, file: string): Compiled {
  const parsed = parse(source, { file });
  const lowered = lower(parsed.ast, { file });
  const renamed = renameClasses(lowered.ir, { prefix: setupPrefix(parsed.ast) });
  const grouped = groupRuns(renamed.ir, "safe");
  const flattened = flattenIr(grouped);
  const emitted = emitCss(flattened.ir, { minify: false });
  return {
    css: emitted.css,
    diagnostics: [...parsed.diagnostics, ...lowered.diagnostics, ...emitted.diagnostics].map(
      (diagnostic) => diagnostic.code,
    ),
  };
}

const fixtures = collectFixtures(fixturesRoot)
  .sort()
  .map((directory) => {
    const id = relative(fixturesRoot, directory).split(sep).join("/");
    return { id, source: readFileSync(join(directory, "input.cssx"), "utf8") };
  });

describe("formatter idempotence", () => {
  test("format(format(x)) equals format(x) for every fixture input", () => {
    expect(fixtures).toHaveLength(54);
    for (const fixture of fixtures) {
      const file = `${fixture.id}/input.cssx`;
      const once = format(fixture.source, file);
      const twice = format(once.formatted, file);
      expect({ id: fixture.id, formatted: twice.formatted }).toEqual({
        id: fixture.id,
        formatted: once.formatted,
      });
    }
  });

  test("parse errors leave the original source byte-identical", () => {
    const source = "@md {\n  .card { padding: 20px; }\n}\n";
    const result = format(source, "src/invalid.cssx");
    expect(result.diagnostics.some((diagnostic) => diagnostic.severity === "error")).toBe(true);
    expect(result.formatted).toBe(source);
  });

  test("canonical output ends with exactly one newline", () => {
    const result = format(".a { color: red; }\n\n\n", "src/a.cssx");
    expect(result.formatted).toBe(".a {\n  color: red;\n}\n");
    expect(format("", "src/empty.cssx").formatted).toBe("");
  });
});

describe("canonical layout", () => {
  test("directives, declarations, variants, nesting and conditions", () => {
    const source = [
      '@setup { prefix: "ui"; css-dir: "../styles"; }',
      '@use "./theme.cssx" as theme;',
      "@variables { spacing: 12px; }",
      "@runtime { --brand: #2563eb; }",
      "@media-types { compact: (max-width: 500px); }",
      ".button {",
      "display:flex;",
      "padding: 12px @md 20px @xl 32px;",
      "margin: 10px !important @md 20px;",
      "&:hover { opacity: 0.85; }",
      "@xl { display: block; }",
      "}",
      "",
    ].join("\n");

    const result = format(source, "src/button.cssx");
    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(
      [
        "@setup {",
        '  prefix: "ui";',
        '  css-dir: "../styles";',
        "}",
        "",
        '@use "./theme.cssx" as theme;',
        "",
        "@variables {",
        "  spacing: 12px;",
        "}",
        "",
        "@runtime {",
        "  --brand: #2563eb;",
        "}",
        "",
        "@media-types {",
        "  compact: (max-width: 500px);",
        "}",
        "",
        ".button {",
        "  display: flex;",
        "  padding: 12px @md 20px @xl 32px;",
        "  margin: 10px !important @md 20px;",
        "",
        "  &:hover {",
        "    opacity: 0.85;",
        "  }",
        "",
        "  @xl {",
        "    display: block;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("@use … styles keeps the rule-merge clause (and a literal `styles` alias stays an alias)", () => {
    // Regression for CSSX-A22/A24: `printUse` used to drop `UseImport.styles`,
    // silently downgrading a rule-merge import to a token-only one (ADR-0014).
    const source = [
      '@use "./x.cssx" as m styles;',
      '@use "./x.cssx" styles;',
      '@use "./x.cssx" as styles;',
      ".button { color: red; }",
      "",
    ].join("\n");

    const result = format(source, "src/imports.cssx");
    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(
      [
        '@use "./x.cssx" as m styles;',
        "",
        '@use "./x.cssx" styles;',
        "",
        '@use "./x.cssx" as styles;',
        "",
        ".button {",
        "  color: red;",
        "}",
        "",
      ].join("\n"),
    );
    expect(format(result.formatted, "src/imports.cssx").formatted).toBe(result.formatted);
  });

  test("comments in native preludes are not duplicated and block comments survive", () => {
    const source = [
      "@media screen /* prelude */ {",
      "  /* inside */",
      "  .a { color: red; /* value */ }",
      "}",
      "",
    ].join("\n");
    const result = format(source, "src/native.cssx");
    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(
      [
        "@media screen /* prelude */ {",
        "  /* inside */",
        "  .a {",
        "    color: red;",
        "    /* value */",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(result.formatted.split("/* prelude */")).toHaveLength(2);
    expect(result.formatted.split("/* inside */")).toHaveLength(2);
  });

  test("comments stay on their own lines and are never duplicated", () => {
    const source = [
      "/* header */",
      ".button {",
      "  /* before */",
      "  color: red; /* trailing */",
      '  content: "/* not a comment */";',
      "}",
      "/* footer */",
      "",
    ].join("\n");

    const result = format(source, "src/comments.cssx");
    expect(result.diagnostics).toEqual([]);
    expect(result.formatted).toBe(
      [
        "/* header */",
        ".button {",
        "  /* before */",
        "  color: red;",
        "  /* trailing */",
        '  content: "/* not a comment */";',
        "}",
        "",
        "/* footer */",
        "",
      ].join("\n"),
    );
    expect(result.formatted.split("/* header */")).toHaveLength(2);
    expect(result.formatted).toContain('"/* not a comment */"');
  });
});

describe("compilation invariance", () => {
  const representative = [
    "lexical/calc",
    "media/inline-variants",
    "media/block-conditions",
    "nesting/descendant-bare",
    "important/per-segment",
    "media/combined-and",
  ];

  test("formatting representative fixtures keeps CSS and diagnostics identical", () => {
    for (const id of representative) {
      const fixture = fixtures.find((candidate) => candidate.id === id);
      expect(fixture).toBeDefined();
      if (fixture === undefined) continue;
      const file = `${id}/input.cssx`;
      const formatted = format(fixture.source, file);
      expect({ id, diagnostics: formatted.diagnostics }).toEqual({ id, diagnostics: [] });

      const before = compileCss(fixture.source, file);
      const after = compileCss(formatted.formatted, file);
      expect({ id, css: after.css, diagnostics: after.diagnostics }).toEqual({
        id,
        css: before.css,
        diagnostics: before.diagnostics,
      });
    }
  });
});
