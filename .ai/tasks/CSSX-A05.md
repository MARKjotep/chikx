# CSSX-A05 — Media IR + lowering (P2)

## Summary

- Define the immutable CSS IR (rules, declarations, condition contexts, native at-rule stacks, origin spans) in `packages/compiler/src/ir/`.
- Implement AST→IR lowering in `packages/compiler/src/lowering/`: inline-variant expansion in authored order, media alias resolution (built-ins < project < file, ADR-0006), combined-alias AND semantics, CHIKX3001 rejections, and safe grouping as a pure utility.
- Golden IR snapshots for the media fixtures; no CSS text emission (A06 owns the emitter) and no variable substitution (A08 owns it).

## Objective

Produce the lowering half of the pipeline between parse and generation. Persist this task as
`.ai/tasks/CSSX-A05.md` and results as `.ai/reports/CSSX-A05.md`.

## Dependencies

- `SPECIFICATION.md` §3.5, §4 (media conditions, alias merge, combined aliases), §5 (cascade contract),
  §6.2 (`@runtime`, deferred to A08), §11 (IR notes), §12 (diagnostics).
- `docs/decisions/ADR-0006-media-alias-merge.md`; ADR-0003 (per-segment `!important`).
- Frozen contracts: `packages/compiler/src/types/{ast,options,diagnostics,span}.ts`.
- Landed pipeline: `packages/compiler/src/index.ts` (`parse`) → `src/parser/index.ts` (`parseTokens`).

## Allowed files (exclusive ownership)

- `packages/compiler/src/ir/**` (new)
- `packages/compiler/src/lowering/**` (new)
- `tests/compiler/media*.test.ts`, `tests/compiler/lowering*.test.ts` (new)
- `.ai/tasks/CSSX-A05.md`, `.ai/reports/CSSX-A05.md`, `.ai/reports/logs/CSSX-A05.log`

No changes to frozen types, lexer, parser, the `src/index.ts` barrel, fixtures, docs or configs.

## Requirements

1. **IR** (`src/ir/types.ts`): immutable, span-preserving nodes — `DeclarationIr`, `MediaConditionIr`,
   `AtRuleContextIr`, `RuleIr`, `NativeBlockIr`, `StylesheetIr`. Raw values stay unsliced (no variable
   substitution, no class naming). Concise JSDoc on every node explaining order/no-dedup guarantees.
2. **Lowering** (`src/lowering/index.ts`): pure `lower(ast, options)` returning `{ ir, diagnostics }`.
   - Expand base + every inline variant in authored order as separate declarations governed by their
     segment condition; never reorder, merge or dedupe (§5.1, §5.2).
   - Conditional blocks AND into inherited conditions; nested rules flush the current run and become
     their own runs with the parent's condition/context, selector untouched (§5.1).
   - Native at-rules push a wrapper onto `context`; the Chikx `condition` stays Chikx-only. Chikx
     constructs inside `@keyframes`/`@font-face`/`@property` are CHIKX3001; plain declarations pass.
     `@runtime` is out of scope (P3/A08) and emits no IR.
   - Media aliases merge by key: built-ins < `options.media` < file `@media-types` (later same-key
     wins). Unknown aliases, comma lists and combinations that cannot form valid CSS are CHIKX3001 with
     no IR for the affected declaration or block.
3. **`groupRuns(ir, mode)`**: `safe` merges only adjacent runs with identical selector, ancestors,
   context stack and condition, preserving declaration order and the first span; `none` returns as
   authored. Documented as running after class rewriting (P4).
4. **Tests**: fixture goldens for `media/inline-variants`, `combined-and`, `block-conditions`,
   `custom-alias-override`, `duplicate-aliases`; cascade order; grouping; all rejection cases; alias
   precedence.

## Constraints

- Pure functions only: no filesystem, no globals, deterministic output across runs/platforms.
- Zero dependencies; JSDoc on every exported IR type and function.
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; all new tests pass.
2. IR is deterministic and span-preserving; cascade order per §5 is provably preserved in tests.
3. All five media fixtures lower to the expected IR; all CHIKX3001 cases reproduce.
4. Report lists created files, the alias-merge table, comma-list/native-context decisions with spec
   citations, and any blockers.

## Validation commands

```sh
bun test tests/compiler/media.test.ts tests/compiler/lowering.test.ts
bun run verify
```
