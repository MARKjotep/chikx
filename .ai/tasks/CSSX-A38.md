# CSSX-A38 — record close-out for the `@group` compiler phase (G0–G5)

## Summary

- Records-only task: the `@group` compiler phase (plan phases G0–G5, CSSX-A30 through CSSX-A37) is
  complete and lead-verified (`bun run verify` 798/0/45; `bun run test:browser` 96 passed in three
  engines; both lead-run).
- Add the missing `groups` row to the browser README coverage table (flagged by G4b as outside its
  scope) and record the completed phase in `.ai/PROGRESS.md` and `.ai/todo.md` item 8.

## Objective

Close out the `@group` phase in the project records only: browser README coverage row, eight
`PROGRESS` rows (A30–A37), and the todo board entry. No source, test, docs, example, plan or fixture
change.

## Work items

1. `tests/browser/README.md`: `groups` row in the Coverage table naming `specs/groups.pw.ts` and the
   D1–D5 semantics (override at breakpoints, base-beats-variant pin, dark/reduced-motion persistence,
   `!important` persistence, pretty/minify/grouping parity).
2. `.ai/PROGRESS.md`: one terse row per task A30–A37 in the existing style, accurate to
   `.ai/reports/CSSX-A30..A37.md`.
3. `.ai/todo.md` item 8: 🔴 planned → 🟢 done in CSSX-A30–A37, keeping the owner's request text.
4. `bun run verify` green after edits; report exactly what was run.

## Allowed files

`tests/browser/README.md`, `.ai/PROGRESS.md`, `.ai/todo.md`, this task, `.ai/reports/CSSX-A38.md`,
`.ai/reports/logs/CSSX-A38.log`. Nothing else — no plan file (G rows already 🟢), no source, no docs,
no examples, no fixtures.

## Constraints

- Records must match the evidence in the A30–A37 reports; no invented numbers.
- No stale 🔴 for the groups compiler phase except the plan's G6 row (correctly still 🔴/deferred).
- Do not touch the plan, compiler, extension, fixtures, goldens or docs.

## Acceptance

- All three files updated in their existing style; `bun run verify` green; report lists the final
  state and evidence.

## Validation

```sh
bun run verify
git diff --stat tests/browser/README.md .ai/PROGRESS.md .ai/todo.md
git status --porcelain
```
