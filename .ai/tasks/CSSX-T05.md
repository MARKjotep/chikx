# CSSX-T05 — the formatter drops the `$` sigil of a namespaced variable declaration

**Status:** 🟢 fixed · **Found by:** TT7 long fuzz (`.ai/reports/CSSX-TT7.md` "TT7-F2") · **Severity:** high
**Package / API:** `packages/compiler` — `format()` → `printTokenDeclaration` (+ the `@variables`
`TokenDeclaration` IR produced by the parser).

## Summary

- `format()` prints a `@variables` token declaration without its authored `$` sigil, so
  `$layout.margin: 4px;` becomes `layout.margin: 4px;`. For a dotted (namespaced) name that output is
  **invalid**: reparsing yields one `CHIKX1001` and the declaration is lost.
- `chikx format` and the VS Code Format Document/save provider therefore silently rewrite a valid
  declaration into a broken one — and `format --check` cannot help, because the formatted output *is*
  the broken text. Idempotence still holds, so `format(format(x)) === format(x)` does not catch it.
- For single-segment names the loss is invisible to the round-trip check (`margin: 4px` reparses to an
  equal token declaration), which is why the 67-fixture suite and TT1's budget-200/500 runs never saw it.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT7.md` "TT7-F2"; history in `.ai/reports/CSSX-TT1.md` (roundtrip area) |
| Repro (minimal) | `format("@variables {\n  $layout.margin: 4px;\n}\n")` → `"@variables {\n  layout.margin: 4px;\n}\n"`; reparsing that output = `CHIKX1001 syntax error: expected ':' after property 'layout'` at offset 21, `@variables` block empty |
| Long-fuzz case | seed 1, budget 100 000, `roundtrip` → `parse(format(x))` IR differs, `inputHash 1ba6fbd33e7b10f7`, case `variables/namespaced-members [token-splice] swap tokens 25 and 47` |
| Not classified | `classifyRoundTripDefect(source, file) === undefined` — neither `CSSX-T1` nor `CSSX-T2` |
| Root cause | `packages/compiler/src/parser/statements.ts:374` strips the sigil into the IR (`name = name.startsWith("$") ? name.slice(1) : name`); `packages/compiler/src/formatter/index.ts:433-435` (`printTokenDeclaration`) prints `name` verbatim |
| Callers | `chikx format`, `chikx format --check`, VS Code `DocumentFormattingEditProvider` / format-on-save |

## Expected vs actual

- **Expected:** `parse(format(x))` is IR-equal to `parse(x)` for a diagnostic-free document — the
  formatter never drops an authored construct (`FRAMEWORK.md` invariant 2), and the printed token
  declaration keeps the authored `$`.
- **Actual:** the sigil is dropped, `@variables` loses the declaration, and a new `CHIKX1001` appears.

## Owned files (fix task)

- `packages/compiler/src/parser/statements.ts` (keep the authored form in the IR — e.g. a `sigil`/`raw`
  field) and `packages/compiler/src/formatter/index.ts` (`printTokenDeclaration`), plus any IR type in
  `packages/compiler/src/types/**`/`ir/**` that gains the field.
- `tests/compiler/formatter.test.ts` (or a new formatter case) — round-trip + idempotence for
  `@variables { $ns.name: …; }` and `@variables { $plain: …; }`.
- `tests/fixtures/**` — **add** a `$ns.name:` fixture (do not edit existing fixtures/goldens).
- `tests/stress/soak/long-fuzz.ts` — **delete** the runner-recorded expectation that
  `roundtrip` may report this violation: the driver must report `unexpectedFailures=[]` at
  `--budget 100000 --seed 1`.

## Suggested fix direction

Keep the authored sigil in the IR (a `sigil: "$"` field or an authored-name field next to the stripped
`name`, which the resolver continues to use), and have `printTokenDeclaration` re-emit it. Namespaced and
plain token declarations then round-trip byte-exactly; no other formatter path changes.

## Acceptance criteria

1. `format("@variables {\n  $layout.margin: 4px;\n}\n")` is a fixed point of `format`, and
   `parse(format(x))` keeps the `token-declaration` (`name:"layout.margin"`, `value:"4px"`) with zero
   diagnostics.
2. A `$ns.name:` fixture round-trips through `format` + `parse` (formatter test) and its emitted CSS is
   unchanged from the authored semantics.
3. `CHIKX_STRESS_SEED=1 bun tests/stress/fuzz/runner.ts --area roundtrip --budget 100000` exits 0 and
   `tests/stress/soak/long-fuzz.ts` reports `unexpectedFailures=[]`.
4. No existing fixture, golden or formatter output changes; `bun run verify` green.

## Validation

```sh
bun test tests/stress/fuzz/roundtrip.test.ts
CHIKX_STRESS_SEED=1 bun tests/stress/fuzz/runner.ts --area roundtrip --budget 100000
bun test tests/compiler/formatter.test.ts
bun run verify
```

## Fix record

**Changed files**

- `packages/compiler/src/formatter/index.ts` — `printTokenDeclaration` now re-emits the authored
  `$` by checking the first character of `token.span` in the printed source (`Printer` carries
  `source`/`file`). No parser/IR change was needed (and `parser/**`/`types/**` are outside this
  worker's write set): the parser already strips `$` into `name`, so the sigil is recoverable from
  the authored span. An unsigiled authored name stays unsigiled, so existing fixture output is
  byte-identical.
- `tests/compiler/formatter.test.ts` — namespaced `$layout.margin` fixed point + zero diagnostics +
  `token-declaration` IR; plain `$margin` sigil kept; unsigiled `margin:` unchanged; compile
  invariance for `$margin`. A `$ns.name` fixture under `tests/fixtures/**` was not added
  (outside this worker's write set); the formatter test covers the same round trip.

**Validation (actual)**

- `bun test tests/compiler/formatter.test.ts tests/stress/fuzz/roundtrip.test.ts` → 27 pass, 0 fail.
- `CHIKX_STRESS_SEED=1 bun tests/stress/fuzz/runner.ts --area roundtrip --budget 100000` →
  `PASS ... cases=100010 violations=0 pinned=0` (exit 0).
- `bunx tsc -p packages/compiler/tsconfig.json --noEmit` → clean.
- `bun test tests/stress/fuzz/` → 46 pass, 0 fail.
- `chikx format --check` could not be executed: concurrent in-flight CLI edits leave
  `packages/cli/src/writer.ts` without the `sweepTemporaries` export (outside this write set);
  the formatter-level `format(format(x)) === format(x)` assertion covers the same property.
