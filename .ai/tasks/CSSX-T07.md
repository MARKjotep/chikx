# CSSX-T07 — an interrupted build leaves a `.cssx-tmp` orphan that nothing ever sweeps

**Status:** 🟢 fixed · **Found by:** TT3 (`.ai/reports/CSSX-TT3.md` "Defect 1") · **Severity:** low
**Package / API:** `packages/cli` — `writer.ts` (`atomicWrite`) and `commands/clean.ts` (+ `build`).

## Summary

- `atomicWrite` creates `.<name>.<pid>.<counter>.cssx-tmp` in the destination directory and removes it
  only inside its own `catch`. A process killed between `writeFile` and `rename` (SIGKILL, OOM, Ctrl-C at
  the wrong moment) leaves the temporary behind forever: no rebuild sweeps it and `clean` only walks
  manifest records.
- Dot-prefixed litter inside an output directory is published by naive copy steps, and `clean` reports a
  clean workspace while the file is still there.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT3.md` "Defect 1 — an interrupted build leaves a `.cssx-tmp` orphan that nothing ever removes" |
| Where | `packages/cli/src/writer.ts:38-57` (temp created at `:38`, removed only in the `catch` at `:52`); `packages/cli/src/commands/clean.ts:59-87` (manifest records only) |
| Pinned test | `tests/stress/fs/interrupt.test.ts:240` ("an orphaned writer temporary is never swept by a build or a clean (CSSX-TT3 defect)"), comment at `:188` |
| Repro (deterministic) | build once → plant `out/src/.a.css.999999.1.cssx-tmp` → `chikx build` exit 0, no warning, orphan still present → `chikx clean` exit 0, `out/src/a.css` removed, orphan still present |
| Observed under real SIGKILL | 1/5 runs at 120 small entries, 4/5 runs at 200 larger entries; survived every following clean build |

## Expected vs actual

- **Expected:** a build (or `clean`) sweeps stale `*.cssx-tmp` files under the planned output
  directories, or ages them out; nothing a killed process writes survives into a "clean" workspace.
- **Actual:** the orphan survives both `build` and `clean` indefinitely, with no warning.

## Owned files (fix task)

- `packages/cli/src/writer.ts` (temporary naming/sweep helper) and `packages/cli/src/commands/build.ts` /
  `clean.ts` (call the sweep).
- `tests/stress/fs/interrupt.test.ts` — **flip** the pinned case (`:240`) into a positive assertion: after
  the rebuild the planted orphan is gone and `clean` leaves no `*.cssx-tmp` anywhere.
- `docs/known-limitations.md` §3 only if the sweep is left opt-in.

## Suggested fix direction

Add a `sweepTemporaries(directories)` helper that removes `.*.cssx-tmp` files matching the writer's own
pattern (never a plain glob over user files) and call it once per build before planning, and from `clean`.
Keep the writer's in-`catch` cleanup as is.

## Acceptance criteria

1. After a build that starts with a planted `out/src/.a.css.999999.1.cssx-tmp`, the file is gone (and a
   warning is emitted, or silently — but recorded in `docs/`).
2. `clean` also leaves no `*.cssx-tmp` under any output directory.
3. The pinned case in `tests/stress/fs/interrupt.test.ts` is now a positive assertion (no
   `CSSX-TT3 defect` comment left).
4. `bun test tests/stress/fs/`, `bun test tests/integration/` and `bun run verify` green.

## Validation

```sh
bun test tests/stress/fs/interrupt.test.ts
bun test tests/stress/fs/
bun run verify
```

## Fix record

- `packages/cli/src/writer.ts`: added `sweepTemporaries(directories)`, which removes only names matching
  the writer's own `.<artifact>.<pid>.<counter>.cssx-tmp` pattern (never a plain glob).
- `packages/cli/src/commands/build.ts`: sweeps the workspace root and every planned output directory
  before writing; `packages/cli/src/commands/clean.ts` sweeps the root, configured output directories and
  every manifest record directory. Silent by design (these were never artifacts); recorded in
  `docs/known-limitations.md` §3 and `docs/configuration.md` §7.
- `tests/stress/fs/interrupt.test.ts`: both pinned assertions flipped — the post-SIGKILL residue and the
  planted orphan are gone after a rebuild, and `clean` leaves no `*.cssx-tmp` anywhere.

Validation:

```sh
bun test tests/stress/fs/interrupt.test.ts   # pass
bun test tests/stress/fs/                    # 54 pass
bun test tests/integration/                  # 55 pass
```
