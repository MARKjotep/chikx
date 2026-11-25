# CSSX-A03 — Stateful chikx tokenizer (P1)

## Summary

- Implement the stateful chikx tokenizer in `packages/compiler/src/lexer/` against the frozen Token/Span/Diagnostic contracts.
- Recognize modifier tokens only at rule-body value/block depth, per the frozen token JSDoc; `@` inside strings/comments/urls/parens stays ordinary CSS content.
- Full unit tests pinning every lexical fixture; no parser work — A04 owns `src/parser/`.

## Objective

Produce the lexer half of the compiler pipeline: source text → token stream + lexical diagnostics, with
guaranteed termination. Public API in `src/lexer/index.ts`:

```ts
export function tokenize(
  source: string,
  file: string,
): { tokens: readonly Token[]; diagnostics: readonly Diagnostic[] };
```

Tokens always end with exactly one `eof`; spans are half-open offsets into `source`; `file` flows into
every diagnostic span. Persist this task as `.ai/tasks/CSSX-A03.md` and results as
`.ai/reports/CSSX-A03.md`.

## Dependencies

- A02 frozen contracts: `packages/compiler/src/types/{token,span,diagnostics,ast}.ts`
- `SPECIFICATION.md` §3.1 (tokenizer), §3.2 (grammar context), §12 (diagnostic families)
- `.ai/CSSX-MASTERPLAN.md` §3.1
- `docs/decisions/ADR-0003-important-per-segment.md`, ADR-0005 (raw AST values), ADR-0011
  (semicolonless finals, parser-owned)
- Lexical fixtures under `tests/fixtures/lexical/`

## Allowed files (exclusive ownership)

- `packages/compiler/src/lexer/**` (new)
- `tests/compiler/lexer*.test.ts` (new test files; not `parser*.test.ts` or `contract.test.ts`)
- `.ai/tasks/CSSX-A03.md`, `.ai/reports/CSSX-A03.md`, `.ai/reports/logs/CSSX-A03.log`

Explicitly out of scope: `packages/compiler/src/types/**` (frozen), `src/index.ts` (barrel integration is
a later lead-directed step), `src/parser/**` (A04), fixtures, docs, configs, `.ai/PROGRESS.md`.

## Requirements

1. `tokenize(source, file)` with the signature above; exactly one trailing `eof`; half-open spans;
   `file` in every span; never throws.
2. Stateful single-pass tokenization per SPECIFICATION.md §3.1, honoring the frozen `types/token.ts`
   JSDoc as authoritative:
   - comments and whitespace preserved as tokens; strings keep their raw slice including quotes;
     escapes never decoded;
   - one `url` token per `url(...)` construct, quoted or unquoted, so interior brackets never count
     for depth;
   - `ident` immediately followed by `(` becomes `function` (name only) plus a separate `lparen`;
   - `@` names are lexed as `at-keyword` and never as `modifier` (the frozen JSDoc assigns
     promotion to the parser); `@` inside strings, comments, URLs and functions remains part of that
     token by construction;
   - `$name` / `$name.member` are single `dollar-ref` tokens;
   - numbers keep their unit or `%` suffix in one `number` token;
   - delimiters, braces, brackets, colons, semicolons, commas and hashes follow CSS scanning rules.
3. Lexical diagnostics for unterminated strings, comments and URLs, illegal control characters and
   invalid escapes as `CHIKX1001` errors with spans covering the offending construct; recovery always
   resumes at a safe boundary and the stream always ends with `eof`.
4. Zero dependencies; pure function; linear time; guaranteed termination on arbitrary input.
5. Concise JSDoc on `tokenize` and every internal module; focused modules behind a small facade.
6. Unit tests with `bun test`:
   - every `tests/fixtures/lexical/*` input pinned: token kind sequence, lossless round-trip, one
     `eof`, no lexical diagnostics, and the `@`-boundary facts (`at-mid-value`, `url-at`,
     `at-in-string`, `calc`, `no-whitespace-modifier`, `comments-escapes`, `final-no-semicolon`);
   - `$spacing` / `$theme.primary`, `@xl+dark` token shape, `@media` vs `@md` context facts,
     unterminated string/comment diagnostics that still terminate with `eof`;
   - invariant tests over exhaustive small and randomized inputs.
7. `bun run verify` exits 0.

## Constraints

- Only the allowed files; frozen types are immutable; a contract that genuinely cannot express a
  requirement is reported as a blocker instead of changed.
- No parser or AST logic.
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; all lexer tests pass.
2. `tokenize` is lossless (round-trip holds for all fixture inputs) and ends every stream with a single
   `eof`.
3. `@` classification matches the frozen JSDoc + spec rules for every lexical fixture.
4. Report lists created files, token-classification decisions with their justifying JSDoc line, test
   evidence, and blockers or contract concerns.

## Validation commands

```sh
bun test tests/compiler/lexer            # lexer suites
bun test                                 # whole suite
bunx biome check packages/compiler/src/lexer tests/compiler/lexer*.test.ts
bun run typecheck
bun run verify
```
