# CSSX-A49 — Property-aware named colors, one-line rule bodies and duplicate classes

## Summary

- Three editor-completion items, all in the editor-only layer:
  1. Color-accepting properties (`color`, `background-color`, `border-color`, …) offer the standard
     CSS named colors in a value position.
  2. Value and property completion inside one-line rule bodies (`.a { color: |; }`, `.a { col| }`,
     `.a { &:hover { color: | } }`) behave exactly like the same contexts in multi-line rules.
  3. Typing `&.class` no longer shows `.class` twice in the selector list.
- Item 1 and item 3 were reproduced and fixed. Item 2 did **not** reproduce on the current tree:
  40+ single-line shapes probe correctly already (A46's authored-current-line fallback covers them),
  so it is pinned by a parity test instead of a code change.
- Editor only: `packages/vscode/src/` + `tests/extension/`. No compiler, parser, formatter, fixture,
  golden, grammar, ADR or specification change.

## Objective

1. **Named colors for color-accepting properties**
   - Add one frozen constant of the standard CSS named colors (148, CSS Color 4).
   - Derive the color-property set from the existing `CSS_PROPERTIES` constant: the `color` property,
     every `*-color` longhand and the SVG paint properties `fill`/`stroke`.
   - Add the missing color properties to `CSS_PROPERTIES` (with one-sentence docs in
     `property-docs.ts`): `accent-color`, `border-top/right/bottom/left-color`,
     `column-rule-color`, `fill`, `outline-color`, `stroke`, `text-decoration-color`.
   - Keep the existing sort convention: the names join the keyword values' `0-` family, so they
     order alphabetically beside `auto`, `inherit`, … and ahead of the `0~` units and `1-` functions.
     Detail is `"CSS color"` so a color stays distinguishable from a generic keyword value.
   - Non-color properties (`width`, `display`, `margin`, `opacity`, `font-weight`, shorthands such as
     `background`/`border`/`outline`) never list a color.

2. **One-line rule bodies**
   - Probe value AND property completion inside single-line rule bodies: `.a { color: |; }`,
     `.a { color: }`, `.a { col| }`, `.a { &:hover { color: | } }`, a second declaration after `;`,
     `@media` one-liners and tight `.a{col}`.
   - Fix classification only if a shape differs from its multi-line equivalent; otherwise pin the
     parity with a regression test without touching the classifier.
   - Do not regress A46 bug C (property completion above an `&` line) or the A29 S-probe contract.

3. **Duplicate class suggestions**
   - Reproduce `&.cl` showing `.class` twice when the class is both defined and referenced with
     `&.class` (or simply defined twice).
   - Dedupe by class name: one item per distinct name, preferring the occurrence whose
     `generated` name differs from the authored name (the useful `generated class .<prefixed>`
     detail) regardless of authored order.
   - Leave the analysis occurrence list untouched; other classes and selector starters keep their
     single items and A46's typed-dot replacement range.

## Owned files

- `packages/vscode/src/intelligence.ts`, `packages/vscode/src/property-docs.ts`
- `tests/extension/provider.intelligence.test.ts`
- `.ai/tasks/CSSX-A49.md`, `.ai/reports/CSSX-A49.md`, `.ai/PROGRESS.md`, `.ai/todo.md`

## Dependencies

- A48 in the same files (`CompletionSuggestion.snippet`/`replaceStart`, `CSS_UNITS`, `unitItems()`,
  `completePropertyWithSemicolon`, the `value`/`property` cases) and A46/A47 before it (typed-colon
  ranges, authored-current-line fallback, function documentation). None may regress.
- Baseline: `bun test` 877 pass / 45 files, intelligence suite 79 pass, typecheck and lint exit 0.

## Constraints

- Pure intelligence layer stays editor-agnostic: no `vscode` imports, no new dependency.
- Smallest coherent change; no completion family removed or reworded; no test weakened or deleted.
- No compiler/parser/lexer/resolver/formatter, grammar, fixture, golden, ADR, specification or
  framework record touched. Preserve unrelated working-tree changes; no commit, push, reset or stash.

## Acceptance criteria

1. `color: |`, `background-color: |`, `border-color: |`, the four `border-*-color` sides,
   `outline-color`, `text-decoration-color`, `accent-color`, `caret-color`, `column-rule-color`,
   `fill` and `stroke` offer the 148 named colors, filtered by the typed word; `width: |` and other
   non-color properties do not.
2. Value and property completion match multi-line rules in every probed one-line shape, including a
   nested `&:hover` one-liner; A29/A46 contexts keep their classification.
3. `&.cl` (and a plain `.cl` in a rule body) shows `.class` exactly once; other classes and selector
   starters are unaffected.
4. All pre-existing tests pass unchanged; `bun test` green; `bun run typecheck` exit 0;
   `bun run lint` exit 0.
5. Records persisted: this task file, `.ai/reports/CSSX-A49.md`, a `P8 · A49` PROGRESS row, and the
   `.ai/todo.md` items.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts
bun test tests/extension/
bun test
bun run typecheck && bun run lint
```
