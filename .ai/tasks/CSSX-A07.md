# CSSX-A07 — Module graph resolver (P3)

## Summary

- Implement the module graph resolver in `packages/compiler/src/resolver/`: `@use` loading through the injected `ModuleHost`, canonical-path caching, cycle detection, workspace containment, topological order.
- Build per-module token scopes (compile-time from `@variables`, runtime from `@runtime`) with namespace rules, and the scope-level errors: duplicate local definitions, ambiguous unqualified imports, compile-time/runtime name collisions (CHIKX2001).
- All filesystem access through `ModuleHost`; tests use an in-memory host. Variable substitution itself is A08.

## Objective

Produce the resolver half of the pipeline: entry files → validated module graph + scopes that A08 can
substitute against. Persist this task as `.ai/tasks/CSSX-A07.md` and results as
`.ai/reports/CSSX-A07.md` (worker log `.ai/reports/logs/CSSX-A07.log`).

## Dependencies

- Frozen contracts: `packages/compiler/src/types/{ast,diagnostics,options,span,token}.ts`, in
  particular the async `ModuleHost`.
- Landed `packages/compiler/src/lexer/index.ts` (`tokenize`) and
  `packages/compiler/src/parser/index.ts` (`parseTokens`).
- SPECIFICATION.md §6, §11, §12; masterplan §3.4, §6; ADR-0007 (workspace root and containment).
- `tests/fixtures/variables/**` layout (`cycle`, `basic`, `namespaced-members`,
  `local-overrides-imported`, `ambiguous-import`).

## Allowed files (exclusive ownership)

- `packages/compiler/src/resolver/**` (new)
- `tests/compiler/resolver*.test.ts` (new)
- `.ai/tasks/CSSX-A07.md`, `.ai/reports/CSSX-A07.md`, `.ai/reports/logs/CSSX-A07.log`

No changes to frozen types, lexer, parser, lowering (`src/transformer/**`, A05 in flight), the barrel
`src/index.ts`, fixtures, docs or configs.

## Requirements

1. Public API in `src/resolver/index.ts`:
   `buildModuleGraph(entries, host, options)` returning
   `{ modules: ReadonlyMap<string, ModuleRecord>; order: readonly string[]; diagnostics: readonly
   Diagnostic[] }`. Because `ModuleHost` is async, the function is `async` and returns a `Promise`.
2. `ModuleRecord { file; ast; dependencies; importedBy; compileScope; runtimeScope; hasRules }`;
   `TokenScope` records the defining module (canonical path), declaring AST node span, local/imported
   origin (import statement + namespace), unqualified visibility, and namespaced member maps.
3. Pipeline per module: `host.readFile` → `tokenize` → `parseTokens`, importing the lexer/parser
   modules directly (never the barrel). Cache by `host.canonicalize(path)`; each file parses once.
4. `@use "./x.chikx" [as alias]` resolves relative to the importer (`host.resolvePath`), is
   canonicalized, checked with `host.fileExists`, and rejected with CHIKX2001 when missing or when the
   lexical/canonical target escapes `host.workspaceRoot()` (ADR-0007). Messages use forward slashes.
   Repeated imports of the same canonical target keep a single dependency edge.
5. Import cycles (including self) → CHIKX2001 with the cycle path in the message; cycle members stay in
   `modules` but are excluded from `order`. `order` is deterministic (dependencies first, ties by
   canonical path).
6. Scope-level CHIKX2001: duplicate local definitions (within/across blocks), ambiguous unqualified
   imports (when not shadowed by a local definition), local compile-time/runtime name collisions,
   missing imports. Undefined `$name` references are A08.
7. Tests with an in-memory recording `ModuleHost`: the variable fixtures above, namespace independence,
   containment, sibling relative resolution, import dedupe, compile/runtime collision, token-only
   modules (`hasRules === false`) and run-to-run determinism. No `node:fs` in `src/resolver/`.

## Constraints

- Pure, host-injected, zero dependencies, deterministic; no ambient state.
- Focused modules (`graph.ts`, `scopes.ts`, `paths.ts`, `types.ts` + facade) with JSDoc on every
  exported type/function.
- Do not touch `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; all resolver tests pass.
2. Cycle, containment, ambiguity, duplicate and collision diagnostics reproduce with CHIKX2001 and
   exact spans.
3. Scopes carry everything A08 needs (defining module, span, namespace, unqualified visibility, member
   names); the scope shape is documented in the report.
4. The report lists created files, API surface, dedupe/ordering decisions with spec citations, and any
   blockers.

## Validation commands

```sh
bun test tests/compiler/resolver.test.ts
bun run verify
```
