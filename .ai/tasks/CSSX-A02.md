# CSSX-A02 — Freeze compiler contracts and golden fixture catalog (P0)

## Summary

- Freeze the compiler's public TypeScript contracts: span, token, AST, diagnostics, options, module host, results and output-plan types in `packages/compiler/src/`.
- Create the golden fixture catalog: input fixtures plus the documented golden format and syntax-derivable expected diagnostics.
- No lexer/parser implementation — types and test data only, so the lexer and parser workers can start against frozen contracts.

## Objective

Freeze every interface later phases compile against, and establish the fixture format. Persist this
task as `.ai/tasks/CSSX-A02.md` and results as `.ai/reports/CSSX-A02.md`.

## Dependencies

- A01 scaffold, `SPECIFICATION.md` v0.1, ADR-0002 (descendant nesting), ADR-0003 (per-segment
  `!important`), ADR-0004 (rule-scoped conditionals), ADR-0005 (raw AST values), ADR-0008
  (tooling), ADR-0010 (naming/exports).

## Allowed files (exclusive ownership)

- `packages/compiler/src/**` (modules under `src/types/`, barrel `src/index.ts`)
- `tests/fixtures/**` (README plus fixture directories)
- `tests/compiler/contract.test.ts` (explicitly allowed by the task constraints for stub/export checks)
- `.ai/tasks/CSSX-A02.md`, `.ai/reports/CSSX-A02.md`, `.ai/reports/logs/CSSX-A02.log`

No root configs, other packages, `.ai/PROGRESS.md`, `SPECIFICATION.md` or docs. Interfaces frozen
here change only with lead approval.

## Requirements

1. Frozen contracts in `packages/compiler/src/types/` with a barrel in `src/index.ts`:
   - `span.ts` — `Span { start, end, file }`, workspace-relative POSIX `file`; line/column derived
     from offsets, never stored.
   - `token.ts` — `TokenKind` union (`ident`, `number`, `string`, `url`, `function`, `delim`,
     `colon`, `semicolon`, `comma`, `lbrace`, `rbrace`, `lparen`, `rparen`, `lbracket`, `rbracket`,
     `hash`, `at-keyword`, `dollar-ref`, `modifier`, `whitespace`, `comment`, `eof`) and
     `Token { kind, value, start, end }`. JSDoc freezes `modifier` as a recognized inline/block
     condition token used only at top-level value depth (or block-condition position), `dollar-ref`
     as `$name`/`$name.member`, and `at-keyword` for directive and native at-rule names.
   - `ast.ts` — nodes mirroring SPECIFICATION.md §3.2 and masterplan §6: `Stylesheet`, `SetupBlock`,
     `Setting`, `UseImport`, `VariablesBlock`, `TokenDeclaration`, `RuntimeBlock`,
     `MediaTypesBlock`, `AliasDeclaration`, `Rule`, `Declaration` (with `important?`), `Variant`
     (with `important?`), `ConditionalBlock`, `NativeAtRule`; raw value slices per ADR-0005 with
     optional `tokens?: Token[]` only when `$` references occur; no top-level conditional nodes
     (ADR-0004); multiple `@setup` blocks allowed as nodes for recovery.
   - `diagnostics.ts` — `Diagnostic`, `DiagnosticSeverity`, `DiagnosticCode`, frozen
     `DIAGNOSTIC_CODES` registry with family anchors `CHIKX1001`, `CHIKX2001`, `CHIKX3001`,
     `CHIKX4001`, `CHIKX5001`, plus `error()`/`warning()` factories.
   - `options.ts` — `ParseOptions`, `CompileOptions` (prefix, naming, media, emit flags, output dirs
     and names, strict, mediaGrouping, workspaceRoot), `CompileProjectOptions`, `ModuleHost` async
     contract; defaults per SPECIFICATION.md §9.
   - `result.ts` — `CompileResult`, `ClassMap` (null-prototype semantics, camelCase policy),
     `ParseResult`, `PlannedOutput`, `OutputPlan`, manifest entry, `planOutputs` signature.
   - `index.ts` — barrel for every frozen type plus `parse`, `compile`, `compileProject`,
     `planOutputs` stubs that throw `not implemented (P1+)`.
2. Fixture catalog under `tests/fixtures/` with `README.md` documenting the golden format and inputs
   grouped by canonical, lexical, media, nesting, important, errors, variables, runtime, global,
   naming, output and config, including the error fixtures' `expected/diagnostics.json` authored only
   for syntax-derivable cases.
3. One small contract test asserting exports exist and stubs throw.

## Owner addendum (received during A02)

1. Diagnostics registry reserves `CHIKX1002` (missing semicolon after a Chikx declaration; v0.1
   requires semicolons while an ordinary CSS final declaration without a trailing semicolon before
   `}` MAY be accepted — documented in the registry) and `CHIKX1003` (malformed declaration or block:
   unbalanced parentheses/braces in values, unrecoverable statements). `CHIKX1001` stays the general
   syntax/lexical anchor.
2. New fixtures: `errors/missing-semicolon` (CHIKX1002, statement-boundary recovery),
   `errors/malformed-value` (CHIKX1003), `lexical/no-whitespace-modifier` (`12px@md` is literal),
   `lexical/at-mid-value` (URL `@` literal while whitespace-preceded `@md` is a modifier).
3. Confirm `minify` stays in `CompileOptions` with default `false` as an opt-in `@setup` key.

## Constraints

- Zero third-party runtime dependencies; typecheck and `bun test` green; no weakening of gates.
- Do not modify `packages/compiler/package.json`, root configs, other packages, docs or
  `.ai/PROGRESS.md`; the lead flips statuses.
- Fixtures must be faithful to SPECIFICATION.md; ambiguities are reported, never guessed.

## Acceptance criteria

1. `bun run typecheck` and full `bun run verify` exit 0.
2. `src/index.ts` exports every frozen type; public API stubs throw; `tests/compiler/contract.test.ts`
   passes.
3. Fixture catalog complete with `tests/fixtures/README.md` documenting the golden format.
4. `expected/diagnostics.json` authored for syntax-derivable error fixtures.
5. Report lists created files, validation evidence, spec ambiguities with exact sections, and
   blockers.

## Validation commands

```sh
bun run typecheck
bun run lint
bun test
bun run verify
```
