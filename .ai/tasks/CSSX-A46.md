# CSSX-A46 — editor completion range/context bugfixes (three bugs)

## Summary

- Fix three completion bugs in the VS Code extension: accepting a pseudo-class after typing `:`
  behind `&` duplicated colons (`&:::hover`), accepting a class after `&.` deleted the typed dot
  (`&.test > a` became `&test > a`), and no CSS property completions appeared on a line written
  directly above a line starting with `&`.
- All three live in the pure intelligence layer (`completionsAt` replacement ranges and
  `contextAt` classification of a selector the tolerant parser glued across line breaks).
- Editor only: `packages/vscode/src/intelligence.ts` plus `tests/extension/`. No compiler, parser,
  formatter, fixture, golden, grammar, ADR or specification change.
- `@fn` (author-function namespace) is recorded as an open, owner-pending feature item — it is not
  implemented here.

## Objective

1. **Bug A — pseudo colon duplication.** After `&:` (cursor right after the colon) `contextAt`
   returns `{ kind: "pseudo", word: "" }` and the `pseudo` case used `replaceStart = offset`, while
   every `PSEUDOS` entry carries its own leading colon(s). Accepting `:hover` therefore kept the
   typed `:` and inserted a second one (`&::hover`, owner saw `&:::hover` after a retrigger); `::`
   pseudo-elements behaved the same. The filter word also had to be the text *after* the colons, and
   typing `&:h`/`&:hov` classified as `selector` (pseudo prefixes matched nothing).
2. **Bug B — class dot removal.** `scanBackWord` treats `.` as a word character, so after `&.` the
   word is `.` (and `.te` after `&.te`). The `selector` case used
   `replaceStart = offset - context.word.length`, covering the typed dot, while class items insert
   the bare name — accepting `.test` produced `&test`, dropping the dot.
3. **Bug C — no properties above an `&` line.** When the line above a line starting with `&` is a
   bare word or empty (and the previous statement is terminated), the tolerant parser glues both
   lines into one multi-line selector (`co\n  &:hover`), so the cursor sat inside a rule
   `selectorSpan` and `contextAt` returned `selector` with no property items. Every bare-word/empty
   position inside a rule body must still classify as `property` (the A29 contract) regardless of
   what the next authored line starts with, while a cursor *on* the `&` line keeps
   `selector`/`pseudo`.

## Owned files

- `packages/vscode/src/intelligence.ts` — `typedColons`/`selectorOrPseudo` helpers,
  `findEnclosingRule` nesting info, rule-body classification guard, `selector`/`pseudo` completion
  ranges.
- `tests/extension/provider.intelligence.test.ts` — five new tests (one per bug plus edge variants);
  no existing test weakened or deleted.
- `.ai/tasks/CSSX-A46.md`, `.ai/reports/CSSX-A46.md`, `.ai/PROGRESS.md`, `.ai/todo.md`.

## Requirements

1. Pseudo replacement range covers the typed colon run (and any spaces between the colons and the
   word), so `&:` + `:hover` → `&:hover` and `&::` + `::after` → `&::after`. The filter word is the
   text after the colons (`hov` → `:hover`, `a` → `:active`/`::after`), and a colon run before the
   typed word makes the statement a `pseudo` context (so typed prefixes filter).
2. Selector replacement range starts after the last typed dot, so `&.` + `.test` → `&.test`,
   `&.te` + `.test` → `&.test`, and a plain `.te` line inside a rule body keeps its dot.
   `SELECTOR_STARTERS` keep their range when no dot is typed; top-level `.te` (no rule body)
   stays `none`.
3. A selector span that crosses a line break inside a rule body is a recovery artefact: classify
   from the authored current line (bare word/empty → `property`, `property:` → `value`, `&…` →
   `selector`/`pseudo`). A selector outside any rule body (top level) keeps the selector path.
4. Record the `@fn` author-function namespace as a new open feature item (owner decision pending:
   mixin-style block emission vs value callables, arguments/defaults/compile-time evaluation,
   call-site syntax, styles-only visibility closure like `@group` per ADR-0017, diagnostics reuse).
   Do not implement it.
5. Every pre-existing extension test (S1–S7 and the A45 tests) keeps passing unchanged.

## Constraints

- Smallest coherent change in the editor intelligence layer; no new module, dependency or refactor.
- No completion item lists added, removed or reworded beyond the range/word fixes.
- No compiler/parser/lexer/resolver/formatter, grammar, fixture, golden, ADR, specification, plan or
  framework record touched.
- Preserve unrelated working-tree changes; no commit, push, reset or stash.

## Acceptance

- Bug A: `&:` + `:hover` → `&:hover`; `&::` + `::after` → `&::after`; `&:hov` filters to `:hover`
  and applies to `&:hover`; declaration-shaped `a:`/`a::` lines in a rule body keep their `value`
  context (A45 `width:` contract) and a top-level `a:` pseudo inserts `a:hover`.
- Bug B: `&.` + `.test` → `&.test`; `&.te` + `.test` → `&.test` with `&.test > a` intact; plain
  `.te` in a rule body → `.test`; selector starters and the top-level `none` result unchanged.
- Bug C: property items on a bare-word or empty line directly above `& { }`, `&:hover { }`,
  `&::after { }` and `&.test { }` (with and without a terminated previous declaration); the cursor
  on the `&` line stays `selector`, on `&:` stays `pseudo`.
- `bun test` green, `bun run typecheck` exit 0, `bun run lint` exit 0.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts
bun test tests/extension/
bun test
bun run typecheck
bun run lint
```
