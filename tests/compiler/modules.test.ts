import { describe, expect, test } from "bun:test";
import { join, posix } from "node:path";
import { decodeFileSetup, resolveEffectiveSetup } from "../../packages/cli/src/setup.ts";
import { compileProject, createNodeHost, parse } from "../../packages/compiler/src/index.ts";
import { buildModuleGraph, styleModuleOrder } from "../../packages/compiler/src/resolver/index.ts";
import type { UseImport } from "../../packages/compiler/src/types/ast.ts";
import type { CompileOptions, ModuleHost } from "../../packages/compiler/src/types/options.ts";

/**
 * Stylesheet-modularization tests (ADR-0014, owner decision 2026-11-25).
 *
 * Three layers are covered here:
 *
 * 1. the `styles` clause in the parser (`@use "..." [as alias] [styles];`);
 * 2. resolver modes — `ModuleRecord.styleDependencies`, rule-bearing edges and
 *    merged-build emission order (`styleModuleOrder`), including cycles;
 * 3. the `compile`/`compileProject` pipeline — per-module lowering and prefix,
 *    imported-first IR order, merged class tables, `module: true` suppression and
 *    runtime tokens flowing into the consuming build.
 *
 * Fixture-driven cases use `tests/fixtures/modules/merge/**` through the real
 * Node host; behavioural edge cases use an in-memory host so no files are
 * written or read.
 */

const WORKSPACE = "/workspace";
const FIXTURES = join(import.meta.dir, "..", "fixtures", "modules", "merge");

function createHost(files: Readonly<Record<string, string>>, root = WORKSPACE): ModuleHost {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path: string): Promise<string> {
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async fileExists(path: string): Promise<boolean> {
      return map.has(path);
    },
    canonicalize(path: string): string {
      return path;
    },
    resolvePath(from: string, to: string): string {
      return posix.resolve(posix.dirname(from), to);
    },
    workspaceRoot(): string {
      return root;
    },
  };
}

const OPTIONS: CompileOptions = { file: "modules.test" };

function uses(source: string): UseImport[] {
  return parse(source, { file: "src/x.cssx" }).ast.items.filter(
    (item): item is UseImport => item.kind === "use",
  );
}

function compileFixture(name: string, entries: readonly string[] = ["entry.cssx"]) {
  const directory = join(FIXTURES, name);
  return compileProject([...entries], createNodeHost(directory), { projectRoot: directory });
}

