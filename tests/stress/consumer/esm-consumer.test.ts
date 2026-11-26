/**
 * TT5 row 2 — ESM consumers of the generated class map.
 *
 * | Assertion | How |
 * |---|---|
 * | plain ESM import under `node --input-type=module` | the `import-css: false` map is imported with a static `import` and its literal exports compared against the compiled class table |
 * | the same import under Bun | identical static import executed by the Bun binary |
 * | the default (`import-css: true`) map on Node | pinned: Node refuses the emitted `.css` import without a loader (`ERR_UNKNOWN_FILE_EXTENSION`); with a hand-written CSS stub hook the same module imports and matches — the documented consumer requirement, not a defect |
 * | generated `.d.ts` travels with the map | the declaration file exists beside the map, declares the same literals, and the map's stylesheet specifier resolves to the written CSS file |
 * | bundler case | `esbuild` / `vite` are not dependencies of this repository, so the row is recorded as **not run — tool not present** (no installation permitted) |
 *
 * Every artifact assertion derives from {@link generatedProject}, not from the emitted
 * text itself, so the map is checked against the authored class names.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "../corpus.ts";
import { cleanupTempProjects, createTempProject, writeProjectFiles } from "../scale/generate.ts";
import {
  type GeneratedProject,
  bundlerStatus,
  createConsumerInstall,
  ensureDistBuild,
  expectStatus,
  generatedProject,
  runProcess,
  runtimeMatrix,
} from "./helpers.ts";

/** camelCase alias the compiler adds when it is unambiguous (`panel-head` → `panelHead`). */
function camelCase(name: string): string {
  return name.replace(/-([a-z0-9])/gu, (_match, letter: string) => letter.toUpperCase());
}

/** Hand-written CSS stub hook: the consumer-side requirement of a plain Node import. */
const CSS_HOOKS = `export function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    return { url: new URL(specifier, context.parentURL).href, format: "module", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
export function load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "", shortCircuit: true };
  return nextLoad(url, context);
}
`;

/** Registers {@link CSS_HOOKS} on the Node versions that have either hook API, then imports. */
const NODE_IMPORT_WITH_HOOKS = `import module from "node:module";
if (typeof module.registerHooks === "function") {
  const hooks = await import("./css-hooks.mjs");
  module.registerHooks({ resolve: hooks.resolve, load: hooks.load });
} else {
  module.register("./css-hooks.mjs", import.meta.url);
}
const imported = await import(process.env.CHIKX_MAP_MODULE);
const named = Object.fromEntries(Object.entries(imported).filter(([key]) => key !== "default"));
process.stdout.write(JSON.stringify({ default: imported.default, named }));
`;

/** One built consumer project. */
interface BuiltConsumer {
  readonly project: GeneratedProject;
  readonly root: string;
}

const matrix = runtimeMatrix();
const nodeRuntime = matrix.rows.find(
  (row) => row.engine === "node" && row.status === "verified",
)?.runtime;
const bunRuntime = matrix.rows.find(
  (row) => row.engine === "bun" && row.status === "verified",
)?.runtime;
const cliRuntime = nodeRuntime ?? bunRuntime;

let installRoot = "";

/** Build one project with the **built** CLI under a real Node runtime. */
function buildWithCli(project: GeneratedProject): BuiltConsumer {
  const root = createTempProject(project.files);
  const entry = join(REPO_ROOT, "packages", "cli", "dist", "index.js");
  const outcome = runProcess(cliRuntime?.binary ?? "bun", [entry, "build"], { cwd: root });
  expect({ status: outcome.status, stderr: outcome.stderr }).toEqual({ status: 0, stderr: "" });
  for (const relative of [
    ...Object.values(project.mapModules),
    ...Object.values(project.declarations),
    ...Object.values(project.stylesheets),
  ]) {
    expect({ artifact: relative, exists: existsSync(join(root, relative)) }).toEqual({
      artifact: relative,
      exists: true,
    });
  }
  return { project, root };
}

let plain: BuiltConsumer;
let withCss: BuiltConsumer;

