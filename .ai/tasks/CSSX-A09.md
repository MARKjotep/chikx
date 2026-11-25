# CSSX-A09 — Class rewrite + JS map/declaration generation (P4)

## Summary

- Implement the pure class-rewrite pass in `packages/compiler/src/naming/`: collect local class tokens from flattened selectors, rename per the naming table (`none` / `prefix`), and unwrap `:global(...)` while keeping its class literal.
- Implement JS class-map and TypeScript declaration generation (§3.6): quoted original keys, camelCase named exports when unambiguous, strict CHIKX4001 collision policy, `__proto__`-safe emission, deterministic ordering, globals never exported.
- Update affected CSS goldens for fixtures whose `@setup` sets a prefix (canonical → `.ui-button` per masterplan §2) and author `expected/map.js` / `expected/map.d.ts` goldens for canonical and the naming/global fixtures.

## Objective

Complete the class-rewrite + map-generation stages of the pipeline (position: after
`substitute`/`emitRuntimeTokens`, before `groupRuns`). Persist this task as
`.ai/tasks/CSSX-A09.md` and results as `.ai/reports/CSSX-A09.md`.

## Dependencies (read-only)

- `SPECIFICATION.md` §7.2 (classes), §8 (JS maps/declarations), §2 (canonical example),
  §12 (CHIKX4001); `.ai/CSSX-MASTERPLAN.md` §3.5, §3.6; `docs/decisions/ADR-0010-class-naming-and-exports.md`.
- A06 selector scanner/flattening (`src/selectors/`) — imported read-only.
- A05 IR (`src/ir/types.ts`, `src/ir/factories.ts`), A06 emitter (`src/emitter/`), A08
  `substitute`/`emitRuntimeTokens`, frozen diagnostics/types
  (`CHIKX4001`, `NamingStrategy`, `NamingOptions`).

## Allowed files (exclusive ownership)

- `packages/compiler/src/naming/**` (new)
- `tests/compiler/naming*.test.ts`, `tests/compiler/mapgen*.test.ts` (new)
- `tests/fixtures/**/expected/css` only where a fixture `@setup` prefix changes class selectors
- `tests/fixtures/**/expected/map.js`, `tests/fixtures/**/expected/map.d.ts` for class-bearing fixtures
- `tests/compiler/golden*.test.ts` runner wiring (required by the task)
- `.ai/tasks/CSSX-A09.md`, `.ai/reports/CSSX-A09.md`, `.ai/reports/logs/CSSX-A09.log`

## Requirements

1. `renameClasses(ir, options)` — pure; rebuilds rules with renamed classes, spans preserved; naming
   table falls back to unprefixed + CHIKX4001 for invalid prefixes/results; `:global(...)` escapes
   renaming, is unwrapped in output, recorded as global (never exported).
2. `generateClassMap(classes, options)` — deterministic ESM JS + `.d.ts`; optional CSS import; named
   camelCase exports when unambiguous; CHIKX4001 error on alias collisions (both named exports
   omitted, default map keeps quoted original keys); reserved/invalid identifiers get quoted keys +
   warning; `__proto__` computed keys; globals omitted; literal types + readonly map.
3. Update canonical/naming/global and every other prefixed fixture CSS golden; wire `renameClasses`
   into the golden runners; author map/d.ts goldens for canonical, naming/* and global/escape.

## Constraints

- Zero dependencies, pure functions, JSDoc on every export, no input mutation, no barrel wiring
  (lead owns `src/index.ts`). Do not modify frozen types/lexer/parser/resolver/lowering/selectors/
  emitter/variables, configs, docs or `.ai/PROGRESS.md`.

## Acceptance criteria

1. `bun run verify` exit 0; all new tests pass; all goldens byte-exact.
2. Nested class references covered; `:global` escapes + unwraps; globals not exported.
3. Collision/reserved policies per ADR-0010; `__proto__` safe; byte-identical across runs.
4. Report: created files, naming/alias/collision decisions with §3.5/§3.6 citations, golden update
   list, blockers.

## Validation commands

```sh
bun test tests/compiler/naming.test.ts tests/compiler/mapgen.test.ts
bun test tests/compiler/golden.test.ts tests/compiler/variables.golden.test.ts
bun run verify
```
