# CSSX-A50 — `(`-triggered function suggestions and the `@fn` board cleanup

## Summary

- Two owner items, both in the editor records/layer:
  1. Typing `(` in a declaration value reveals the curated CSS functions in intellisense, and
     accepting one **replaces the typed `(`** with the call (`width: (|` + `clamp(` →
     `width: clamp(`, never `(clamp(`).
  2. The `@fn` author-function plan (todo item 14) is deleted from the board by owner decision.
- Editor only: `packages/vscode/src/` + `tests/extension/` + `.ai/` records. No compiler, parser,
  formatter, fixture, golden, grammar, ADR or specification change.

## Objective

### 1. `(` trigger for function suggestions

Current facts:

- Trigger characters are registered in `packages/vscode/src/controller.ts` (`"@", "$", ".", ":",
  "/", "&"`); `(` is missing.
- `contextAt` returns `value` when a statement matches `property:`; the `value` case of
  `completionsAt` builds keyword values, `PROPERTY_VALUES`, named colors (A49), units (A48) and
  functions.
- `scanBackWord` stops at `(`, so after `width: (` the word is `""` and the value case returns the
  full keyword list — and accepting `clamp(` appends behind the typed paren (`(clamp(`).

Behaviour:

- When the character directly in front of the value word is a `(` the author just typed, return
  **only** the curated function items with a replacement range that covers the typed `(` (per-item
  `replaceStart`, the A48 mechanism). Keyword values, named colors and units do not appear in that
  state; `$`-token items stay out of scope.
- No snippet: the function inserts the plain `name(` form (`clamp(`, `var(--`), so accepting yields
  exactly `width: clamp(`. Stated as the design choice (see report).
- Editing inside an existing call must not change: `calc(100% - 2|` keeps units only,
  `calc(100%|` keeps the ordinary list and never offers a paren-replacing item, `calc(|` (a paren
  behind a call name) keeps the ordinary list. A second `(` (`calc((`) behaves like the first.
- A further typed word filters the list (`width: (cl|` → `clamp(`) while the range still covers the
  `(`, so accepting yields `width: clamp(` (never a duplicated paren).
- Every reachable value-bearing shape gets the same state (multi-line rule, one-line rule, nested
  `&:hover`, `@media` one-liner, `@keyframes` frame). `@setup` values and selector positions are
  **not** forced into it.

### 2. Remove the `@fn` plan

- Delete todo item 14 (`@fn` author-function namespace) entirely. Items keep their numbers; the
  board already tolerates gaps (bugs 1, 9, 12, 13).
- Add feature item 18 for the `(` trigger.

## Owned files

- `packages/vscode/src/intelligence.ts`
- `packages/vscode/src/controller.ts` (one trigger character)
- `tests/extension/provider.intelligence.test.ts` (new tests only; no existing test weakened)
- `.ai/tasks/CSSX-A50.md`, `.ai/reports/CSSX-A50.md`, `.ai/PROGRESS.md`, `.ai/todo.md`

## Dependencies

- A46–A49 landed in the same files: typed-colon/dot ranges and the authored-current-line fallback
  (A46), function documentation (A47), `CompletionSuggestion.snippet`/`replaceStart` + `unitItems()`
  (A48), `CSS_NAMED_COLORS`/`COLOR_PROPERTIES`/`namedColorItems()`/`classDetail()` (A49). None may
  regress.
- Baseline: `bun test` 881 pass / 45 files, extension suite 181, intelligence suite 83, typecheck
  and lint exit 0.

## Constraints

- The pure intelligence layer stays editor-agnostic; the adapter's range/snippet handling is reused
  as is. No new dependencies. No commit, push, reset or stash.

## Acceptance criteria

1. `width: (|` offers only curated function items; accepting `clamp(` yields `width: clamp(`.
2. `width: (cl|` narrows to `clamp(` and accepting yields `width: clamp(`.
3. `calc(100% - 2|` and `calc(100%|` keep the normal value behaviour; `calc(100%|` offers no
   paren-replacing function item.
4. `@`/`$`/`.`/`:`/`&` trigger behaviours and A46–A49 results unchanged; all pre-existing tests pass
   unchanged; `bun test` green; `bun run typecheck` exit 0; `bun run lint` exit 0.
5. Records persisted: this task file, the report, the `P8 · A50` PROGRESS row 🟢, todo item 14
   removed, new feature item for the `(` trigger.

## Validation commands

- `bun test tests/extension/provider.intelligence.test.ts`
- `bun test tests/extension/`
- `bun test`
- `bun run typecheck && bun run lint`
