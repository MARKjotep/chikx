# CSSX-A24 — Formatter must preserve the `@use … styles` clause

## Summary

- The Chikx formatter (`packages/compiler/src/formatter/index.ts`) drops the `styles` clause from
  `@use "./motion.cssx" as m styles;`, printing `@use "./motion.cssx" as m;` instead. That silently
  downgrades a rule-merge import (ADR-0014) to a token-only import — a semantics rewrite on save with
  format-on-save (invariant 2, "never silently drop authored constructs").
- CSSX-A22 reproduced it with a `test.failing` pin in
  `tests/extension/formatter.current-grammar.test.ts` ("styles blocker"). Fixing `printUse` makes
  that test pass.
- This is a pure formatter bug fix enforcing already-specified ADR-0014 / SPECIFICATION.md §6.3
  semantics: no language change, therefore **no new ADR and no SPECIFICATION.md edit**.
- `tests/compiler/**` is off-limits (owned by CSSX-A20); the missing formatter coverage for
  `@use … styles` is added in the extension round-trip suite and noted as a gap for a later
  consolidated task.

## Objective

Make `format()` round-trip the optional `styles` clause of
`@use "<specifier>" [as <alias>] [styles];` byte-exactly (canonical spacing), whatever the alias form.

Canonical output grammar (unchanged style rules elsewhere):

```
@use "<path>" [as <alias>] [styles];
```

## Relevant files / scope

- `packages/compiler/src/formatter/index.ts` — `printUse` (only source change expected).
- `tests/extension/formatter.current-grammar.test.ts` — flip `test.failing` → `test`, keep/strengthen
  the assertion, add round-trip coverage for the bare `@use "…" styles;` form and idempotency.
- `.ai/tasks/CSSX-A24.md`, `.ai/reports/CSSX-A24.md`, `.ai/reports/logs/CSSX-A24.log`.

Read-only: `tests/compiler/formatter.test.ts` (existing coverage check).
Off-limits: `packages/compiler/src/{variables,resolver}/**`, `tests/compiler/**`,
`tests/fixtures/**`, `SPECIFICATION.md`, `docs/**`, `packages/vscode/**`, `.ai/todo.md`,
`.ai/PROGRESS.md`.

## Dependencies

- ADR-0014 (rule-merge imports), FRAMEWORK.md §5.2, §7 invariant 2, §9 bug-fix protocol.
- CSSX-A22 finding (`.ai/reports/CSSX-A22.md`).

## Constraints

- No semantics change; formatter stays a pure `parse → print` pass with no new dependencies.
- Never weaken tests (invariant 12). Do not edit `tests/compiler/**`, even if a golden encodes the
  bug — report it as a blocker instead.
- No ad-hoc `bun build`/`tsc` substitutes.

## Acceptance criteria

- `@use "./motion.cssx" as m styles;` and `@use "./m.cssx" styles;` survive `format()` unchanged
  (modulo canonical spacing of the rest of the file), and `format(format(x)) === format(x)`.
- The pinned CSSX-A22 test is a normal passing `test`.
- No other formatter output changes; any diff where old output encoded the bug is reported precisely.
- `bun run verify` green (or green except explicitly reported out-of-scope failures from the
  concurrent CSSX-A20 worker's in-flight files).

## Validation

- `bun run verify`
- `bun test tests/extension tests/compiler/formatter.test.ts` (the second path read-only)
