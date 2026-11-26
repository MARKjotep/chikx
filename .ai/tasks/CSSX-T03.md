# CSSX-T03 — an invalid `$` prefix pushes a `CHIKX2001` span past the end of the source

**Status:** 🟢 fixed · **Found by:** TT1 (`.ai/reports/CSSX-TT1.md` "CSSX-T3"); long-budget evidence in
TT7 (`.ai/reports/CSSX-TT7.md`, `CSSX-TT7-fuzz-compile-seed3.log`) · **Severity:** medium
**Package / API:** `packages/compiler` — `compile()` diagnostics for undefined token references
(`variables/expand.ts` `resolveReference` + `referenceSpan`, runtime-token reference scan).

## Summary

- With an invalid `@setup { prefix: "$" }`, a `$`-reference diagnostic reports a span **past the end of
  the authored file**. Every diagnostic span must satisfy `0 <= start <= end <= source.length`; the
  compile area asserts that invariant on every other input.
- The value text the reference was read from is the prefix-rewritten form `$-p` (3 chars) while the
  authored text is `$p` (2 chars), so the span is measured on rewritten text and translated with an
  authored offset base.
- **This task owns a red pin.** `tests/stress/fuzz/compile.test.ts` pins today's behaviour *and*
  deliberately does not exempt it, so `CHIKX_STRESS_SEED=3 bun tests/stress/fuzz/runner.ts --area
  compile --budget 100000` exits 1 until the fix lands. The fix must delete the pin.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT1.md` "CSSX-T3"; `.ai/reports/CSSX-TT7.md` case 4 (seed 3, 3 OOB spans, 30.8 s) |
| Pinned tests | `tests/stress/fuzz/compile.test.ts:125` (asserts `46..49`) and `:142` (property checker still reports it) |
| Repro | `'@setup{prefix:"$";}@runtime{p:red;}.c{c:$p;}'` (44 chars) → `CHIKX2001 Undefined token "$-p"` span `46..49`, plus `CHIKX4001 Invalid class prefix "$"` span `38..42` |
| Corpus cases (seed 3) | `238cccfef402d033` → `122..133` in a 124-char source; `48636492a05f3010` → `218..220`, `237..239` in 217 chars; `0f531622ffbf3c9f` → `154..163` in 152 chars |
| Long-run evidence | `CHIKX_STRESS_SEED=3 bun tests/stress/fuzz/runner.ts --area compile --budget 100000 --seed 3` → exit 1, `cases=100000 violations=3 pinned=0` |
| Related code | `packages/compiler/src/variables/expand.ts:191` (`referenceSpan` = `origin.start + token offsets`), `:237`, `resolveReference` error at `:153`; runtime path `variables/runtime.ts:219` |

## Expected vs actual

- **Expected:** every diagnostic span is inside its file (`0 <= start <= end <= length`), and the
  undefined-reference message names the authored reference (`$p`).
- **Actual:** span `46..49` on a 44-character file, message names `$-p`. `compile()` itself stays total
  (no throw, bounded diagnostics, frozen results) — only the span contract is broken.

## Owned files (fix task)

- `packages/compiler/src/variables/{expand,runtime}.ts` (span construction for undefined references);
  possibly the `$`-prefix setup path that rewrites the reference text.
- `tests/stress/fuzz/compile.test.ts` — **delete** the `CSSX-T3` pin (`:114-141`) and the
  `still reports out-of-bounds spans` guard test (`:142`); replace them with a positive assertion that
  the same input reports an **in-bounds** span whose text is the authored reference.
- `tests/stress/soak/long-fuzz.ts` — **remove** the `expectedCssxT3` classification (`:9-24`, `:181`) so
  `compile` is expected to exit 0 at every seed.

## Suggested fix direction

Report the reference span from the authored source slice: either keep a mapping from the rewritten
(prefixed) value text back to the authored offsets, or fall back to the enclosing declaration/rule span
when the rewritten text cannot be mapped. Then the seed-3 corpus reproduces as an ordinary in-bounds
`CHIKX2001`.

## Acceptance criteria

1. The repro reports an undefined-token diagnostic with `end <= source.length` (and `start <= end`), and
   no diagnostic in the compiled corpus is out of bounds at seed 3 / budget 100 000.
2. The `CSSX-T3` pin and its guard test are deleted; the property checker reports **no** violation.
3. `CHIKX_STRESS_SEED=3 bun tests/stress/fuzz/runner.ts --area compile --budget 100000` exits 0
   (`violations=0`, `pinned=0`), and `tests/stress/soak/long-fuzz.ts` no longer needs an expected
   failure for `compile`.
4. `bun test tests/compiler/` unchanged and green; `bun run verify` green.

## Validation

```sh
bun test tests/stress/fuzz/compile.test.ts
CHIKX_STRESS_SEED=3 bun tests/stress/fuzz/runner.ts --area compile --budget 100000
bun tests/stress/soak/long-fuzz.ts --budget 10000 --seed 3
bun run verify
```

## Fix record

**Root cause (confirmed, not the assumed one):** the invalid prefix itself does not rewrite the
reference. `substitute` resolves `$p` to the `@runtime` token `p` and renders `var(--$-p)`; because
the prefix is `$`, that *generated* text contains a `$`. The defensive re-expansion in
`emitRuntimeTokens` (step 3) then re-lexed `var(--$-p)` with the authored value origin (`$p` starts at
40), so the invented `$-p` at text offset 6 was reported as `40 + 6 = 46..49` in a
44-character file. `$p` is not undefined at all — the CHIKX2001 was a false positive on text no
author wrote.

**Fix:** `packages/compiler/src/variables/expand.ts` — `referenceSpan` now returns `null` when the
computed absolute span falls outside `origin.fallback` (the authored declaration/segment span), and
`expandValue` skips such tokens. Generated `$` characters are therefore never treated as authored
references, while every authored reference keeps its exact offset. No diagnostic code, severity or
message changed, and no other pass was modified.

**Changed files**

- `packages/compiler/src/variables/expand.ts` — span guard at the reference/diagnostic emission point.
- `tests/stress/fuzz/compile.test.ts` — CSSX-T3 pin and "still reports out-of-bounds" guard deleted;
  replaced by a positive in-bounds assertion and a zero-violation `compileViolations` assertion.
- `tests/stress/fuzz/areas.ts` — `CSSX-T1`/`CSSX-T2` classifier (`DEFECT_FORMAT_*`, unbalanced-prelude
  and marker-prefixed-variant helpers, `classifyRoundTripDefect`) removed; `roundTripViolations`
  reports every problem as a hard failure. `limitation`/`limitations` plumbing retained (always empty).
- `tests/stress/fuzz/runner.ts` — stale CSSX-T1/T2/T3 "pinned defects" note removed.
- `tests/stress/fuzz/roundtrip.test.ts` — additive CSSX-T05 corpus case: `$ns.name` token declaration
  and reference are fixed points.
- `tests/stress/soak/long-fuzz.ts` — `expectedFailure`/`expectedCssxT3` classification removed;
  `compile` is expected to exit 0 at every seed. Out-of-bounds counters kept as a regression signal.
- `tests/compiler/setup-span-bounds.test.ts` — new focused suite for the span contract.

**Validation (actual outcomes)**

| Command | Outcome |
|---|---|
| `bun test tests/compiler/setup-span-bounds.test.ts tests/stress/fuzz/compile.test.ts tests/compiler/parser.test.ts tests/compiler/compile.test.ts` | 76 pass, 0 fail |
| `CHIKX_STRESS_BUDGET=100000 CHIKX_STRESS_SEED=3 bun tests/stress/fuzz/runner.ts --area compile` | `PASS … cases=100000 violations=0 pinned=0` (32.7 s) |
| `bun tests/stress/fuzz/runner.ts --area roundtrip --budget 2000 --seed 7` | `PASS … cases=2010 violations=0 pinned=0` |
| `bun test tests/stress/fuzz/` | 47 pass, 0 fail |
| `bun test tests/compiler/{variables.golden,substitute,runtime,golden,groups.golden}.test.ts` | 102 pass, 0 fail |
| `bunx tsc -p packages/compiler/tsconfig.json --noEmit` | clean |
| `bunx biome check` on the seven changed files | clean |

**Acceptance**

1. ✔ Repro now reports only `CHIKX4001` at `38..42`; no span is out of bounds at seed 3 / 100 000.
2. ✔ Pin and guard test deleted; the property checker reports no violation (the new test asserts
   `compileViolations(...) === []`).
3. ✔ 100 000 run exits 0 with `violations=0 pinned=0`; `long-fuzz.ts` no longer classifies `compile`.
4. 🟡 `bun test tests/compiler/` targeted files green; `bun run verify` is owned by the integration
   worker and was not run.

**Write-set note:** the parent dispatch listed `parser/**` + `lowering/spans.ts`, but the defect is in
the reference-diagnostic emission point in `variables/expand.ts`; the task spec assigns
`variables/{expand,runtime}.ts` to this fix and that directory has no other owner. `long-fuzz.ts`
is required by acceptance #3. No forbidden file was touched, and `runtime.ts` needed no change.

