import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../../packages/compiler/src/index.ts";
import type { StylesheetIr } from "../../packages/compiler/src/ir/types.ts";
import { lower } from "../../packages/compiler/src/lowering/index.ts";
import { generateClassMap, renameClasses } from "../../packages/compiler/src/naming/index.ts";
import type { ClassTable } from "../../packages/compiler/src/naming/types.ts";
import type { Stylesheet } from "../../packages/compiler/src/types/ast.ts";

/**
 * JS class-map and declaration generation tests (SPECIFICATION.md §8,
 * masterplan §3.6, ADR-0010), plus the map/d.ts goldens for class-bearing
 * fixtures.
 *
 * The pipeline here is `parse → lower → renameClasses → generateClassMap`.
 * Substitution is not needed because class selectors do not contain `$`
 * references, and the CSS import path is supplied explicitly (A10 owns the
 * output planner that computes it).
 */

const FIXTURES = join(import.meta.dir, "..", "fixtures");

function irFor(source: string, file = "input.cssx"): StylesheetIr {
  const parsed = parse(source, { file });
  return lower(parsed.ast, { file }).ir;
}

function tableFor(source: string, prefix = "ui"): ClassTable {
  return renameClasses(irFor(source), { prefix }).classes;
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

/** Evaluate the generated ESM body as a plain module object (no imports). */
function evaluate(js: string): Record<string, unknown> {
  const body = js
    .replace(/^import .*;\n/m, "")
    .replace(/^export const /gm, "const ")
    .replace(/^export default /m, "return ");
  return new Function(body)() as Record<string, unknown>;
}

function jsNamedExports(js: string): string[] {
  return [...js.matchAll(/^export const (\S+) =/gm)].map((match) => match[1] ?? "");
}

function typeNamedExports(types: string): string[] {
  return [...types.matchAll(/^export declare const (\S+):/gm)].map((match) => match[1] ?? "");
}

describe("mapgen: canonical shape", () => {
  test("canonical/button matches the §2 class map and declaration shape", () => {
    const table = tableFor(
      readFileSync(join(FIXTURES, "canonical", "button", "input.cssx"), "utf8"),
      "ui",
    );
    const result = generateClassMap(table, { cssImport: "../styles/button.css" });

    expect(result.diagnostics).toEqual([]);
    expect(result.js).toBe(
      [
        'import "../styles/button.css";',
        'export const button = "ui-button";',
        'export const icon = "ui-icon";',
        "export default { button, icon };",
        "",
      ].join("\n"),
    );
    expect(result.types).toBe(
      [
        'export declare const button: "ui-button";',
        'export declare const icon: "ui-icon";',
        'declare const map: { readonly button: "ui-button"; readonly icon: "ui-icon" };',
        "export default map;",
        "",
      ].join("\n"),
    );
  });

  test("the CSS import line is emitted only for a string specifier", () => {
    const table = tableFor(".card { color: red; }");
    expect(generateClassMap(table, { cssImport: null }).js.startsWith("export const")).toBe(true);
    expect(generateClassMap(table).js.startsWith("export const")).toBe(true);
    expect(
      generateClassMap(table, { cssImport: "./x.css" }).js.startsWith('import "./x.css";\n'),
    ).toBe(true);
  });

  test("an empty table exports an empty object and a never-record declaration", () => {
    const result = generateClassMap({ entries: [] });
    expect(result.js).toBe("export default {};\n");
    expect(result.types).toBe("declare const map: Record<string, never>;\nexport default map;\n");
    expect(result.diagnostics).toEqual([]);
  });
});

describe("mapgen: aliases and strict policies", () => {
  test("camelCase aliases appear as named exports and as extra default keys", () => {
    const result = generateClassMap(tableFor(".button-primary { color: red; }"));
    expect(result.js).toBe(
      [
        'export const buttonPrimary = "ui-button-primary";',
        'export default { "button-primary": buttonPrimary, buttonPrimary };',
        "",
      ].join("\n"),
    );
    expect(result.types).toContain(
      [
        "declare const map: {",
        '  readonly "button-primary": "ui-button-primary";',
        '  readonly buttonPrimary: "ui-button-primary";',
        "};",
      ].join("\n"),
    );
    expect(result.diagnostics).toEqual([]);
  });

  test("a camelCase collision is CHIKX4001, omits both named exports and keeps original keys", () => {
    const result = generateClassMap(tableFor(".foo-bar { color: red; } .fooBar { color: blue; }"));

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe("CHIKX4001");
    expect(result.diagnostics[0]?.severity).toBe("error");
    expect(result.diagnostics[0]?.message).toContain('"fooBar"');
    expect(result.js).toBe('export default { "foo-bar": "ui-foo-bar", fooBar: "ui-fooBar" };\n');
    expect(result.types).toBe(
      'declare const map: { readonly "foo-bar": "ui-foo-bar"; readonly fooBar: "ui-fooBar" };\nexport default map;\n',
    );
    expect(jsNamedExports(result.js)).toEqual([]);
  });

  test("reserved and digit-leading aliases warn and stay reachable through keys", () => {
    const source =
      ".default { color: red; } .delete { color: blue; } .button { color: green; } " +
      ".\\32 col { color: black; }";
    const result = generateClassMap(tableFor(source));

    expect(result.diagnostics).toHaveLength(3);
    expect(result.diagnostics.every((entry) => entry.code === "CHIKX4001")).toBe(true);
    expect(result.diagnostics.every((entry) => entry.severity === "warning")).toBe(true);
    expect(result.js).toBe(
      [
        'export const button = "ui-button";',
        'export default { default: "ui-default", delete: "ui-delete", button, "2col": "ui-2col" };',
        "",
      ].join("\n"),
    );
    expect(result.types).toContain('readonly default: "ui-default";');
    expect(jsNamedExports(result.js)).toEqual(["button"]);
  });

  test("__proto__ is emitted with a computed key and evaluates safely", () => {
    const result = generateClassMap(tableFor(".__proto__ { color: red; }"));

    expect(result.js).toContain('export const __proto__ = "ui-__proto__";');
    expect(result.js).toContain('export default { ["__proto__"]: __proto__ };');
    const module = evaluate(result.js);
    expect(Object.getPrototypeOf(module)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(module, "__proto__")).toBe(true);
    expect(Object.getOwnPropertyDescriptor(module, "__proto__")?.value).toBe("ui-__proto__");
  });

  test("global classes are never exported", () => {
    const source = readFileSync(join(FIXTURES, "global", "escape", "input.cssx"), "utf8");
    const result = generateClassMap(renameClasses(irFor(source), { prefix: "ui" }).classes, {
      cssImport: null,
    });

    expect(result.js).not.toContain("external-icon");
    expect(result.types).not.toContain("external-icon");
    expect(jsNamedExports(result.js)).toEqual(["icon", "card"]);
  });
});

describe("mapgen: declarations and determinism", () => {
  test("the declaration file exports exactly the JS named exports and uses no any", () => {
    const result = generateClassMap(
      tableFor(".card-header { color: red; } .icon { color: blue; } .default { color: green; }"),
    );

    expect(typeNamedExports(result.types)).toEqual(jsNamedExports(result.js));
    expect(result.types).not.toContain("any");
    expect(result.types).toContain("readonly");
    expect(result.types).toContain('"ui-card-header"');
  });

  test("output is byte-identical across runs", () => {
    const table = tableFor(".a-b { color: red; } .c { color: blue; } .default { color: green; }");
    const first = generateClassMap(table, { cssImport: "./x.css" });
    const second = generateClassMap(table, { cssImport: "./x.css" });

    expect(second.js).toBe(first.js);
    expect(second.types).toBe(first.types);
    expect(second.diagnostics).toEqual(first.diagnostics);
  });
});

interface MapGolden {
  readonly group: string;
  readonly name: string;
  readonly cssImport: string | null;
  readonly diagnostics: readonly string[];
}

const MAP_GOLDENS: readonly MapGolden[] = [
  {
    group: "canonical",
    name: "button",
    cssImport: "../styles/button.css",
    diagnostics: [],
  },
  { group: "global", name: "escape", cssImport: null, diagnostics: [] },
  { group: "naming", name: "prefix", cssImport: null, diagnostics: [] },
  { group: "naming", name: "empty-prefix", cssImport: null, diagnostics: [] },
  { group: "naming", name: "camel-collision", cssImport: null, diagnostics: ["CHIKX4001"] },
  {
    group: "naming",
    name: "reserved-js-identifier",
    cssImport: null,
    diagnostics: ["CHIKX4001", "CHIKX4001"],
  },
];

describe("mapgen: fixture goldens", () => {
  for (const golden of MAP_GOLDENS) {
    test(`${golden.group}/${golden.name} matches expected/map.js and map.d.ts`, () => {
      const directory = join(FIXTURES, golden.group, golden.name);
      const parsed = parse(readFileSync(join(directory, "input.cssx"), "utf8"), {
        file: `${golden.group}/${golden.name}/input.cssx`,
      });
      const ir = lower(parsed.ast, { file: `${golden.group}/${golden.name}/input.cssx` }).ir;
      const renamed = renameClasses(ir, { prefix: setupPrefix(parsed.ast) });
      const result = generateClassMap(renamed.classes, { cssImport: golden.cssImport });

      expect(result.diagnostics.map((entry) => entry.code)).toEqual(golden.diagnostics);
      expect(result.js).toBe(readFileSync(join(directory, "expected", "map.js"), "utf8"));
      expect(result.types).toBe(readFileSync(join(directory, "expected", "map.d.ts"), "utf8"));
    });
  }
});
