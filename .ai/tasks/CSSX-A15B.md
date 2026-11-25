# CSSX-A15B — Phase 7: docs, benchmarks and release readiness

## Summary

- Write the real documentation: full README, `docs/grammar`, `docs/cascade` (with browser-evidence
  pointers), `docs/configuration`, compatibility matrix, known limitations, and fill the five
  `examples/` directories with working, buildable examples.
- Run the masterplan §9 benchmarks (100 and 1,000 files: cold build, incremental build, memory) with
  a repeatable script and record honest numbers in `docs/performance.md` — measure, do not promise.
- Release readiness: `CHANGELOG.md`, `LICENSE` (MIT, root), package metadata validation,
  `npm pack --dry-run` tarball checks for compiler+cli, `@vscode/vsce` package for the extension, a
  `bun run release:check` aggregate script, and the `@vscode/test-electron` framework record under
  `.ai/framework/`.

## Objective

Make the project releasable and documented per masterplan §11. Persist this task as
`.ai/tasks/CSSX-A15B.md` and results as `.ai/reports/CSSX-A15B.md`.

## Allowed files (exclusive ownership — do not touch anything else)

- `README.md`, `CHANGELOG.md`, `LICENSE`, `docs/**` (grammar/, cascade/, configuration/, decisions/
  untouched — ADRs stay), `examples/**`
- `scripts/benchmark.ts` (new) + root `package.json` (add `benchmark` + `release:check` scripts ONLY)
- `.ai/framework/vscode-test-electron/**` (new record)
- `.ai/tasks/CSSX-A15B.md`, `.ai/reports/CSSX-A15B.md`, `.ai/reports/logs/CSSX-A15B.log`
- `packages/vscode/package.json` + `packages/vscode/CHANGELOG.md` ONLY the metadata fields vsce
  requires (publisher, repository, license, homepage/bugs) and an existing `README.md` for the
  extension — do not change its scripts/dependencies.

Do NOT touch `packages/compiler/**`, `packages/cli/**`, `packages/language-service/**`, tests (except
running them), `tests/browser/**`, `.ai/PROGRESS.md`, SPECIFICATION.md, protected AGENTS.md files.
Another worker owns emitter/formatter/CLI-format — stay out of `packages/compiler/src/**` and
`packages/cli/src/**` entirely.

## Requirements

1. **README.md** (rewrite the stub): what chikx is (one paragraph + the canonical example from
   SPECIFICATION.md §2), install (`bun add @chikx/compiler` / CLI), quick start (write → build → use
   the map in JSX), output configuration table summary, CLI command list with flags + exit codes,
   VS Code extension summary (highlighting, completions, diagnostics, preview, compile-on-save off by
   default), testing/quality gates, repo layout, license. Link to SPECIFICATION.md and docs/.
2. **docs/grammar.md**: the full grammar (EBNF from SPECIFICATION.md §3.2) + lexical rules
   (@-recognition, escapes, strings) + owner-locked decisions D1–D3 inline. **docs/cascade.md**: the
   cascade contract in full (§3.3), with explicit worked examples (base-then-variant order,
   later-base-overrides-earlier-conditional, safe grouping rules, what is NOT done — no reordering
   promises), plus a pointer to the browser evidence: `tests/browser/specs/` and how to run
   `bun run test:browser`.
3. **docs/configuration.md**: every `@setup` key and `chikx.config.json` key (from SPECIFICATION.md
   §output/§project configuration) with defaults, precedence, kebab↔camel mapping, safety rules
   (overlap/traversal/symlink), and the emit-flag consistency rules.
