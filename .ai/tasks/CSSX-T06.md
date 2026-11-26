# CSSX-T06 — `chikx watch` stalls permanently when a change arrives mid-build

**Status:** 🟢 fixed · **Found by:** TT7 (`.ai/reports/CSSX-TT7.md` "TT7-F1") · **Severity:** high
**Package / API:** `packages/cli` — `commands/watch.ts` (`notify()`, the dispatch loop and the stale
generation discard), `chikx watch` / `chikx watch --json`.

## Summary

- While a build cycle is running, `notify()` finds `wake === undefined` and **drops** the notification.
  When the cycle then discards itself as stale, the loop returns to `waitForWork()` with the invalidating
  change still pending — and nothing wakes it again: the watcher stays silent until an *unrelated*
  filesystem event arrives.
- The discarded generation has already renamed some artifacts into place but never rewrites the manifest,
  so `chikx clean` ownership tracking disagrees with the tree (`hash mismatch …` for the entries it
  wrote).
- Reproducible 3/3 with a 250 ms edit cadence; the release soak (30 s cadence) does not trigger it, which
  is why it survived the campaign's headline soak.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT7.md` "TT7-F1 — `chikx watch` stalls permanently after discarding a stale build generation" |
| Where | `packages/cli/src/commands/watch.ts:96-108` (`notify()` clears/reuses `wake`; drops when undefined) and the dispatch loop `:191-260` |
| Repro | `CHIKX_SOAK=1 CHIKX_SOAK_WATCH_EDITS=5 CHIKX_SOAK_WATCH_INTERVAL_MS=250 bun test tests/stress/soak/watch-soak.test.ts` → stalls on edit 3 (`src/file-002.cssx`), `timed out after 30000ms (possible watcher stall)`; 3/3 runs |
| Observed symptom | `chikx watch: discarded a stale build generation`, then no `build` event for 10 s; the edited file's artifact keeps the previous content |
| Second symptom | manifest/artifact hash mismatch for the entries the discarded generation wrote |
| Not committed as a red test | the trigger is an `fs.watch` timing race, so a pin would be flaky; the committed soak case runs at 1 000 ms and documents why (`tests/stress/soak/helpers.ts`) |

## Expected vs actual

- **Expected:** every accepted change eventually produces a build; a discarded generation writes nothing
  (or rewrites the manifest) so that manifest and tree always agree; the watcher never requires an
  unrelated event to resume.
- **Actual:** the queued change is lost until an unrelated event; the artifact tree can disagree with the
  manifest after a discard.

## Owned files (fix task)

- `packages/cli/src/commands/watch.ts` (wakeup latch + stale-generation guard).
- `tests/stress/soak/watch-soak.test.ts` / `tests/stress/soak/helpers.ts` — lower the committed cadence
  back to a race-reaching value (e.g. 250 ms) as a **regression case** once the stall is fixed, or add a
  dedicated deterministic case in `tests/stress/fs/watch.test.ts` style.
- `docs/known-limitations.md` §3 if any residual single-writer/watch caveat remains.

## Suggested fix direction

Make the wakeup a latch: set a `pendingWake` flag in `notify()` when `wake` is `undefined` and re-check
it before awaiting `waitForWork()` (or skip the await entirely while `pending`/`pendingUnknown`/
`pendingConfig` are non-empty). Secondarily, check `isCurrent()` before the **first** artifact rename so a
discarded generation cannot desync the manifest.

## Acceptance criteria

1. With a 250 ms edit cadence the watcher completes every edit (no stall over ≥ 20 edits), each edit
   produces a fresh artifact, and no generation is discarded more than once per change burst.
2. After a discarded generation the manifest still matches the artifact tree (`chikx clean` follows it
   correctly).
3. The regression case is committed and deterministic enough to run in the default gate (bounded waits,
   documented race window), or the committed soak case uses the reachable cadence.
4. `bun test tests/stress/fs/watch.test.ts`, `bun test tests/integration/cli-watch.test.ts` and
   `bun run verify` green; `CHIKX_SOAK=1 bun test tests/stress/soak/` green.

## Validation

```sh
CHIKX_SOAK=1 CHIKX_SOAK_WATCH_EDITS=5 CHIKX_SOAK_WATCH_INTERVAL_MS=250 bun test tests/stress/soak/watch-soak.test.ts
bun test tests/stress/fs/watch.test.ts tests/integration/cli-watch.test.ts
bun run verify
```

## Fix record

- `packages/cli/src/commands/watch.ts`: `notify()` now sets a `pendingWake` latch when no waiter exists and
  `waitForWork()` returns immediately while it is set, so a change announced mid-build is never dropped.
- `packages/cli/src/commands/build.ts`: the generation is checked immediately before the first artifact
  rename; once writes begin, the manifest is always persisted for the set that landed, so a change arriving
  during the write loop can no longer desync the tree from `.cssx-manifest.json`.
- `tests/stress/soak/helpers.ts`: committed watch cadence restored to the race-reaching 250 ms with a
  comment explaining the regression; `watch-soak.test.ts` allows at most one stale discard per edit.

Validation:

```sh
CHIKX_SOAK=1 CHIKX_SOAK_WATCH_EDITS=5 CHIKX_SOAK_WATCH_INTERVAL_MS=250 bun test tests/stress/soak/watch-soak.test.ts
# pass, edits=5 builds=6 staleDiscards=0 manifest problems=0
CHIKX_SOAK=1 CHIKX_SOAK_WATCH_EDITS=20 CHIKX_SOAK_WATCH_INTERVAL_MS=250 bun test tests/stress/soak/watch-soak.test.ts
# pass, edits=20 builds=20 staleDiscards=0 manifest problems=0
bun test tests/stress/fs/watch.test.ts tests/integration/cli-watch.test.ts   # 8 pass
```

The full `bun run verify` was not run by this worker (the integration worker owns the full gate).
