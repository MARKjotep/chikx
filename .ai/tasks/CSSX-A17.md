# CSSX-A17 — Semicolonless declaration before a nested rule is silently swallowed

## Summary

- Parsing `.button { color: red\n  &:hover { color: blue; } }` currently yields **no diagnostics**
  and one bogus nested rule whose selector is `color: red\n  &:hover`. The authored declaration is
  silently dropped, which violates invariant 2 (never silently swallow an authored construct) and
  ADR-0011 (a semicolonless declaration is only allowed for a **plain-CSS FINAL** declaration; this
  one is not final).
- The rule-vs-declaration decision belongs to `lexer/` + `parser/` per FRAMEWORK.md §6/§9, so the
  fix lands in `packages/compiler/src/parser/**` and reports the existing **CHIKX1002**
  (missing semicolon). No new diagnostic code is introduced.
- Recovery keeps the authored declaration **and** the following nested rule, emitting exactly one
  CHIKX1002 for the statement. The ADR-0011 allowance for a plain-CSS final declaration stays
  diagnostic-free and is covered by an explicit test.
- A regression fixture (`errors/semicolonless-before-nested-rule`) plus focused parser unit tests
  pin the behavior; `bun run verify` must stay green.

## Objective

1. Detect, inside a rule/conditional body, the statement shape "declaration that reached a nested
   rule's `{` without a `;`" and classify it as a declaration instead of a rule selector.
2. Report `CHIKX1002` once for that statement (syntax family, already in the frozen registry), keep
   the parsed declaration in the AST and resume parsing at the nested rule's selector so the nested
   rule survives intact.
3. Never throw; always return an AST. Ambiguous statements must not produce duplicate diagnostics.
4. Do not change the ADR-0011 allowance: a plain-CSS final declaration (last in the body, no
   modifier/`$`) without `;` before `}` stays accepted with no diagnostic.

## Reproduction (verified before the fix)

```ts
parse(`.button {\n  color: red\n  &:hover { color: blue; }\n}\n`, { file: "repro.cssx" })
```

Before: `diagnostics: []`; AST body = one rule with
`selector: "color: red\n  &:hover"` containing `color: blue`.

## Files (exclusive write scope)

- `packages/compiler/src/parser/**` — `value.ts` (selector-start lookahead), `rule.ts`
  (`classifyStatement`), `declaration.ts` (`scanValue` + `parseDeclaration`), `cursor.ts` (shared
  `startsNewLine`).
- `tests/compiler/parser.test.ts` — focused unit tests (recovery shape, spans, ADR-0011 allowance).
- `tests/compiler/{golden,pipeline,formatter,sourcemap}.test.ts` — fixture-catalog counts and lists
  only (48 → 49 entries, 38 → 39 plain).
- `tests/fixtures/errors/semicolonless-before-nested-rule/**` — new regression fixture
  (`input.cssx`, `expected/css`, `expected/diagnostics.json`).
- `tests/fixtures/README.md` — one fixture-index row.
- `.ai/tasks/CSSX-A17.md`, `.ai/reports/CSSX-A17.md`, `.ai/reports/logs/CSSX-A17.log`.

## Constraints

- No code outside the parser module; no `types/**` (frozen), no `SPECIFICATION.md`, ADRs,
  `.ai/todo.md`/`.ai/PROGRESS.md`, vscode package or other compiler stages.
- No new diagnostic codes; use `CHIKX1002`.
- No `bun build`/`tsc` ad-hoc substitutes; no weakened tests, no deleted goldens.
- Spans must stay authored (`Span` offsets), never invented.
- Semantics are unchanged: this enforces ADR-0011 as already written.

## Acceptance criteria

- `parse()` on the reproduction emits exactly one `CHIKX1002` for the non-final semicolonless
  declaration and keeps `&:hover` as a nested rule; the compiled CSS contains both `color: red` and
  the nested hover rule.
- The final-declaration semicolonless case (`lexical/final-no-semicolon` and an explicit unit test)
  remains diagnostic-free.
- New fixture (`CHIKX1002`, one entry) and unit tests pass.
- No unrelated golden diffs; every diff justified in the report.
- `bun run verify` green (typecheck + lint + test).

## Validation commands

```sh
bun test tests/compiler/parser.test.ts
bun test tests/compiler/golden.test.ts
bun run verify
```
