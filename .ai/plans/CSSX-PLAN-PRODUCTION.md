# Chikx Plan — Production readiness (v0.1 release)

**Status:** all phases open 🔴. This plan defines future work only; nothing in it has been executed.
Created 2026-11-26 against the editor-intelligence handover `.ai/HANDOVER.md` (A45–A51 landed,
`bun run verify` 892 pass / 0 fail across 45 files).

The language, compiler, CLI and editor surface are feature-complete for v0.1: the remaining work is
release engineering, not semantics. Two packaging gaps are recorded as release blockers in
`docs/known-limitations.md` §2 (the CLI `bin` entry pointing at TypeScript source, and the untrimmed
VSIX payload), the extension manifest still carries placeholder `github.com/chikx/chikx` URLs
(`docs/release.md` "Manual pre-release steps"), and the deferred editor smoke checks from the wave need
a real Extension Development Host. `bun run release:check` (`docs/release.md` "Aggregate gate") is the
authoritative gate for every phase below; publishing is irreversible per its "Rollback" section — a bad
release is superseded by a new version, never withdrawn.

Ownership: every phase is executed by `code` with lead verification of the gate results; PP4 requires
explicit owner authorization before any commit, push, tag or publish.

## Implementation Progress

| Phase / item | Deliverable | Acceptance condition | Status |
|---|---|---|---|
| PP0 · Baseline re-verification | Run `bun run verify`, `bun run test:browser`, full `bun run release:check`; record actual numbers/durations in this table | All three green; recorded results match the plan (test files, pass counts, browser totals, VSIX size) | 🔴 |
| PP1a · CLI `bin` entry | `@chikx/cli` `bin` → Node-compatible `dist` entry; affected tests and docs updated | `node packages/cli/dist/index.js --version` works from a clean checkout after build; `bun test`/`bun run verify` green; `docs/known-limitations.md` §2 row and `docs/release.md` payload rows updated | 🔴 |
| PP1b · VSIX payload | `.vscodeignore` in `packages/vscode` excluding `src/`, `test/`, `tsconfig.json` | `vsce package` succeeds; recorded file count/size in `docs/release.md` refreshed; extension still activates from the trimmed VSIX | 🔴 |
| PP1 · Packaging gate | Both fixes integrated | `bun run release:check` green; tarball and VSIX contents inspected (`npm pack --dry-run --json`, `unzip -l`) | 🔴 |
| PP2a · Manifest URLs | Replace placeholder `https://github.com/chikx/chikx` repository/homepage URLs | **Owner decision required** (canonical repo URL); manifest consistent across compiler/CLI/extension | 🔴 |
| PP2b · CHANGELOG 0.1.0 | `CHANGELOG.md` entry for 0.1.0 | Entry lists the shipped feature set and links the known limitations; matches tag date | 🔴 |
| PP2c · Docs consistency | README (already refreshed), `docs/known-limitations.md`, `docs/release.md` aligned with PP1/PP2 changes | No stale counts, paths or placeholder URLs remain in the v0.1 docs; lint green | 🔴 |
| PP3 · Editor manual smoke | Run the 7-item checklist from `.ai/HANDOVER.md` in an Extension Development Host | Each item verified, or explicitly recorded as not verifiable in this environment with the reason | 🔴 |
| PP3 · Deferred harness (optional) | Extend `packages/vscode/test/suite.js` for A51 adapter behavior (suggest-widget swatches, native picker via `colorsAt()`) | New smoke assertions pass in the extension host; no assertion weakening elsewhere | 🔴 |
| PP4 · Release execution | Tag v0.1.0, commit per owner instructions, publish compiler + CLI + extension | **Explicit owner authorization first**; `npm publish --workspace @chikx/compiler`, `--workspace @chikx/cli`, `vsce publish` all succeed | 🔴 |
| PP5 · Post-release verification | Install from registry and marketplace in a clean environment; run the README quick start end to end | Checklist recorded in `.ai/reports/`: `npx chikx --version`, `bunx chikx --version`, VSIX/marketplace install, quick start builds and renders | 🔴 |

## PP0 — Baseline re-verification

Deliverables: a recorded baseline before any release edit, so PP1 regressions are attributable.

1. `bun run verify` — expect 892 pass / 0 fail across 45 files (typecheck, Biome, unit/integration/
   extension-provider suites); record the exact counts.
2. `bun run test:browser` — expect the recorded 75/75 Playwright totals on Chromium, Firefox and
   WebKit (`docs/cascade.md` §5); record which engines actually ran here.
3. `bun run release:check` — the full aggregate gate from `docs/release.md`, including both builds,
   package metadata assertions, `npm pack --dry-run` checks, all seven examples and `vsce package`;
   record the produced `chikx-0.1.0.vsix` size and file count.

Dependencies: none (current working tree, uncommitted A45–A51 changes included).
Exit criteria: all three green with numbers pasted into the progress rows above. Any pre-existing
failure is reported separately and blocks PP4, not the docs work in PP1/PP2.

## PP1 — Packaging fixes

These are the two v0.1 release blockers in `docs/known-limitations.md` §2; nothing else in that table
is in scope.

