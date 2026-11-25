# CSSX-A16 — Rule-merge imports (`@use ... styles`) (P7)

## Summary

- Extend the resolver with a `styles` import mode (rule-bearing module graph edges, per-module provenance).
- Implement per-module lowering + per-module class renaming with the module's own prefix, merged IR (imported-first order), merged class tables with strict collision detection, and the `module: true` setup key.
- New `modules/` fixture group + goldens + tests; no docs/examples work (another worker owns them).

## Objective

Deliver stylesheet modularization: `@use "./card.chikx" [as alias] styles;` merges a module's
stylesheet rules into the importing build under the owner decision of 2026-11-25 (ADR-0014).
Persist this task as `.ai/tasks/CSSX-A16.md` and results as `.ai/reports/CSSX-A16.md`.

## Dependencies (read-only)

- `SPECIFICATION.md` §3.2 (grammar), §6.1–§6.2 (modules, tokens), §7.2 (class renaming), §8
  (maps/declarations), §9 (output setup), §12 (diagnostics).
- `docs/decisions/ADR-0007-workspace-root-and-containment.md`,
  `docs/decisions/ADR-0010-class-naming-and-exports.md`.
- Landed pipeline `packages/compiler/src/index.ts` (`compile`/`compileProject`/`compileEntry`),
  `src/resolver/**`, `src/naming/**`, `src/lowering/**`, `src/variables/**`.
- `.ai/reports/CSSX-A07.md`, `.ai/reports/CSSX-A08.md` (scope/provenance shapes).

## Owner feature decision (2026-11-25) — normative

`@use "./card.cssx" [as alias] styles;` imports the module's RULES as well as its tokens.

- Imported rules keep the imported module's OWN prefix (from its own `@setup`); the importing
  file's prefix never applies.
- Merged CSS order: imported modules first (depth-first in `@use` authored order), then the
  importing file's rules — native-`@import`-like cascade.
- One merged JS map + `.d.ts` for the importing build covering all style-imported modules plus its
  own classes. Same original class name → same emitted name unifies; different results or
  camelCase alias collisions → CHIKX4001 (strict).
- Style-imported modules do not force standalone artifacts. `@setup { module: true; }` marks a
  file module-only: its own build suppresses `emit-css`/`emit-map`/types unless explicitly
  authored.
- Cycles through style imports → CHIKX2001. Runtime tokens of merged modules emit into the
  consuming build per §6.2.
- Write ADR-0014 and update `SPECIFICATION.md` §3.2 EBNF + the modules section.

## Allowed files (exclusive ownership)

- `packages/compiler/src/**` (resolver, naming, lowering, index barrel; the one pre-approved
  frozen-type addition is `UseImport.styles?: boolean`).
- `packages/cli/src/setup.ts` (project-build integration for the `module: true` setup key).
- `tests/compiler/modules*.test.ts`, `tests/compiler/merge*.test.ts`,
  `tests/fixtures/modules/**`.
- `docs/decisions/ADR-0014-rule-merge-imports.md`, `SPECIFICATION.md` (§3.2 EBNF + modules
  section).
- `.ai/tasks/CSSX-A16.md`, `.ai/reports/CSSX-A16.md`, `.ai/reports/logs/CSSX-A16.log`.

## Requirements

1. Resolver parses the optional `styles` clause and records the mode on the edge
   (`ModuleRecord.styleDependencies`); style-imported modules join the graph.
2. Pipeline lowers each style-imported module with its own setup, then the entry; IR order is DFS
   over style imports in authored order, then the entry.
3. Class rewrite per module prefix, then merged table: identical pairs unify; conflicts and
   camelCase alias collisions are CHIKX4001.
4. One merged map + `.d.ts` from the existing generator.
5. `module: true` suppresses that file's own emit-css/emit-map/types unless the keys are authored.
6. Fixtures: `merge/{basic,prefix-independence,collision,tokens-plus-rules,cycle,module-flag,chain}`
   with CSS + map goldens.
7. Tests: parser clause, resolver modes/cycles, prefix independence, DFS order, map merge and
   collisions, module-flag suppression, runtime tokens from merged modules, byte-identical existing
   goldens.

## Constraints

- Zero dependencies, pure passes, deterministic; existing suites and goldens unchanged.
- Only `UseImport.styles?: boolean` was added to a frozen type.
- Do not mark `.ai/PROGRESS.md`.

## Acceptance criteria

1. `bun run verify` exit 0; all suites green; existing goldens unchanged.
2. All seven merge fixtures behave per the owner decision with goldens.
3. ADR-0014 + SPECIFICATION.md updates written.
4. Report: created files, pipeline order, prefix/collision decisions, blockers.

## Validation commands

```sh
bun test tests/compiler/modules.test.ts tests/compiler/merge.test.ts
bun run verify
```
