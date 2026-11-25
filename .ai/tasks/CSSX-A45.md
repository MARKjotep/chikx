# CSSX-A45 — editor completion bugfixes (five bugs + two additions)

## Summary

- Fix five completion-context bugs in the VS Code extension: `@setup` lost key completion after a
  completed setting, `@keyframes` bodies offered nothing at a statement or frame-body position, no
  values came right after `property:`, typing `&` did not reopen completions, and six animation
  longhands were missing from the property list.
- Two additions from the same evaluation: a curated CSS function list in `value` context, and the
  built-in `$keyframes.` namespace item in `$` token completion.
- The `@fn` (author-defined function namespace) idea was evaluated and **deferred** — editor-only
  discovery for v0.1, no language or compiler change.
- Editor only: `packages/vscode/src/` plus `tests/extension/`. No compiler, parser, formatter,
  fixture, golden, grammar, ADR or specification change.

## Objective

1. **`@setup` statement boundary.** After a completed setting (`prefix: "ui";`) the previous line's
   colon was still the nearest colon, so a fresh line inside `@setup { }` classified as
   `setup-value` (no candidates) instead of `setup-key`.
2. **`@keyframes` body completion.** A fresh line inside `@keyframes spin { }` returned `none`, and
   a frame block (`from { }`) body offered no property/value items: native at-rule blocks were not
   traversed (frame blocks live in the node's `block`, not `body`) and there was no frame-selector
   context.
3. **Value context right after `property:`.** The tolerant AST ends an empty-valued declaration span
   at the colon, so a cursor at `width: |` sat outside the declaration and fell back to the property
   list; `width:|` (no space) behaved the same.
4. **`&` trigger character.** `&` is not a word character and was not a completion trigger, so
   starting a nested selector did not reopen the suggestion list.
5. **Missing animation longhands.** Only `animation`, `animation-delay` and `animation-duration` were
   offered; `animation-` completion stopped there and the longhands had no docs.
6. **Addition — CSS functions in `value` context.** Offer a curated function list after the keyword
   values, filtered by the typed word and independent of the property (values are raw CSS per
   SPECIFICATION.md §3.3), with `var(` inserting `var(--`.
7. **Addition — `$keyframes.` in token completion.** `$` should offer the built-in keyframe namespace
   beside imported aliases so every namespace is reachable without knowing its spelling.
8. **Record the `@fn` deferral** in this task and the CSSX-A45 report: an `@fn` namespace for
   author-defined functions is not part of v0.1 and stays editor-only; a real namespace only if
   Chikx adopts its own callables later.

## Owned files

- `packages/vscode/src/intelligence.ts` — context classification, frame selectors, CSS functions,
  `$keyframes.` item, animation longhands.
- `packages/vscode/src/controller.ts` — `&` added to the completion trigger characters.
- `packages/vscode/src/providers/completion.ts` — trigger-character doc comment.
- `packages/vscode/src/property-docs.ts` — six new animation longhand descriptions (107 → 113).
- `tests/extension/provider.intelligence.test.ts` — one test per fix and per addition.
- `.ai/tasks/CSSX-A45.md`, `.ai/reports/CSSX-A45.md`, `.ai/PROGRESS.md`, `.ai/todo.md`.

## Requirements

1. In the `@setup` branch of `contextAt`, treat the last `;` or `{` as the statement boundary and
   return `setup-value` only when the nearest colon lies after it; otherwise `setup-key`. Boolean
   setup values must keep completing.
2. Traverse native at-rule `block` members when locating the enclosing rule/declaration (a shared
   `blockMembers` helper), add `findEnclosingNativeAtRule`, and add a `keyframe-selector` completion
   context gated on the at-rule name `keyframes` plus a brace-depth check that keeps the closing `}`
   out. Offer `from`, `to`, `0%`, `25%`, `50%`, `75%`, `100%` with one-line documentation, and scan
   the frame word so the replacement range covers `50%`. Directives after `@` inside a keyframes body
   and non-keyframes native blocks must keep their previous behaviour (no frame selectors).
3. Inside an enclosing rule, classify a `property:` statement from the **current line** as `value`
   even when the AST dropped the declaration, while a bare word (`wid`) stays `property` and
   `&:hover`/`a:hover` stay selector/pseudo.
4. Register `&` in the completion trigger characters and state it in the provider comment.
5. Add `animation-direction`, `animation-fill-mode`, `animation-iteration-count`, `animation-name`,
   `animation-play-state`, `animation-timing-function` to `CSS_PROPERTIES`, each with a one-sentence
   entry in `property-docs.ts` (completion documentation and hover share the same strings).
6. Add a `CSS_FUNCTIONS` list (25 entries: math, custom property/env/attr/url, colour, gradients,
   easing, transforms, filters, counters) used by the `value` case: keyword values keep sort prefix
   `0-`, functions use `1-`, `detail` is `CSS function`, documentation renders the example call, and
   `var` inserts `var(--` so no separate `var(--…)` item exists. Filtering is by typed word only.
7. In the `token` case push `$keyframes.` (`detail: built-in keyframe namespace`) when the namespace
   starts with the typed word, beside the imported aliases.
8. Do not change compiler behaviour, diagnostics, goldens, the TextMate grammar, the specification,
   an ADR or the plan. `@fn` stays a recorded deferral.

## Constraints

- Smallest coherent change inside the editor intelligence layer; no refactors, no new dependency, no
  new module.
- Existing contexts (directive/token/member/import-path/setup-value/property/selector/pseudo/group/
  keyframe-member) keep their current results; the tests for them are unchanged.
- The controller imports `vscode`, so trigger-character registration is asserted from its source.
- Preserve unrelated working-tree changes; no commit or push.

## Acceptance

- Each of the five bugs has a test that fails before and passes after the fix, and the two additions
  have their own tests (documentation, insert text, sort order, filtering).
- `@keyframes` frame bodies behave like rule bodies (`property`, then `value` with `blur(` among the
  suggestions); frame selectors filter by prefix; `%` replacement range is exact.
- `bun run typecheck` and `bun run lint` exit 0; `bun test` green with the new tests included.
- The only behavioural side effect is recorded (rules nested in `@media`/`@supports` now get rule-body
  completion instead of `none`).
- `.ai/reports/CSSX-A45.md` lists changed paths, per-fix evidence with test names, verification and
  the `@fn` deferral.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts
bun test
bun run typecheck
bun run lint
```
