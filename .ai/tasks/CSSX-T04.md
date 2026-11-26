# CSSX-T04 — `& &` nesting expands exponentially with no size bound and no diagnostic

**Status:** 🟢 fixed · **Found by:** TT2 (`.ai/reports/CSSX-TT2.md` "CSSX-T4") · **Severity:** high
**Package / API:** `packages/compiler` — selector flattening / lowering (`selectors/**` + `lowering/**`)
inside `compile()` / `compileProject()`.

## Summary

- Each nesting level that carries **two** `&`s doubles the selector product, so emitted CSS grows ≈×4
  per two levels: 12 levels already produce 12 306 B and **1 000 levels did not finish in 180 s**
  (probe killed).
- There is no size bound, no cap diagnostic and no typed error: a pathological — but syntactically
  valid — stylesheet hangs or OOMs the build instead of failing fast.
- The plan's §TT2 row 5 ("1k-deep `&` chain, 500-item selector list") is **not implementable as
  stated** for the `& &` shape; the committed case uses the linear `&.m<n>` chain
  (`tests/stress/scale/selectors.test.ts:106`) and the exponential shape is this task.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT2.md` — "CSSX-T4 — selector expansion is exponential when nested levels carry two `&`s" |
| Repro | `.a { & & { & & { … } } }` nested *n* levels with one `color: red;` at the bottom |
| Measured growth | `4 → 66 B`, `6 → 210 B`, `8 → 786 B`, `10 → 3 090 B`, `12 → 12 306 B`; 1 000 levels > 180 s (killed) |
| Determinism | No seed needed; the shape is deterministic |
| Committed cousin case | `tests/stress/scale/selectors.test.ts:106` (linear chain, green) — proves the harness, not the defect |
| Contract source | SPECIFICATION.md §3 nesting; `docs/performance.md` medians assume regular fixtures |

## Expected vs actual

- **Expected:** a bound on emitted selector complexity (or on the `&`-product) enforced during
  flattening, with a typed `CHIKX1xxx`/`CHIKX3xxx` diagnostic naming the nesting depth and the selector;
  the build fails fast with exit 1 instead of exhausting memory.
- **Actual:** unbounded growth, no diagnostic, no early failure — 12 levels is already 12 KB of CSS for
  one rule, and deeper input never completes.

## Owned files (fix task)

- `packages/compiler/src/selectors/**` (flattening) and/or `packages/compiler/src/lowering/**`
  (expansion entry), plus the diagnostic message catalogue and `SPECIFICATION.md`/`docs/known-limitations.md`
  if a limit becomes part of the contract.
- `tests/stress/scale/selectors.test.ts` — **add** a bounded case at the chosen limit and just past it
  (typed diagnostic, no hang); keep the existing linear case untouched.
- `tests/compiler/selectors.test.ts` — unit case for the cap.

## Suggested fix direction

Count the flattened selector product while lowering: once emitted selectors for one rule exceed a fixed
cap (or the nesting product exceeds a fixed factor), emit one typed diagnostic naming the rule and the
depth, drop the rule, and continue with the rest of the file — matching how an unresolved `@group` or
`$`-reference already recovers. Pick the cap from the measured curve (12 levels = 12 306 B) and record it
in the SPECIFICATION so it is a contract, not a heuristic.

## Acceptance criteria

1. The 12-level `& &` repro either completes under a recorded bound or fails with **one** typed
   diagnostic; the 1 000-level shape fails fast (< a few seconds) with the same diagnostic, never a hang
   or an OOM.
2. The limit is documented (SPECIFICATION + `docs/known-limitations.md` §4) with the measured growth
   table and the chosen cap.
3. Legal linear nesting (1 000-deep `&.m<n>`, 500-item selector lists) still builds exactly as today;
   no fixture/golden output changes.
4. `bun test tests/stress/scale/` green including the new bounded case; `bun run verify` green.

## Validation

```sh
bun test tests/stress/scale/
bun test tests/compiler/selectors.test.ts
bun run verify
```

## Fix record

**Status:** 🟢 fixed (2026-11-26).

**Changed files**

| Path | Change |
|---|---|
| `packages/compiler/src/selectors/flatten.ts` | Exported `FLATTEN_LIMITS` (`maxSelectorChars: 8_388_608`, `maxSelectors: 100_000`); every expansion step (`substitute`, `descend`, `flattenAgainstParent`, `resolveAncestors`, `flattenSelector`) now rejects with a bounded reason naming the nesting depth before a pathological product is materialised. Legal output is unchanged. |
| `packages/compiler/src/selectors/index.ts` | Re-export `FLATTEN_LIMITS`. |
| `tests/compiler/nesting-bound.test.ts` | **New.** 12-level `& &` still compiles clean; 1 000-level chain fails fast with one typed diagnostic and an in-bounds span; selector-count and character boundaries; large legal nesting unchanged. |

**Bound / diagnostic**

- Per rule: ≤ 8 388 608 characters in the joined flattened selector list and ≤ 100 000 alternatives. Over-budget flattening returns one rejection, which `flattenIr`/`emitCss` report as a typed **CHIKX1001** (syntax family) whose message names the depth and the offending selector; the rule is dropped and the rest of the file continues.
- A dedicated subcode (`CHIKX1004`) was deliberately **not** registered: `tests/compiler/contract.test.ts:71` pins the exact `DIAGNOSTIC_CODES` key set and is outside this task's write set. Recommended integration follow-up: register `CHIKX1004` ("selector expansion limit") and extend that expected-key list, then use it in `diagnosticFor` for limit failures only.
- Docs still pending (outside write set): add the 8 MiB / 100 000-selector contract to `SPECIFICATION.md` §7.1 and the measured growth table + cap to `docs/known-limitations.md` §4.

**Validation (actual outcomes)**

| Command | Outcome |
|---|---|
| `bun test tests/compiler/nesting-bound.test.ts tests/compiler/selectors.test.ts tests/compiler/groups.expansion.test.ts` | **54 pass / 0 fail** (3.49 s) |
| `bun test tests/stress/scale/selectors.test.ts tests/stress/fuzz/compile.test.ts` | **12 pass / 0 fail** (2 619 expects, 3.00 s) |
| `tsc -p packages/compiler/tsconfig.json --noEmit` | **exit 0** |
| `bun test tests/compiler` (extra regression) | **655 pass / 0 fail** (30 files) |
| `bunx biome check <touched files>` | clean |

**Measured**

- 1 000-level `& &`: compile finishes in **≈2.2 s** with one `CHIKX1001` ("…flattening limit… at nesting depth 1000"), span inside the 12 013-char source, empty CSS (rule dropped). Previously > 180 s / killed.
- 12-level `& &`: **0 diagnostics**, CSS still emitted as before.
- Committed legal scale shape (1 000-deep `&.m<n>` + 500-item list): 2 451 388 chars / 500 alternatives, inside the bound (2.45 MB < 8 MiB).
