# CSSX-A27 — Refresh FRAMEWORK.md §2 repo-map counts for `tests/compiler/` and `tests/fixtures/`

## Summary

- `FRAMEWORK.md` §2 still says `tests/compiler/` = 24 files and `tests/fixtures/` = 48 `input.cssx`
  goldens in 12 groups.
- Today's work added suites and fixture groups (keyframes, semicolonless-before-nested-rule).
- Task: observe the real counts from the tree and update only those two count strings.

## Objective

1. Observe (do not guess) the tree:
   - `ls tests/compiler/*.test.ts | wc -l`
   - `find tests/fixtures -name "input.cssx" | wc -l`
   - number of fixture groups containing `input.cssx` (top-level group directories; `cli/` and
     `modules/` hold project/merged fixtures without `input.cssx`, per `tests/fixtures/README.md`).
2. Update only the count strings in the §2 rows `tests/fixtures/` and `tests/compiler/` of
   `.ai/framework/chikx/FRAMEWORK.md`. Leave the rest of each row's text intact.
3. Write this prompt, `.ai/reports/CSSX-A27.md` and `.ai/reports/logs/CSSX-A27.log`.

## Files (exclusive write scope)

- `.ai/framework/chikx/FRAMEWORK.md` — §2 rows for `tests/fixtures/` and `tests/compiler/`, count
  strings only.
- `.ai/tasks/CSSX-A27.md`, `.ai/reports/CSSX-A27.md`, `.ai/reports/logs/CSSX-A27.log`.

Nothing else may be written: no tests, fixtures, goldens, sources, configs, `README.md`,
`.ai/PROGRESS.md`, todo or plan files.

## Dependencies

None. CSSX-A26 already refreshed the suite-size strings (§8/§11) and deferred these §2 rows.

## Constraints

- Observed numbers only; never guess or round.
- Preserve existing uncommitted changes from earlier tasks in the shared tree.
- No test weakening, no fixture edits, no commit/push.

## Acceptance criteria

- `tests/compiler/` row states the observed `.test.ts` file count.
- `tests/fixtures/` row states the observed `input.cssx` golden count and the observed group count;
  `cli/` and `modules/merge/` notes remain intact.
- `bun run verify` green.

## Validation

```sh
bun run verify
```

## Report

`.ai/reports/CSSX-A27.md` with the observed numbers, changed files, verification evidence and
handoff; append the worker log to `.ai/reports/logs/CSSX-A27.log`.