function diagnosticCodes(diagnostics: readonly { readonly code: string }[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe("`styles` clause parsing (ADR-0014)", () => {
  test("a plain @use has no styles marker", () => {
    const [item] = uses('@use "./theme.cssx";');
    expect(item).toBeDefined();
    expect(item?.styles).toBeUndefined();
    expect(item?.alias).toBeUndefined();
    expect(item?.path).toBe("./theme.cssx");
  });

  test("the styles clause sets styles: true", () => {
    const [item] = uses('@use "./card.cssx" styles;');
    expect(item?.styles).toBe(true);
    expect(item?.alias).toBeUndefined();
  });

  test("the styles clause follows the alias clause", () => {
    const [item] = uses('@use "./card.cssx" as card styles;');
    expect(item?.alias).toBe("card");
    expect(item?.styles).toBe(true);
    expect(item?.span.start).toBe(0);
    expect(item?.span.file).toBe("src/x.cssx");
  });

  test("`styles` as an alias name is still an alias", () => {
    const [item] = uses('@use "./card.cssx" as styles;');
    expect(item?.alias).toBe("styles");
    expect(item?.styles).toBeUndefined();
  });

  test("a missing semicolon after the clause keeps the marker and reports CHIKX1001", () => {
    const parsed = parse('@use "./card.cssx" styles\n.a { color: red; }', {
      file: "src/x.cssx",
    });
    const [item] = parsed.ast.items.filter((entry): entry is UseImport => entry.kind === "use");
    expect(item?.styles).toBe(true);
    expect(diagnosticCodes(parsed.diagnostics)).toContain("CHIKX1001");
  });
});

describe("resolver style edges", () => {
  const FILES: Record<string, string> = {
    [`${WORKSPACE}/src/entry.cssx`]:
      '@use "./tokens.cssx";\n@use "./card.cssx" styles;\n.page { color: red; }\n',
    [`${WORKSPACE}/src/tokens.cssx`]: "@variables { gap: 4px; }\n",
    [`${WORKSPACE}/src/card.cssx`]: ".card { padding: 8px; }\n",
  };

  test("styleDependencies records only rule-bearing edges, in authored order", async () => {
    const host = createHost(FILES);
    const graph = await buildModuleGraph([`${WORKSPACE}/src/entry.cssx`], host, OPTIONS);
    const entry = graph.modules.get(`${WORKSPACE}/src/entry.cssx`);
    expect(entry?.dependencies).toEqual([
      `${WORKSPACE}/src/tokens.cssx`,
      `${WORKSPACE}/src/card.cssx`,
    ]);
    expect(entry?.styleDependencies).toEqual([`${WORKSPACE}/src/card.cssx`]);
    expect(graph.modules.get(`${WORKSPACE}/src/tokens.cssx`)?.styleDependencies).toEqual([]);
    expect(styleModuleOrder(graph, `${WORKSPACE}/src/entry.cssx`)).toEqual([
      `${WORKSPACE}/src/card.cssx`,
    ]);
  });

  test("a repeated styles import merges once", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@use "./card.cssx" styles;\n@use "./card.cssx" styles;\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: ".card { padding: 8px; }\n",
    });
    const graph = await buildModuleGraph([`${WORKSPACE}/src/entry.cssx`], host, OPTIONS);
    expect(graph.modules.get(`${WORKSPACE}/src/entry.cssx`)?.styleDependencies).toEqual([
      `${WORKSPACE}/src/card.cssx`,
    ]);
    expect(styleModuleOrder(graph, `${WORKSPACE}/src/entry.cssx`)).toEqual([
      `${WORKSPACE}/src/card.cssx`,
    ]);
  });

  test("a diamond merges the shared module once, after its own style imports", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@use "./a.cssx" styles;\n@use "./b.cssx" styles;\n.root { color: red; }\n',
      [`${WORKSPACE}/src/a.cssx`]: '@use "./c.cssx" styles;\n.a { color: red; }\n',
      [`${WORKSPACE}/src/b.cssx`]: '@use "./c.cssx" styles;\n.b { color: red; }\n',
      [`${WORKSPACE}/src/c.cssx`]: ".c { color: red; }\n",
    });
    const graph = await buildModuleGraph([`${WORKSPACE}/src/entry.cssx`], host, OPTIONS);
    expect(styleModuleOrder(graph, `${WORKSPACE}/src/entry.cssx`)).toEqual([
      `${WORKSPACE}/src/c.cssx`,
      `${WORKSPACE}/src/a.cssx`,
      `${WORKSPACE}/src/b.cssx`,
    ]);
  });

  test("a style-import cycle is CHIKX2001 and the walk terminates deterministically", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]: '@use "./a.cssx" styles;\n.root { color: red; }\n',
      [`${WORKSPACE}/src/a.cssx`]: '@use "./b.cssx" styles;\n.a { color: red; }\n',
      [`${WORKSPACE}/src/b.cssx`]: '@use "./a.cssx" styles;\n.b { color: red; }\n',
    });
    const graph = await buildModuleGraph([`${WORKSPACE}/src/entry.cssx`], host, OPTIONS);
    expect(diagnosticCodes(graph.diagnostics)).toEqual(["CHIKX2001"]);
    expect(graph.diagnostics[0]?.message).toContain("Import cycle detected");
    expect(styleModuleOrder(graph, `${WORKSPACE}/src/entry.cssx`)).toEqual([
      `${WORKSPACE}/src/b.cssx`,
      `${WORKSPACE}/src/a.cssx`,
    ]);
  });

  test("a self styles import is a cycle and never includes the entry", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]: '@use "./entry.cssx" styles;\n.root { color: red; }\n',
    });
    const graph = await buildModuleGraph([`${WORKSPACE}/src/entry.cssx`], host, OPTIONS);
    expect(diagnosticCodes(graph.diagnostics)).toEqual(["CHIKX2001"]);
    expect(styleModuleOrder(graph, `${WORKSPACE}/src/entry.cssx`)).toEqual([]);
  });
});

