# CSSX-A04 — Recursive-descent Chikx parser (P1)

## Summary

- Implement the recursive-descent chikx parser in `packages/compiler/src/parser/` against the frozen AST/diagnostic contracts, consuming a `readonly Token[]` stream.
- Full grammar per SPECIFICATION.md §3.2 EBNF incl. owner decisions D1–D3, per-segment `!important` (ADR-0003), semicolon recovery (CHIKX1002/ADR-0011) and malformed-value recovery (CHIKX1003).
- No lexer work — A03 owns `src/lexer/`; your tests drive the parser directly with token streams built from fixture sources via a small local test helper.

## Objective

Produce the parser half of the compiler pipeline: token stream → immutable AST + syntax diagnostics, with
statement-boundary error recovery. Persist this task as `.ai/tasks/CSSX-A04.md` and results as
`.ai/reports/CSSX-A04.md` (worker log `.ai/reports/logs/CSSX-A04.log`).

## Dependencies

- A02 frozen contracts: `packages/compiler/src/types/{ast,token,diagnostics,result,span}.ts`.
- `SPECIFICATION.md` §0 (D1–D3), §3.1–§3.5, §12; ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0011,
  ADR-0012; `tests/fixtures/README.md` diagnostics policy.
- A03 (lexer) runs in parallel; the parser must not depend on it.

## Allowed files (exclusive ownership)

- `packages/compiler/src/parser/**` (new)
- `tests/compiler/parser*.test.ts` (new)
- `.ai/tasks/CSSX-A04.md`, `.ai/reports/CSSX-A04.md`, `.ai/reports/logs/CSSX-A04.log`

No changes to `packages/compiler/src/types/**` (frozen), `packages/compiler/src/index.ts`, `src/lexer/**`,
fixtures, docs or configs.

## Requirements

1. Public API `parseTokens(tokens: readonly Token[], file: string): { ast: Stylesheet; diagnostics:
   readonly Diagnostic[] }` in `src/parser/index.ts`; pure, zero dependencies, never throws, always
   returns a `Stylesheet`. No `parseSource` convenience and no re-tokenization.
2. Grammar per SPECIFICATION.md §3.2 and frozen AST JSDoc: `@setup` (multiple blocks → multiple nodes),
   `@use` (optional `as alias`), `@variables`, `@runtime`, `@media-types`, rules, native at-rules,
   unknown top-level `@ident` passthrough; top-level conditional block → CHIKX1001 + statement-boundary
   recovery with no node (D3/ADR-0004).
3. Rules vs declarations by balanced lookahead (ADR-0002), never by colon presence; bare nested
   selectors stay raw `Rule` nodes (D1); selectors keep raw slice + `selectorSpan`.
4. Declarations: split at modifiers into base + `Variant[]`; raw per-segment values/spans; per-segment
   `!important` (ADR-0003); `tokens?` only when a `dollar-ref` exists (ADR-0005).
5. Conditional blocks rule-scoped only (D3); native at-rule inside a conditional block → CHIKX1001 +
   recovery.
6. Semicolon policy (ADR-0011): semicolonless final declaration accepted only without modifier/`$`;
   otherwise CHIKX1002 with statement-scoped span and bounded recovery. Unclosed block → CHIKX1001.
7. Malformed values (unbalanced parens/brackets) → CHIKX1003 + recovery to the next statement.
8. Exact spans per frozen JSDoc; every node immutable.
9. Never throw; always terminate; diagnostics carry CHIKX1001/1002/1003 via the frozen factories.
10. Focused modules with a small facade and concise JSDoc.
11. Tests with `bun test` driving token streams from a local test-only scanner; cover every
    `tests/fixtures/errors/*` input, the canonical fixture AST shape, and structural cases
    (descendant nesting, multiple `&`, runtime variants, multiple `@setup`, native at-rules,
    per-segment `!important`).
12. `bun run verify` exits 0.

## Constraints

- Token-stream input only; no lexer import, no re-tokenization, no new dependencies.
- Frozen types are immutable; escalate instead of changing the contract.
- Do not touch `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; parser tests pass.
2. All `errors/*` fixture diagnostics that are derivable from tokens reproduce (code, severity, span
   policy); semantic-only fixtures are documented for later phases.
3. Canonical fixture parses to the documented AST shape with exact spans.
4. Never throws on any tested input; recovery resumes at statement boundaries.
5. Report lists created files, grammar/recovery decisions with spec/ADR citations, test evidence and
   blockers or contract concerns.

## Validation commands

```sh
bun test tests/compiler/parser.test.ts
bun run verify
```
