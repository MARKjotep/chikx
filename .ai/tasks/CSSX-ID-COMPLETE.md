# CSSX-ID-COMPLETE — selector-context `#` completion

**Status:** 🟢 done (2026-11-26) · **Board item:** feature 26 · **Scope:** editor intelligence only
**Package / API:** `packages/vscode` — `src/intelligence.ts` (analysis collection + completion state),
tests, docs and records. No compiler, CLI, naming, map or `.d.ts` change; ids keep emitting
byte-for-byte.

## Summary

- Add document id-selector collection beside the existing class analysis: every `#name` in a
  selector position, deduped by name, first appearance wins, `{ name, range }`.
- In selector position, a typed `#` (including `#wo` narrowing) offers one `selector` item per id:
  label `#name`, detail `id selector`, adapter kind `CompletionItemKind.Class`, first-appearance
  order. Accepting replaces the typed `#…` word range so exactly one `#` remains.
- Pin both no-leak directions: value `#` on a colour property stays colour/hex only; selector `#`
  never offers colours, classes, starters or directives.
- Ids stay document-global: no cross-file suggestions, no rename, no map entry.

## Implementation

- `packages/vscode/src/intelligence.ts`
  - `IdOccurrence { name, range }` and `collectIdSelectors(analysis)`: walks rule selectors in the
    current AST (rules, nested rule bodies, conditional blocks and native at-rule blocks), dedupes by
    name and records the name-only range.
  - `scanSelectorIds(selector)`: selector-only scanner. Skips quoted strings, escapes, selector
    comments and attribute contents; includes base selectors, `&` nesting, comma lists,
    `:is()`/`:not()`/`:has()` arguments and `:global(#x)`.
  - `hashPrefixStart()` (renamed from `hashColorStart()`, same geometry) is shared by the value `#`
    colour state and the new selector `#` id state.
  - The existing `selector` case returns early on a typed `#`: ids only, filtered by the typed word
    (`#pan` → `#panel`/`#panel-header`), each item `replaceStart` on the `#`.
- `packages/vscode/src/providers/completion.ts`: no change; `selector` already maps to
  `CompletionItemKind.Class` and the adapter passes `detail`/`replaceStart` through.

## Tests

- `tests/extension/provider.intelligence.test.ts` — `id selector completion (feature 26)`:
  1. collection: nested, pseudo-functional (`:is`/`:not`/`:has`), comma list, `:global(#x)`,
     string/attribute/declaration exclusion, selector comment exclusion, dedupe and order;
  2. completion labels/kinds/detail, first-appearance order, prefix narrowing, acceptance replacing
     the typed range and never producing `##`;
  3. value `#` on `color` stays the 183-item colour state with no id items.
- Host: `packages/vscode/test/ui/completions.js` gains context 8b — selector `#` lists the document
  ids, accepting writes one `#`; a colour `#` row confirms colours only and no ids. Contexts
  `23 → 25`.

## Acceptance criteria

1. Selector `#` completes the document ids with label `#name`, kind `selector` (Class), detail
   `id selector`, first-appearance order; narrowing and single-`#` acceptance work.
2. Value/selector no-leak directions pinned; existing class, `&` and pseudo states unchanged.
3. Host assertion green; suite counts recorded.
4. Docs/records persisted (todo item 26 🟢, plan row, CHANGELOG).
5. `bun run verify`, `bun run release:check`, `bun run lint` green.

## Validation

- `bun test tests/extension/provider.intelligence.test.ts` → 108 pass.
- `bun run verify` → 1326 pass / 2 skip / 0 fail (98 files; host 14 scenarios / 899 assertions,
  completions 158), 67.0 s test time.
- `bun run release:check` → 165.0 s, browser 96/96, nine examples, VSIX 18 files / 138.75 KB.
- `bun run lint` → exit 0 (457 files, 0.31 s).
