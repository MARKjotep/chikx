# CSSX-A51 — Hex colors, color-kind items, inline swatches and the A50 filterText follow-up

## Summary

- Color intellisense now matches the built-in CSS support: `COLOR_PROPERTIES` value lists offer the
  148 A49 named colors **and** a 35-entry curated hex palette, and both families are `color` items so
  the suggest widget paints a swatch.
- `#` is a registered completion trigger with its own value state: `color: #|` lists the colors,
  `color: #f0|` narrows them, accepting replaces the typed `#…` prefix (`color: #` + `red` ->
  `color: red`, never `#red`), and `#` outside a color-accepting property offers nothing.
- A new pure `colorsAt(text, analysis)` feeds the existing `DocumentColorProvider`: hex values
  (property-agnostic) and named colors (whole words in color-accepting declarations/custom
  properties) get inline swatches; the native picker writes lowercase `#rrggbb` back (alpha only when
  non-1), so named values are rewritten only when the author picks.
- A50 follow-ups: `CompletionSuggestion.filterText` passthrough (`(clamp`, `#red`) so VS Code's own
  narrowing cannot hide a paren/`#` item, and the stale trigger comment in
  `providers/completion.ts` now lists `(`, `/` and `#`.

## Objective

1. Hex colors in color-value completion + the `color` suggestion kind + the `#` state.
2. Color decorations + native picker via `colorsAt()` behind `DocumentColorProvider`.
3. A50 follow-ups: paren-state `filterText`, stale trigger comment.

## Owned files (write set)

`packages/vscode/src/intelligence.ts`, `adapter.ts`, `controller.ts`, `providers/completion.ts`,
`providers/color.ts` (the existing, already-registered color provider — see the deviation note in the
report), `tests/extension/provider.intelligence.test.ts`, `.ai/tasks/CSSX-A51.md`,
`.ai/reports/CSSX-A51.md`, `.ai/PROGRESS.md`, `.ai/todo.md`.

## Constraints

- Read `.ai/reports/CSSX-A49.md` and `.ai/reports/CSSX-A50.md` first; no A46-A50 regressions.
- Pure layer stays editor-agnostic (no `vscode` import in `intelligence.ts`); no new dependencies,
  no compiler/parser/formatter/grammar/fixture/golden/ADR/spec change, no commit/push/reset/stash.

## Acceptance criteria

1. `color: |` offers named colors and hex entries, both kind `color`; `width: |` offers neither.
2. `color: #|` lists the colors, `color: #f|` narrows, accepting does not duplicate the prefix, `#`
   outside a color property offers nothing.
3. `colorsAt` finds named and hex values with correct ranges/rgba; the provider is registered; color
   presentations write hex back.
4. Paren-state items carry `filterText`; the stale comment is fixed.
5. All pre-existing tests pass, `bun test` green, `bun run typecheck` 0, `bun run lint` 0.
6. Records persisted (task, report, `P8 · A51` PROGRESS row, todo items).

## Validation commands

- `bun test tests/extension/provider.intelligence.test.ts`
- `bun test tests/extension/`
- `bun test`
- `bun run typecheck && bun run lint`
