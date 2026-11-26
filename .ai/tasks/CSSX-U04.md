# CSSX-U04 — renaming a token onto an existing name is allowed and diagnosed only afterwards

**Status:** 🟢 fixed · **Found by:** U1 (`.ai/reports/CSSX-U1.md` "Defects observed" #4) · **Severity:** medium
**Package / API:** `packages/vscode` — `src/intelligence.ts` `prepareRename`/`renameAt` validation (name
shape only), and the duplicate-definition diagnostic that arrives afterwards (`CHIKX2001`, compiler
resolver). Cross-linked compiler question: single-file duplicate `@variables` keys are **not** diagnosed
at all.

## Summary

- The rename provider validates only the *shape* of the new name. Renaming `$accent` onto an existing
  `$gap` is accepted, the `WorkspaceEdit` applies, and the document then contains two declarations of
  the same token — the user has already lost the old name by the time the error appears.
- The duplicate is reported **after** the edit as `CHIKX2001` ("duplicate definition"), which makes the
  failure visible but not preventable; a rename should refuse up front (as the group/keyframe renames
  already do for ambiguity and collisions).
- Measured while writing this spec (evidence below): the *diagnostic* half is **shared with compiler
  validation, and narrower than expected** — a duplicate `@variables` key is diagnosed only when the
  document participates in a module graph; a single-file document with two `gap:` declarations (in one
  block or in two blocks) compiles **with no diagnostic at all** and the first value wins. So the pin's
  "diagnosed only after" holds for the module-graph case, while the plain single-file duplicate is
  silent on both the compiler and the editor side.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-U1.md` — "Defects observed" #4 and the "Candidate task" note |
| Pinned test | `packages/vscode/test/ui/navigation.js:178-205` — `"pinned: the conflicting rename applied"`, `"pinned: the rename produced two \`gap\` declarations (CSSX-U1)"`, `"pinned: the applied conflicting rename is reported as CHIKX2001 afterwards (CSSX-U1)"`, `"pinned: the follow-up diagnostic names the duplicate definition (CSSX-U1)"` |
| Provider | `packages/vscode/src/intelligence.ts` — the rename path validates the identifier; nothing consults the token table for an existing name (compare `groups.ts`/`keyframes.ts` refusal paths used by the group/keyframe renames) |
| Repro (host) | temp copy of `ui/navigation-entry.cssx`; rename `accent` → `accent2` (applies), then rename `accent2` → `gap` (a name that already exists) → `applyEdit` returns `true`, the text contains two `gap:` declarations, `CHIKX2001` appears afterwards |
| Compiler probe (module graph) | `/private/tmp/…/c.cssx` with `@use "./m.cssx" as m;` and duplicate `gap:` keys → `compile()` reports `CHIKX2001:error` "Duplicate local compile-time variable \"$gap\"" |
| Compiler probe (single file) | same duplicate keys **without** `@use` → `compile()` reports **`[]`** and emits `padding: 4px` (first value wins); `analyzeText()` also reports `[]` |
| Pinned sibling observation | `navigation.js:105-110` — `prepareRename` prefills the caret's *reference* text incl. the sigil (recorded separately, not part of this task) |

## Expected vs actual

- **Expected:** a rename whose target name already exists in the visible scope is refused at
  `prepareRename`/`rename` time with a clear reason (the pattern the group/keyframe renames use), so the
  document is never left in a duplicate state.
- **Actual:** the rename applies; the duplicate surfaces afterwards as `CHIKX2001` (module-graph case) or
  not at all (plain single-file duplicate — first value wins silently).

## Owned files (fix task)

- `packages/vscode/src/intelligence.ts` — the rename path (`renameAt`/`prepareRename` caller): refuse a
  target name that already resolves for the same symbol kind/scope, returning the existing refusal shape
  used for ambiguous groups/keyframes.
- `packages/vscode/test/ui/navigation.js:178-210` — **remove the four pins** and assert the refusal
  (`rename` rejects or `prepareRename` reports the conflict, document text unchanged).
- Compiler-side question (separate decision, not this task's code): if the owner wants single-file
  duplicate `@variables` keys diagnosed, that is a `packages/compiler` task in the TT family (the probe
  above is the evidence that they are currently silent). Record the outcome in the task's notes either
  way.

## Suggested fix direction

Reuse the existing collision refusal: before building the `WorkspaceEdit`, resolve the requested name in
the same scope the rename would write to; if a symbol already exists there and it is not the symbol being
renamed, throw the same "already defined" error path the group/keyframe renames use, which VS Code
surfaces as a failed rename instead of an applied edit.

## Acceptance criteria

1. Renaming a token onto an existing name is refused: `executeDocumentRenameProvider` rejects (or
   `prepareRename` reports the conflict) and the document text is byte-identical after the attempt.
2. A non-conflicting rename still applies to the declaration and every reference (3 edits / 1 file for
   the local token; 3 edits / 2 files for the cross-module group rename — both existing assertions).
3. The four pins at `packages/vscode/test/ui/navigation.js:178-205` are **removed**; the refusal is
   asserted positively.
4. The compiler-side duplicate-key question is recorded in this task (measured: silent for single-file
   documents, `CHIKX2001` with a module graph) and routed, or explicitly closed as intended.
5. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun test tests/extension/
bun run verify
```

## Fix record

**Result:** 🟢 fixed (editor half and compiler half).

- Rename refusal now lives in the provider, since `intelligence.ts` was outside this lane's write set:
  `packages/vscode/src/providers/navigation.ts` `provideRenameEdits` resolves the cursor with
  `tokenAt` after a successful plan and throws `A token named "$<name>" already exists in scope.`
  when `analysis.ts` `tokenNameConflict` finds a different local token with the new name. Shape
  errors still win (the `renameAt` reason is thrown first), and group/keyframe paths are unaffected.
- `packages/vscode/src/analysis.ts`:
  - `tokenNameConflict(analysis, name, renaming)` scans the document's own `analysis.tokens`
    (compile-time and runtime share the `$name` namespace) and excludes the renamed symbol, so a
    no-op rename and a free name stay valid.
  - `collectTokenNameProblems` mirrors `compiler/src/resolver/scopes.ts` `collectLocalSymbols`
    (duplicate local compile-time/runtime names and compile/runtime collisions) with identical
    messages, spans and `file` label, and is applied only when the document has no `@use`: a module
    graph already reports the duplicate through `compile()`, so nothing is reported twice.
- Pins flipped to correct behaviour: `packages/vscode/test/ui/navigation.js:179-202` now asserts the
  refusal regex, byte-identical text and a single `gap:` declaration.
- Additive unit cases: `tests/extension/provider.navigation.test.ts` (conflict helper) and
  `tests/extension/provider.analysis.test.ts` (single-file duplicate is one CHIKX2001; module-graph
  duplicate is still reported exactly once; first value wins).

**Compiler half (BLOCKED):** `packages/compiler/src/index.ts` `compile()`, `else` branch
(lines ~237-247) builds the memory-only graph and then assigns `baseDiagnostics = parsed.diagnostics`,
discarding the graph's entry diagnostics. Measured: `buildModuleGraph()` on the same single-file
source reports the duplicate (golden fixture `variables/duplicate-local` expects CHIKX2001), while
`compile()` returns `[]` and emits the first value. Fix is to merge the entry's graph diagnostics
(following `diagnosticsForEntry` in the `hasUse` branch) — not edited here per the lane write set.

**Compiler half (fixed):** `packages/compiler/src/index.ts` — the no-`@use` branch now calls
`singleFileDiagnostics(parsed.diagnostics, diagnosticsForEntry(graph, entryKey))`. The helper keeps the
caller's parse diagnostics (authored file label, authoritative) and merges every resolver diagnostic
(`CHIKX2xxx`+) the memory graph produced, which previously vanished. A single-file duplicate
`@variables` key now reports exactly one `CHIKX2001` with the resolver's message and later-declaration
span (`Duplicate local compile-time variable "$gap" in "<file>".`); duplicate `@runtime` keys and
compile/runtime name collisions are covered by the same merge. The `@use` branch is untouched, so the
module-graph path still reports exactly one copy and first-value-wins emission is unchanged. New
`tests/compiler/single-file-duplicate.test.ts` pins the exact diagnostic (including byte-equality with
`buildModuleGraph()`), first-value CSS, the `@use` single-report case and the `variables/duplicate-local`
golden CSS.

**Validation (compiler half):** `bun test tests/compiler/single-file-duplicate.test.ts
tests/compiler/compile.test.ts tests/compiler/modules.test.ts tests/compiler/contract.test.ts
tests/compiler/variables.golden.test.ts tests/compiler/golden.test.ts` → 68 pass / 0 fail.
`bun test tests/stress/fuzz/compile.test.ts` → 9 pass / 0 fail. `bunx tsc -p
packages/compiler/tsconfig.json --noEmit` → exit 0, no output. Report:
`.ai/reports/CSSX-FIX-U04-COMPILER.md`.

**Validation:** `bun test tests/extension/provider.navigation.test.ts tests/extension/provider.analysis.test.ts`
→ 41 pass / 0 fail. `bun test tests/extension/host.test.ts` → 13 scenarios, 826 assertions
(navigation 24, commands-matrix 101), exit 0. `bunx tsc -p packages/vscode/tsconfig.json --noEmit`
→ exit 0, no output. `bun run verify` not run (campaign instruction).
