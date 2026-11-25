# CSSX-A35 — G4c: author-facing documentation for `@group.<name>`

## Summary

- Implement phase **G4c** of `.ai/plans/CSSX-PLAN-GROUPS.md`: document `@group.<name>` for authors in
  `docs/grammar.md`, `docs/cascade.md`, `docs/compatibility.md` and `docs/known-limitations.md`.
- Describe only shipped behaviour (G1–G3 landed and lead-verified): definition/use-site syntax,
  defaults-then-overrides splice, and the two cascade consequences pinned by ADR-0017.
- State the ADR-0017 item 9 v1 exclusions bluntly; never promise `@apply`, parameters, conditional use
  sites, group chaining or `$group.<name>` values.
- Docs-only task: no code changes, `bun run verify` stays green at the 745/44 baseline.

## Objective

1. Read `AGENTS.md`, ADR-0017, `SPECIFICATION.md` §3.7, plan §3 and the G4c row, plus the current
   voice/structure of the four target docs.
2. `docs/grammar.md`: add `@group` where sibling directives are covered — EBNF productions,
   directive-table row, and a subsection covering the definition (top level only, declarations only,
   contiguous dotted name, emits nothing) and the use site (any rule body, block required).
3. `docs/cascade.md`: add the `.panel`/`.tile` override lowering from ADR-0017 with the two pinned
   consequences (use-site base beats an earlier `@md` default at every width; an `!important` default
   is not beaten by a plain override), cross-referencing ADR-0003/ADR-0017.
4. `docs/compatibility.md`: replace the stale "`@group` deferred" row with a supported feature row
   (spec-level engine phrasing, browser gate G4b pending) plus a mixins/`@apply` row and a
   groups-are-not-mixins note.
5. `docs/known-limitations.md`: replace the stale "no reusable groups" row with the blunt v1
   exclusion list, add the editor/group-intelligence gap, and note formatter support only as
   "must be verified in your release" (G5 is a parallel task).
6. Run the validation commands; write this task, the report and the worker log; mark the plan's G4c
   row 🟢 (that row only).

## Owned files

- `docs/grammar.md`, `docs/cascade.md`, `docs/compatibility.md`, `docs/known-limitations.md`
- `.ai/plans/CSSX-PLAN-GROUPS.md` (G4c row only)
- `.ai/tasks/CSSX-A35.md`, `.ai/reports/CSSX-A35.md`, `.ai/reports/logs/CSSX-A35.log`

Off-limits: `tests/**`, `packages/**` (including the formatter owned by G5), ADR-0017,
`SPECIFICATION.md`, examples, `button.cssx`, `PROGRESS`/`todo`/masterplan, framework records.

## Dependencies

- G3 complete and lead-verified (splice order, no filtering, `!important`/variant consequences).
- ADR-0017 (normative decisions 1–9) and `SPECIFICATION.md` §3.7.
- G4a/G4b/G5 run in parallel on disjoint files; no coordination beyond reading the formatter header.

## Constraints

- Docs describe only shipped behaviour; no claims that `@apply`, parameters, conditional use sites,
  chaining or `$group.<name>` values exist.
- Keep each doc's existing heading style, table format, link style and voice; cross-reference
  ADR-0017 and `SPECIFICATION.md` §3.7.
- No test weakening; no code changes; `bun run verify` green with zero behavioural change.
- Framework records are not required: this task documents a shipped compiler feature and the
  formatter gap is recorded by its owning plan phase, not as a framework defect.

## Acceptance

- The four docs describe only shipped behaviour, list the v1 exclusions bluntly, and contradict
  neither ADR-0017 nor `SPECIFICATION.md` §3.7.
- No `@apply`/parameter/conditional-use-site promise appears anywhere in the changed text.
- `bun run verify` green (745 pass / 44 files), no source or test diff.
- Report lists per-file summaries and the plan's G4c row is 🟢.

## Validation commands

```sh
bun run verify
git status --porcelain
git diff --stat docs .ai/plans
```
