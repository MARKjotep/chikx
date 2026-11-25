# CSSX-A06 — Selector flattening + CSS emitter (P2)

## Summary

- Implement selector flattening (nested `&`/descendant rules → flat selectors per ADR-0002/ADR-0012) in `packages/compiler/src/selectors/`.
- Implement the deterministic CSS emitter in `packages/compiler/src/emitter/`: pretty and `minify` modes, native at-rule composition with Chikx conditions, declaration order preserved.
- Author golden CSS for the fixture catalog (fixtures without `$` references) and pin the emitter with unit tests. Browser cascade validation follows this task via the lead.

## Objective

Turn `StylesheetIr` into real CSS text — the compiler's primary output. Persist this task as
`.ai/tasks/CSSX-A06.md` and results as `.ai/reports/CSSX-A06.md`.

## Dependencies

- `SPECIFICATION.md` §3.3 (cascade contract), §3.5 (native at-rules), §2 (canonical example), §7.1
  (supported nesting and `:is(...)` specificity), §9 (`minify` owner requirement), §12 diagnostics.
- `docs/decisions/ADR-0002-descendant-nesting.md`, `ADR-0012-ampersand-substitution.md`,
  `ADR-0003-important-per-segment.md`.
- Frozen IR `packages/compiler/src/ir/types.ts` (`RuleIr.ancestors`, `NativeBlockIr.statement`,
  `NativeBlockChild`); landed lowering (`lower`, `groupRuns`) — imported read-only.
- A05 handoff notes, especially "A06 must not double-emit native wrappers".

## Allowed files (exclusive ownership)

- `packages/compiler/src/selectors/**` (new)
- `packages/compiler/src/emitter/**` (new)
- `tests/compiler/selectors*.test.ts`, `tests/compiler/emitter*.test.ts`,
  `tests/compiler/golden*.test.ts` (new)
- `tests/fixtures/**/expected/css` (golden CSS only; never another fixture artifact)
- `.ai/tasks/CSSX-A06.md`, `.ai/reports/CSSX-A06.md`, `.ai/reports/logs/CSSX-A06.log`

Frozen types, lexer, parser, resolver, lowering, the barrel, docs and configs are out of scope.

## Requirements

1. **Selectors** (`src/selectors/`): pure `flattenSelector(selector, ancestors)` with a
   diagnostics-carrying result. ADR-0002 descendant nesting; ADR-0012 `&` substitution in any
   position, trailing, repeated, escaped `\&` literal and never inside strings/attribute values.
   Parent selector lists use `:is(...)` where specificity requires it (documented policy); nested
   selector lists expand as the CSS cross-product in authored order. Unsupported cases return a
   reason for the emitter to turn into a CHIKX1001-family diagnostic.
2. **Emitter** (`src/emitter/`): pure, deterministic `emitCss(ir, { minify })`.
   Rules in IR order; `condition.query` ANDed with native media context preludes into one `@media`
   wrapper when possible; `@supports`/`@layer`/`@container` nest outside the media query; native
   blocks emit their wrapper exactly once; statement at-rules, descriptor at-rules and keyframe
   steps handled. No reordering or deduplication; per-segment `!important` preserved. Structural
   validation: empty declaration values and inline variants without a base value emit CHIKX1001 and
   the declaration is omitted (§3.1). Minify compacts structural whitespace only and preserves
   authored value/prelude tokens.
3. **Goldens**: every fixture input without a real `$` reference (detected from `dollar-ref`
   tokens) gets authored `expected/css`; a golden runner compares the full pipeline byte-exact in
   pretty mode. Fixtures with `$` references are deferred to A08. Error fixtures follow one
   documented partial-output policy.
4. **Tests**: selector flattening matrix, pretty/minify pairs, at-rule composition, descriptor,
   statement, keyframe, adversarial IR, minify token preservation, goldens, and a
   whitespace-only-difference check over the golden set.

## Constraints

- Pure functions; zero dependencies; deterministic; JSDoc on public types/functions.
- Import `types/*`, `src/ir` and `src/lowering`; never edit them.
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; all new tests pass.
2. Every non-`$` fixture has authored `expected/css` reproduced byte-exact (pretty).
3. Minify mode is proven whitespace-only-different on the golden set.
4. Report lists created files, the `:is(...)` policy, golden authoring policy, deferred fixtures and
   blockers.

## Validation commands

```sh
bun test tests/compiler/selectors.test.ts tests/compiler/emitter.test.ts tests/compiler/golden.test.ts
bun run verify
```
