# CSSX-A41 — seventh example: `examples/groups` (`@group` showcase)

## Summary

- Add `examples/groups/`, a seventh worked example showcasing the shipped reusable declaration
  groups (`@group.<name>`, ADR-0017, plan G0–G5 complete): a style-imported module defining
  `chrome` and `elevated`, use-site overrides where same-property repeats stay in the output,
  an inline `@md` default, a `!important` default that a plain override cannot beat, defining-module
  `$token` resolution that a same-named entry token must not leak into, and runtime customization
  authored at the use site (owner decision (b)).
- Wire the example like `examples/overrides`: one appended `release:check` command, the
  `docs/release.md` example list says seven and names it, and committed deterministic
  `generated/` output plus `.cssx-manifest.json`.
- No compiler, test, extension or other-example source changes; the example is exercised by its own
  CLI build and the existing release wiring.

## Objective

1. Read `AGENTS.md`, `.ai/reports/CSSX-A21.md` (wiring template), `examples/overrides/**`,
   ADR-0017 and `SPECIFICATION.md` §3.7.
2. Create `examples/groups/chikx.config.json` mirroring the overrides config: entries
   `src/**/*.cssx`, modules excluded, prefix `ui`, `strict: true`, `mediaGrouping: "safe"`.
3. Create `examples/groups/src/`:
   - `chrome.cssx` — compile-time tokens plus `@group.chrome` (padding / border-radius / border /
     `box-sizing !important`) and `@group.elevated` (shadow, compile-time background, inline
     `padding: $chrome-padding @md 20px` default).
   - `theme.cssx` — runtime `surface`/`accent` tokens, imported `styles`.
   - `entry.cssx` — both imports, a local same-named `chrome-padding: 40px` that must not change
     the defaults, one rule per demonstration.
4. Build with the CLI, confirm exit 0 and zero diagnostics, then rebuild and byte-compare for
   determinism. Commit the generated CSS/map/types and manifest.
5. Write `examples/groups/README.md`: structure, build command, what each rule demonstrates, the
   v1 exclusions in one line, ADR-0017 link.
6. Append one `release:check` command for `examples/groups` and update the `docs/release.md`
   example list to seven.
7. Run `bun run verify`; write this task, the report and the worker log.

## Owned files

`examples/groups/**`, `package.json` (one appended `release:check` command),
`docs/release.md` (example list only), `.ai/tasks/CSSX-A41.md`,
`.ai/reports/CSSX-A41.md`, `.ai/reports/logs/CSSX-A41.log`.

Off-limits: everything else, including other examples, `packages/**` (parallel workers own
`packages/vscode/**`), `tests/**`, root `README.md`, `FRAMEWORK.md`, `PROGRESS`/`todo`, ADRs,
`SPECIFICATION.md`.

## Dependencies

- ADR-0017 accepted: (a) styles-only visibility, (b) compile-time-only defaults, (c) CHIKX2001.
- Compiler G0–G5 complete and verified (`.ai/reports/CSSX-A30`–`A37`); `bun run verify` baseline
  798 tests / 45 files.
- `examples/overrides` is the structure/config/output template (CSSX-A21).

## Constraints

- Zero diagnostics; deterministic output (two-run byte compare); generated output committed.
- The example must not contradict ADR-0017/§3.7: defaults resolve in the defining module, runtime
  references are rejected in defaults, use-site overrides are emergent cascade (never filtered),
  `!important` binds per value segment (ADR-0003).
- Do not touch unrelated working-tree changes left by parallel workers; no commit/push.

## Acceptance

- `bun packages/cli/src/index.ts build --config examples/groups/chikx.config.json` exits 0 with
  `diagnostics: []`, `warnings: []`, `errors: []`.
- Two consecutive builds produce byte-identical `generated/**` and `.cssx-manifest.json`.
- Built CSS shows: defaults before use-site declarations with same-property repeats preserved;
  inline `@md` default; `!important` default surviving a plain override; defining-module token
  values despite an identically named entry token; use-site `var(--ui-*)` runtime values.
- `release:check` contains the appended command; `docs/release.md` says seven and lists `groups`.
- `bun run verify` green at the 798/45 baseline (no test count change expected).
- Report records the CSS excerpt and command outcomes.
