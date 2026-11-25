# CSSX-A44 — keyframes semantics decisions (ADR-0018)

## Summary

- Record the owner's three keyframes-semantics answers of 2026-11-25 in a new ADR-0018 addendum:
  styles-only visibility is permanent (ADR-0015 unchanged), string-named keyframes are rejected, and
  conditional keyframes are rejected for v0.1 and deferred beyond it.
- Close the compiler-semantics half of todo item 6: known-limitations gains a blunt exclusion row,
  `SPECIFICATION.md` §6.4/§13 reference ADR-0018, and the plan's stale near-top status line now
  reflects the shipped G0–G6 state.
- Decisions only: no language, compiler, test or behaviour change.
- Validation: `bun run verify` green at 849 pass / 0 fail / 45 files.

## Objective

1. Write `docs/decisions/ADR-0018-keyframes-visibility-and-exclusions.md` in ADR-0015's structure
   with the owner's (i)–(iii) answers and the emit-safety rationale.
2. Add the two exclusions to `docs/known-limitations.md` §4 with ADR-0015/ADR-0018 links.
3. Add a minimal `SPECIFICATION.md` §6.4 rejected-constructs note (plus §13 wording) without changing
   normative behaviour.
4. Mark todo item 11 🟢 done in CSSX-A44; item 6 stays the editor-half record.
5. Fix the plan's `**Status:**` line only.
6. Append `PROGRESS` A44 and note the follow-up in the A43 report.

## Owned files

- `docs/decisions/ADR-0018-keyframes-visibility-and-exclusions.md` (new).
- `docs/known-limitations.md`, `SPECIFICATION.md`, `.ai/todo.md`,
  `.ai/plans/CSSX-PLAN-GROUPS.md` (status line only), `.ai/PROGRESS.md`, `.ai/reports/CSSX-A43.md`
  (follow-up note).
- `.ai/tasks/CSSX-A44.md`, `.ai/reports/CSSX-A44.md`, `.ai/reports/logs/CSSX-A44.log`.

## Constraints

- Record the owner's decisions; do not re-open or extend them.
- No compiler/parser/formatter/source/test/fixture/example change; ADR-0015 stands unchanged.
- Keep the specification note minimal and non-normative in effect.
- Preserve the plan's G0–G6 rows and all other content.

## Acceptance

- ADR-0018 carries Status, Context, Decision (i–iii), Rejected alternatives, Consequences and Related
  links, and states the emit-safety rationale for styles-only visibility.
- Known-limitations §4 has one row naming both exclusions and linking ADR-0015/ADR-0018.
- `SPECIFICATION.md` §6.4 mentions the two exclusions with ADR-0018; §13 no longer calls keyframe
  editor support deferred.
- Todo item 11 is 🟢 with the decision summary; item 6 unchanged.
- Plan status line says complete and shipped.
- `bun run verify` green at 849/45.

## Validation

- `bun run verify`.