**PP1a — CLI `bin` entry.** `packages/cli/package.json` declares `"bin": { "chikx": "src/index.ts" }`,
which only runs under Bun's TypeScript loader. Point it at the built Node-compatible entry
(`dist/index.js`, already the package `main`), update every test/doc that pins the `src` path
(`tests/integration/node-smoke/` expectations, `docs/known-limitations.md` §2, `docs/release.md`
tarball rows, the README install note once true), and confirm `node packages/cli/dist/index.js
--version` succeeds after a build. The tarball must still ship `dist/**` and whatever `src/**` the
recorded contents list claims — keep `docs/release.md` honest either way.

**PP1b — VSIX payload.** Add `packages/vscode/.vscodeignore` excluding `src/`, `test/` and
`tsconfig.json` (keep `dist/`, `out/`, `syntaxes/`, `media/`, `LICENSE`, `README.md`,
`language-configuration.json`). Re-run the packaging step and refresh the recorded
`DONE Packaged: … (N files, S KB)` line in `docs/release.md`.

Dependencies: PP0.
Exit criteria: `bun run release:check` still green; Node-only CLI invocation works without Bun;
`npm pack --dry-run --json` and `unzip -l chikx-0.1.0.vsix` contents inspected and consistent with the
recorded docs.

## PP2 — Metadata and docs finalization

- Replace the placeholder `https://github.com/chikx/chikx` repository/homepage URLs in
  `packages/vscode/package.json` (and any identical placeholders elsewhere). **Blocked on an owner
  decision**: the plan cannot invent the canonical URL, so this row stays 🔴 until the owner answers.
- Author the 0.1.0 `CHANGELOG.md` entry from the shipped surface (compiler, CLI, VS Code extension,
  groups, keyframes, editor intelligence) and the honest limits in `docs/known-limitations.md`.
- README refresh is done as part of creating this plan; re-check its counts and install note after
  PP1a lands so the `src/index.ts` caveat disappears if the `bin` fix makes it obsolete.
- Update the `docs/known-limitations.md` §2 rows after PP1 (a fixed gap moves out of the blockers
  table, or the row states the new behavior).

Dependencies: PP1 for the docs rows; the URL replacement can run any time after the owner answer.
Exit criteria: no placeholder URLs, no stale counts or paths, CHANGELOG present for 0.1.0, lint green.

## PP3 — Editor manual smoke and the deferred harness

Run the 7-item checklist recorded in `.ai/HANDOVER.md` in a real Extension Development Host:
colour property shows 148 named colors + 35 hex (kind Color) while `width:` shows neither; `#f0`
narrows and accepts without duplication; `width: (` lists 25 functions and `clamp(` accept replaces
the paren; property accept leaves the cursor before `;`; `margin: 1` offers units and `1r` completes
`rem`; `&:` / `&.` accept keeps the colon/dot and property completion works above an `&` line; named
and hex values show clickable swatches and the picker writes lowercase hex.

A51's adapter behavior (suggest-widget swatches, native picker) is unit-tested and typecheck-verified
only. Optionally extend `packages/vscode/test/suite.js` with smoke assertions that drive
`colorsAt()` and the colour-provider registration; anything the harness cannot observe stays on the
manual list.

Dependencies: PP0 (green baseline); can run in parallel with PP1/PP2.
Exit criteria: all 7 items verified, or recorded as not verifiable here with the exact reason. Do not
mark items passed from unit tests alone — the handover explicitly separates the two.

## PP4 — Release execution (owner-authorized only)

No commit, push, tag or publish happens without explicit owner authorization; the working tree also
contains pre-existing uncommitted work and deletions that must be preserved as the owner left them.

1. Tag `v0.1.0` on the authorized commit.
2. `npm publish --workspace @chikx/compiler`
3. `npm publish --workspace @chikx/cli`
4. `cd packages/vscode && vsce publish` (Marketplace; publisher `chikx`)

Dependencies: PP0–PP3 complete including the PP2a URL decision; `bun run release:check` green
immediately before publishing.
Exit criteria: both npm packages resolvable at 0.1.0 and the extension published. Publishing is
**irreversible** (`docs/release.md` "Rollback"): the only remedy for a bad release is a new version.

## PP5 — Post-release verification

From a clean environment (fresh profile, no workspace symlinks):

1. `npm i @chikx/cli && npx chikx --version`; `bunx chikx --version`.
2. Install the published extension (Marketplace) and the local VSIX in a clean profile; confirm
   activation, diagnostics, completion and swatches.
3. Run the README quick start end to end: config, `chikx build`, generated CSS/map/types, JSX import.

Dependencies: PP4.
Exit criteria: a checklist with actual outputs recorded in `.ai/reports/` (not this plan); any
mismatch opens a follow-up task rather than an in-place edit to the published claim.

## Out of scope / deferred

- Token completion inside function arguments (`calc($ui.space|)`).
- A language server (LSP) for editors other than VS Code (`docs/known-limitations.md` §1).
- Cross-module rename of tokens and classes.
- In-extension-host smoke for A51 adapter behavior if PP3 leaves it on the manual checklist.
- Editor formatting beyond the document-level parse→print pass.
- Any compiler, CLI or language-service semantics work: v0.1 ships the current language, these phases
  only package and publish it.
