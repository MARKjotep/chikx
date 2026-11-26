# Task · CSSX-STALE-DIAGS

## Summary

- An open importer kept its old diagnostics after a `$token` or `@runtime` member was renamed in a
  defining module; the compiler was already correct (`chikx check` reports `CHIKX2001`).
- The editor's per-document analysis cache and pending debounces never invalidated importers when a
  dependency changed, so the importer was only re-analyzed after its own edit.
- Reproduce in the real extension host first (red), then invalidate cached document states on `.cssx`
  change/save/close and re-schedule every open `.cssx` document on the existing debounce.
- Pin the compiler/CLI side with a CLI `check` test for a missing `$` member; keep compiler/CLI source
  unchanged.

## Objective

1. **Repro (red first):** temp workspace with `tokens.cssx`
   (`@setup { module: true; }` + `@variables { space: 8px; }`) and `main.cssx`
   (`@use "./tokens.cssx" as t;` + `.x { padding: $t.space; }`). Open both, assert clean, rename the
   module key to `gap`, save, and assert `CHIKX2001` appears in `main.cssx` without editing it; fix
   `main.cssx` to `$t.gap` and assert it clears. Repeat for `@runtime { colors: … }` / `$t.colors`.
   Re-assert that the module's own diagnostics refresh on its own edit.
2. **Fix:** `AnalysisService.invalidateAll()` drops every cached state, pending debounce and
   bumps a generation so an analysis spanning the invalidation is neither cached nor notified.
   `ChikxController` calls it on `.cssx` change/save/close and re-schedules all open `.cssx`
   documents; the save path refreshes the saved document immediately and debounces the rest.
3. **CLI pin:** an importer referencing a missing `$` member reports `CHIKX2001` and `chikx check`
   exits 1, with JSON diagnostics and no writes.
4. **Docs/records:** known limitations §5, CHANGELOG `[0.1.0]` Fixed, board bug 26, plan row, this
   task and its report.

## Relevant / allowed files

- `packages/vscode/src/service.ts`, `controller.ts` (invalidation/wiring only)
- `packages/vscode/test/ui/module-refresh.js`, `packages/vscode/test/suite.js`
- `tests/extension/provider.analysis.test.ts`, `tests/integration/cli-build.test.ts`
- `docs/known-limitations.md`, `CHANGELOG.md`, `.ai/todo.md`,
  `.ai/plans/CSSX-PLAN-PRODUCTION.md`, `.ai/tasks/CSSX-STALE-DIAGS.md`,
  `.ai/reports/CSSX-STALE-DIAGS.md`

No compiler/CLI source changes, no examples.

## Constraints

- Repro red before the fix; waits poll observable host diagnostics, never fixed sleeps.
- No watcher or background poller; reuse the existing 150 ms debounced service/controller wiring.
- No assertion weakening; preserve the uncommitted tree; no git commands.

## Acceptance criteria

1. Importer diagnostics update after a dependency rename/save without touching the importer, for
   both `$token` and `@runtime`; they clear after the reference is fixed.
2. No watcher/poller; debounce preserved; no diagnostics thrash.
3. CLI pin: missing `$` member → `CHIKX2001`, `check` exit 1.
4. Docs/records persisted.
5. `bun run verify`, `bun run release:check`, `bun run lint` green.

## Validation commands

`bun test tests/extension/host.test.ts` (red before, green after), `bun run verify`,
`bun run release:check`, `bun run lint`.

## Handoff

Implemented and verified; see `.ai/reports/CSSX-STALE-DIAGS.md`.
