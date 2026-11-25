# CSSX-A29 — Property completion after line breaks and built-in CSS property hover docs

## Summary

- Property completion inside a rule body dies when the previous line has no `;` (or a nested `&`
  rule follows): the ADR-0011 recovery span swallows the next line into the declaration value, so
  the completion context misclassifies as `value` and the typed prefix matches nothing.
- Fix the pure context detector so a line break with value content behind it plus a bare-word
  current line counts as a new declaration line (property context), while wrapped values stay
  `value`.
- Add one-sentence docs for all 107 supported CSS properties and wire them into hover and property
  completion documentation.

## Objective

1. `contextAt` (`packages/vscode/src/intelligence.ts`, `findEnclosingDeclaration` branch around
   line 686): after confirming `colon >= 0 && offset > colon`, compute
   `const lineBreak = text.lastIndexOf("\n", offset - 1)`. When `lineBreak > colon`, the text
   between `colon + 1` and `lineBreak` has non-whitespace content, and
   `text.slice(lineBreak + 1, offset)` matches `/^[\t ]*[A-Za-z-]*[\t ]*$/`, return
   `{ kind: "property", word }`. Everything else keeps returning the value context.
2. New pure module `packages/vscode/src/property-docs.ts`:
   `CSS_PROPERTY_DOCS: Readonly<Record<string, string>>` (one accurate sentence per
   `CSS_PROPERTIES` entry, all 107) and `propertyDoc(name): string | undefined`.
3. `hoverAt`: between media-alias and class detection, hover declaration property names only
   (word of `[A-Za-z-]` at the offset; `findEnclosingDeclaration(...).property === word`; word in
   the docs table). Markdown: `**display** — CSS property`, blank line, description, then
   `Common values: …` when `PROPERTY_VALUES[word]` exists. Range is the word range.
4. Completion `"property"` case: add `documentation: propertyDoc(property)`; keep `detail` and
   `insertText`.
5. Tests in `tests/extension/provider.intelligence.test.ts`: S1/S2 property completion, S7/S6
   value regressions, hover on definition/value/misspelling/unterminated property, and property
   completion documentation. Replace the stale "css-languageservice deferred" hover test.
6. Board/progress: `.ai/todo.md` bug 9 + feature 10 (both 🟢 done in CSSX-A29);
   `.ai/PROGRESS.md` row `P8 · A29`.

## Files (exclusive write scope)

- `packages/vscode/src/intelligence.ts`
- `packages/vscode/src/property-docs.ts` (new)
- `packages/vscode/src/providers/hover.ts`
- `tests/extension/provider.intelligence.test.ts`
- `.ai/tasks/CSSX-A29.md`, `.ai/reports/CSSX-A29.md`, `.ai/todo.md`, `.ai/PROGRESS.md`

`examples/basic/src/button.cssx` is the owner's uncommitted edit and stays untouched.

## Dependencies

None. Builds on CSSX-A13 (providers) and CSSX-A17/A18 (semicolon recovery diagnostics).

## Constraints

- Keep `packages/vscode/src` free of `vscode` imports except `providers/`; both intelligence and
  `property-docs.ts` stay pure and bun-testable.
- Minimal, local fix in `contextAt`; no restructuring, no test weakening, no fixture edits.
- Preserve public exports and unrelated behavior; no commit or push.

## Acceptance criteria

- Probes: S1 `.card {\n  color: red\n  dis|` → `property` + `display`; S2 same with a following
  `&:hover` rule; S3/S4 unchanged `property`; S6 box-shadow wrapped value and S7 `display:` wrapped
  value stay `value`.
- Hover: defined for every property in `CSS_PROPERTIES`; `undefined` for values (`flex` in
  `display: flex`), misspellings (`colorr`) and `@media` prelude features (`min-width`); completion
  property items carry the same documentation.
- `bun run typecheck`, `bun run lint`, `bun run verify` all green; counts recorded.

## Validation

```sh
bun run typecheck
bun run lint
bun test tests/extension/provider.intelligence.test.ts
bun run verify
```

## Handoff

Write `.ai/reports/CSSX-A29.md` with the summary, files changed, probe/test evidence (output tail),
observed counts and blockers.
