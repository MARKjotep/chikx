/**
 * TT5 row 3 — type inference from the generated declarations.
 *
 * | Assertion | How |
 * |---|---|
 * | literal class-name keys infer | a consumer that imports the generated map declares `map["card-one"]` and the camelCase export as `"ui-card-one"` literals and typechecks clean |
 * | a wrong key still errors | `@ts-expect-error` on `map["card-three"]` produces tsc exit 0; the same file **without** the directive is a red run (the directive is genuinely consumed, not unused) |
 * | the value is a literal, not `string` | assigning `map["card-one"]` to `"ui-card-two"` is an error, so a stray `@ts-expect-error` there is consumed |
 * | the mechanism cannot pass vacuously | a stray `@ts-expect-error` on a **correct** key leaves an unused directive (`TS2578`) and tsc fails |
 *
 * `tsc` is the repository's own TypeScript binary run as a subprocess under the newest
 * installed Node runtime (falling back to Bun when no Node is installed); the consumer
 * files are written into the generated project so the import path is the real one a
 * consumer writes: `./dist/maps/src/card.map.js` → `card.map.d.ts`.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "../corpus.ts";
import { cleanupTempProjects, createTempProject, writeProjectFiles } from "../scale/generate.ts";
import {
  type ProcessOutcome,
  TSC_ENTRY,
  ensureDistBuild,
  expectStatus,
  generatedProject,
  runProcess,
  runtimeMatrix,
} from "./helpers.ts";

/** Project root of the built consumer project. */
let root = "";
/** Binary that runs `tsc`. */
let tscBinary = "";
/** Human-readable runtime label for failure messages. */
let tscRuntime = "";
/** Path of the generated map module, relative to {@link root}. */
const MAP_MODULE = "./dist/maps/src/card.map.js";

/** Baseline: literals infer from both the named exports and the default map. */
const CONSUMER_CLEAN = `import map, { cardOne, cardTwo } from ${JSON.stringify(MAP_MODULE)};

// Named exports are literal types, not \`string\`.
const namedLiteral: "ui-card-one" = cardOne;
const secondLiteral: "ui-card-two" = cardTwo;
// Keys are literal class names and their values are the emitted literal.
const keyedLiteral: "ui-card-one" = map["card-one"];
const camelLiteral: "ui-card-two" = map.cardTwo;
// A map lookup is assignable to the wide type as well.
const wide: string = map["card-one"];

export { namedLiteral, secondLiteral, keyedLiteral, camelLiteral, wide };
`;

/** Wrong key with the expectation that it errors. */
const CONSUMER_WRONG_KEY = `import map from ${JSON.stringify(MAP_MODULE)};

// @ts-expect-error - "card-three" is not a class in this stylesheet
const wrongKey: string = map["card-three"];

export { wrongKey };
`;

/** Wrong literal with the expectation that it errors: proves the value type is literal. */
const CONSUMER_WRONG_LITERAL = `import map from ${JSON.stringify(MAP_MODULE)};

// @ts-expect-error - the map value is the literal "ui-card-one", not an arbitrary string
const wrongLiteral: "ui-card-two" = map["card-one"];

export { wrongLiteral };
`;

/** Control: the same wrong key without the directive must fail. */
const CONTROL_WRONG_KEY = `import map from ${JSON.stringify(MAP_MODULE)};

const wrongKey: string = map["card-three"];

export { wrongKey };
`;

/** Control: a stray directive on a correct key must fail with TS2578. */
const CONTROL_UNUSED_DIRECTIVE = `import map from ${JSON.stringify(MAP_MODULE)};

// @ts-expect-error - nothing is wrong with this key
const fine: string = map["card-one"];

export { fine };
`;

/** Run `tsc --noEmit` over the given consumer files. */
function typecheck(files: readonly string[]): ProcessOutcome {
  const args = [
    TSC_ENTRY,
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "ESNext",
    "--moduleResolution",
    "Bundler",
    ...files,
  ];
  return runProcess(tscBinary, args, { cwd: root, timeoutMs: 180_000 });
}

/** Label that names the exact consumer file and compiler when a case goes red. */
function label(file: string): string {
  return `${tscRuntime} tsc --noEmit ${file}`;
}

beforeAll(async () => {
  await ensureDistBuild();
  const matrix = runtimeMatrix();
  const node = matrix.rows.find(
    (row) => row.engine === "node" && row.status === "verified",
  )?.runtime;
  const bun = matrix.rows.find((row) => row.engine === "bun" && row.status === "verified")?.runtime;
  tscBinary = node?.binary ?? bun?.binary ?? "bun";
  tscRuntime = node === undefined ? `bun ${bun?.version ?? "?"}` : `node ${node.version}`;
  root = createTempProject(generatedProject({ importCss: false, sourceMap: false }).files);
  // The declarations under test are generated artifacts, so build with the built CLI first.
  const cliEntry = join(REPO_ROOT, "packages", "cli", "dist", "index.js");
  const buildOutcome = runProcess(tscBinary, [cliEntry, "build"], { cwd: root });
  expectStatus(`${tscRuntime} chikx build (${root})`, buildOutcome, 0);
  expect(existsSync(join(root, "dist", "maps", "src", "card.map.d.ts"))).toBe(true);
  writeProjectFiles(root, {
    "consumer.ts": CONSUMER_CLEAN,
    "wrong-key.ts": CONSUMER_WRONG_KEY,
    "wrong-literal.ts": CONSUMER_WRONG_LITERAL,
    "control-wrong-key.ts": CONTROL_WRONG_KEY,
    "control-unused-directive.ts": CONTROL_UNUSED_DIRECTIVE,
  });
});

afterAll(() => {
  cleanupTempProjects();
});

describe("type inference from the generated declarations", () => {
  test("the generated declarations pin literal class names", () => {
    const declarations = readFileSync(join(root, "dist", "maps", "src", "card.map.d.ts"), "utf8");
    expect(declarations).toContain('export declare const cardOne: "ui-card-one";');
    expect(declarations).toContain('readonly "card-one": "ui-card-one"');
    expect(declarations).toContain('readonly "card-two": "ui-card-two"');
    expect(tscBinary.startsWith("/")).toBe(true);
  });

  test("literal keys and exports infer in a plain consumer", () => {
    const outcome = typecheck(["consumer.ts"]);
    expectStatus(label("consumer.ts"), outcome, 0);
    expect(outcome.status).toBe(0);
  });

  test("a wrong key still errors under @ts-expect-error", () => {
    const expected = typecheck(["wrong-key.ts"]);
    const control = typecheck(["control-wrong-key.ts"]);
    // The directive is consumed: with it tsc is clean, without it tsc is red.
    expectStatus(label("wrong-key.ts"), expected, 0);
    expect(expected.status).toBe(0);
    expect(control.status).not.toBe(0);
    expect(control.stdout + control.stderr).toContain("card-three");
    expect(control.stdout + control.stderr).toMatch(/TS7053|TS2339/u);
  });

  test("the map value is a literal, so a wrong literal is an error too", () => {
    const expected = typecheck(["wrong-literal.ts"]);
    expectStatus(label("wrong-literal.ts"), expected, 0);
    expect(expected.status).toBe(0);
  });

  test("a stray @ts-expect-error on a correct key fails with TS2578", () => {
    const control = typecheck(["control-unused-directive.ts"]);
    expectStatus(label("control-unused-directive.ts"), control, 2);
    expect(control.stdout + control.stderr).toContain("TS2578");
  });
});
