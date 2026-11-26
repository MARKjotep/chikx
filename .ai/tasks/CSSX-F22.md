# CSSX-F22 — minified output by default

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** output defaults,
default-output goldens, all committed example CSS, docs/ADR, full gates
**Packages:** `@chikx/compiler`, `@chikx/cli`, `@chikx/vscode`

## Summary

- Flip `minify` / `output.minify` from `false` to `true` in the compiler's resolved setup, the CLI's
  file-setup defaults and the editor's output defaults. `--no-minify`, `@setup { minify: false }`
  and project `output.minify: false` remain the expanded-output opt-outs.
- Minification affects emitted CSS only. `format()`, class-map generation and `.d.ts` declarations
  keep their bytes; source maps keep the same v3 generation rules and describe the emitted positions.
- Regenerate every fixture golden that asserts default output, keep explicit `minify: false` pretty
  goldens untouched, and rebuild all eight committed example stylesheets through their own
  `chikx.config.json` twice (byte-identical).
- ADR-0022, docs, CHANGELOG, task/report and board item 22.

## Objective

1. Default minified output for `compile()`, `compileProject()`, CLI project/single-file builds, watch
   and editor Compile File / compile-on-save / Preview.
2. Preserve the precedence chain: defaults < project config < file `@setup` < CLI flags; last minify
   flag wins.
3. Update expectations only where they assert default output. Do not change tests that explicitly pass
   `minify: false`, formatter output expectations, class-map/`.d.ts` goldens or pretty-vs-minified
   browser parity.
4. Rebuild the eight examples and prove deterministic output.
5. Record the contract change in ADR-0022 and all user-facing docs.

## Relevant files

- `packages/compiler/src/output/resolve.ts`, `packages/compiler/src/types/options.ts`
- `packages/cli/src/setup.ts`
- `packages/vscode/src/output.ts`, `packages/vscode/src/intelligence.ts`
- `tests/fixtures/**/expected/{css,minified}`, `tests/compiler/**`, `tests/integration/**`,
  `tests/stress/**`, `packages/vscode/test/ui/**`
- `examples/*/generated/styles/*.css`
- `docs/decisions/ADR-0022-minified-output-default.md`, `README.md`, `docs/configuration.md`,
  `docs/usage.md`, `SPECIFICATION.md`, `CHANGELOG.md`
- `biome.json` (exclude intentionally minified generated example CSS)
- `.ai/tasks/CSSX-F22.md`, `.ai/reports/CSSX-F22.md`, `.ai/todo.md`

## Dependency state

PP0–PP2 🟢; F18/F20/F21/F23 🟢. Baseline: `verify` 1283 pass / 2 skip / 0 fail across 95 files; host
14 scenarios / 866 assertions; release:check green (eight examples, browser 96/96, VSIX 18 files). No
git commands; the uncommitted tree is preserved.

## Constraints

- No test deletion or skipped tests.
- No assertion weakening; explicit pretty/opt-out pins keep their original bytes.
- Gates sequential: `bun run verify`, `bun run release:check`, `bun run lint`; preserve exit codes.
- Example sources untouched; rebuilds byte-identical.

## Acceptance criteria

1. Default output is minified across compiler API, CLI project/single-file builds and editor paths;
   `--no-minify` / `minify: false` produce the previous expanded bytes.
2. Formatter, class-map/`.d.ts` and source-map behavior are unchanged.
3. All eight example stylesheets are minified and byte-identical on rebuild; `release:check` green.
4. Docs/ADR-0022/CHANGELOG/task/report/board updated.
5. `bun run verify`, `bun run release:check` and `bun run lint` pass.

## Validation

```sh
bun run verify
bun run release:check
bun run lint
for name in basic responsive variables jsx custom-output overrides groups portfolio; do
  node packages/cli/dist/index.js build --config examples/$name/chikx.config.json
done
```

## See also

- `.ai/reports/CSSX-F22.md`
- `.ai/todo.md` item 22
- `docs/decisions/ADR-0022-minified-output-default.md`