4. **docs/compatibility.md**: compatibility matrix — supported: nested selectors (flat output), media
   aliases + combinations, variables/imports, runtime tokens, native at-rule passthrough list
   (`@media`, `@supports`, `@layer`, `@container`, `@keyframes`, `@font-face`, `@property`, `@page`),
   `:global`, prefix naming; NOT supported in v0.1 (from the Deferred lists + A05/A11/A13 known
   limitations): mixins, container aliases, inline pseudo-state modifiers, hashing/file-scoped naming,
   top-level conditional blocks, comma-list alias definitions, cross-CLI rename, source-map status
   (state it honestly — in progress at A15A), formatter status, CSS language-server projection. Be
   honest per masterplan §11 ("Avoid claiming full CSS compatibility until tested").
5. **examples/** (five working examples, each with README + .chikx sources + expected/built outputs
   committed under `examples/<name>/generated/` built via `bun run --cwd packages/cli build` or
   `compile()`): `basic` (§2 canonical), `responsive` (media variants + combined + block conditions),
   `variables` (compile-time + imports + runtime tokens), `jsx` (a tiny React component + the generated
   map usage, no React dependency needed — show the import), `custom-output` (setup dirs/names +
   import-css off variant). Each example must build clean via the CLI (prove it in your validation).
6. **Benchmarks** (`scripts/benchmark.ts`): generate 100 / 1,000 synthetic source files (deterministic
   generator: rules + variants + tokens + an import chain), measure: cold project build (wall time),
   single-file incremental recompile (via compile() on one file, excluding fs write), peak memory
   (process.memoryUsage), and a cached-parse completion-relevant proxy if meaningful — run each 5
   times, report median. Write `docs/performance.md` with the actual numbers, the machine context
   (Apple Silicon/Node/Bun versions), and the §9 targets marked "measured" — do NOT claim targets are
   met unless they are; record misses honestly.
7. **Release readiness**: root `CHANGELOG.md` (0.1.0: full feature list from the phases); root
   `LICENSE` (MIT, author Marky per package.json) if missing; `bun run release:check` script = verify
   + test:browser + `npm pack --dry-run` for compiler/cli (assert file lists: dist + README + LICENSE +
   package.json) + `bunx @vscode/vsce package` for the extension into `packages/vscode/chikx-*.vsix`
   (add vsix pattern to .gitignore at root — allowed as part of this line) + example builds. Add the
   vsce-required metadata to `packages/vscode/package.json` (publisher `chikx`, repository, license,
   bugs/homepage) and a short extension `CHANGELOG.md`.
8. **Framework record** (per `.ai/agents/AGENTS.md` rules):
   `.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md` — summary:
   @vscode/test-electron 2.5.2 cannot use the removed macOS `Electron` launcher binary of VS Code
   1.147.0; affected API: `runTests` on macOS; framework version: `@vscode/test-electron 2.5.2` +
   VS Code 1.147.0 (exact, verified from package metadata/install); reproduction + expected/actual
   behavior; evidence: A13's real extension-host run; workaround: resolve `.../MacOS/Code` binary
   manually (as A13 does); status: open upstream. Follow the record format in the workflow doc.

## Constraints

- Honest documentation: no claims beyond tested behavior; every unsupported feature listed.
- Zero new runtime dependencies; devDeps only for vsce IF needed (`@vscode/vsce` as devDep at root or
  `bunx` — prefer bunx without install; if vsce refuses without install, add it as a root
  devDependency and record why).
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.
- `bun run verify` must stay green; do not break any suite.

## Acceptance criteria

1. `bun run verify` exit 0; `bun run release:check` runs end-to-end (record each sub-result; vsce
   packaging either succeeds producing a vsix or the exact blocker is documented).
2. All five examples build clean via the CLI with committed generated outputs.
3. `docs/*.md` complete and honest; performance numbers measured with environment context;
   compatibility matrix lists every v0.1 gap.
4. Framework record exists with exact verified versions.
5. Report: created files, benchmark numbers, release-check results, blockers.

## Validation commands

```sh
bun run verify
bun run benchmark
bun run release:check
for d in examples/*/; do (cd "$d" && bun ../../../packages/cli/src/index.ts build); done
```
