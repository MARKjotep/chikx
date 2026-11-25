# CSSX-A26 — Task: refresh stale suite counts in README and FRAMEWORK.md

## Summary

- Two docs still advertise the old suite size: `FRAMEWORK.md` §8/§11 say "612 tests / 37 files" and
  `README.md` says "573 tests across 35 files".
- The suite is now 679 tests / 41 files after today's CSSX-A17..A25 work.
- Run `bun run verify` personally and use **only the counts it prints**; no guessing or copying
  from other reports.
- Fix the three count strings, nothing else, and persist task/report/log records.

## Objective

1. Run `bun run verify` and read the final `bun test` summary (pass/fail counts, file count).
2. Replace the stale count strings with the observed numbers in:
   - `.ai/framework/chikx/FRAMEWORK.md` §8 gates table, `bun test` / `bun run test` row.
   - `.ai/framework/chikx/FRAMEWORK.md` §11, first bullet.
   - `README.md`, "Testing and quality gates" paragraph.
3. Write this task prompt, a report at `.ai/reports/CSSX-A26.md` and a worker log at
   `.ai/reports/logs/CSSX-A26.log`.

## Allowed files (exclusive write scope)

| File | Permitted change |
|---|---|
| `.ai/framework/chikx/FRAMEWORK.md` | Count strings in §8 table row and §11 first bullet only. |
| `README.md` | The test-count sentence only. |
| `.ai/tasks/CSSX-A26.md` | This prompt. |
| `.ai/reports/CSSX-A26.md` | Report. |
| `.ai/reports/logs/CSSX-A26.log` | Worker log. |

Everything else — including `.ai/PROGRESS.md`, other docs, sources, tests and fixtures — is
untouched, even where the working tree already contains uncommitted changes from earlier tasks.

## Constraints

- No invented numbers: use exactly what `bun run verify` prints in this run.
- No test, fixture, golden or config edits; this is a documentation consolidation only.
- Preserve unrelated working-tree changes; never commit, push or publish.
- If the gate is red, stop and report the failure rather than adjusting expectations.

## Acceptance criteria

- `README.md` and `FRAMEWORK.md` contain no `573`, `612`, `35 files` or `37 files` suite counts.
- Both files state the counts observed in this run.
- `bun run verify` green.

## Validation

```sh
bun run verify
grep -nE '573|612|35 files|37 files|679|41 files' README.md .ai/framework/chikx/FRAMEWORK.md
```
