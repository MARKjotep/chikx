# CSSX-A40 — G6c: TextMate scopes for `@group`

## Summary

- Phase **G6c** of `.ai/plans/CSSX-PLAN-GROUPS.md`: `@group.<name>` definitions and use sites get
  distinct TextMate scopes, separate from media aliases (`@md`), sibling directives (`@setup`) and
  `$keyframes.<name>` members.
- Highlighting only. The compiler, resolver, lowering, formatter, fixtures and extension providers
  are untouched; no output or snapshot changes.
- Owned files: `packages/vscode/syntaxes/chikx.tmLanguage.json`, the two grammar test suites and the
  new records. `packages/vscode/src/**` belongs to the parallel A39 worker.

## Objective

Add grammar rules so a top-level `@group.<name>` definition and an in-rule use site are
distinguishable, the member name has its own scope, malformed forms degrade gracefully, and every
existing grammar test still passes unchanged.

## Required reading

1. `packages/vscode/syntaxes/chikx.tmLanguage.json` — directive, dotted construct, media-alias and
   member scoping.
2. `tests/extension/grammar.test.ts`, `grammar.scopes.test.ts`, `grammar-harness.ts`.
3. `docs/decisions/ADR-0017-reusable-declaration-groups.md` items 1, 2, 5 (contiguous dotted form,
   position decides definition vs use site, `@group.keyframes` is an ordinary name).
4. Plan §6 G6c row and §7 G6 highlighting criterion.

## Work items

1. Add `#group-definition` (root, before aliases) and `#group-use` (block body) with
   `meta.directive.group.chikx` / `meta.group.use.chikx` containers.
2. Share the consistent directive keyword scope and dot punctuation:
   `keyword.control.directive.chikx` + `punctuation.accessor.chikx`; give the member
   `entity.name.type.group.chikx`.
3. Add `#group-keyword` so a bare `@group` and spaced `@group .x` keep only the directive keyword
   scope and never open a variant/generic at-rule that swallows following content.
4. Reserve `group` in the alias, `conditional-block` and `alias-block-start` exclusion lists so
   `@group.*` is never a media alias or variant block; `@groupie` remains an alias.
5. Add structural and rendered-scope tests: definition vs use site, member scope, `@group.keyframes`,
   `$keyframes.spin` distinction, `@md`/`@setup`, malformed adjacency.
6. Records plus the plan's G6c row.

## Constraints

- Owned files only: grammar, `tests/extension/grammar*.test.ts` (harness untouched), records, plan
  G6c row. No `packages/vscode/src/**`, other tests, docs, examples, PROGRESS/todo.
- Existing scope names and rule order stay stable; no existing test is edited or weakened.
- Highlighting never affects output.

## Acceptance criteria

- Definition vs member scopes are distinct from media aliases and other directives.
- All existing grammar tests pass unchanged; new grammar tests pass.
- `bun run verify` green (798/45 baseline + new tests).

## Validation commands

```sh
bun test tests/extension/grammar.test.ts tests/extension/grammar.scopes.test.ts
bun test
bun run verify
```