describe("rule-merge compilation", () => {
  test("merged CSS puts imported modules first and keeps each module's own prefix", async () => {
    const results = await compileFixture("prefix-independence");
    const entry = results["entry.cssx"];
    expect(entry).toBeDefined();
    if (entry === undefined) return;

    expect(diagnosticCodes(entry.diagnostics)).toEqual([]);
    expect(entry.css).toBe(
      [
        ".ui-panel {",
        "  border-radius: 8px;",
        "}",
        "",
        ".ui-tile {",
        "  color: red;",
        "}",
        "",
        ".admin-page {",
        "  padding: 16px;",
        "}",
        "",
      ].join("\n"),
    );
    expect({ ...entry.classes }).toEqual({
      panel: "ui-panel",
      tile: "ui-tile",
      page: "admin-page",
    });
  });

  test("chain imports merge depth-first: deepest module first, entry last", async () => {
    const results = await compileFixture("chain");
    const entry = results["entry.cssx"];
    if (entry === undefined) throw new Error("missing chain entry result");

    const order = [".c-charlie", ".b-bravo", ".app-root"].map((selector) =>
      entry.css?.indexOf(selector),
    );
    expect(order[0]).toBeGreaterThanOrEqual(0);
    expect(order[0]).toBeLessThan(order[1] ?? -1);
    expect(order[1]).toBeLessThan(order[2] ?? -1);
    expect({ ...entry.classes }).toEqual({
      charlie: "c-charlie",
      bravo: "b-bravo",
      root: "app-root",
    });
  });

  test("tokens and rules merge through one styles import, runtime tokens included", async () => {
    const results = await compileFixture("tokens-plus-rules");
    const entry = results["entry.cssx"];
    if (entry === undefined) throw new Error("missing tokens-plus-rules entry result");

    expect(diagnosticCodes(entry.diagnostics)).toEqual([]);
    expect(entry.css).toContain("--app-primary: #2563eb;");
    expect(entry.css).toContain("@media (prefers-color-scheme: dark)");
    expect(entry.css).toContain("--app-primary: #60a5fa;");
    expect(entry.css).toContain("padding: 10px;");
    expect(entry.css).toContain("color: var(--app-primary);");
    expect(entry.css).toContain("margin: 10px;");
    expect({ ...entry.classes }).toEqual({ card: "ui-card", page: "app-page" });
  });

  test("the styles clause is opt-in: a token-only import contributes no rules", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "app"; }\n@use "./card.cssx";\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: '@setup { prefix: "ui"; }\n.card { color: blue; }\n',
    });
    const results = await compileProject(["src/entry.cssx"], host, {
      projectRoot: WORKSPACE,
    });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing token-only entry result");
    expect(entry.css).toBe(".app-page {\n  color: red;\n}\n");
    expect({ ...entry.classes }).toEqual({ page: "app-page" });
  });

  test("the importing prefix never applies to merged rules and vice versa", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "admin"; }\n@use "./card.cssx" styles;\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: ".card { color: blue; }\n",
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing prefix entry result");
    expect(entry.css).toBe(".card {\n  color: blue;\n}\n\n.admin-page {\n  color: red;\n}\n");
    expect({ ...entry.classes }).toEqual({ card: "card", page: "admin-page" });
  });

  test("naming strategy none disables merging prefixes as well", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "admin"; }\n@use "./card.cssx" styles;\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: '@setup { prefix: "ui"; }\n.card { color: blue; }\n',
    });
    const results = await compileProject(["src/entry.cssx"], host, {
      projectRoot: WORKSPACE,
      naming: { strategy: "none" },
    });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing strategy-none result");
    expect(entry.css).toBe(".card {\n  color: blue;\n}\n\n.page {\n  color: red;\n}\n");
  });

  test("merged builds keep source maps for every contributing module", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "app"; source-map: true; }\n@use "./card.cssx" styles;\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: '@setup { prefix: "ui"; }\n.card { color: blue; }\n',
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing merged source map result");
    expect(diagnosticCodes(entry.diagnostics)).toEqual([]);
    const map = JSON.parse(entry.sourceMap ?? "{}") as {
      file?: string;
      sources?: string[];
      sourcesContent?: (string | null)[];
    };
    expect(map.file).toBe("entry.css");
    expect(map.sources).toEqual(["src/card.cssx", "src/entry.cssx"]);
    expect(map.sourcesContent?.every((content) => typeof content === "string")).toBe(true);
    expect(entry.css?.endsWith("/*# sourceMappingURL=entry.css.map */\n")).toBe(true);
  });

  test("a style module's setup diagnostics are reported by the consuming build", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]: '@use "./card.cssx" styles;\n.page { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: "@setup { bogus: 1; }\n.card { color: blue; }\n",
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing module-setup result");
    expect(diagnosticCodes(entry.diagnostics)).toEqual(["CHIKX1001"]);
    expect(entry.diagnostics[0]?.message).toContain('"bogus"');
  });
});

