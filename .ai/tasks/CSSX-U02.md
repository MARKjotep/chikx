# CSSX-U02 — a lone `&` starter duplicates the ampersand (`&&:hover`)

**Status:** 🟢 fixed · **Found by:** U1/U2 (`.ai/reports/CSSX-U1.md` "Defects observed" #2, `.ai/reports/CSSX-U2.md` row 6 pin) · **Severity:** high
**Package / API:** `packages/vscode` — `src/intelligence.ts` `completionsAt` `"selector"` case
(`replaceStart` for the nested-selector starters) and the accepted result in the editor.

## Summary

- Inside a rule body, typing a lone `&` offers the nested-selector starters (`&`, `&:hover`,
  `&:focus-visible`, `&:disabled`, `& > `, `& + `) whose replacement range is **empty at the caret**,
  because `&` is not a word character and `context.word` is `""` after it.
- Accepting `&:hover` therefore inserts the whole starter after the typed `&`, producing `&&:hover` —
  a selector the author never asked for, with no diagnostic (it parses as two nested `&`).
- The `(` (A50) and `#` (A51) states repair the punctuation they were triggered by; the bare-`&` state
  is the remaining member of that family. The `&:` and `&.` paths are already correct (A46), which is
  why this only shows on a bumpy `&` with nothing behind it.

## Evidence

| Item | Value |
|---|---|
| Reports | `.ai/reports/CSSX-U1.md` (#2 + "Candidate task U1-B"), `.ai/reports/CSSX-U2.md` (row 6 pin), `.ai/reports/CSSX-U3.md` finding 4 |
| Source | `packages/vscode/src/intelligence.ts:2737-2746` — `dot < 0` ⇒ `replaceStart = offset - context.word.length` = `offset` after a lone `&`; `SELECTOR_STARTERS` at `:961-968` |
| Pinned tests | `packages/vscode/test/ui/completions.js:180` (`empty range at the caret`) and `:186` (`accepting &:hover doubles the ampersand`); `packages/vscode/test/ui/checklist.js:428` and `:434` (row 6, the release-checklist tripwire) |
| Repro (host) | document `.badge {\n  &\n}\n`, caret on line 2 column 3, trigger `&` → accept `&:hover` → text contains `  &&:hover` |
| Cross-check | the same acceptance after `&:` yields `&:hover` (never `&::hover`) — that path is correct |

## Expected vs actual

- **Expected:** accepting a nested-selector starter replaces the punctuation it extends, so a lone `&`
  plus `&:hover` yields `&:hover` (the starter is self-contained: it already begins with `&`).
- **Actual:** the starter is inserted at the caret and the authored `&` stays, yielding `&&:hover`.

## Owned files (fix task)

- `packages/vscode/src/intelligence.ts` — `"selector"` case `:2737-2750`: when the statement word is
  empty but the caret directly follows a `&` (or `&` + whitespace), move `replaceStart` back over that
  `&` for the starter items only, or emit items whose `insertText` omits the leading `&`.
- `packages/vscode/test/ui/completions.js:160-190` — **remove both pins** and assert the single
  ampersand (`&:hover`), keeping the item label/kind assertions.
- `packages/vscode/test/ui/checklist.js:415-440` — **remove both pins** (row 6) and assert `  &:hover`
  after acceptance; row 6 must stay automated.
- Pure-layer coverage: one `tests/extension/intelligence.*` case for the accepted text (the range logic
  is pure), next to the existing A46 `&:`/`&.` cases.

## Suggested fix direction

Treat the authored `&` like the A46/A50 repairs treat `:`/`(`: compute the replacement start from the
authored punctuation in front of the caret (`replaceStart = offset - 1` when `text[offset - 1] === "&"`
and the item's text starts with `&`), leaving the `&:`/`&.`/class-item ranges untouched. The class items
in the same state must keep their current (dot-aware) range.

## Acceptance criteria

1. A lone `&` + accept `&:hover` yields exactly `&:hover`; `& > ` yields `& > ` with one ampersand; `&`
   yields `&`.
2. The `&:` path keeps yielding `&:hover` (no `&&:hover`, no `&::hover`) and the `&.` class path keeps
   its typed dot — both existing positive assertions stay green.
3. The four pins listed above are **removed**; the checklist row 6 assertion states the fixed text, so a
   regression fails the release checklist.
4. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun test tests/extension/
bun run verify
```

## Fix record

- Changed `packages/vscode/src/intelligence.ts` (`"selector"` case): added `authoredAmpersandStart()`,
  used as a per-item `replaceStart` on the `SELECTOR_STARTERS`. A lone `&` with an empty word now has
  the starters replace the authored ampersand; class items keep the caret range, and the result-level
  `replaceStart` is unchanged.
- Changed `packages/vscode/test/ui/completions.js`: both `CSSX-U1` pins are gone — the lone-`&` case
  asserts every starter replaces the typed `&` (range `caret-1…caret`, insert starts with `&`) and that
  accepting `&:hover` yields one `&:hover`, never `&&`.
- Changed `packages/vscode/test/ui/checklist.js` row 6 (outside the initial write set; required by
  acceptance #3 and to keep the host suite green): the bare-`&` pin now asserts the fixed range and
  `  &:hover`, and the `&.` block asserts no `&`-prefixed starter.
- Added a unit case in `tests/extension/provider.intelligence.test.ts` ("a lone `&` starter replaces
  the typed ampersand") covering all six starters and the unchanged class-item range.
- Validation: `bun test tests/extension/provider.intelligence.test.ts` → 98 pass / 0 fail;
  `bun test tests/extension/host.test.ts` → 13 scenarios, 827 assertions, exit 0 (twice);
  `bunx tsc -p packages/vscode/tsconfig.json --noEmit` → clean. `bun run verify` was not run (out of
  this task's validation set).
