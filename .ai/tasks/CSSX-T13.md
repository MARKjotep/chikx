# CSSX-T13 — editor and compiler disagree on group/keyframe visibility in cyclic import graphs

**Status:** 🟢 fixed · **Found by:** TT6 (`.ai/reports/CSSX-TT6.md` "O1") · **Severity:** low
**Package / API:** `packages/vscode/src/{groups,keyframes}.ts` (editor-side re-implementation) vs
`packages/compiler/src/resolver/{groups,keyframes}.ts` (compiler truth), reached through
`packages/vscode/src/analysis.ts`.

## Summary

- The editor re-implements the compiler's `@group`/`@keyframes` visibility rules. On **acyclic** module
  graphs the two agree on 26 fixture directories and 60 seeded projects. On **cyclic** graphs (an input
  that already reports `CHIKX2001 Import cycle detected`) they recover different sets.
- Cause: both sides memoize partial closure results computed *inside* the cycle, so whichever file first
  hits the back edge determines what later files see.
- Neither answer is "correct" — the input is already an error — so the campaign's contract for this state
  is termination + determinism, which `tests/stress/editor/differential.test.ts` asserts. Divergence is an
  ergonomics/support issue: hover, go-to-definition and rename can show symbols the compiler will not emit.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-TT6.md` "O1 — editor/compiler group divergence on **cyclic** module graphs"; differential table and repro |
| Measurement | `generateModuleProject(seed, { cyclic: true })`, seeds 1–100: **9 seeds diverge, 15 module-level differences**; acyclic seeds 1–60: **0 divergences** |
| Seed-15 repro | `a.cssx @use "./e.cssx"; @use "./f.cssx" styles; @group.card{…}` · `b.cssx @use "./f.cssx"; @use "./a.cssx" styles; @group.card{…}` · `c.cssx @use "./b.cssx" styles; @group.panel{…}` · `e.cssx @group.panel{…}` · `f.cssx @use "./c.cssx" styles; @use "./e.cssx";` → compiler (`b`): `[["card","resolved:/virtual/b.cssx"]]`; editor (`b`): `[["card","resolved:/virtual/b.cssx"],["panel","resolved:/virtual/c.cssx"]]` |
| Where | `packages/vscode/src/groups.ts` `closureMemo`; `packages/compiler/src/resolver/groups.ts` `collect` memo (same pattern in the keyframes pair) |
| Committed case | `tests/stress/editor/differential.test.ts` — cyclic corpus asserts termination, determinism and "every candidate is a loaded module", **not** set equality |
| Related | TT2's 500-module cycle case (`tests/stress/scale/modules.test.ts:126`) |

## Expected vs actual

- **Expected:** for a cyclic graph the editor either matches the compiler's recovered set or refuses per
  the documented ambiguity rule (as it already does for duplicate keyframe names), so a user never sees a
  symbol the compiler silently omits.
- **Actual:** both sides return different recovered sets for the same file, with no signal in the editor.

## Owned files (fix task)

- `packages/vscode/src/groups.ts`, `packages/vscode/src/keyframes.ts` (memoization / back-edge policy) —
  or `packages/compiler/src/resolver/{groups,keyframes}.ts` if the compiler is the side that should change
  (it must stay the single source of truth either way).
- `tests/stress/editor/differential.test.ts` — strengthen the cyclic corpus from
  "termination + determinism" to set equality (or to the documented refusal).
- `docs/known-limitations.md` §5 if the shipped answer stays "differs on cyclic graphs".
- Optional: a differential unit test in `tests/extension/` next to the existing provider suites.

## Suggested fix direction

Pick one truth and share it. The cheapest: on a back edge, both sides mark the closure result as
"approximate" and the editor refuses (hover: *"import cycle — visibility is undefined"*, no definition,
rename refused), matching the existing ambiguity behaviour. The structural fix is to drop the editor
re-implementation and consume `resolver/**` directly, which also removes the A45-era duplication risk for
future rule changes.

## Acceptance criteria

1. For cyclic seeds the editor and compiler agree on the visible set (or the editor refuses with an
   explicit cycle reason on every seed where they would differ).
2. All 26 fixture directories and 60 acyclic seeded projects keep matching (no regression in the acyclic
   contract).
3. `tests/stress/editor/differential.test.ts` asserts the decided rule on the cyclic corpus; no assertion
   weakened elsewhere.
4. `docs/known-limitations.md` §5 matches the shipped behaviour; `bun test tests/stress/editor/`,
   `bun test tests/extension/` and `bun run verify` green.

## Validation

```sh
bun test tests/stress/editor/differential.test.ts
bun test tests/stress/editor/
bun test tests/extension/
bun run verify
```

## Fix record

Fixed 2026-11-26 (CSSX-FIX-EDITOR-ANALYSIS).

- `packages/vscode/src/groups.ts`, `packages/vscode/src/keyframes.ts` — the editor now resolves every
  loaded module's closure up front in **sorted canonical-path order** through the same shared memo,
  matching `packages/compiler/src/resolver/{groups,keyframes}.ts` (`visibleGroups` / `visibleKeyframes`
  sort their source map and memoize partial results). Previously the closures were computed lazily in
  document-load order, so inside a cycle a different file hit the back edge first and a different
  partial closure was memoized (seed-15 `b.cssx` showed `panel` the compiler never emits). The compiler
  resolver is unchanged — it remains the reference.
- `tests/stress/editor/differential.test.ts` — the cyclic corpus is strengthened from
  "termination + determinism + loaded candidates" to **set equality** with the compiler, comparing each
  analysed document with a compiler graph built from that document as the entry (the same styles
  closure the editor loads; the compiler's answer depends on the module set it is given). Seeds raised
  to 100; added an explicit seed-15 regression pin (`b.cssx` = `card=resolved:/virtual/b.cssx` only).
  Keyframes keep the documented ADR-0015 ambiguous-editor rule via `keyframeDivergence`.
- Acyclic contract unchanged: 26 fixture directories and 60 acyclic seeded projects still match.
- `docs/known-limitations.md` §5 makes no claim about cyclic editor/compiler agreement, so it needs no
  edit and was left untouched (outside this task's write set).

Validation (actual outcomes):

- `bun test tests/stress/editor/differential.test.ts` — 10 pass, 0 fail, 625 expect() calls; 100 cyclic
  seeds, 50 CHIKX2001 cycle diagnostics, zero visibility divergence (seed 15 included).
- Ad-hoc 100-seed probe (groups strict, keyframes ADR-0015 rule): 0 failures.
- `bun test tests/stress/editor/` — 50 pass, 0 fail.
- `bun test tests/extension/` — 194 pass, 0 fail.
- `bunx tsc -p packages/vscode/tsconfig.json --noEmit` — clean.
