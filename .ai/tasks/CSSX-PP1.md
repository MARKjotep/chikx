# CSSX-PP1 — Packaging fixes (v0.1 release blockers)

**Status:** 🟢 done · **Plan item:** PP1a / PP1b / PP1 of `.ai/plans/CSSX-PLAN-PRODUCTION.md`
**Scope:** CLI manifest `bin`, VSIX payload, pinned test, docs rows and records

## Summary

- `@chikx/cli`'s `bin` now points at the built `dist/index.js` (Node-compatible ESM) instead of the
  TypeScript source, so invoking the package no longer needs Bun's TypeScript loader.
- A new `packages/vscode/.vscodeignore` drops `src/`, `test/` and `tsconfig.json` from the VSIX; the
  package falls from 84 files / 309.78 KB to 18 files / 134.57 KB.
- The scaffold test now pins `bin === main === "./dist/index.js"`; the docs records carry the actual
  payload numbers.
- Residual (not in this write set): the built CLI keeps the source `#!/usr/bin/env bun` shebang, so a
  plain symlinked `bin` on a Node-only machine still needs Bun. `node dist/index.js` works.

## Acceptance

1. `packages/cli/package.json` `bin.chikx` = `./dist/index.js`; `node packages/cli/dist/index.js
   --version` exits 0 after `bun run --cwd packages/cli build`.
2. No test/doc/manifest pins `src/index.ts` as the bin entry (`grep`).
3. VSIX excludes `src/**`, `test/**`, `tsconfig.json`; keeps `out/extension.js`, `dist/`,
   `syntaxes/`, `media/`, `language-configuration.json`, `LICENSE`, `README.md`; every contributed
   path resolves after unpacking.
4. `bun run verify` green at the PP0 baseline (1225 pass / 2 skip / 0 fail, 89 files; host 14
   scenarios / 856 assertions).
5. `bun run release:check` green end to end.
6. `docs/release.md`, `docs/known-limitations.md` §2 and `README.md` state the shipped behaviour.

## Evidence

`.ai/reports/CSSX-PP1.md` — gate commands, exit codes, durations, VSIX listing and tarball counts.
