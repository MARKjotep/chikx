# CSSX-A10 — Output planner (P4)

## Summary

- Implement the pure output planner in `packages/compiler/src/output/`: resolve every artifact destination from setup/config/CLI inputs per SPECIFICATION.md, with full validation (overlap, duplicate targets, traversal, symlink escapes, extension rules) before anything is written.
- Compute the CSS side-effect import path relative to the JS map directory (forward slashes, `./` when needed) and the manifest entries for watch/clean ownership.
- Cover every acceptance case listed in the spec as unit tests with an in-memory host; the planner never writes.

## Objective

Deliver the `planOutputs` stage: the compiler returns artifacts and never writes (masterplan §6). Resolve CSS, JS class map, declaration and CSS source-map destinations; reject unsafe plans with CHIKX5001; emit deterministic manifest records; keep the barrel unwired because barrel wiring is lead-directed.

## Dependencies

- `SPECIFICATION.md` §9 (normative output configuration), masterplan §4 and §6.
- `docs/decisions/ADR-0007-workspace-root-and-containment.md`,
  `docs/decisions/ADR-0010-class-naming-and-exports.md`.
- Frozen contracts: `packages/compiler/src/types/result.ts` (`PlannedOutput`,
  `OutputPlan`, `ManifestEntry`, `PlanOutputsInput`, `PlanOutputsResult`, `PlanOutputs`),
  `types/options.ts` (`ResolvedSetup`, `CliOutputOverrides`, `OutputOptions`, `ModuleHost`),
  `types/diagnostics.ts` (CHIKX5001).
- Fixtures `tests/fixtures/output/*` (inputs only; expected goldens are owned elsewhere).

## Allowed files (exclusive ownership)

- `packages/compiler/src/output/**` (new)
- `tests/compiler/output*.test.ts`, `tests/compiler/planner*.test.ts` (new)
- `.ai/tasks/CSSX-A10.md`, `.ai/reports/CSSX-A10.md`, `.ai/reports/logs/CSSX-A10.log`

Frozen types, the barrel (`packages/compiler/src/index.ts`), other pipeline modules, fixtures,
docs and configs are out of scope.

## Requirements

1. Public facade `packages/compiler/src/output/index.ts` exports a pure, deterministic
   `planOutputs(input: PlanOutputsInput): PlanOutputsResult` that never writes or throws for expected
   planning failures. An optional context argument supplies a canonicalization host and occupied
   targets for symlink and cross-entry collision checks (frozen input has no host field).
2. Resolution: file-level directories relative to the source file and exact; project-level
   directories relative to the workspace root with source-relative subdirectories preserved;
   defaults css-dir/map-dir = source directory, names `<stem>.css` and `<stem>.map.js`; independent
   directory/name overrides; precedence defaults < project < file setup < CLI.
3. Name rules: basenames only, no separators or traversal, `.css` / `.js` required; `classes.js`
   yields `classes.d.ts`; `theme.css` yields `theme.css.map` when source maps are enabled.
4. Emit consistency: `emit-css: false` requires `import-css: false`; disabled maps suppress types
   with a CHIKX5001 warning unless types were explicitly disabled; no source map when CSS is off.
5. Safety: reject input/output overlap, duplicate targets, workspace escapes, symlink escapes and
   filename traversal with CHIKX5001. External output is always rejected because the frozen contracts
   carry no trusted policy flag.
6. CSS import specifier computed from the JS map directory to the CSS artifact, forward slashes,
   `./` when needed, safely escaped for a double-quoted JS string literal.
7. Manifest: one entry per planned artifact in stable kind order (CSS, JS, types, CSS source map),
   no timestamps.
8. Tests: one named test for each SPECIFICATION.md §9.3 acceptance case plus safety and precedence
   coverage; in-memory/fake host only.

## Acceptance criteria

1. `bun run verify` exit 0; all planner tests pass.
2. Every §9.3 acceptance case is a named test with the exact plan or CHIKX5001 diagnostic.
3. Import paths are correct across sibling directories, nested sources and spaces in paths.
4. Report lists created files, precedence implementation notes, frozen-shape gaps and blockers.

## Validation commands

```sh
bun test tests/compiler/output.test.ts tests/compiler/planner.test.ts
bun run typecheck
bun run lint
bun run verify
```
