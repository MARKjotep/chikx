# CSSX-A15A — Phase 7: CSS source maps + canonical formatter

## Summary

- Implement CSS source maps (standard v3, in-house VLQ encoder, declaration-level origin mappings) in
  the emitter behind `source-map: true`, with the `/*# sourceMappingURL=… */` comment pointing at the
  actual output basename.
- Implement the canonical chikx formatter in `packages/compiler/src/formatter/` (parse → print,
  idempotent, property-centric, values untouched) and wire `chikx format [file]` with `--check` mode
  (replacing the P7 stub).
- Golden + round-trip tests for both; source-map mappings decoded and asserted.

## Objective

Complete the two remaining compiler features. Persist this task as `.ai/tasks/CSSX-A15A.md` and
results as `.ai/reports/CSSX-A15A.md`.

## Dependencies

- `SPECIFICATION.md` §6 (pipeline/source-map contract), §9 (output configuration, `.css.map`
  naming), §3.1 (formatter-relevant syntax).
- `.ai/CSSX-MASTERPLAN.md` §6 and §9 (minification/source-map test requirements).
- `docs/decisions/ADR-0003-important-per-segment.md`.
- Landed stages: emitter A06, lowering spans, output planner A10, parser/IR spans, CLI P7 stub.

## Allowed files (exclusive ownership)

- `packages/compiler/src/emitter/**` (maps-off output stays byte-identical)
- `packages/compiler/src/sourcemaps/**` (new)
- `packages/compiler/src/formatter/**` (new)
- `packages/cli/src/commands/format.ts` and CLI wiring required by `chikx format`
- `tests/compiler/sourcemap*.test.ts`, `tests/compiler/formatter*.test.ts`,
  `tests/integration/format*.test.ts` (new)
- `.ai/tasks/CSSX-A15A.md`, `.ai/reports/CSSX-A15A.md`, `.ai/reports/logs/CSSX-A15A.log`

Frozen types, the compiler barrel (`packages/compiler/src/index.ts`), other pipeline modules,
fixtures' inputs/goldens, docs, root configs and `.ai/PROGRESS.md` are out of scope.

## Requirements

1. **Source maps** — zero-dependency v3 generator (`version`, `sources` workspace-relative POSIX,
   VLQ `mappings`, optional `sourceRoot`/`file`, no `names`). Emitter records a mapping for each
   emitted rule selector and declaration property from the node span start, including minified
   output. `emitCss` gains an opt-in `sourceMap` option returning `{ css, map?, diagnostics }`; the
   CSS gains `/*# sourceMappingURL=<css basename>.map */`. Maps off must keep the 48 golden CSS
   files byte-identical.
2. **Formatter** — pure `format(source, file)` returning `{ formatted, diagnostics }`; canonical
   two-space layout, blank line between top-level constructs, directive blocks one entry per line,
   inline variants on one line, `!important`/aliases/values as raw slices, comments preserved,
   final newline, idempotent, errors return the original source and the parse diagnostics.
   Compilation results must be unchanged after formatting.
3. **CLI** — `chikx format [file]` writes in place by default and reports changed paths; `--check`
   writes nothing and exits 1 when files would change; exit codes 0/1/2.
4. **Tests** — in-test VLQ decoder asserting selector/declaration origins in pretty and minified
   modes; URL comment correctness; maps-off goldens; formatter idempotence over all fixtures,
   comment/directive/conditional/nested layout, unchanged compilation, and CLI in-place/`--check`
   behavior in a temp workspace.

## Acceptance criteria

1. Typecheck and the full test suite pass; existing goldens unchanged.
2. Source maps decode correctly at declaration granularity in pretty and minified modes; the URL
   comment names the planned CSS basename.
3. Formatter is idempotent on all fixtures, compilation-invariant, and the CLI contract holds.
4. Report records created files, mapping granularity/option shape, formatter decisions, the
   `compile()` wiring handoff and any blockers.

## Validation commands

```sh
bun test tests/compiler/sourcemap.test.ts tests/compiler/formatter.test.ts tests/integration/format-cli.test.ts
bun run typecheck
bun test
bun run verify
```
