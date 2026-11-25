# CSSX-A34 — G4a: `@group` golden fixture matrix

## Summary

- Author the golden fixture matrix for `@group`: 13 single-file cases plus 7 merged-build cases per
  `.ai/plans/CSSX-PLAN-GROUPS.md` §8, with byte-exact `expected/{css,diagnostics.json}` reviewed line
  by line.
- Every fixture proves one ADR-0017 semantic; the goldens become the release-pinned behaviour of
  phase G4a. No compiler source may change: a surprising output is investigated and reported, never
  "fixed" by pinning it.
- G1–G3 are complete and lead-verified (`.ai/reports/CSSX-A31.md`, `-A32.md`, `-A33.md`); this task
  consumes their semantics.

## Objective

Implement phase **G4a** of `.ai/plans/CSSX-PLAN-GROUPS.md`: the single-file and merged-build fixture
matrix of §8, the catalog/README rows, and a runner that asserts the files byte-exactly.

## Required reading

1. `.ai/plans/CSSX-PLAN-GROUPS.md` §8 (matrix) and §9 (golden review rules).
2. Existing fixture conventions: `tests/fixtures/canonical/button/`,
   `tests/fixtures/errors/missing-semicolon/`, `tests/fixtures/runtime/basic/`,
   `tests/fixtures/keyframes/*` (merged `entry.cssx` shape) and `tests/fixtures/README.md`.
3. `tests/compiler/golden.test.ts`, `variables.golden.test.ts`, `runtime.test.ts` (merged runner),
   `pipeline.test.ts`, `parser.test.ts`, `sourcemap.test.ts` — how the catalog is discovered and
   asserted.
4. `docs/decisions/ADR-0017-reusable-declaration-groups.md` and `SPECIFICATION.md` §3.7 for the
   semantics each case pins.

## Work items

1. **Single-file fixtures** under `tests/fixtures/groups/<case>/input.cssx` + `expected/`:
   `same-file`, `no-override`, `two-use-sites`, `unknown-group`, `duplicate-definition`,
   `group-position`, `nested-rule-in-definition`, `conditional-use-site`, `inline-variant-default`,
   `important-default`, `empty-group`, `group-named-keyframes`, `alias-group`.
2. **Merged fixtures** (real `compileProject` entries): `style-import`, `token-only`,
   `ambiguous-import`, `local-shadows-import`, `transitive-visibility`,
   `cross-module-defining-tokens`, `runtime-ref`.
3. **Fixture catalog/README**: README group rows/counts, and the fixture-count row(s) the plan owns.
4. **Records**: this task, `.ai/reports/CSSX-A34.md`, `.ai/reports/logs/CSSX-A34.log`; plan G4a
   status.

## Allowed files

`tests/fixtures/groups/**`, `tests/fixtures/README.md`, `tests/compiler/groups.golden.test.ts`,
`tests/compiler/golden.test.ts` (fixture-count row), this task/report/log, the plan's G4a status.

## Constraints

- Nothing in `packages/**`, no docs, no `PROGRESS`/todo, no examples, no `button.cssx`.
- Goldens are pinned behaviour: review every expected diff against ADR-0017 before pinning; a red
  gate is never "fixed" by editing expectations unless the output is the intended ADR behaviour.
- Existing fixtures and suites stay green (745/44 baseline at task start).

## Acceptance (plan §7 G4a)

- Every §8 case exists with byte-exact goldens; `expected/diagnostics.json` records the exact codes;
  no pre-existing golden changes except the planned fixture-catalog counts.
- `bun run verify` green with the new fixtures counted; the report lists each case with its pinned
  semantic and evidence.

## Validation

```sh
bunx tsc -p packages/compiler/tsconfig.json --noEmit
bunx biome check .
bun test tests/compiler/groups.golden.test.ts
bun test tests/compiler
bun run verify
git status --porcelain tests/fixtures
```