beforeAll(async () => {
  await ensureDistBuild();
  const install = createConsumerInstall();
  installRoot = install.root;
  writeProjectFiles(installRoot, {
    "css-hooks.mjs": CSS_HOOKS,
    "node-import-css.mjs": NODE_IMPORT_WITH_HOOKS,
  });
  plain = buildWithCli(generatedProject({ importCss: false, sourceMap: false }));
  withCss = buildWithCli(generatedProject({ importCss: true, sourceMap: true }));
});

afterAll(() => {
  cleanupTempProjects();
});

describe("ESM consumers of the generated class map", () => {
  test("generated artifacts match the authored class table", () => {
    // Guard against a fixture drift that would make the import cases vacuous.
    expect(plain.project.classes).toEqual({
      "panel-head": "ui-panel-head",
      "panel-body": "ui-panel-body",
      "card-one": "ui-card-one",
      "card-two": "ui-card-two",
    });
    expect(cliRuntime).toBeDefined();
    expect(installRoot).not.toBe("");
  });

  test("plain ESM import of the import-css:false map under node --input-type=module", () => {
    if (nodeRuntime === undefined) {
      // Recorded unverified in the runtime matrix; never silently skipped as passed.
      expect(matrix.rows.some((row) => row.engine === "node" && row.status === "unverified")).toBe(
        true,
      );
      return;
    }
    const modulePath = join(plain.root, plain.project.mapModules["src/panel.cssx"] ?? "");
    const code = `import map, { panelHead, panelBody } from ${JSON.stringify(
      pathToFileURL(modulePath).href,
    )};
process.stdout.write(JSON.stringify({ default: map, named: { panelHead, panelBody } }));`;
    const outcome = runProcess(nodeRuntime.binary, ["--input-type=module", "-e", code], {
      cwd: plain.root,
    });
    expectStatus(`node ${nodeRuntime.version} --input-type=module -e <static import>`, outcome, 0);
    expect(outcome.stderr).toBe("");
    expect(JSON.parse(outcome.stdout)).toEqual({
      default: {
        "panel-head": "ui-panel-head",
        panelHead: "ui-panel-head",
        "panel-body": "ui-panel-body",
        panelBody: "ui-panel-body",
      },
      named: { panelHead: "ui-panel-head", panelBody: "ui-panel-body" },
    });
  });

  test("plain ESM import of the import-css:false map under Bun", () => {
    if (bunRuntime === undefined) {
      expect(matrix.rows.find((row) => row.engine === "bun")?.reason ?? "").not.toBe("");
      return;
    }
    const modulePath = join(plain.root, plain.project.mapModules["src/panel.cssx"] ?? "");
    const code = `import map, { panelHead, panelBody } from ${JSON.stringify(
      pathToFileURL(modulePath).href,
    )};
process.stdout.write(JSON.stringify({ default: map, named: { panelHead, panelBody } }));`;
    const outcome = runProcess(bunRuntime.binary, ["--input-type=module", "-e", code], {
      cwd: plain.root,
    });
    expectStatus(`bun ${bunRuntime.version} --input-type=module -e <static import>`, outcome, 0);
    expect(outcome.stderr).toBe("");
    expect(JSON.parse(outcome.stdout)).toEqual({
      default: {
        "panel-head": "ui-panel-head",
        panelHead: "ui-panel-head",
        "panel-body": "ui-panel-body",
        panelBody: "ui-panel-body",
      },
      named: { panelHead: "ui-panel-head", panelBody: "ui-panel-body" },
    });
  });

  test("Node rejects the import-css:true map without a loader, and imports it with one", () => {
    if (nodeRuntime === undefined) return;
    const modulePath = join(withCss.root, withCss.project.mapModules["src/card.cssx"] ?? "");
    const plainOutcome = runProcess(
      nodeRuntime.binary,
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(pathToFileURL(modulePath).href)});`,
      ],
      { cwd: withCss.root },
    );
    // Pinned consumer requirement: a `.css` import is not executable by Node alone.
    expect({
      documented: "node refuses the emitted stylesheet import",
      status: plainOutcome.status,
      mentionsCss: /ERR_UNKNOWN_FILE_EXTENSION/u.test(plainOutcome.stderr),
      mentionsStylesheet: plainOutcome.stderr.includes(join("dist", "styles", "src", "card.css")),
    }).toEqual({
      documented: "node refuses the emitted stylesheet import",
      status: 1,
      mentionsCss: true,
      mentionsStylesheet: true,
    });

    const outcome = runProcess(nodeRuntime.binary, ["node-import-css.mjs"], {
      cwd: installRoot,
      env: { CHIKX_MAP_MODULE: pathToFileURL(modulePath).href },
    });
    expectStatus(`node ${nodeRuntime.version} node-import-css.mjs`, outcome, 0);
    expect(outcome.stderr).toBe("");
    expect(JSON.parse(outcome.stdout)).toEqual({
      default: {
        "card-one": "ui-card-one",
        cardOne: "ui-card-one",
        "card-two": "ui-card-two",
        cardTwo: "ui-card-two",
      },
      named: { cardOne: "ui-card-one", cardTwo: "ui-card-two" },
    });
  });

  test("Bun imports the import-css:true map with no loader", () => {
    if (bunRuntime === undefined) return;
    const modulePath = join(withCss.root, withCss.project.mapModules["src/card.cssx"] ?? "");
    const code = `const imported = await import(${JSON.stringify(pathToFileURL(modulePath).href)});
const named = Object.fromEntries(Object.entries(imported).filter(([key]) => key !== "default"));
process.stdout.write(JSON.stringify({ default: imported.default, named }));`;
    const outcome = runProcess(bunRuntime.binary, ["--input-type=module", "-e", code], {
      cwd: withCss.root,
    });
    expectStatus(`bun ${bunRuntime.version} --input-type=module -e <dynamic import>`, outcome, 0);
    expect(outcome.stderr).toBe("");
    expect(JSON.parse(outcome.stdout)).toEqual({
      default: {
        "card-one": "ui-card-one",
        cardOne: "ui-card-one",
        "card-two": "ui-card-two",
        cardTwo: "ui-card-two",
      },
      named: { cardOne: "ui-card-one", cardTwo: "ui-card-two" },
    });
  });

  test("the map's stylesheet specifier resolves to the written CSS and the .d.ts matches", () => {
    const mapPath = join(withCss.root, withCss.project.mapModules["src/card.cssx"] ?? "");
    const mapText = readFileSync(mapPath, "utf8");
    const stylesheetSpecifier = /^import "([^"]+)";$/mu.exec(mapText)?.[1] ?? "";
    expect(stylesheetSpecifier).not.toBe("");
    expect(resolve(join(mapPath, ".."), stylesheetSpecifier)).toBe(
      join(withCss.root, withCss.project.stylesheets["src/card.cssx"] ?? ""),
    );

    // The import-css:false map must stay dependency-free.
    const plainText = readFileSync(
      join(plain.root, plain.project.mapModules["src/panel.cssx"] ?? ""),
      "utf8",
    );
    expect(plainText).not.toContain(".css");

    // Declarations ship beside the map and declare the same literals.
    const declarations = readFileSync(
      join(withCss.root, withCss.project.declarations["src/card.cssx"] ?? ""),
      "utf8",
    );
    for (const name of ["card-one", "card-two"]) {
      const emitted = withCss.project.classes[name] ?? "";
      expect(mapText).toContain(`"${emitted}"`);
      expect(declarations).toContain(`"${name}": "${emitted}"`);
      // The camelCase alias is declared unquoted, like the JS named export.
      expect(declarations).toContain(`${camelCase(name)}: "${emitted}"`);
    }
    expect(declarations).toContain('export declare const cardOne: "ui-card-one";');
  });

  test("bundler row is recorded as not run — the tools are not dependencies", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    };
    for (const tool of ["esbuild", "vite"] as const) {
      const status = bundlerStatus(tool);
      // The recorded row and the manifest agree: the tool is genuinely absent.
      expect({ tool, declared: Object.hasOwn(declared, tool), present: status.present }).toEqual({
        tool,
        declared: false,
        present: false,
      });
      expect(status.reason).toContain("not present");
      expect(status.present ? status.reason : "not run — tool not present").toBe(
        "not run — tool not present",
      );
    }
  });
});
