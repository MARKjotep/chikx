# CSSX-A48 — CSS-native property semicolon and unit completions

## Summary

- Two CSS-native completion behaviours, matching the built-in CSS language server:
  accepting a property suggestion inserts `property: ;` with the cursor before the semicolon
  (gated by a new setting, default on), and typing a number in a declaration value suggests the CSS
  units that can follow it (`rem`, `px`, `%`, …) appended after the number.
- Today the `property` case of `completionsAt` inserts the plain text `` `${property}: ` `` and the
  `value` case offers nothing at all while a number is being typed (`margin: 1|` → zero items).
- Editor only: `packages/vscode/src/` + `tests/extension/` + the extension's `package.json`
  configuration contribution. No compiler, parser, formatter, fixture, golden, grammar, ADR or
  specification change.

## Objective

1. **Property completion inserts `;` and places the cursor before it.**
   - Extend `CompletionSuggestion` with an optional snippet insert form (`readonly snippet?: string`);
     when set it takes precedence over `insertText` in the adapter
     (`packages/vscode/src/providers/completion.ts`, ≈line 37).
   - Property items carry `` `${property}: $0;` `` so accepting `color` in a rule body yields
     `color: ;` with the cursor between `: ` and `;`.
   - Gate on a new setting `chikx.editor.completePropertyWithSemicolon`, default `true` (mirrors VS
     Code's `css.completion.completePropertyWithSemicolon`). Read it via
     `vscode.workspace.getConfiguration("chikx", document.uri)` (the `formatOnSave` pattern in
     `packages/vscode/src/controller.ts` ≈line 227) and pass it as
     `completePropertyWithSemicolon?: boolean` in the `completionsAt` options. When the option is
     false the current plain `` `${property}: ` `` insert is kept.
   - Register the setting under `contributes.configuration` `chikx.editor.*` in
     `packages/vscode/package.json` (one property only, `boolean`, default `true`, description
     mentioning the cursor placement).
   - The snippet must behave correctly when the replace range covers a partially typed property word
     (`col|` → accept `color` → `color: ;`) and must not alter the `value`/`pseudo`/`selector` cases.

2. **Unit suggestions after a number in value context.**
   - In the `value` case, when the typed word begins with a number prefix matching `/^\d*\.?\d+/`
     (`1`, `10`, `1r`, `.5`, `0.`), offer CSS units in addition to the existing lists; keyword-value
     filtering stays untouched.
   - A curated `CSS_UNITS` constant with short one-sentence descriptions covering at minimum: `px`,
     `rem`, `em`, `%`, `vh`, `vw`, `vmin`, `vmax`, `ch`, `ex`, `cm`, `mm`, `in`, `pt`, `pc`, `q`,
     `fr`, `deg`, `grad`, `rad`, `turn`, `s`, `ms`, `hz`, `khz`, `dpi`, `dppx`.
   - Filter: strip the number prefix from the word and filter units by the remaining suffix
     (word `1` → all units; word `1r` → `rem` first; word `.5` → all).
   - Replacement range starts after the number prefix (like A46's typed-dot handling) so accepting
     `rem` at `margin: 1|` yields `1rem`, never deleting the digits; the same holds for `.5|`.
   - Item shape: bare unit label, kind `value`, detail/description from `CSS_UNITS`, and a stable
     `sortText` so units sort after keyword values but before functions (the existing `0-`/`1-`
     convention).
   - `%` is not part of the `scanBackWord` word set: when `%` is already typed the word stops before
     it, and no duplicate/broken unit suggestion may appear.
   - Units are property-agnostic (values are raw CSS per SPECIFICATION.md §3.3); no per-property unit
     filtering.

## Owned files

- `packages/vscode/src/intelligence.ts`, `packages/vscode/src/providers/completion.ts`,
  `packages/vscode/package.json` (one configuration property)
- `tests/extension/provider.intelligence.test.ts` (new tests; no existing test weakened or deleted)
- `.ai/tasks/CSSX-A48.md`, `.ai/reports/CSSX-A48.md`, `.ai/PROGRESS.md` (`P8 · A48` row),
  `.ai/todo.md` (feature item describing both behaviours)

## Dependencies

- A47 landed in the same files (`CssFunction.usage`, `cssFunctionDocumentation`, `cssFunctionAt`
  ≈line 2168, hover branch ≈line 2276); A46 landed before it (`typedColons` ≈line 624,
  `selectorOrPseudo` ≈line 640). Neither may regress.
- Baseline: `bun test` 871 pass / 45 files, intelligence suite 73 pass, `bun run typecheck` exit 0,
  `bun run lint` exit 0.

## Constraints

- Pure intelligence layer stays editor-agnostic: no `vscode` imports; the snippet is just a string
  field.
- Smallest coherent change; no new dependency, module or refactor; no completion item list removed or
  reworded.
- No compiler/parser/lexer/resolver/formatter, grammar, fixture, golden, ADR, specification, plan or
  framework record touched. Preserve unrelated working-tree changes; no commit, push, reset or stash.

## Acceptance criteria

1. With the setting on, accepting `color` (typed fully or filtered from `col`) yields `color: ;` with
   the cursor before the `;`; with the setting off the current `color: ` insert is preserved.
2. `margin: 1|` offers units; accepting `rem` yields `1rem`; `1r` filters to `rem`; `.5` works; digits
   are never deleted.
3. Unit items carry descriptions; keyword-value and function items are unaffected.
4. All pre-existing tests pass unchanged; `bun test` green; `bun run typecheck` exit 0;
   `bun run lint` exit 0.
5. Records persisted: this task file, `.ai/reports/CSSX-A48.md` (summary, per-behaviour
   diagnosis/design, evidence table with real outputs, handoff), a `P8 · A48` PROGRESS row 🟢 and the
   todo board entry.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts
bun test tests/extension/
bun test
bun run typecheck && bun run lint
```