describe("module: true (ADR-0014)", () => {
  test("the module's own build emits no CSS, map or types", async () => {
    const results = await compileFixture("module-flag", ["module.cssx"]);
    const module = results["module.cssx"];
    if (module === undefined) throw new Error("missing module result");
    expect(diagnosticCodes(module.diagnostics)).toEqual([]);
    expect(module.css).toBeUndefined();
    expect(module.js).toBeUndefined();
    expect(module.types).toBeUndefined();
    expect({ ...module.classes }).toEqual({ card: "ui-card" });
  });

  test("an explicitly authored emit key wins over module: true", async () => {
    const results = await compileFixture("module-flag", ["explicit.cssx"]);
    const explicit = results["explicit.cssx"];
    if (explicit === undefined) throw new Error("missing explicit module result");
    expect(diagnosticCodes(explicit.diagnostics)).toEqual([]);
    expect(explicit.css).toBe(".ui-card {\n  padding: 8px;\n}\n");
    // emit-map and emit-types were not authored, so they stay suppressed.
    expect(explicit.js).toBeUndefined();
    expect(explicit.types).toBeUndefined();
  });

  test("the importing build is unaffected by the module's emit flags", async () => {
    const results = await compileFixture("module-flag");
    const entry = results["entry.cssx"];
    if (entry === undefined) throw new Error("missing module-flag entry result");
    expect(diagnosticCodes(entry.diagnostics)).toEqual([]);
    expect(entry.css).toBe(".ui-card {\n  padding: 8px;\n}\n\n.app-page {\n  display: block;\n}\n");
    expect(entry.js).toContain('export const card = "ui-card";');
  });

  test("module: false keeps the default artifacts", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]: "@setup { module: false; }\n.page { color: red; }\n",
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing module:false result");
    expect(entry.css).toBe(".page {\n  color: red;\n}\n");
    expect(entry.js).toBeDefined();
    expect(entry.types).toBeDefined();
  });

  test("module: true does not make the CSS import requirement fail", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/module.cssx`]: "@setup { module: true; }\n.card { color: red; }\n",
    });
    const results = await compileProject(["src/module.cssx"], host, { projectRoot: WORKSPACE });
    const module = results["src/module.cssx"];
    if (module === undefined) throw new Error("missing suppressed module result");
    expect(diagnosticCodes(module.diagnostics)).toEqual([]);
  });

  test("the CLI resolves the same suppression, with authored keys winning", () => {
    const suppressed = decodeFileSetup(
      parse("@setup { module: true; } .card { color: red; }", { file: "card.cssx" }).ast,
    );
    expect(suppressed.module).toBe(true);
    const setup = resolveEffectiveSetup("card.cssx", null, suppressed, undefined);
    expect(setup.emitCss).toBe(false);
    expect(setup.emitMap).toBe(false);
    expect(setup.emitTypes).toBe(false);
    expect(setup.importCss).toBe(false);

    const explicit = decodeFileSetup(
      parse("@setup { module: true; emit-map: true; } .card { color: red; }", {
        file: "card.cssx",
      }).ast,
    );
    const restored = resolveEffectiveSetup("card.cssx", null, explicit, undefined);
    expect(restored.emitMap).toBe(true);
    expect(restored.emitCss).toBe(false);
  });
});

describe("merged class tables and exports", () => {
  test("one merged map covers every module plus the entry", async () => {
    const results = await compileFixture("basic");
    const entry = results["entry.cssx"];
    if (entry === undefined) throw new Error("missing basic entry result");
    expect(entry.js).toBe(
      [
        'import "./entry.css";',
        'export const card = "card-card";',
        'export const page = "app-page";',
        "export default { card, page };",
        "",
      ].join("\n"),
    );
    expect(entry.types).toContain('export declare const card: "card-card";');
  });

  test("identical names unify and different emitted names are CHIKX4001", async () => {
    const results = await compileFixture("collision");
    const entry = results["entry.cssx"];
    if (entry === undefined) throw new Error("missing collision entry result");

    const collisions = entry.diagnostics.filter((diagnostic) => diagnostic.code === "CHIKX4001");
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.severity).toBe("error");
    expect(collisions[0]?.message).toContain('"ui-shared"');
    expect(collisions[0]?.message).toContain('"shared"');
    // Strict recovery keeps the first result, so the map stays deterministic.
    expect({ ...entry.classes }).toEqual({
      shared: "ui-shared",
      solo: "ui-solo",
      page: "app-page",
    });
    // Both `.shared` module rules still emit their authored declarations.
    expect(entry.css?.match(/\.ui-shared \{/g)).toHaveLength(2);
    expect(entry.css).toContain(".shared {");
  });

  test("camelCase alias collisions across modules are CHIKX4001 and keep quoted keys", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "app"; }\n@use "./card.cssx" styles;\n.fooBar { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: '@setup { prefix: "ui"; }\n.foo-bar { color: blue; }\n',
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing alias-collision result");

    expect(diagnosticCodes(entry.diagnostics)).toEqual(["CHIKX4001"]);
    expect(entry.js).toContain('"foo-bar": "ui-foo-bar"');
    expect(entry.js).toContain('fooBar: "app-fooBar"');
    expect(entry.js).not.toContain("export const fooBar");
  });

  test("a global class in a module and a local class of the same name do not conflict", async () => {
    const host = createHost({
      [`${WORKSPACE}/src/entry.cssx`]:
        '@setup { prefix: "app"; }\n@use "./card.cssx" styles;\n.card { color: red; }\n',
      [`${WORKSPACE}/src/card.cssx`]: ":global(.card) { color: blue; }\n",
    });
    const results = await compileProject(["src/entry.cssx"], host, { projectRoot: WORKSPACE });
    const entry = results["src/entry.cssx"];
    if (entry === undefined) throw new Error("missing global/local result");
    expect(diagnosticCodes(entry.diagnostics)).toEqual([]);
    expect({ ...entry.classes }).toEqual({ card: "app-card" });
    expect(entry.css).toContain(".card {");
    expect(entry.css).toContain(".app-card {");
  });

  test("merged builds are deterministic across runs", async () => {
    const first = await compileFixture("tokens-plus-rules");
    const second = await compileFixture("tokens-plus-rules");
    const left = first["entry.cssx"];
    const right = second["entry.cssx"];
    expect(left?.css).toBe(right?.css);
    expect(left?.js).toBe(right?.js);
    expect(left?.types).toBe(right?.types);
    expect(diagnosticCodes(left?.diagnostics ?? [])).toEqual(
      diagnosticCodes(right?.diagnostics ?? []),
    );
  });
});
