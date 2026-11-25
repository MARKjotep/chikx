# CSSX-A25 — Close documentation drift from A21 and formatter coverage gap from A24

## Summary

- CSSX-A21 landed `examples/overrides/` (the sixth worked example) but flagged out-of-scope stale
  mentions: root `README.md` still says "five examples", and `FRAMEWORK.md` §2/§8/§11 still describe
  five examples.
- `FRAMEWORK.md` §6's `CHIKX2001` row still lists "conflicting runtime definitions" as an error
  trigger, contradicting ADR-0016 (same-name runtime tokens resolve in merge order, entry last, with
  no diagnostic).
- CSSX-A24 fixed the formatter dropping `styles` on `@use`, but `tests/compiler/**` was owned by
  another task then, so the compiler formatter suite has no `@use … styles` round-trip case;
  coverage lives only in `tests/extension/formatter.current-grammar.test.ts`.
- This task is consolidation only: docs wording plus one new test case. No compiler, package,
  fixture, golden, ADR or specification change.

## Objective

1. Write this task prompt before implementing.
2. `README.md`: include `overrides` in every example-list / "five examples" mention (factual, minimal).
3. `.ai/framework/chikx/FRAMEWORK.md`:
   - §2 `examples/` row: six examples including `overrides`, all built by `release:check`.
   - §6 `CHIKX2001` row: drop "conflicting runtime definitions" as an error trigger, cite ADR-0016,
     and fix the recovery text that still says first definition wins.
   - §8 `release:check` row: 5 → 6 example builds.
   - §11: add a bullet for the six examples (incl. `overrides`, ADR-0016 showcase) and a bullet
     noting the formatter now preserves `@use … styles` (CSSX-A24).
   - Nothing else in that file changes.
4. `tests/compiler/formatter.test.ts`: add a round-trip case proving `@use "./x.cssx" as m styles;`
   and `@use "./x.cssx" styles;` survive `format()`, mirroring the extension suite's assertions
   (including idempotency, and a literal `as styles` alias as the negative control). Update
   fixture-count assertions only if the case requires it.
5. Verify `docs/release.md` already mentions the sixth example (A21 updated it): read-only check.

## Relevant files / exclusive write scope

- `README.md`
- `.ai/framework/chikx/FRAMEWORK.md` (only the rows/bullets named above)
- `tests/compiler/formatter.test.ts`
- `.ai/tasks/CSSX-A25.md`, `.ai/reports/CSSX-A25.md`, `.ai/reports/logs/CSSX-A25.log`

Hard off-limits: everything else, including `packages/**`, `tests/fixtures/**`, `SPECIFICATION.md`,
other `docs/**`, `.ai/PROGRESS.md`, `.ai/todo.md`.

## Dependencies

- ADR-0014 (`@use … styles` rule merge), ADR-0016 (runtime-token merge-order override).
- CSSX-A21 landing `examples/overrides/`, CSSX-A24 formatter fix; FRAMEWORK.md §5.5, §6, §8, §11.

## Constraints

- Documentation stays minimal and factual; no UI/semantics decisions, no new claims.
- Never weaken tests (FRAMEWORK.md §7 invariant 12). New case only; goldens untouched.
- No ad-hoc `bun build` / `tsc` substitutes.
- No commit, push or publish.

## Acceptance criteria

- README and FRAMEWORK rows match the six-example tree and ADR-0016 semantics.
- The new compiler formatter test asserts the exact canonical text for both `styles` forms, fails
  against the pre-A24 printer, and passes now; `format(format(x)) === format(x)`.
- `bun run verify` fully green.

## Validation

- `bun test tests/compiler/formatter.test.ts`
- `bun run verify`
