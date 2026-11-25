# CSSX-A23 — Plan: reusable declaration groups (`@group.<name>`)

## Summary

- Owner proposal (2026-11-25): a named, reusable declaration set defined once as
  `@group.<name> { … }` and included in any rule with `@group.<name> { <overrides> }`, so a group's
  defaults stay customizable at every use site.
- This is a **planning-only** task: it produces `.ai/plans/CSSX-PLAN-GROUPS.md` with the design,
  owned scopes, phase/task breakdown, acceptance criteria, open owner decisions and a
  🔴-only Implementation Progress table. **No implementation, no source/test/doc edits.**
- Masterplan §12 already sanctions "reusable declaration groups (`@group`/`@apply`)" as a future
  feature and SPECIFICATION.md §13 defers it behind an ADR; the masterplan is never edited, so the
  actionable plan lives under `.ai/plans/`.
- Language change ⇒ `ADR-0017` + normative SPECIFICATION.md section + fixtures/goldens +
  `bun run verify` + `bun run test:browser` before any code lands.

## Objective

1. Write `.ai/tasks/CSSX-A23.md` (this file) before any other artifact.
2. Create `.ai/plans/CSSX-PLAN-GROUPS.md` styled after `.ai/plans/CSSX-PLAN.md`: phases, tasks with
   exclusive owned scopes and dependencies, per-phase acceptance criteria, concurrency notes, risks,
   and one near-top `## Implementation Progress` table with every row 🔴.
3. Record the lead/owner design decisions of 2026-11-25 verbatim in effect: declarations-only v1
   scope, use-site override semantics via the existing §5.4 cascade (no dedupe/filter), visibility
   following the ADR-0015 `styles` pattern as the default proposal, CHIKX2001-family diagnostics with
   block omission, a separate `group` symbol kind with a reserved `@use … as group` alias, and the
   explicit v1 exclusions.
4. Record the three open owner decisions (token-only visibility; `@runtime` members in group
   defaults; diagnostic reuse vs new subcode), plus the ADR-authoring details the plan leaves open
   (inline variants in defaults, whitespace in `@group.<name>`, bare include form, ambiguity rules).
5. Write `.ai/reports/CSSX-A23.md` and `.ai/reports/logs/CSSX-A23.log`; verify no other file changed.

## Files

- Create: `.ai/tasks/CSSX-A23.md` (this prompt)
- Create: `.ai/plans/CSSX-PLAN-GROUPS.md` (the deliverable)
- Create: `.ai/reports/CSSX-A23.md`
- Create: `.ai/reports/logs/CSSX-A23.log`

## Dependencies

- Read-only context: `.ai/CSSX-MASTERPLAN.md` §12, SPECIFICATION.md §3.2/§3.5/§3.6/§5.4/§5.5/§6.4/§13,
  `docs/decisions/ADR-0014-rule-merge-imports.md`, `ADR-0015-keyframes-namespace.md`,
  `.ai/framework/chikx/FRAMEWORK.md` §2/§4/§5/§7/§9/§10, `.ai/plans/CSSX-PLAN.md`.
- Todo item 8 is already recorded by its owning worker as 🔴 planned → this plan; do not edit
  `.ai/todo.md`.
- `.ai/PROGRESS.md` is lead-owned; this task does not edit it.

## Constraints

- Exclusive write scope: the four files above. Nothing else may be created, modified or deleted.
- **HARD OFF-LIMITS:** `.ai/CSSX-MASTERPLAN.md` (never edited), `.ai/PROGRESS.md`, `.ai/todo.md`,
  `SPECIFICATION.md`, `docs/**`, `packages/**`, `tests/**`, `.ai/framework/**`.
- No implementation, no fixtures, no ADR file: the ADR is a *phase of the plan* (G0), authored later
  by the task that owns it.
- Do not modify or weaken any test or golden to make anything pass; nothing is built here.
- Preserve pre-existing worktree changes from parallel tasks; verify by status-set comparison.

## Acceptance criteria

- `.ai/plans/CSSX-PLAN-GROUPS.md` contains: design (definition, use site, expansion semantics,
  visibility, diagnostics, spans, symbol kind/collisions), explicit v1 exclusions, open decision
  points, phases G0–G6 with owned scopes and acceptance criteria, concurrency rules, risks,
  fixture matrix, quality gates, and a 🔴-only `## Implementation Progress` table.
- The plan states unambiguously that implementation is deferred and requires `ADR-0017` plus owner
  sign-off before code.
- `.ai/reports/CSSX-A23.md` (## Summary first) and `.ai/reports/logs/CSSX-A23.log` exist.
- No other file changed.

## Validation

```sh
git status --porcelain            # only the four A23 files may appear beyond the pre-existing set
git diff --stat                   # must not list any file outside the four
wc -l .ai/plans/CSSX-PLAN-GROUPS.md
grep -n "🔴" .ai/plans/CSSX-PLAN-GROUPS.md   # progress rows all open
```
