# CSSX-A28 — Fix residual text accuracy in FRAMEWORK.md §2 (`entry.cssx` goldens note and `tests/compiler/` suite list)

## Summary

- CSSX-A27 corrected the §2 counts but left two residual text inaccuracies flagged by its report.
- The `tests/fixtures/` row still says only `modules/merge/ 7 goldens using entry.cssx`, although
  `keyframes/` and `runtime/` also hold `entry.cssx` goldens.
- The `tests/compiler/` row still enumerates a stale 16-name subset of the current 25 suites.
- Task: observe the real tree and fix exactly those two text fragments.

## Objective

1. Verify the facts (no guessing):
   - `find tests/fixtures -name "entry.cssx" | wc -l` and the per-directory distribution.
   - `ls tests/compiler/*.test.ts` for the actual suite file names.
2. Update only these fragments in `.ai/framework/chikx/FRAMEWORK.md` §2:
   - `tests/fixtures/` row: replace the trailing `modules/merge/`-only `entry.cssx` note with the
     observed total and its locations.
   - `tests/compiler/` row: replace the stale partial parenthetical with the actual file names as a
     compact one-line enumeration.
3. Write this prompt, `.ai/reports/CSSX-A28.md` and `.ai/reports/logs/CSSX-A28.log`.

## Files (exclusive write scope)

- `.ai/framework/chikx/FRAMEWORK.md` — §2 `tests/fixtures/` trailing `entry.cssx` note and the
  `tests/compiler/` parenthetical only. No other line, row, count or section.
- `.ai/tasks/CSSX-A28.md`, `.ai/reports/CSSX-A28.md`, `.ai/reports/logs/CSSX-A28.log`.

## Dependencies

CSSX-A27 (counts `54 input.cssx` / `13 groups` / `25 files`) — leave those numbers untouched.

## Constraints

- Observed data only; preserve the compact table-row style and escaping.
- Preserve unrelated uncommitted changes; no test weakening, no fixture/source edits, no commit/push.

## Acceptance criteria

- Both §2 fragments match the observed tree; all other §2 text unchanged.
- `bun run verify` green.

## Validation

```sh
bun run verify
```

## Handoff

Report observed distribution and file list, the two changed fragments, verification evidence and
blockers; log the worker run to `.ai/reports/logs/CSSX-A28.log`.
