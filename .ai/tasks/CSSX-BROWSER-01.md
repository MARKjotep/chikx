# CSSX-BROWSER-01 — Browser verification infrastructure (P2/7)

## Summary

- Set up Playwright in the repo (`@playwright/test` as a root devDependency) and create the browser test infrastructure under `tests/browser/`.
- Build a harness that compiles chikx fixture sources to real CSS with the public compiler API and loads them in generated HTML pages.
- Author computed-style specs per masterplan §9: viewports 320/767/768/1279/1280, light/dark, reduced motion, hover/focus/disabled, combined conditions, overlapping selectors/specificity, and pretty-vs-minified computed equality. Run Chromium; report engine availability.

## Objective

Make the cascade contract verifiable in real browsers — the masterplan's core quality gate. Persist this task as `.ai/tasks/CSSX-BROWSER-01.md` and results as `.ai/reports/CSSX-BROWSER-01.md`.

## Dependencies

- `SPECIFICATION.md` §3.3 (declarations, variants, `!important`) and §5 (cascade contract).
- `SPECIFICATION.md` §4.1 default media aliases (sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536).
- Masterplan §9 browser requirements (computed styles, viewports, schemes, states, minified/pretty).
- `docs/decisions/ADR-0008-tooling.md` (dev tooling at workspace root, zero compiler runtime deps).
- Public compiler API `packages/compiler/src/index.ts` (`compile`, `createNodeHost`).

## Allowed files (exclusive ownership)

- `tests/browser/**` (new: Playwright config, harness, HTML templates, spec files, compiled-CSS build step, `.gitignore` for artifacts)
- Root `package.json` (devDependencies: add `@playwright/test` ONLY; scripts: add `"test:browser": "playwright test"` ONLY) — nothing else in the root
- `.ai/tasks/CSSX-BROWSER-01.md`, `.ai/reports/CSSX-BROWSER-01.md`, `.ai/reports/logs/CSSX-BROWSER-01.log`

Do NOT touch `packages/**`, `tests/fixtures/**` (read-only), other tests, docs. Import the compiler ONLY via its public barrel (`@chikx/compiler` source path `../..`/`packages/compiler/src/index.ts` is fine for the harness build step — document the import path).

## Requirements

1. **Install**: `bun add -d @playwright/test` then `bunx playwright install chromium` (attempt firefox/webkit too; if downloads fail in this environment, record it and scope the suite to Chromium — report exactly what is installed).
2. **Harness** (`tests/browser/harness/`): a build step (run by a Playwright `globalSetup` or a beforeAll) that compiles selected fixture sources with `compile()`/lowering-emitter APIs into `tests/browser/dist/` — one CSS per scenario, BOTH pretty and minified variants. Scenarios (compile these small chikx sources inline in the harness — they are browser test data, NOT new fixture directories):
   - `inline-variants`: `padding: 12px @md 20px @xl 32px;` + `font-size: 14px @md 16px;`
   - `combined`: `background: white @dark #181818 @xl+dark #101010;`
   - `block-conditions`: `@md { display: grid; gap: 24px; }` + `@compact`-style custom alias via `@media-types` if expressible, else portrait
   - `specificity`: overlapping selectors `.card.card` vs `.card` and duplicated declarations order
   - `runtime`: `@runtime { primary: #2563eb @dark #60a5fa; }` + `color: $primary;`
   - `states`: `&:hover`, `&:focus`, `&:disabled` opacity rules
   - `reduced`: `animation`/`transition` gated behind `@reduced`
   - `nesting`: `& > .icon { width: 16px @lg 20px; }`
   - HTML template per scenario loading the compiled CSS (link tag) with stable test ids; also a minified twin page set.
3. **Specs** (`tests/browser/*.spec.ts`) with `@playwright/test`:
   - **Viewport cascade**: assert computed padding/font-size at 320, 767, 768, 1279, 1280 px viewport widths — base below 768, md from 768, xl from 1280 (the exact boundaries in SPECIFICATION.md §3.2 defaults).
   - **Color scheme**: `colorScheme: "light"` vs `"dark"` emulation — `background`/`color` flip; combined `@xl+dark` only applies at ≥1280 AND dark.
   - **Reduced motion**: `reducedMotion: "reduce"` emulation gates the transition/animation.
   - **States**: hover via `page.hover`, focus via `page.focus`, disabled via disabled attribute — computed opacity changes per rules.
   - **Specificity**: `.card.card` wins over `.card` regardless of order; duplicate declarations — later wins.
   - **Runtime**: light/dark flips `color` via custom property; the `--ui-primary` custom property value visible on computed style.
   - **Pretty vs minified**: for EVERY scenario, computed styles of the pretty page and minified page must be deep-equal at all viewports (masterplan §9 requirement).
   - **No console errors** and no failed requests on every page (page.on listener assertions).
4. **Config**: `playwright.config.ts` — `testDir: tests/browser/specs` (or equivalent), projects: chromium (plus firefox/webkit only if installed), retries 0, fullyParallel off (deterministic), report list. Add `tests/browser/dist` + `test-results` to `tests/browser/.gitignore`.
5. Run `bunx playwright test` and record actual results. If the environment cannot install browsers, mark the suite `test.skip` with a clear reason, still deliver all files, and report the blocker — do NOT fake passes.

## Constraints

- Zero runtime deps for the harness beyond `@playwright/test` (dev-only at root); compiler imported via public API only; deterministic (no sleeps — Playwright auto-waiting only).
- Do not modify `bun run verify` scripts; the browser gate runs via `bun run test:browser` and is reported separately.
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run test:browser` executes; Chromium results recorded (pass/skip with reason).
2. All listed scenarios + pretty/minified equality + console/request cleanliness asserted.
3. Harness compiles fixture CSS through the public compiler API (no hand-written CSS in the harness).
4. Report: installed engines, scenario list, actual pass/fail evidence, any environment limitations, blockers.

## Validation commands

```sh
bun add -d @playwright/test
bunx playwright install chromium
bunx playwright install firefox
bunx playwright install webkit
bun run test:browser
```

## Implementation notes (recorded during execution)

- Playwright only discovers `playwright.config.ts` from the invocation directory, and the required
  script is exactly `playwright test`; the config therefore lives at the repo root. No other root
  file besides `package.json`, `bun.lock` (dependency install) and this config is touched.
- Playwright specs are named `*.pw.ts` and `testMatch: "**/*.pw.ts"` is set. Bun's own test runner
  discovers `*.spec.ts`, so `.spec.ts` browser files would be executed by `bun test` and break the
  `verify` gate; the `.pw.ts` naming keeps `bun test` clean without weakening Playwright coverage.
- Extra masterplan §9 check: each scenario is also compiled with `mediaGrouping: "none"` and compared
  against the default `"safe"` output at every viewport and color scheme.
- Missing-browser fallback: `skipBrowserIfMissing()` is registered per spec file, so an absent
  binary reports skipped tests with a reason instead of launch failures.

## Handoff

Return changed files, actual results, evidence and blockers to the lead. Do not mark plan/progress statuses.
