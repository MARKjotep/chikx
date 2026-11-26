# CSSX-F21 — opt-in class-map CSS import (`import-css`) + build-on-demand docs

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** compiler map generation,
output settings, editor setup-key completion, docs (incl. Code Runner guide), tests
**Packages:** `@chikx/compiler`, `@chikx/cli`, `@chikx/vscode`

## Summary

- `@setup { import-css: true; }` / `output.importCss` (default `false`) makes the generated
  `map.js` start with exactly one `import "<stylesheet>";` for bundler-driven consumers. The default
  keeps the CSSX-A52 import-free map byte-identical and plain-Node importable.
- The specifier is computed from the planned **map file** to the planned **stylesheet**, POSIX
  separators, `./`-prefixed when in or below the map directory (`../` when above). With a `css-dir`
  list the **first listed destination** is canonical.
- No stylesheet in the plan (`emit-css: false`, or `module: true` without a restored `emit-css`)
  means no import — a map never points at a missing artifact. `.d.ts` stays pure declarations.
- Precedence follows the existing chain: defaults < project config (`output.importCss`) < file
  `@setup`. The editor offers `import-css` as a setup key with `true`/`false` values.
- `docs/usage.md` gains the explicit owner-requested **build on demand (no watcher)** section:
  `chikx.compileOnSave` limits and the Code Runner `chikx` executor setup (pre-publish forms and
  `"$fullFileName"` quoting), plus native `chikx.compileFile`/`chikx.buildProject` keybindings.

## Objective

Implement board item 21 exactly as decided:

1. Boolean `import-css` setup key and `output.importCss` pair, default `false`.
2. Map generation prepends one relative side-effect import naming the planned stylesheet; first
   `css-dir` destination for lists; suppressed when no CSS is planned.
3. Compiler → CLI (`config.ts`, `setup.ts`, `compiler-api.d.ts`) wiring and editor completion.
4. ADR-0021, configuration/usage/SPEC/CHANGELOG docs, the Code Runner section, task/report/board.

## Relevant files

- `packages/compiler/src/index.ts` (setup key tables, decode/assign, `definedOutput`, map options)
- `packages/compiler/src/types/options.ts` (`OutputOptions.importCss`, `ResolvedSetup`)
- `packages/compiler/src/output/resolve.ts` (`OUTPUT_DEFAULTS.importCss`, `defaultSetupFor`)
- `packages/compiler/src/output/import-path.ts` (new: `stylesheetImportSpecifier`)
- `packages/compiler/src/naming/mapgen.ts` (`ClassMapOptions.cssImport`), `naming/index.ts`
- `packages/cli/src/{config,setup,compiler-api.d}.ts`
- `packages/vscode/src/intelligence.ts`, `packages/vscode/test/ui/completions.js`
- `tests/compiler/import-css.test.ts`, `tests/integration/cli-import-css.test.ts`,
  `tests/extension/provider.intelligence.test.ts`
- `docs/decisions/ADR-0021-opt-in-css-import.md`, `docs/configuration.md`, `docs/usage.md`,
  `SPECIFICATION.md`, `CHANGELOG.md`
- `.ai/tasks/CSSX-F21.md`, `.ai/reports/CSSX-F21.md`, `.ai/todo.md`

## Dependency state

PP0–PP2 🟢; F18 🟢 (1248 pass / 92 files); F20 🟢 (1259 pass / 93 files) with the boolean-key
template (`SETUP_KEYS`, `BOOLEAN_SETUP_KEYS`, `assignBooleanSetting`, `definedOutput`,
`defaultSetupFor`) in place, plus the `map-inherit` completion. No git commands; the uncommitted tree
is preserved.

## Constraints

- Failing repro first; no assertion weakening.
- Default-off map output byte-identical; existing map goldens must not move.
- Import specifiers deterministic, POSIX and derived from the validated plan.
- Gates sequential: `bun run verify`, `bun run release:check`, `bun run lint`.

## Acceptance criteria

1. `import-css: true` emits exactly one side-effect import at the top with the correct relative path;
   `css-dir` list → first destination; `emit-css: false` → no import; `.d.ts` unchanged.
2. Default `false` → map goldens byte-identical; config pair + file precedence work.
3. Editor completion offers `import-css` (host expectation updated, suite green).
4. `docs/usage.md` contains the build-on-demand / Code Runner section; ADR-0021, configuration, SPEC
   and CHANGELOG updated; task/report/board persisted (item 21 🟢).
5. `bun run verify`, `bun run release:check` and `bun run lint` pass.

## Validation

```sh
bun test tests/compiler/import-css.test.ts tests/integration/cli-import-css.test.ts \
  tests/extension/provider.intelligence.test.ts
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-F21.md`
- `.ai/todo.md` item 21
- `docs/decisions/ADR-0021-opt-in-css-import.md`
