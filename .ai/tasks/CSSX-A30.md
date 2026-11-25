# CSSX-A30 — G0: ADR-0017 and normative `@group` specification

## Summary

- Phase **G0** of `.ai/plans/CSSX-PLAN-GROUPS.md` (planning task CSSX-A23): write
  `docs/decisions/ADR-0017-reusable-declaration-groups.md` as accepted and integrate the normative
  `@group` text into `SPECIFICATION.md`, so the design stops being a proposal.
- The owner answered all three open decisions on 2026-11-25: (a) **styles-only** visibility,
  (b) **compile-time-only** group defaults (no `@runtime` references), (c) **reuse CHIKX2001**.
- Docs-only. **No code may change**: no grammar, compiler, formatter, editor or fixture edits, no
  golden diff, no diagnostic-registry edit. Zero source changes is an acceptance condition, not a
  side effect.
- G0 is a hard gate: G1 (lexer/parser) may not start until this ADR and the spec text are accepted.

## Objective

1. Write `docs/decisions/ADR-0017-reusable-declaration-groups.md` following ADR-0015's structure
   (status, context, decision, rejected alternatives, consequences, related links) with
   `Status: Accepted (owner sign-off 2026-11-25; decisions (a) styles-only, (b) compile-time-only
   defaults, (c) reuse CHIKX2001)`.
2. State in the ADR: definition grammar (top-level, declarations only, non-parametric, emits
   nothing, empty legal/inert); use-site grammar (any rule body, any depth, block required in v1,
   declarations only); the **splice-then-override** expansion semantics (defaults in definition
   order, then use-site declarations in authored order, at the authored position; overrides win by
   the ordinary §5.2 cascade; never filter/reorder/dedupe/rewrite; invariant 3 applies;
   `!important` per segment); visibility (a) and precedence (local shadows import, two imports
   ambiguous, duplicate-in-module, `@use … as group`, `$group.<name>`); token resolution and spans
   (defaults in the defining module, overrides in the consumer, runtime refs rejected per (b), the
   naive-AST-copy engineering consequence); the §2.5 diagnostics/recovery matrix verbatim plus the
   rejected default-less recovery; the §5 authoring details; the nine §3 v1 exclusions; the five
   rejected alternatives; consequences (G1–G6, formatter release blocker, frozen registry
   untouched).
3. Update `SPECIFICATION.md`: a new normative `§3.7` group section (grammar EBNF, definition/use-site
   rules, splice semantics with the plan's `.panel`/`.tile` example lowered to equivalent authored
   CSS, visibility/precedence, diagnostics, v1 exclusions), `§3.2` productions for the two new
   constructs, `§3.6` reserved name `group` including the `@use … as group` rejection, and `§13`
   where `@group` stops being deferred.
4. Flip the plan's G0 progress row to 🟢 with an evidence note (nothing else in the plan changes).
5. Write this task file, `.ai/reports/CSSX-A30.md` and `.ai/reports/logs/CSSX-A30.log`; run
   `bun run verify` and record its output tail.

## Files (exclusive write scope)

- Create: `docs/decisions/ADR-0017-reusable-declaration-groups.md`
- Modify: `SPECIFICATION.md`
- Modify: `.ai/plans/CSSX-PLAN-GROUPS.md` (G0 progress row only)
- Create: `.ai/tasks/CSSX-A30.md` (this prompt), `.ai/reports/CSSX-A30.md`,
  `.ai/reports/logs/CSSX-A30.log`

## Dependencies

- `.ai/plans/CSSX-PLAN-GROUPS.md` §2–§5, §7 (design, exclusions, owner decisions, authoring
  details, G0 acceptance) and `.ai/tasks/CSSX-A23.md` / `.ai/reports/CSSX-A23.md` (the plan task).
- `docs/decisions/ADR-0015-keyframes-namespace.md` (format template),
  `docs/decisions/ADR-0003-important-per-segment.md`, `ADR-0005-ast-raw-values.md`,
  `ADR-0011-semicolonless-final-declarations.md`, `ADR-0014-rule-merge-imports.md`.
- `SPECIFICATION.md` §3.2, §3.6, §5.1, §5.2, §5.4, §5.5, §6.1, §6.3, §13;
  `.ai/framework/chikx/FRAMEWORK.md` §4, §5, §7 (invariants 3, 4, 10, 11), §9.
- Read-only: `.ai/CSSX-MASTERPLAN.md` §12, `.ai/todo.md` item 8. Neither is edited.

## Constraints

- Docs-only: no `packages/**`, `tests/**`, `docs/known-limitations.md`,
  `packages/compiler/src/types/diagnostics.ts`, `.ai/CSSX-MASTERPLAN.md`, `.ai/PROGRESS.md` or
  `.ai/todo.md` change.
- The ADR is written as **accepted**; it records the owner's decisions and does not re-open them.
- SPECIFICATION edits must not contradict existing numbered sections. Prefer a new subsection
  (§3.7) over renumbering; keep the existing tone, heading style and cross-reference style.
- Do not weaken a test, edit a golden or regenerate expectations to pass. Preserve unrelated
  worktree changes from parallel tasks.
- No commit or push.

## Acceptance criteria (plan §7 G0)

- ADR-0017 follows ADR-0015's format and states the definition grammar, splice semantics, visibility
  rule (a), the (b) runtime rule, diagnostics/recovery with (c), the v1 exclusions and all three
  owner answers.
- SPECIFICATION grammar/§3.6/§13 are updated consistently with the ADR; no contradiction between the
  two documents.
- `bun run verify` green and unchanged in counts (docs only); no golden diff; the report records the
  verify output tail and the exact files touched.
- The plan's G0 row is 🟢; nothing else in the plan changed.

## Validation

```sh
bun run verify                       # typecheck + lint + test, counts unchanged
git status --porcelain               # only the A30 files + pre-existing parallel work
git diff --stat                      # SPECIFICATION.md and the plan G0 row only
grep -n "🔴\|🟢" .ai/plans/CSSX-PLAN-GROUPS.md
```

## Handoff

Write `.ai/reports/CSSX-A30.md` (`## Summary` first, then objective/files/acceptance/evidence with
the verify tail) and `.ai/reports/logs/CSSX-A30.log`. G1 may start only after this report is
accepted by the lead; the ADR is normative from sign-off.
