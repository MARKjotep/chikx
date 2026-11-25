# Chikx Implementation Progress

Owner-locked language decisions (2026-11-25): bare nesting means descendant; `!important` binds per value segment; conditional blocks are rule-scoped in v0.1.

## Implementation Progress

| Item | Deliverable | Acceptance condition | Status |
|---|---|---|---|
| P0 · A01 scaffold + governance | workspaces, tsconfig/biome, SPECIFICATION.md, 10 ADRs, plan/progress files | `bun install`, `bun run typecheck`, `bun run lint`, `bun test`, `bun run verify` all pass (lead-verified 2026-11-25) | 🟢 |
| P0 · A02 contracts + fixtures | frozen token/AST/diagnostic/API types + golden fixture catalog | typecheck passes; fixture catalog complete with golden format (lead-verified 2026-11-25) | 🟢 |
| P1 · A03 lexer | stateful tokenizer + recovery-safe termination | lexer unit tests pass incl. @-boundary lexical cases (lead-verified 2026-11-25) | 🟢 |
| P1 · A04 parser | recursive-descent AST + error recovery | parser tests and recovery pass (lead-verified 2026-11-25) | 🟢 |
| P2 · A05 media lowering | CSS IR + media grouping per cascade contract | golden tests pass (lead-verified 2026-11-25) | 🟢 |
| P2 · A06 nesting + CSS generator | selector lowering + CSS emitter | golden + browser cascade tests pass (lead-verified 2026-11-25) | 🟢 |
| P3 · A07 module resolver | import graph, cycles, workspace bounds | module graph and cycle tests pass (lead-verified 2026-11-25) | 🟢 |
| P3 · A08 variables + runtime tokens | substitution + custom property emission | variable/runtime tests pass (lead-verified 2026-11-25) | 🟢 |
| P4 · A09 naming + class maps | prefix strategy, JS map + .d.ts emission | class map and JSX tests pass (lead-verified 2026-11-25) | 🟢 |
| P4 · A10 output planner | path planning, safety, manifest | masterplan §4 acceptance cases pass (lead-verified 2026-11-25) | 🟢 |
| P5 · A11 CLI + watcher | build/check/watch/clean, exit codes 0/1/2 | end-to-end build/check/watch pass + Node smoke (lead-verified 2026-11-25) | 🟢 |
| P6 · A12 TextMate grammar | tmLanguage + language configuration | highlighting smoke test in extension host (lead-verified 2026-11-25) | 🟢 |
| P6 · A13 providers | completion/hover/diagnostics | extension-host smoke tests pass (lead-verified 2026-11-25) | 🟢 |
| P7 · A14 browser verification suite | cross-browser computed-style matrix | Chromium/Firefox/WebKit computed-style tests pass (lead-verified 2026-11-25; harness delivered early via CSSX-BROWSER-01) | 🟢 |
| P7 · A15 source maps + format + docs + release | sourcemaps, formatter, benchmarks, packaging | full quality gates pass (source maps + formatter complete and lead-verified 2026-11-25; docs/benchmarks/release complete, lead-verified 2026-11-25; vsce extension-name fix tracked in the .cssx sweep) | 🟢 |
| P7 · A16 rule-merge imports | modularization feature per owner decision | merge fixtures + goldens pass; existing goldens unchanged (lead-verified 2026-11-25) | 🟢 |
| P8 · A17 parser semicolon bug | CHIKX1002 when a declaration without `;` precedes a nested `&` rule (owner report, todo item 1) | fixture + parser unit test; ADR-0011 final-declaration allowance intact; lead re-verified CHIKX1002 + CSS emission 2026-11-25; `bun run verify` green at completion | 🟢 |
| P8 · A18 editor intelligence + board | native at-rule completion after `@`; "Add semicolon" quick-fix; `.ai/todo.md` bug/feature board (items 1–5) | extension tests 85/85 lead-verified 2026-11-25; full `bun run verify` green 2026-11-25 (656/39) | 🟢 |
| P8 · A19 keyframes as `$keyframes.<name>` | ADR-0015: keyframe names referenceable + importable via `@use … styles` (owner decision 2026-11-25) | 6 fixtures + 19 unit tests; lead re-verified expansion + CHIKX2001 unknown member 2026-11-25; full `bun run verify` green (656/39) | 🟢 |
| P8 · A20 runtime token merge-order override | ADR-0016: entry `@runtime` wins over style-imported modules on same custom property; local-over-import override stays for compile-time | 5 fixtures + goldens; lead probe-verified entry-wins + module-order (no CHIKX2001) 2026-11-25; `bun run verify` green (677/41) | 🟢 |
| P8 · A21 examples/overrides showcase | `examples/overrides/` sixth example: real `--ui-*` vars, same-name imports, entry-wins override, disambiguation, imported keyframes (+ release wiring, docs list) | builds exit 0 with zero diagnostics; deterministic hash; lead re-verified built CSS 2026-11-25; `bun run verify` green (678/41) | 🟢 |
| P8 · A22 format-on-save | compiler `format()` wired as DocumentFormattingEditProvider + `chikx.editor.formatOnSave` (default off); parse errors never mangle on save | extension tests 94/94 lead-verified 2026-11-25; full `bun run verify` green (677/41); found compiler `printUse` drops `styles` — fix tracked as A24 | 🟢 |
| P8 · A23 `@group.<name>` planning | plan doc `.ai/plans/CSSX-PLAN-GROUPS.md`: reusable groups with use-site override blocks (owner proposal 2026-11-25; masterplan §12 item) | plan persisted (phases G0–G6, 🔴 table); NO implementation until owner answers 3 decision points + ADR-0017 | 🟢 planned |
| P8 · A24 formatter `styles` keyword fix | `packages/compiler/src/formatter` `printUse` must preserve `styles` on `@use` (A22 blocker: save silently downgraded rule-merge imports) | pinned test passing; lead re-verified round-trip (`as m styles` preserved, alias/`as styles`/plain unaffected); `bun run verify` green (678/41) | 🟢 |
| P8 · A25 consolidation | README/FRAMEWORK.md example-count + runtime-conflict-row drift (A21 flagged); add `@use … styles` formatter case to `tests/compiler/formatter.test.ts` (A24 gap) | drift rows updated; new formatter round-trip case (regression-pinned vs HEAD); `bun run verify` green (679/41) | 🟢 |
| P8 · A26 count refresh | FRAMEWORK §8/§11 + README test-count numbers aligned to the current suite | observed 679/41 (worker ran verify twice, identical); no stale counts remain; `bun run verify` green | 🟢 |
| P8 · A27 FRAMEWORK §2 count refresh | §2 rows for `tests/compiler/` and `tests/fixtures/` aligned to the current tree (54 goldens / 13 groups / 25 files) | worker-observed numbers; `bun run verify` green (679/41) | 🟢 |
| P8 · A28 FRAMEWORK §2 text residuals | entry.cssx golden-count note (13: 7 merge, 3 keyframes, 3 runtime) and the 25-suite list in §2 refreshed to the observed tree | worker-verified fragments; `bun run verify` green (679/41, lead re-run 2026-11-25) | 🟢 |
