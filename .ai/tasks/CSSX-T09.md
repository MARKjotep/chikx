# CSSX-T09 — a project whose include globs match nothing exits 0 with only a warning

**Status:** 🟢 fixed · **Found by:** TT4 (`.ai/reports/CSSX-TT4.md` "Findings for TT8" #1) · **Severity:** medium
**Package / API:** `packages/cli` — `build`/`check` discovery + exit codes (`0` success, `1` build/check
failure, `2` invocation error) and the report/NDJSON shape.

## Summary

- When the configured include globs match no source files, `chikx build` prints a warning and **exits 0**
  (`0 entries, 0 files written`); `--json` reports `success:true, entries:[]`.
- A typo'd or moved source directory therefore turns CI green on an empty build — the silent-green risk
  TT0 flagged. The plan allowed exit 1 or 2 for this row; the shipped behaviour is neither.
- Exit codes are a public CLI contract, so the change needs an owner decision on the code (1 vs 2) and a
  `docs/` + golden update, not just a code edit.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT4.md` "Findings for TT8" row 1 |
| Repro | `chikx.config.json` = `{"include":["nope/**/*.cssx"]}`; `bun packages/cli/src/index.ts build` → exit **0**, `chikx build: 0 entries, 0 files written, 1 warning`; `--json` → `success:true, entries:[]` |
| Committed test | `tests/stress/cli/exit-codes.test.ts` — "Include globs match nothing" row asserts today's exit 0 + warning |
| Docs | `docs/configuration.md` (include), `docs/known-limitations.md` §3, `README` CI usage |

## Expected vs actual

- **Expected (owner decision required):** an empty match set is a build **failure** (exit 1, "no sources
  matched") or an invocation error (exit 2) — or explicitly stays a warning if the owner keeps it. Either
  way the decision is recorded and the behaviour is pinned.
- **Actual:** exit 0 + warning; nothing distinguishes "built nothing by design" from "built nothing
  because the globs are wrong".

## Owned files (fix task)

- `packages/cli/src/commands/build.ts` (and `check` if it shares discovery) + `packages/cli/src/report.ts`
  for the message/JSON field.
- `tests/stress/cli/exit-codes.test.ts` — update the row to the decided exit code; keep the golden
  `tests/stress/cli/golden/*` byte-stable or regenerate deliberately
  (`CHIKX_STRESS_UPDATE_GOLDEN=1`) with the diff reviewed.
- `tests/integration/cli-*.test.ts` only where the current expectation is asserted.
- `docs/configuration.md` / `docs/known-limitations.md` / `README` exit-code tables.

## Suggested fix direction

Follow the arg/config error precedent: an empty discovery result is a *configuration* problem, so exit 2
with `No .cssx sources matched the project include globs.` on stderr and `{success:false, exitCode:2}` in
JSON — unless the owner prefers exit 1 to keep `build` failures uniform. Whichever is chosen, add an
explicit opt-out only if a real use case exists (e.g. a documented `--allow-empty`).

## Acceptance criteria

1. Owner decision recorded in the task/report ("empty match → exit N", rationale).
2. The decided exit code is asserted for `build` and `check`, in text and `--json` form, and the NDJSON
   watch `ready` event stays unaffected.
3. Goldens updated deliberately with a reviewed diff; no assertion weakened.
4. Docs (`docs/configuration.md`, `docs/known-limitations.md` if the risk stays) match the shipped
   behaviour; `bun run verify` green.

## Validation

```sh
bun test tests/stress/cli/
bun test tests/integration/
bun run verify
```

## Fix record

- **Owner decision:** empty match set = configuration error, **exit 2** (per the suggested direction and
  the TT4 exit-code matrix). Rationale: a moved/typo'd source tree must not turn CI green; exit 1 is
  reserved for compile/validation failures, so a discovery problem is an invocation/config error.
- `packages/cli/src/commands/build.ts`, `check.ts`, `watch.ts`: after project resolution, an empty entry
  set returns `invocationFailure` with `No .cssx sources matched the project include globs.` (stderr in
  text mode; `{success:false, exitCode:2, error}` with `--json`). Single-file mode and the watch `ready`
  NDJSON handshake are unchanged.
- `tests/stress/cli/exit-codes.test.ts`: the pinned exit-0 row now asserts exit 2 for `build` and `check`,
  text and `--json`. No golden changed (no golden covered the empty case).
- `docs/configuration.md` (include row + discovery bullets), `docs/known-limitations.md` §3 and the README
  exit-code table record the decided behaviour.

Validation:

```sh
bun test tests/stress/cli/    # 69 pass
bun test tests/integration/   # 55 pass
```
