# CSSX-T11 — `--config --json` consumes `--json` as the config value

**Status:** 🟢 fixed · **Found by:** TT4 (`.ai/reports/CSSX-TT4.md` "Findings for TT8" #3) · **Severity:** low
**Package / API:** `packages/cli` — `args.ts` value-flag parsing (`build`, `check`, `watch`, `clean`,
`format`).

## Summary

- A value-taking flag swallows the next argv token even when it is another flag, so
  `chikx build --config --json` treats `--json` as the config path: exit 2 with the **text** message
  `chikx: Configuration file not found: --json` and empty stdout.
- The exit code is correct; the diagnosis is not. A caller that asked for machine-readable output gets
  text, and the real mistake (a missing `--config` value) is reported as a missing file.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT4.md` "Findings for TT8" row 3; exit-code matrix row "Value flag swallows a following flag" |
| Repro | `bun packages/cli/src/index.ts build --config --json` → exit 2, stderr `chikx: Configuration file not found: --json`, stdout empty |
| Committed test | `tests/stress/cli/exit-codes.test.ts` — "Missing flag value" / value-flag row (`build --config` → exit 2 `chikx: --config requires a path.`) |
| Contrast | `build --config` (nothing after it) already reports `--config requires a path.` |

## Expected vs actual

- **Expected:** a value-taking flag followed by another flag (or end of argv) is a **usage** error:
  `chikx: --config requires a path.` (exit 2), parsed *after* `--json` so the report is JSON when the
  caller asked for it.
- **Actual:** `--json` is consumed as the value, producing a misleading "Configuration file not found"
  text error.

## Owned files (fix task)

- `packages/cli/src/args.ts` (value-flag consumption rule).
- `tests/stress/cli/exit-codes.test.ts` — flip the row to the new message and add the
  `--config --json` and `--config --json` (json first: `--json build --config`) pair.
- `tests/stress/cli/golden/invocation-error-json.txt` — only if the chosen label changes.
- `docs/configuration.md` / CLI usage text if the error wording is documented.

## Suggested fix direction

In the argv walker, refuse to consume a following token that starts with `-` (and is not exactly `-`) as a
flag value; emit the existing "requires a path" usage error instead. This keeps `--config=-` style and
`--json` ordering behaviour unambiguous.

## Acceptance criteria

1. `build --config --json` → exit 2, `chikx: --config requires a path.`, JSON report on stdout when
   `--json` appears before the failure (`build --json --config`), text only when it appears after.
2. All other value flags behave consistently (duplicate `--config`, `--config=x`, `--` terminator).
3. No other exit-code cell or golden changes; the full 0/1/2 matrix in
   `tests/stress/cli/exit-codes.test.ts` stays green.
4. `bun run verify` green.

## Validation

```sh
bun test tests/stress/cli/
bun test tests/integration/cli-config.test.ts
bun run verify
```

## Fix record

- `packages/cli/src/args.ts`: a value flag only consumes the next token when it is not another option
  (`next.startsWith("-") && next !== "-"` is refused). `--config --json`, `--config --config` and an empty
  `--config=` now report `chikx: --config requires a path.`; a bare `-` remains a legal value. The error is
  produced at the point of failure, so `--json` written *before* it yields the JSON report and one written
  after it stays text.
- `tests/stress/cli/exit-codes.test.ts`: pinned "swallowed flag" row flipped to the usage error, with the
  `build --json --config` JSON-order case and the empty inline value added. No exit-code cell or golden
  changed elsewhere.

Validation:

```sh
bun test tests/stress/cli/               # 69 pass
bun test tests/integration/cli-config.test.ts  # pass (part of 55 integration tests)
```
