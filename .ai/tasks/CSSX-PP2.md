# CSSX-PP2 — metadata and docs finalization (+ PP1 shebang correction)

## Summary

- Stage 1 closes PP1's shebang residual: the CLI source entry moves from `#!/usr/bin/env bun` to
  `#!/usr/bin/env node`, pinned by a source-level test, then rebuilt.
- Stage 2 replaces the placeholder `github.com/chikx/chikx` manifest URLs with the owner-decided
  `github.com/MARKjotep/chikx`, authors the consolidated 0.1.0 changelog, and aligns the v0.1 docs.
- Release gate grows from seven to eight example builds (`portfolio`), and the recorded browser
  totals move to PP0's actuals (96/96, 32 per engine).

## Scope

Write set: `packages/cli/src/index.ts` + its test pin; `packages/vscode/package.json`; root
`package.json` (examples step only); `CHANGELOG.md`; `docs/release.md`, `docs/compatibility.md`,
`docs/cascade.md`, `docs/known-limitations.md`, `docs/usage.md`, `README.md`,
`packages/cli/README.md`; records `.ai/tasks/CSSX-PP2.md`, `.ai/reports/CSSX-PP2.md`,
`.ai/PROGRESS.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md`, plus the PP1 report correction.

## Stage 1 — shebang

1. `packages/cli/src/index.ts` first line → `#!/usr/bin/env node` (Bun executes Node-shebang files).
2. Extend `tests/integration/scaffold.test.ts` to assert the source first line is exactly that.
3. Rebuild, confirm `dist/index.js` first line and `node packages/cli/dist/index.js --version` → 0.
4. Re-run `release:check`; update recorded numbers that moved.

## Stage 2 — PP2

- **PP2a:** swap the slug only in repository `.git`, `#readme` homepage and `/issues` bugs; update
  `docs/release.md` step 1 so it records the replacement. Acceptance: no `chikx/chikx` in
  `packages docs README.md`.
- **PP2b:** one `[0.1.0] - 2026-11-26` entry covering compiler/CLI/extension, `@group` (ADR-0017),
  `$keyframes` (ADR-0015/0018), runtime override (ADR-0016), A45–A51 + U07, the 19-defect campaign,
  CSSX-A52 as breaking, semantic tokens, `examples/portfolio`, `docs/usage.md`, known-limitations
  link. Tag lands at PP4 (bump date if later).
- **PP2c:** add `portfolio` to the release example step + `docs/release.md`; browser counts →
  96/96 / 32 per engine in compatibility/cascade/README; fix stale `import-css`, default-object and
  `src/index.ts` references; verify known-limitations §2 and usage settings.

## Gates (once, in order)

1. `bun run verify` — 1225/2/0 baseline plus the new pin.
2. `bun run release:check` — eight examples, new manifest URLs.
3. `bun run lint`.

## Constraints

No git commands, sequential gates, no dependency changes, no assertion weakening, exit codes
preserved, docs carry actual numbers only. CHANGELOG is user-facing prose, honest for an MVP.
