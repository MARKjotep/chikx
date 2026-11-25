# CSSX-A13 — VS Code providers, commands and extension host (P6)

## Summary

- Implement the language providers in `packages/vscode/src/`: diagnostics (tolerant compiler parse, debounced, stale-version discard), completions (properties, values, media aliases, `$variables` + namespace members, setup keys, import paths, selectors/pseudos), hover (resolved token value, condition expression, generated class), definition + references for `$tokens`, single-file token rename, color provider, outline.
- Implement the commands from the spec: Compile File, Build Project, Preview Compiled CSS (in-memory, never writes), Open Generated CSS, Open Class Map, Check Project; status bar, output channel, compile-on-save OFF by default, workspace-trust respect, multi-root nearest-config.
- Make the extension loadable in the Node extension host (tsc build to `out/`) and add extension-host smoke tests via `@vscode/test-electron` (graceful fallback if the environment cannot run them).

## Objective

Complete the VS Code interface to the same compiler used by the CLI. Persist this task as
`.ai/tasks/CSSX-A13.md` and results as `.ai/reports/CSSX-A13.md`.

## Dependencies

- A12 grammar, language configuration and manifest contributes (read-only).
- A02–A11 compiler public barrel (`parse`, `compile`, `compileProject`, `planOutputs`,
  `createNodeHost`) — imports through `packages/compiler/src/index.ts` only.
- SPECIFICATION.md §3.5 / §8 / §10; `.ai/CSSX-MASTERPLAN.md` §8; ADR-0008.

## Allowed files (exclusive ownership)

- `packages/vscode/**` (`src/**`, `package.json` scripts/devDeps, `tsconfig`, `out/` gitignored)
- `tests/extension/provider*.test.ts`, `tests/extension/host*.test.ts` (new; do NOT modify A12's
  `grammar*.test.ts` files)
- `.ai/tasks/CSSX-A13.md`, `.ai/reports/CSSX-A13.md`, `.ai/reports/logs/CSSX-A13.log`

Not touched: compiler/cli packages, root configs, fixtures, grammar JSON, `.ai/PROGRESS.md`,
`tests/integration/**` (watch-test stabilization in progress).

## Architecture

- `src/analysis.ts` — pure document analysis over `{ text, path, version }`: tolerant `parse()`,
  optional `compile()`, line index, offset→position mapping, diagnostics, media alias table
  (built-ins + project config + file `@media-types`), token symbols (`$name`, `$ns.member`), setup
  settings, selector classes with generated names, hex colors. No `vscode` import.
- `src/intelligence.ts` — pure completion/hover/definition/references/rename/symbol/color logic over
  the same inputs. No `vscode` import, so `bun test` exercises it directly.
- `src/service.ts` — debounced analysis cache (150 ms, injectable timers) with stale-version discard.
- `src/config.ts`, `src/glob.ts`, `src/output.ts` — nearest `chikx.config.json`, project entry
  discovery, output planning through `planOutputs` plus temp-file atomic writes.
- `src/providers/*.ts` — thin VS Code adapters mapping the pure results to VS Code types.
- `src/controller.ts` — commands, status bar, output channel, trust, compile-on-save (off by
  default), preview content provider, multi-root nearest config.
- `src/extension.ts` — activation entry (`activate`/`deactivate`).

Build: `tsc` to `packages/vscode/out/` as CommonJS for the Node extension host. The compiler is
imported through its relative source barrel (`../../compiler/src/index.js`) for development; the
compiler sources are compiled into `out/compiler/` by the same project. `main` is `out/extension.js`
(a generated two-line shim that re-exports `out/vscode/src/extension.js`). A15/bundling may switch to
the workspace dependency.

## Requirements

1. Architecture and debounce/stale discard as above.
2. Providers: diagnostics (workspace collection, dirty buffers, never throws), completion
   (context-aware, triggers `@`, `$`, `.`, `:`, `/`), hover, definition/references/rename (token
   scope, parser spans, no regex), color, outline.
3. Commands + UI per §8: six commands, status bar success/error/stale with click-to-build, `Chikx`
   output channel, settings `chikx.compileOnSave` (false) and `chikx.previewSplitEditor`, trust
   gating for writes/automatic builds, multi-root nearest config, version-guarded cancellation.
4. Loadable via `tsc`; scripts `build`, `watch`, `typecheck`; devDeps `@types/vscode`,
   `@vscode/test-electron`, `@types/node`.
5. Tests: `tests/extension/provider*.test.ts` (no vscode module) covering diagnostics
   codes/positions on the canonical fixture, alias completion incl. `@2xl`, token hover values,
   rename avoiding strings and `:global`, and `tests/extension/host*.test.ts` best-effort
   extension-host smoke (activation, grammar registration, command presence, diagnostics on a broken
   document) with an honest documented skip when VS Code cannot run.
6. `bun run verify` exit 0 (root typecheck script is not editable; the extension typecheck runs as
   its own command and is reported).

## Constraints

- Public compiler barrel only; zero new runtime dependencies; deterministic tests (injectable
  timers, no fixed sleeps); A12 grammar untouched; no `.ai/PROGRESS.md` edits.

## Acceptance criteria

1. `bun run verify` exit 0; provider unit tests pass; extension-host tests pass or documented skip.
2. All §8 providers/commands implemented; compile-on-save off by default; trust respected.
3. Extension activates against the compiler's public API (no deep imports).
4. Report lists created files, decisions (incl. the css-languageservice deferral), evidence and
   blockers.

## Validation commands

```sh
bun test tests/extension
bun run --cwd packages/vscode typecheck
bun run --cwd packages/vscode build
bun run verify
```
