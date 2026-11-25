# CSSX-A43 — records close-out for the editor wave (A39–A42)

## Summary

- Close out the shipped editor wave in the project records only: known-limitations editor/language
  rows, ADR-0017's deferred editor item and G6 consequence, the plan's G6 rows, PROGRESS entries for
  A39–A43 and the keyframes half of todo item 6.
- The shipped scope is fixed by the four reports: A39 group completion/hover/outline/rename, A40
  group TextMate scopes, A41 `examples/groups`, A42 `$keyframes.<name>` completion/hover/rename.
- No source, test, fixture, example, specification or other doc changes; remaining limitations
  (visible-module rename scope, `animation:` shorthand not rewritten, token-only-import keyframes
  invisible) stay documented.
- Validation: `bun run verify` green at 849 pass / 0 fail / 45 files.

## Objective

1. `docs/known-limitations.md`: replace the stale "Group name intelligence" row and the §1 keyframe
   intelligence row with accurate shipped/remaining-scope text; correct §4's "no cross-module
   renaming" claim without changing the language exclusions.
2. `docs/decisions/ADR-0017-reusable-declaration-groups.md`: dated consequence note under item 9
   recording that the owner brought editor support forward (A39/A40/A42), and update the G6
   consequences bullet; original decision text intact.
3. `.ai/plans/CSSX-PLAN-GROUPS.md`: G6c 🟡 → 🟢 with A40 evidence and the cleared verify gate; G6
   aggregate 🔴 → 🟢. G0–G5 rows untouched.
4. `.ai/PROGRESS.md`: append A39–A43 rows in the established style with the observed counts.
5. `.ai/todo.md`: item 6 editor half 🟢 done in CSSX-A42; new item 11 keeps the compiler-semantics
   half open; item 8's "follow-up release" note reflects A39/A40.
6. Run `bun run verify` and record the result.

## Owned files

- `docs/known-limitations.md`, `docs/decisions/ADR-0017-reusable-declaration-groups.md`,
  `.ai/plans/CSSX-PLAN-GROUPS.md`, `.ai/PROGRESS.md`, `.ai/todo.md`.
- `.ai/tasks/CSSX-A43.md`, `.ai/reports/CSSX-A43.md`, `.ai/reports/logs/CSSX-A43.log`.

## Evidence sources

- `.ai/reports/CSSX-A39.md`, `CSSX-A40.md`, `CSSX-A41.md`, `CSSX-A42.md`; plan G6a–G6c rows.
- Observed counts from those reports: A39 824/45 at completion and 826/45 after the post-review
  correction (A42's 826 baseline); A40 36/36 grammar and 805/45 full suite; A41 build exit 0,
  deterministic output, 805/45; A42 849/45 (826 baseline + 23 tests).

## Constraints

- Records only; no source, tests, fixtures, `SPECIFICATION.md`, examples or `button.cssx`.
- Do not overstate: keyframes from token-only imports, string-named/conditional keyframes and
  `animation:` shorthand rename remain out of scope; rename is limited to the current document's
  visible module set.
- Keep ADR-0017's decision text intact; annotate rather than rewrite.
- Leave plan G0–G5 rows unchanged.

## Acceptance

- No record describes group or `$keyframes.` editor intelligence as missing or deferred.
- ADR-0017 carries a dated consequence note and an updated G6 consequence, cross-linked to
  A39/A40/A42.
- Plan G6 and G6c rows are 🟢 with evidence; G0–G5 rows unchanged.
- PROGRESS has one terse row per task A39–A43.
- Todo item 6 is split: editor half done (A42), compiler-semantics half open (item 11, 🔴).
- `bun run verify` green at 849/45.

## Validation

- `bun run verify` — typecheck + lint + full test suite.
