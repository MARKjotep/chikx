# CSSX-U07 — `!` after a declaration value suggests nothing

**Status:** 🟢 fixed · **Found by:** owner report 2026-11-26 · **Severity:** low (completion gap)
**Package / API:** `packages/vscode` — completion trigger registration (`src/controller.ts`), the completion context
machine (`src/intelligence.ts`), the adapter header (`src/providers/completion.ts`).

## Summary

- Typing `!` after a declaration value (`color: red!`, `margin: 4px !`) produced **zero suggestions**; the built-in
  CSS support offers `!important` there.
- Root cause: `!` was not a registered completion trigger (`@ $ . : / & ( #`), and no completion state handled a typed
  bang. `scanBackWord` does not include `!`, so the editor either did not invoke completion at all or fell into the
  ordinary value list.
- Fix: register `!` as a trigger and add an `important` context that offers exactly `!important`, replacing the typed
  bang run (so accepting never yields `!!important`).

## Evidence

| Item | Value |
|---|---|
| Repro | `.card { color: red! }`, `.card { margin: 4px ! }` → completion list empty before the fix |
| Trigger list before | `packages/vscode/src/controller.ts` `activate()`: `"@", "$", ".", ":", "/", "&", "(", "#"` |
| Context before | no `!` handling in `contextAt()`; the value state had no bang branch |
| Pinned behaviour after | `tests/extension/provider.intelligence.test.ts` — `!important completion (CSSX-U07)` (4 tests) |
| Host row after | `packages/vscode/test/ui/completions.js` — context 13 (`!`), `contexts` 21 → 22 |

## Expected vs actual

- **Expected:** in a declaration value after a value word, `!`/`!im` offers `!important`; accepting writes one
  `!important` and replaces the typed bang/suffix. Selectors, `@` contexts, property-name positions and an empty value
  offer no `!` item.
- **Actual before:** an empty list (no trigger, no state).

## Acceptance criteria

1. `!` is a registered trigger character (`controller.ts`).
2. `color: red!` and `margin: 4px !` return exactly one item, `!important`, whose range starts on the typed `!` (or the
   start of a `!` run) and ends at the caret; accepting yields `!important`, never `!!important`.
3. `!im` filters to `!important` and the typed suffix is replaced; `filterText` is `!important` over the covered range.
4. Negative: a selector (`.card!`), a property-name position (`col!`) and an empty value (`color: !`) offer no
   `!important` item.
5. Host row drives the `!` trigger through `vscode.executeCompletionItemProvider` and applies the item.
6. `bun test tests/extension/provider.intelligence.test.ts`, `bun test tests/extension/host.test.ts` and
   `bun run verify` green.

## Fix record

**Result:** 🟢 fixed.

- `packages/vscode/src/controller.ts`: `!` appended to the completion trigger characters.
- `packages/vscode/src/intelligence.ts`: new `importantBangStart()` helper (returns the start of the `!` run typed
  before the completion word) and an `important` `CompletionContext`. The value branch of `contextAt()` returns it only
  after a non-empty value (`text.slice(colon + 1, bang).trim() !== ""`), which keeps selectors, `@` contexts and
  property-name positions out. `completionsAt()` returns the single `!important` item with
  `replaceStart = context.start`, `insertText = "!important"`, `filterText = "!important"`, detail
  “CSS declaration modifier”.
- `packages/vscode/src/providers/completion.ts`: header trigger list documents `!`.
- Tests: 4 additive intelligence cases (offer + repair, `!im` filter, already-typed/double bang, three negatives) and
  one host row in `packages/vscode/test/ui/completions.js` (21 → 22 contexts).

**Validation:** `bun test tests/extension/provider.intelligence.test.ts` → 102 pass; `bun test tests/extension/host.test.ts`
→ 14 scenarios, 860 assertions (completions 130); `bun run verify` → see `.ai/reports/CSSX-COLOR-TOKENS.md`.
