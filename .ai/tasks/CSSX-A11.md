# CSSX-A11 — CLI, project config, writer, manifest and watcher (P5)

## Summary

- Implement the `chikx` CLI in `packages/cli/src/`: build, check, watch, clean (format accepts and defers to P7), with exit codes 0/1/2 and the full flag set.
- Add `chikx.config.json` loading with schema validation (strict unknown-key rejection) and the project include/exclude glob engine.
- Atomic writes (temp file + rename, per-file), manifest-tracked `clean` (owned + unmodified only), debounced watch with reverse import graph and stale-generation guard; Node smoke test proves runtime compatibility.

## Objective

Complete the standalone compiler milestone: the CLI is usable from build scripts without any editor
and never corrupts previous outputs. Persist this task as `.ai/tasks/CSSX-A11.md` and results as
`.ai/reports/CSSX-A11.md`.

## Dependencies

- `SPECIFICATION.md` §7 (selected here as the CLI contract in masterplan §7), §9.1–§9.2 (output
  resolution, safety, writing), §10 (project configuration), §11 (public API), §12 (diagnostics).
- `.ai/CSSX-MASTERPLAN.md` §7 (CLI) and §4 (output writing/manifest).
- `docs/decisions/ADR-0008-tooling.md` (Bun workspaces, Node >= 20 smoke test, zero runtime deps).
- `docs/decisions/ADR-0007-workspace-root-and-containment.md` (workspace root, containment).
- Public compiler API only: `compile`, `compileProject`, `planOutputs`, `createNodeHost`, `parse`,
  plus public result/option/diagnostic types from `packages/compiler/src/index.ts`.
- Planner context in `.ai/reports/CSSX-A10.md` (precedence, project mirroring, manifest shape,
  frozen-shape gaps).

## Allowed files (exclusive ownership)

- `packages/cli/**` (src, tsconfig, package.json)
- `tests/integration/**` (new test files only; `scaffold.test.ts` assertions untouched)
- `tests/fixtures/cli/**` (new CLI fixture projects)
- `.ai/tasks/CSSX-A11.md`, `.ai/reports/CSSX-A11.md`, `.ai/reports/logs/CSSX-A11.log`

`packages/compiler/**`, root configs, docs and `.ai/PROGRESS.md` are out of scope.

## Requirements

1. Commands: `build [file]`, `watch [file]`, `check [file]`, `clean`, `format [file]` (prints
   "formatting lands in P7", exit 2), `--help`, `--version`. Flags: `--config <path>`, `--json`,
   `--dry-run`, `--minify`/`--no-minify`. No file argument → project build from config include globs
   (config required). A file argument is a single-entry build; it never flattens multiple outputs.
2. Exit codes: 0 success; 1 compile/validation errors (any severity `error` diagnostic, output-plan
   errors, write failures); 2 invocation/config errors (unknown flag, missing/invalid config,
   missing file, format-not-implemented). `check` never writes and reports diagnostics only.
   `--json` prints machine-readable files, written flags and diagnostics with code, severity,
   message, line and column.
3. `chikx.config.json`: `include`/`exclude` globs (`*`, `**`, `?`, `{a,b}`; zero dependencies),
   `output` (camelCase mirror of setup keys; kebab↔camel mapping documented), `classes`
   (strategy/prefix), `media`, `compiler` (strict, mediaGrouping). Schema validation rejects bad
   types always and unknown keys in strict mode (exit 2). Nearest-config resolution walks up from
   the entry file or cwd.
4. Writer: per-file atomicity (temp file in the destination directory, then rename), missing
   directories created, previous outputs retained on error. Manifest `.chikx-manifest.json` at the
   workspace root tracks compiler-owned outputs and hashes; `clean` deletes only manifest-owned,
   unmodified files and reports skipped ones; `--dry-run` lists without touching the disk.
5. Watch: initial full build, then incremental affected entries through the reverse import graph
   derived from `compileProject` results; debounced file events; deletions and config changes
   handled with full rebuilds; writes serialized; stale generations discarded; source `.chikx`
   files only so generated outputs never feed back.
6. Node smoke test: build compiler and CLI `dist` with their package build scripts (`tsc`), run the
   compiled CLI under plain `node`, assert exit codes and artifacts, and verify the compiler
   package's public `main`/`exports` point at the built `dist`.
7. Integration tests: fixture project (2–3 sources, imports, `@setup` dirs/names) → byte-stable
   artifacts at expected paths; check clean/error/no-write; build error keeps last outputs; strict
   config rejection; `--json` shape; clean ownership/modification rules; watch rebuild; atomicity
   proof; Node smoke test.

## Constraints

- CLI imports only compiler public barrel exports; no deep imports.
- Zero new runtime dependencies; globs implemented in-house.
- Deterministic output and reporting; no fixed sleeps for correctness.
- JSDoc on public CLI config types; focused modules.
- Do not mark `.ai/PROGRESS.md`.

## Acceptance criteria

1. `bun run verify` exit 0 with compiler suites untouched and green; all CLI integration tests pass.
2. build/check/watch/clean behave with correct exit codes; Node smoke test passes under plain `node`.
3. Atomic writes proven (failing write leaves the previous artifact intact).
4. Report: created files, config schema decisions, watch architecture, exact Node/Bun evidence,
   blockers.
