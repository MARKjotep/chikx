# CSSX-F18 — `css-dir` value lists

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** compiler output planning,
CLI setup/writer/manifest/watch/clean, docs, tests
**Packages:** `@chikx/compiler` (setup decoding, planner), `@chikx/cli` (setup precedence, manifest,
clean, watch)

## Summary

- A file-level `css-dir` may author a comma-separated list (`css-dir: "../client", "../src";`).
  Every listed in-workspace directory receives the same stylesheet (same `css-name`), and
  `source-map: true` writes one source map beside each destination.
- Single authored paths keep the current single-value behaviour byte-for-byte. A list is an
  explicit exception to the §3.2 single-scalar rule, scoped to `css-dir` only (ADR-0019).
- Each item resolves exactly like today's single `css-dir` — relative to the source file, no project
  mirroring — and the list replaces project `output.cssDir` for that file. `map-dir`/`map-name`
  and config-level `output.cssDir` stay single-valued.
- Empty or duplicate items are `CHIKX2001` with a span inside the authored value; external
  destinations remain `CHIKX5001` per item. One manifest record per destination keeps `clean`,
  the interrupted-write `.cssx-tmp` sweep and watch/NDJSON reporting complete.

## Objective

Implement board item 18 without weakening the existing output-planning contracts:

1. `@setup` decoding splits `css-dir` on top-level commas (quoted commas stay literal), decodes each
   item as a scalar, and reports empty/duplicate items with CHIKX2001 and item spans.
2. `ResolvedSetup.cssDirs` carries the file list; the planner resolves every item exactly and emits
   one CSS candidate per directory (plus one source map per directory when enabled). A CLI
   `cssDir` override replaces the list.
3. CLI setup decoding mirrors the list for planning; manifest/clean/watch already operate on planned
   paths, so they pick up every destination without special cases.
4. Docs, SPECIFICATION, ADR-0019 and CHANGELOG describe the actual behaviour; task/report/board
   records persist the outcome.

## Relevant files

- `packages/compiler/src/setup-list.ts` (new decoder), `src/index.ts` (setup decode + export),
  `src/types/ast.ts` (`Setting.valueSpan`), `src/parser/statements.ts`, `src/types/options.ts`
  (`ResolvedSetup.cssDirs`), `src/output/resolve.ts`, `src/output/index.ts`
- `packages/cli/src/setup.ts`, `src/compiler-api.d.ts`
- `tests/compiler/output-list.test.ts`, `tests/compiler/setup-css-list.test.ts`,
  `tests/integration/cli-css-list.test.ts`, `tests/integration/cli-watch.test.ts`
- `SPECIFICATION.md`, `docs/configuration.md`, `docs/usage.md`,
  `docs/decisions/ADR-0019-setup-output-lists.md`, `CHANGELOG.md`

## Acceptance criteria

1. `css-dir: "../client", "../src";` writes the stylesheet (and a source map per destination when
   enabled) to both directories; single-value inputs stay byte-identical.
2. Duplicate/empty items are CHIKX2001 with spans inside the value; external items are CHIKX5001.
3. Manifest records every destination; `clean` removes all; the temp sweep covers each output
   directory; watch and `--json`/NDJSON report every written path.
4. `map-dir` and project `output.cssDir` remain single-valued.
5. `bun run verify`, `bun run release:check` and `bun run lint` pass.

## Validation

```sh
bun test tests/compiler/output-list.test.ts tests/compiler/setup-css-list.test.ts \
  tests/integration/cli-css-list.test.ts tests/integration/cli-watch.test.ts
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-F18.md`
- `.ai/todo.md` item 18
- `docs/decisions/ADR-0019-setup-output-lists.md`
