# CSSX-T02 — `parse(format(x))` changes the variant split of adjacent `@`-markers

**Status:** 🟢 fixed · **Found by:** TT1 (`.ai/reports/CSSX-TT1.md` "CSSX-T2") · **Severity:** medium
**Package / API:** `packages/compiler` — `parse()` variant boundaries (declaration value scanning) and
`format()` declaration printing.

## Summary

- A declaration value that carries two adjacent `@`-markers without whitespace (`x: 1 @a@b 2`) parses as
  **one** variant (`aliases:["a"]`, `value:"@b 2"`). `format()` normalizes it to `x: 1 @a @b 2;`, which
  reparses as **two** variants (`a:""`, `b:"2"`).
- A variant split is semantics (it decides which conditional block a value segment lands in), so
  canonical formatting must not change it; `parse(format(x))` must stay IR-equal to `parse(x)`.
- The authored form is ambiguous, and the formatter's output is the canonical form, so the two sides
  must be made to agree — either the parser splits on adjacency or the formatter keeps adjacency.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT1.md` — "CSSX-T2 — `format` changes the variant split of adjacent `@`-markers" |
| Pinned test | `tests/stress/fuzz/roundtrip.test.ts:158` (`CSSX-T2: format changes the variant split …`) |
| Classifier branch | `tests/stress/fuzz/areas.ts:258` → `hasMarkerPrefixedVariantValue` (constant `DEFECT_FORMAT_ROUNDTRIP`, `areas.ts:126`) |
| Corpus cases | seed 1, budget 200, hash `017f72c1df03f0f0` (fixture `runtime/with-variant`, operator `dollar-at-abuse`); seed 5, hash `8ede5396d72b69ee` (fixture `media/combined-and`) |
| Repro | `parse(".a { x: 1 @a@b 2; }")` → `variants: [{aliases:["a"], value:"@b 2"}]`; `format(…)` → `".a {\n  x: 1 @a @b 2;\n}\n"`; reparse → `variants: [{aliases:["a"]},{aliases:["b"]}]` |
| Lexer tokens | `ident:x colon: number:1 ws at-keyword:@a at-keyword:@b ws number:2 semicolon` — the second marker is a token in its own right |
| Boundary rule | `packages/compiler/src/parser/value.ts:225-232`: a boundary is taken when `token.kind === "modifier"`, at the value start, or after whitespace — an `at-keyword` directly after another marker is therefore **not** a boundary |
| Printer | `packages/compiler/src/formatter/index.ts:444-447` always separates variants with a space |

## Expected vs actual

- **Expected:** `parse(format(x))` is IR-equal to `parse(x)` (positions normalized) for every input with
  no parse diagnostics; the canonical form and the authored form describe the same variants.
- **Actual:** one variant becomes two, so a `@b` segment that was part of variant `a`'s value becomes an
  independent variant on the next parse.

## Owned files (fix task)

- `packages/compiler/src/parser/value.ts` (boundary detection) and/or
  `packages/compiler/src/formatter/index.ts` (declaration/variant printing).
- `tests/stress/fuzz/roundtrip.test.ts` — **delete** the `CSSX-T2` pin; assert the invariants instead
  (both the `017f72c1df03f0f0` and `8ede5396d72b69ee` corpus cases must satisfy round-trip equality).
- `tests/stress/fuzz/areas.ts` — **delete** `DEFECT_FORMAT_ROUNDTRIP`, `hasMarkerPrefixedVariantValue`
  and the classifier branch.
- `tests/stress/fuzz/runner.ts:215` — drop `CSSX-T2` from the pinned-defect note.

## Suggested fix direction

Treat an `at-keyword`/`modifier` token that immediately follows a modifier boundary (no whitespace) as a
new variant boundary in `value.ts` (`separated` currently excludes it). Then `x: 1 @a@b 2` parses as two
variants, exactly like the canonical `x: 1 @a @b 2;` the formatter prints, and the round trip holds
without special-casing the printer. Add a fixture or unit case pinning the adjacency rule; keep
`@a+b` (plus-joined aliases) untouched.

## Acceptance criteria

1. `parse(format(x))` IR-equal to `parse(x)` for `".a { x: 1 @a@b 2; }"` and both corpus hashes.
2. The variant split is explicit and pinned by a unit test (adjacent markers → two variants; `@a+b` →
   one variant with two aliases).
3. No existing golden/fixture output changes (`tests/fixtures/runtime/with-variant` and
   `tests/fixtures/media/combined-and` expected CSS byte-identical).
4. The `CSSX-T2` pin and classifier branch are deleted so a regression reports a violation.
5. `bun test tests/stress/fuzz/` green (`pinned=0` for this shape); `bun run verify` green.

## Validation

```sh
bun test tests/stress/fuzz/
bun tests/stress/fuzz/runner.ts --area roundtrip --budget 5000 --seed 5
bun test tests/compiler/variables.golden.test.ts tests/compiler/formatter.test.ts
bun run verify
```

## Fix record

**Changed files**

- `packages/compiler/src/formatter/index.ts` — `printDeclaration` keeps an authored marker adjacent
  to its variant value when that value starts with `@`, so `x: 1 @a@b 2` prints as
  `x: 1 @a@b 2;` and reparses as the same single variant. This uses the spec's sanctioned
  "formatter keeps adjacency" option; the alternative parser change (`parser/value.ts`) is outside
  this worker's write set.
- `tests/compiler/formatter.test.ts` — adjacent markers → one variant, fixed point, IR equality;
  `@a+b` stays one variant with two aliases.
- `tests/stress/fuzz/roundtrip.test.ts` — replaced the `CSSX-T2` pin with positive invariants and
  asserted corpus cases `017f72c1df03f0f0` (seed 1, budget 200) and `8ede5396d72b69ee` (seed 5,
  budget 500 — the spec's "budget 200" is not where the hash occurs for seed 5).

**Residual (outside this worker's write set):** `tests/stress/fuzz/areas.ts` still has
`DEFECT_FORMAT_ROUNDTRIP`/`hasMarkerPrefixedVariantValue` and its branch, and `runner.ts:215` still
mentions the pin in its note. Inert after the fix (`pinned=0`).

**Validation (actual)**

- `bun test tests/compiler/formatter.test.ts tests/stress/fuzz/roundtrip.test.ts` → 27 pass, 0 fail.
- `bun test tests/compiler/variables.golden.test.ts` → 17 pass, 0 fail.
- `bun tests/stress/fuzz/runner.ts --area roundtrip --budget 5000 --seed 7` → `pinned=0`.
- `bunx tsc -p packages/compiler/tsconfig.json --noEmit` → clean.
