# CSSX-A36 — G5: formatter round-trip for `@group`

## Summary

- Implement phase **G5** of `.ai/plans/CSSX-PLAN-GROUPS.md`: `format()` must print
  `@group.<name>` definitions and use sites like every other at-rule block, so parse→print never
  drops or rewrites a group.
- This is the **release blocker** ADR-0017 names: format-on-save ships and is enabled via
  `chikx.editor.formatOnSave`, so a formatter blind to group nodes deletes authored groups on save.
  G1 found that pre-G5 `format()` returned `.panel {\n}\n` for a group source with zero diagnostics.
- Print both node kinds (`group-definition`, `group-use-site`) appending to the existing
  `Printer`: one declaration per line, sibling at-rule indentation and blank-line rules, authored
  indentation depth inside rule bodies, and comments inside group values never duplicated.
- Pin round-trip, idempotence, semicolonless-final-declaration, parse-error fallback, group fixture
  preservation and group-free no-churn in `tests/compiler/formatter.test.ts` and
  `tests/extension/formatter.current-grammar.test.ts`; record evidence and update only the plan's
  G5 row.

## Objective

1. Read `AGENTS.md`, ADR-0017 item 8, plan §7 G5, the formatter module, the A24 `printUse` fix and
   the G1 finding.
2. Print `GroupDefinition` at top level and `GroupUseSite` inside rule/native bodies through the
   existing `printBlockItems` layout path (declarations only, so no nested-block blank lines).
3. Extend `embeddedCommentRanges` for both node kinds so an inline comment inside a group value is
   not printed twice.
4. Add formatter tests: round trip keeps both kinds with byte-identical declarations, idempotence,
   never emptied, group fixtures keep every `@group.` statement, semicolonless final declaration,
   parse-error unchanged with group syntax, group-free canonical layout byte-for-byte, compiled CSS
   invariance for a group source.
5. Keep `tests/extension/formatter.current-grammar.test.ts` green and add the group shape there.
6. Write task/report/log and mark only the plan's G5 row 🟢.

## Owned files

- `packages/compiler/src/formatter/index.ts`
- `tests/compiler/formatter.test.ts`, `tests/extension/formatter.current-grammar.test.ts`
- `.ai/plans/CSSX-PLAN-GROUPS.md` (G5 row only)
- `.ai/tasks/CSSX-A36.md`, `.ai/reports/CSSX-A36.md`, `.ai/reports/logs/CSSX-A36.log`

Off-limits: parser, lexer, resolver, lowering, types/AST, emitter, extension `src/**`, fixtures,
goldens, docs, ADR, `SPECIFICATION.md`, examples, `button.cssx`, PROGRESS/todo/masterplan,
framework records.

## Dependencies

- G1 (AST nodes, spans) and G3 (expansion semantics) complete.
- G4a writes `tests/fixtures/groups/**` concurrently; this task only reads those fixtures and does
  not edit them.

## Constraints

- No semantic change: `format` remains parse→print; diagnostics behavior unchanged.
- Group-free sources must format byte-identically to the pre-G5 formatter (no churn).
- No test weakening; do not regenerate expectations to pass.
- Framework records are not required: this is compiler application work, not a Rossa/Yvee/Shweet
  defect or feature request, and no framework dependency changes.

## Acceptance

- `format(format(x)) === format(x)` for sources with definitions and use sites.
- A file with a group is never emptied or structurally changed; group declarations byte-compare
  equal (authored slices) before/after.
- Parse-error input returned unchanged, including malformed group syntax.
- Group printing matches sibling at-rule layout, and the G1 finding (`.panel {\n}\n`) no longer
  reproduces.
- `bun run verify` green with the fixture-catalog counts consistent with G4a's landed fixtures.

## Validation commands

```sh
bunx tsc -p packages/compiler/tsconfig.json --noEmit
bunx biome check packages/compiler/src/formatter tests/compiler/formatter.test.ts tests/extension/formatter.current-grammar.test.ts
bun test tests/compiler/formatter.test.ts tests/extension/formatter.current-grammar.test.ts
bun test tests/compiler
bun test tests/extension
bun run verify
git status --porcelain
```
