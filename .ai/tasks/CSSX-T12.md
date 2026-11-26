# CSSX-T12 — `check --dry-run` is silently ignored

**Status:** 🟢 fixed · **Found by:** TT4 (`.ai/reports/CSSX-TT4.md` "Findings for TT8" #4) · **Severity:** low
**Package / API:** `packages/cli` — `commands/check.ts` → `executeBuild({ write:false, dryRun:false })` and
the JSON/NDJSON report envelope.

## Summary

- `chikx check --dry-run --json` accepts the flag and ignores it: the report says `dryRun:false` and every
  output carries `reason:"check"`.
- Nothing is written either way (that is what `check` means), so the impact is a wrong machine-readable
  field: a consumer keying on `dryRun` sees a value that contradicts the invocation.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT4.md` "Findings for TT8" row 4; flag-precedence table row `check --dry-run --json` |
| Repro | `bun packages/cli/src/index.ts check --dry-run --json` → exit 0, `dryRun:false`, all outputs `reason:"check"`, disk untouched |
| Committed test | `tests/stress/cli/precedence.test.ts` — `check --dry-run --json` row; golden `tests/stress/cli/golden/check-json.txt` |
| Sibling behaviour | `build --dry-run --json` → `dryRun:true`, `reason:"dry-run"` |

## Expected vs actual

- **Expected (one of two, decided in the task):** either `check` rejects `--dry-run` as a conflicting flag
  (like `--check` outside `format` does: exit 2 `--check is only valid for chikx format.`), or it honours
  it (`dryRun:true` in the report). Silently accepting and ignoring is the only wrong answer.
- **Actual:** accepted and ignored; the report contradicts the flags.

## Owned files (fix task)

- `packages/cli/src/commands/check.ts` and/or `packages/cli/src/args.ts` (conflict matrix).
- `tests/stress/cli/precedence.test.ts` — pin the decided behaviour; regenerate
  `tests/stress/cli/golden/check-json.txt` only if the report changes (review the diff).
- `docs/` CLI tables if `check` flags are documented there.

## Suggested fix direction

Prefer rejecting the combination in the args layer next to the existing `--check`-outside-`format` rule —
`--dry-run` is meaningless for `check` because `check` never writes — with exit 2 and a message of the same
family. If the owner prefers honouring it, pass `dryRun: true` through to `executeBuild` so the report is
truthful.

## Acceptance criteria

1. `check --dry-run --json` either exits 2 with a conflicting-flag message or reports `dryRun:true` — and
   the chosen behaviour is asserted in `tests/stress/cli/precedence.test.ts` plus documented.
2. `check --json`, `build --dry-run --json`, `clean --dry-run --json` and `format --dry-run --json` are
   unchanged (goldens byte-identical unless deliberately regenerated).
3. `bun test tests/stress/cli/` and `bun run verify` green.

## Validation

```sh
bun test tests/stress/cli/precedence.test.ts
bun test tests/stress/cli/
bun run verify
```

## Fix record

- **Decision:** reject the combination in the args layer, next to the existing `--check`-outside-`format`
  rule. `chikx check --dry-run` → exit 2 `chikx: --dry-run is not valid for chikx check.`; with `--json`
  the failure is the standard `{success:false, exitCode:2, error}` report.
- `packages/cli/src/args.ts`: added the rule; `commands/check.ts` is unchanged (it already never writes).
- `tests/stress/cli/precedence.test.ts`: pinned "ignored" case flipped to the rejection (text and JSON),
  plus an unchanged `check --json` case. `tests/stress/cli/golden/check-json.txt` is byte-identical.
- `docs/configuration.md` §8 and the README flags note document that `--dry-run` is invalid for `check`.

Validation:

```sh
bun test tests/stress/cli/precedence.test.ts  # pass
bun test tests/stress/cli/                    # 69 pass
```
