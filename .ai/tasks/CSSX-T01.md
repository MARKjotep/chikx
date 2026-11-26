# CSSX-T01 — `format()` is not idempotent for an at-rule whose prelude swallows the terminator

**Status:** 🟢 fixed · **Found by:** TT1 (`.ai/reports/CSSX-TT1.md` "CSSX-T1") · **Severity:** medium
**Package / API:** `packages/compiler` — `format()` (formatter at-rule printing; parser prelude for
statement at-rules), `parser/native-at-rule` IR.

## Summary

- For a parse-clean input whose native at-rule prelude ends in an unbalanced `[` or `(`, the formatter
  emits the statement terminator `;` as part of the prelude, so re-formatting the output appends a
  second `;`, then a third: canonical output is not a fixed point.
- `format` is specified as a pure `parse → print` pass whose output is canonical, so
  `format(format(x)) === format(x)` must hold for every input the parser accepts without errors.
- Idempotence is already asserted for every fixture (`tests/compiler/formatter.test.ts:137,425`); the
  defect only appears on generated/unbalanced input, which is why the fixture suite never saw it.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT1.md` — "CSSX-T1 — `format` is not idempotent for an at-rule whose prelude swallows the terminator" |
| Pinned test | `tests/stress/fuzz/roundtrip.test.ts:134` (`CSSX-T1: format is not idempotent …`) |
| Classifier branch | `tests/stress/fuzz/areas.ts:258` `classifyRoundTripDefect` → `hasUnbalancedAtRulePrelude` (constant `DEFECT_FORMAT_IDEMPOTENCE`, `areas.ts:118`) |
| Corpus case | seed 1, budget 200, input hash `c4a21866af2c9459`, fixture `output/only-names`, operator `imbalance` inserting `[` `{` |
| Repro | `format("@x[a")` → `"@x [a;\n"` → `format(…)` → `"@x [a;;\n"`; none of the three parses report a diagnostic |
| Same shape | `@media[x { a: b; }`, `@x[a;` (report) |
| Gate that keeps it visible | `bun run stress` — `roundtrip` reports it as `pinned` (exempted), so the default gate stays green |

## Expected vs actual

- **Expected:** `format(format(x)).formatted === format(x).formatted` and
  `parse(format(x))` IR-equal to `parse(x)` (positions normalized) for every diagnostic-free input.
- **Actual:** each pass adds one `;` to the prelude; the formatted text is not a fixed point. The parse
  IR is unaffected today (the `;` stays inside the swallowed prelude), so only the idempotence half of
  the round-trip property fails.

## Owned files (fix task)

- `packages/compiler/src/formatter/index.ts` (statement / native at-rule printing, ≈`:133`, `:180`,
  `:263`, `:414`) and, if the prelude span is the cause, `packages/compiler/src/parser/**` for the
  statement-at-rule prelude end.
- `tests/stress/fuzz/roundtrip.test.ts` — **delete** the `CSSX-T1` pin and turn its assertions into
  positive invariants (`format(format(x)) == format(x)` for `"@x[a"`, `"@media[x { a: b; }"`,
  `"@x[a;"` and the `c4a21866af2c9459` corpus case).
- `tests/stress/fuzz/areas.ts` — **delete** the `DEFECT_FORMAT_IDEMPOTENCE` constant,
  `hasUnbalancedAtRulePrelude` and its `classifyRoundTripDefect` branch, and the
  `roundtrip.test.ts`/`areas.ts` doc-comment references to `CSSX-T1`.
- `tests/stress/fuzz/runner.ts:215` — drop `CSSX-T1` from the pinned-defect note when the classifier
  branch goes.

## Suggested fix direction

Keep the authored prelude bytes out of the terminator decision: print a statement at-rule's `;`
separately from the prelude text and, when the prelude contains an unbalanced `[`/`(`, either close it
from the authored source or reproduce the authored prelude verbatim instead of re-printing a slice that
already absorbed the `;`. Whatever the mechanism, the printed form must re-lex to the same prelude text.

## Acceptance criteria

1. `format(format(x)).formatted === format(x).formatted` for all three repro shapes and the corpus case.
2. `parse(format(x))` stays IR-equal to `parse(x)` for those inputs.
3. No fixture output changes: `tests/compiler/formatter.test.ts`, `tests/extension/*formatting*` and the
   13 group fixtures stay byte-identical.
4. The `CSSX-T1` pin, the `DEFECT_FORMAT_IDEMPOTENCE` constant and the classifier branch are deleted —
   the harness must report a violation, not a limitation, if the defect returns.
5. `bun test tests/stress/fuzz/` green with `pinned=0` for the `CSSX-T1` shape; `bun run verify` green.

## Validation

```sh
bun test tests/stress/fuzz/
bun tests/stress/fuzz/runner.ts --area roundtrip --budget 5000 --seed 7
bun test tests/compiler/formatter.test.ts
bun run verify
```

## Fix record

**Changed files**

- `packages/compiler/src/formatter/index.ts` — `printNative` prints a statement at-rule's `;` only
  when the prelude would not reabsorb it. `preludeSwallowsTerminator` tokenizes the printed prelude
  and mirrors `parseNativeAtRule`'s closer stack; with a dangling `[`/`(` the authored form had no
  terminator, so omitting it is stable and lossless.
- `tests/stress/fuzz/roundtrip.test.ts` — replaced the `CSSX-T1` pin with positive fixed-point /
  IR-equality assertions for `@x[a`, `@media[x { a: b; }`, `@x[a;`, `@x(a` and corpus case
  `c4a21866af2c9459`; the mutation-corpus test now requires `run.limitations === []`.
- `packages/compiler/src/formatter/index.ts` header doc states the terminator exception.

**Residual (outside this worker's write set):** `tests/stress/fuzz/areas.ts` still defines
`DEFECT_FORMAT_IDEMPOTENCE`/`hasUnbalancedAtRulePrelude` and the classifier branch, and
`runner.ts:215` still mentions the pin in its note. They are inert after the fix (runner reports
`pinned=0`); deletion belongs to a worker allowed to edit those files.

**Validation (actual)**

- `bun test tests/stress/fuzz/` → 46 pass, 0 fail.
- `bun tests/stress/fuzz/runner.ts --area roundtrip --budget 5000 --seed 7` →
  `PASS ... cases=5010 violations=0 pinned=0`.
- `CHIKX_STRESS_SEED=1 ... --budget 100000` → `PASS ... cases=100010 violations=0`.
- `bun test tests/compiler/formatter.test.ts` → green (incl. 4 new T01 cases).
- `bunx tsc -p packages/compiler/tsconfig.json --noEmit` → clean.
