# CSSX-A37 — G4b: `@group` cross-browser computed-style gate

## Summary

- Phase **G4b** of `.ai/plans/CSSX-PLAN-GROUPS.md`: Playwright scenarios proving `@group` override
  semantics in real engines (Chromium, Firefox, WebKit) with computed-style assertions at the pinned
  breakpoints 320/767/768/1279/1280.
- Pin the two "by design, do not fix" cases — D2 (a use-site base declaration beats an earlier `@md`
  group default at every width) and D4 (`!important` on a group default survives a plain use-site
  declaration) — plus D3 (`@dark`/reduced-motion keep non-overridden group values) and D5
  (pretty/minify and safe/`none` grouping compute identically for expanded rules).
- G1–G3 and G4a are complete and lead-verified; this task only adds browser harness inputs, specs
  and records. No compiler, fixture, doc or board file may change.

## Objective

Implement phase **G4b**: group scenario source(s) in `tests/browser/harness/**`, a
`tests/browser/specs/**` spec asserting D1–D5 in three engines, and the task/report/log records.
Update the plan's G4b row and the aggregate G4 row only after the gate passes.

## Required reading

1. `.ai/plans/CSSX-PLAN-GROUPS.md` §7 G4b, §8 D1–D5, §9 (browser gate is mandatory).
2. The existing browser harness end to end: `tests/browser/README.md`, `tests/browser/harness/build.ts`,
   `harness/scenarios.ts`, `harness/global-setup.ts`, `specs/support.ts`, `specs/cascade.pw.ts`,
   `specs/parity.pw.ts`, `specs/grouping.pw.ts`, `playwright.config.ts`.
3. `docs/decisions/ADR-0017-reusable-declaration-groups.md` item 3 and G4a's group fixtures
   (`.ai/reports/CSSX-A34.md`) — the browser expectations must agree with the
   `inline-variant-default` and `important-default` goldens.

## Work items

1. **Harness input**: a `groups` scenario in `tests/browser/harness/scenarios.ts` compiled through the
   existing builder path. Group `chrome` has base defaults, an inline `@md` variant default, an
   `@dark` variant, a `@reduced` variant and a `!important` default, and is used by `.panel` and
   `.tile` with different overrides. Group `chip` (base only) is used twice by `.badge` so safe
   grouping actually merges two expanded runs.
2. **Spec** `tests/browser/specs/groups.pw.ts`:
   - **D1** use-site override (`color`, `border-radius`) wins at 320/767/768/1279/1280.
   - **D2** `.panel`'s base `padding: 20px` beats the group's `12px @md 24px` default at all widths;
     `.tile` (no override) proves the default variant still switches at 768.
   - **D3** non-overridden `background` keeps the group value in light/dark and
     `transition-duration` keeps its `@reduced` gate, with the override unaffected.
   - **D4** group `display: flex !important` is not beaten by `.panel`'s plain `display: block`.
   - **D5** pretty/minified/`mediaGrouping: "none"` pages compute identically for the expanded rules,
     with `.badge` values pinning both merged use sites.
   - Shared `page` fixture keeps console errors, page errors, failed requests and HTTP ≥400 as
     failures.
3. **Records**: this task, `.ai/reports/CSSX-A37.md` (## Summary first),
   `.ai/reports/logs/CSSX-A37.log`; plan G4b + aggregate G4 rows.

## Allowed files

`tests/browser/harness/**`, `tests/browser/specs/**`, this task/report/log, the plan's G4b and G4
rows. Nothing else: no `packages/**`, no `tests/compiler/**`, no `tests/fixtures/**`, no docs, no
`PROGRESS`/todo, no examples, no `button.cssx`.

## Constraints

- Deterministic assertions and auto-waiting only; no fixed sleeps; role/label or `data-testid`
  locators.
- Never weaken an assertion to pass. An engine that disagrees with a golden expectation is a
  compiler bug: diagnose, report, do not paper over.
- `bun run verify` and `bun run test:browser` both green before reporting. The G4a watch-test fs
  timeout, if it recurs, is reported, not weakened.

## Acceptance (plan §7 G4b)

- D1–D5 pass in Chromium/Firefox/WebKit; pretty/minify and safe/`none` grouping produce identical
  computed styles for an expanded rule; no new console errors or failed requests; `bun run verify`
  green; the report records per-engine results, scenario files and evidence (output tail).

## Validation

```sh
bunx biome check tests/browser/specs tests/browser/harness
bunx playwright test --project=chromium tests/browser/specs/groups.pw.ts
bunx playwright test --project=firefox --project=webkit tests/browser/specs/groups.pw.ts
bun run test:browser
bun run verify
git status --porcelain tests/browser .ai/plans/CSSX-PLAN-GROUPS.md
```
