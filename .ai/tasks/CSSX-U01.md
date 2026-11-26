# CSSX-U01 — `$`-namespace completion drops the sigil

**Status:** 🟢 fixed · **Found by:** U1/U2 (`.ai/reports/CSSX-U1.md` "Defects observed" #1, `.ai/reports/CSSX-U2.md` "Defects pinned here") · **Severity:** high
**Package / API:** `packages/vscode` — `src/intelligence.ts` `completionsAt` `"token"` branch (imported-alias
items), the replacement range it computes, and the `item` a user accepts in the suggest widget.

## Summary

- Typing `$` in a declaration value offers one item per `@use … as <alias>` import, labelled
  `<alias>.` — **without** the `$` sigil, unlike the built-in `$keyframes.` item beside it.
- The replacement range for those items starts one character **before** the typed `$`
  (`replaceStart = offset - context.word.length - 1`), so accepting `theme.` in a real editor writes
  `color: theme.` and deletes the sigil the user typed.
- `theme.` is not a valid Chikx reference: the accepted text is dropped by the compiler and the author
  loses the token they were about to name. Every other `$` state (`$brand`, `$keyframes.`) is correct,
  which is why the pure suites never saw it.

## Evidence

| Item | Value |
|---|---|
| Reports | `.ai/reports/CSSX-U1.md` (#1 + "Candidate task U1-A"), `.ai/reports/CSSX-U2.md` (carried, not repeated in the checklist) |
| Source | `packages/vscode/src/intelligence.ts:2570-2578` — `label: \`${imported.alias}.\`` and `insertText: \`${imported.alias}.\`` in the alias loop; the range comes from `:2550` `replaceStart = offset - context.word.length - 1` |
| Sibling that is correct | `packages/vscode/src/intelligence.ts:2556-2569` — the built-in `$keyframes.` item uses `label`/`insertText` `$${KEYFRAMES_NAMESPACE}.` |
| Pinned test | `packages/vscode/test/ui/completions.js:132` — `"pinned: accepting the namespace yields \`theme.\` (CSSX-U1)"` |
| Repro (host) | fixture with `@use "./theme.cssx" as theme;`, caret after typing `$` in a value → item label `theme.`; applying the item's own range + text yields `color: theme.` |
| Expected text after acceptance | `color: $theme.` (the sigil survives, as it does for `$keyframes.`) |

## Expected vs actual

- **Expected:** accepting a namespace item leaves a valid reference — `$theme.` — exactly like the
  `$keyframes.` item in the same list, and the label the screen reader announces matches what is
  inserted.
- **Actual:** label and insert text are `theme.`; the range replaces the typed `$`, so the accepted
  document reads `color: theme.` (invalid, silently dropped by the compiler).

## Owned files (fix task)

- `packages/vscode/src/intelligence.ts` — the `"token"` case (`:2549-2579`): make the alias item
  `label`/`insertText` `$${alias}.`, or keep the label and move `replaceStart` one character right for
  that item only (`filterText` must still match the typed `$`.
- `packages/vscode/test/ui/completions.js:120-135` — **remove the pin**: flip the acceptance assertion
  from `theme.` to `$theme.` and keep the label/`filterText`/range assertions as positive invariants.
- Pure-layer coverage: add one `tests/extension/intelligence.*` case next to the existing `$`-completion
  tests (the adapter path is unit-tested there, the acceptance is host-only).

## Suggested fix direction

Mirror the `$keyframes.` item that already sits in the same list: `label: \`$${alias}.\``,
`insertText: \`$${alias}.\``, and let the existing range (which covers the typed `$`) replace it. Add a
`filterText` of `$${alias}.` only if VS Code's narrowing against the range text regresses (A51's
pattern); the empty-word state must still list the item.

## Acceptance criteria

1. Accepting a namespace item after a typed `$` writes `$theme.` — the sigil is present, nothing is
   duplicated, and the document has no new `CHIKX2001`.
2. The `$` list still contains exactly one item per import alias plus `$keyframes.`, with
   `kind === CompletionTokenKind`/constant as today.
3. The pin at `packages/vscode/test/ui/completions.js:132` is **removed** and replaced by the positive
   assertion `$theme.` (a regression must fail, not pass as "documented behaviour").
4. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun test tests/extension/
bun run verify
```

## Fix record

- Changed `packages/vscode/src/intelligence.ts` (`"token"` case): the imported-alias item is now
  labelled and inserted as `$<alias>.`, matching the sibling `$keyframes.` item; the shared range that
  covers the typed `$` now swaps in a valid reference.
- Changed `packages/vscode/test/ui/completions.js`: the `CSSX-U1` pin is gone — the namespace case
  asserts the `$theme.` label/insert, range over `$`, and accepted text `color: $theme.` with exactly
  one `$`; it also asserts `theme.` is not offered.
- Added a unit case in `tests/extension/provider.intelligence.test.ts` ("the imported namespace item
  keeps the `$` its range replaces") asserting the label, insert text, alias+keyframes list and the
  accepted document text.
- Validation: `bun test tests/extension/provider.intelligence.test.ts` → 98 pass / 0 fail;
  `bun test tests/extension/host.test.ts` → 13 scenarios, 827 assertions, exit 0 (twice);
  `bunx tsc -p packages/vscode/tsconfig.json --noEmit` → clean. `bun run verify` was not run (out of
  this task's validation set; host + unit + typecheck are the gate here).
