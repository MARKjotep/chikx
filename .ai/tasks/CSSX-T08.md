# CSSX-T08 — a running watcher never discovers a brand-new nested directory

**Status:** 🟢 fixed · **Found by:** TT3 (`.ai/reports/CSSX-TT3.md` "Defect 2") · **Severity:** medium
**Package / API:** `packages/cli` — `commands/watch.ts` (event filter `:144`, `syncWatchers` `:159-176`).

## Summary

- `chikx watch` drops any event whose filename does not end in `.cssx`, so the parent directory's event
  for a newly created **directory** is discarded, and no watcher is attached to the new tree. A component
  directory added while the watcher runs stays invisible until the config changes or the watcher
  restarts.
- This directly contradicts `docs/known-limitations.md` §3, which claims "a brand-new deep directory is
  picked up through its parent's event" — TT3 proved it is not. The docs row is corrected in TT8
  (this campaign) and cross-links this task.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT3.md` "Defect 2 — a brand-new nested directory is never discovered by a running watcher" |
| Where | `packages/cli/src/commands/watch.ts:144` (`if (!filename.endsWith(".cssx")) return;`), `syncWatchers` `:159-176` |
| Pinned test | `tests/stress/fs/watch.test.ts:160` ("does not discover a brand-new nested directory (CSSX-TT3 defect) until a full rebuild"), comment at `:171` |
| Repro | watch on `include: ["src/**/*.cssx"]` with `src/one.cssx` → `mkdir src/fresh` + write `src/fresh/five.cssx` → no build within 600 ms, no `out/src/fresh/five.css`; editing `src/one.cssx` rebuilds only `one.cssx`; a config edit recovers |
| Docs contradiction | `docs/known-limitations.md` §3 "Watch is not recursive" row (corrected by TT8 to the actual behaviour, cross-linking this task) |

## Expected vs actual

- **Expected:** creating a directory that matches the include globs (or touching a file inside one)
  triggers a rediscovery that picks up the new sources, without a restart.
- **Actual:** no build, no artifact, silence — the new sources are invisible until the config changes or
  the watcher restarts.

## Owned files (fix task)

- `packages/cli/src/commands/watch.ts` (event classification + `syncWatchers`).
- `tests/stress/fs/watch.test.ts` — **flip** the pinned case (`:160`) into a positive assertion; keep the
  output-feedback guard case (`exclude`d file, `:209`) green.
- `docs/known-limitations.md` §3 row — restore the accurate claim once the fix lands.

## Suggested fix direction

Schedule a full rediscovery for directory events instead of matching only `.cssx` filenames, keeping the
existing output-feedback guard by testing the event path against the known output directory names rather
than by extension. Then `syncWatchers` attaches watchers for the new tree and the pending source builds.

## Acceptance criteria

1. `mkdir src/fresh` + `src/fresh/five.cssx` under a running watcher produces `out/src/fresh/five.css`
   within the debounce window, with no config edit and no restart.
2. Directory removal still prunes artifacts (`tests/stress/fs/watch.test.ts:127` unchanged and green) and
   excluded/output directories still produce no rebuild loop.
3. The pinned case is a positive assertion (no `CSSX-TT3 defect` comment left) and
   `docs/known-limitations.md` §3 matches the shipped behaviour.
4. `bun test tests/stress/fs/watch.test.ts`, `bun test tests/integration/cli-watch.test.ts` and
   `bun run verify` green.

## Validation

```sh
bun test tests/stress/fs/watch.test.ts
bun test tests/integration/cli-watch.test.ts
bun run verify
```

## Fix record

- `packages/cli/src/commands/watch.ts`: the event filter no longer keys on `.cssx` alone. The watcher keeps
  a workspace-relative artifact set from each build report, ignores known artifacts, the manifest and
  writer temporaries, and treats any other non-`.cssx` entry (a created/removed directory in practice) as a
  signal to rediscover the include globs. `syncWatchers` then attaches to the new tree.
- `tests/stress/fs/watch.test.ts`: pinned case flipped to a positive assertion (new nested directory +
  source produce `out/src/fresh/five.css` without a config edit); directory-prune and excluded-output
  cases unchanged and green.
- `docs/known-limitations.md` §3 "Watch is not recursive" row restored to the accurate shipped behaviour.

Validation:

```sh
bun test tests/stress/fs/watch.test.ts          # pass
bun test tests/integration/cli-watch.test.ts    # pass
```
