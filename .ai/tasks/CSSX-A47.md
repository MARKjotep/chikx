# CSSX-A47 — CSS function tooltips and richer function documentation

## Summary

- Add hover tooltips for the curated CSS functions (`calc`, `var`, `color-mix`, gradients,
  transforms, filters, …) and replace the thin "CSS function, for example `…`" completion line with a
  per-function usage sentence plus the sample call.
- Today `hoverAt` in `packages/vscode/src/intelligence.ts` covers groups, `@group`, keyframes, tokens,
  media aliases, properties and classes, but hovering `calc` inside `calc(100% - 20px)` returns
  nothing, and the 25 `CSS_FUNCTIONS` entries carry only an `example`.
- Editor only: `packages/vscode/src/intelligence.ts` + `tests/extension/provider.intelligence.test.ts`.
  No compiler, parser, formatter, fixture, golden, grammar, ADR or specification change.

## Objective

1. **Enrich the function data.** Extend the `CssFunction` interface with a `usage` description (one or
   two sentences: what the function does + its argument shape) and populate it for all 25 entries of
   `CSS_FUNCTIONS`. The existing `example` field (the sample call) stays untouched.
2. **Completion documentation.** In the `value` case of `completionsAt`, render the item documentation
   as the usage description followed by the sample call — one consistent format for every function:
   `` `${usage}\n\nExample: \`${example}\`` ``.
3. **Hover support.** In `hoverAt`, add a CSS-function branch placed after token/alias handling and
   alongside the property branch, so it cannot shadow the existing hovers: when the word under the
   cursor is a known `CSS_FUNCTIONS` name **and** is immediately followed by `(` in the authored text,
   return `**calc()** — CSS function`, the usage description, then ``Example: `calc(100% - 20px)` ``.
   The hover range covers only the function-name word. A known name that is not followed by `(`
   (bare `steps` keyword, `min` in `min-width`) and function-looking text inside strings, comments or
   `url(...)` arguments must not match. A declaration property name can never reach the branch: it is
   followed by `:`, never `(`.
4. **Tests.** New tests in `tests/extension/provider.intelligence.test.ts` following the existing
   conventions: hover per representative function (`calc`, `var`, `color-mix`, a gradient,
   `cubic-bezier`), an exhaustive 25-function hover matrix, negative cases (word without `(`, unknown
   function, inside a string, inside a comment, inside `url(...)`, inside the arguments), the
   property-word/call-word coexistence case and completion-documentation assertions for the new
   format. No existing test weakened or deleted.

## Owned files

- `packages/vscode/src/intelligence.ts` — `CssFunction.usage`, `cssFunctionDocumentation()`,
  `cssFunctionAt()`, the hover branch, the `value` completion documentation.
- `tests/extension/provider.intelligence.test.ts` — new `describe("CSS function tooltips (A47)")`
  block (6 tests); no existing test changed.
- `.ai/tasks/CSSX-A47.md`, `.ai/reports/CSSX-A47.md`, `.ai/PROGRESS.md`, `.ai/todo.md`.

## Dependencies

- A46 landed in the same files (`typedColons` ≈line 624, `selectorOrPseudo` ≈line 640,
  `EnclosingRule` from `findEnclosingRule` ≈line 758). Its behaviour and tests must stay green.
- Baseline: `bun test` 865 pass / 45 files, `bun run typecheck` exit 0, `bun run lint` exit 0,
  intelligence suite 67 pass.

## Requirements

1. Every `CSS_FUNCTIONS` entry has a `usage` (one or two sentences) and keeps its `example` and
   optional `insertText` unchanged; no entry added or removed.
2. Completion documentation and hover render the same string from one helper, so the format cannot
   drift: `usage`, blank line, ``Example: `sample call` ``.
3. Function hover: title `**<name>()** — CSS function`, blank line, the shared documentation body;
   range = the name word only.
4. Hover only when the name word is immediately followed by `(` in the authored text; never inside
   strings, comments or `url(...)` arguments (the `url` name itself is a call and does match).
5. Cursor inside the arguments keeps no function hover (restriction to the name word is deliberate;
   documented in the report).
6. Existing hovers keep precedence: `$tokens`, media aliases, groups, keyframes and declaration
   properties behave exactly as before.

## Constraints

- Smallest coherent change: pure data + one text-level helper + one hover branch.
- No new dependency, module, refactor or completion item list change.
- No compiler/parser/lexer/resolver/formatter, grammar, fixture, golden, ADR, specification, plan or
  framework record touched.
- Preserve unrelated working-tree changes; no commit, push, reset or stash.

## Acceptance

- Hovering `calc` in `width: calc(100% - 20px);` shows name, usage and example; the same for every
  other curated function.
- Completion documentation for functions shows the usage sentence + sample call format.
- Negative cases produce no function hover.
- All pre-existing tests pass unchanged; `bun test` green, `bun run typecheck` exit 0,
  `bun run lint` exit 0.
- Records persisted: this task file, `.ai/reports/CSSX-A47.md`, a `P8 · A47` PROGRESS row 🟢 and the
  todo board entry.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts
bun test tests/extension/
bun test
bun run typecheck && bun run lint
```
