# CSSX-A33 — G3: `@group.<name>` expansion, token attribution, spans and diagnostics

## Summary

- Implement phase **G3** of `.ai/plans/CSSX-PLAN-GROUPS.md`: every `@group.<name>` use site (any
  depth) is replaced in place by the group's defaults in definition order followed by the use-site
  block's declarations in authored order, before that module's `lower`/`substitute` passes.
- Defaults resolve `$refs` in the defining module and overrides in the consumer; a default's
  `@runtime` reference is CHIKX2001 with that segment omitted (owner decision (b)).
- Unknown and ambiguous groups are CHIKX2001 at the use-site span, omit exactly the use-site block
  and leave an emptied rule dropped like any other; nothing is filtered, reordered or deduplicated.
- Lead-directed documentation correction: the ADR-0017 item 5/7 text and `SPECIFICATION.md` §3.7 now
  state that `@use "…" as group` invalidates the whole statement (no namespace, no tokens),
  mirroring `as keyframes`.

## Objective

1. Read `AGENTS.md`, ADR-0017, `SPECIFICATION.md` §3.7, the plan (§2.2–§2.7, §6 G3, §7 G3, §8, §9)
   and the G1/G2 reports (`.ai/reports/CSSX-A31.md`, `.ai/reports/CSSX-A32.md`) before coding.
2. Study `lowering/**` (`lower`, `groupRuns`, spans), `variables/**` (`substitute`, `expand`,
   `ast`, `walk`, `runtime`) and the per-module wiring in `index.ts`; choose the ADR-0017 item 6
   attribution design and document it.
3. Add the expansion pass in `packages/compiler/src/lowering/` and export it from the lowering
   barrel; it resolves each use site against the consuming module's `GroupResolution`.
4. Attribute substitution by the authored `span.file`, extend the reference walks to use-site
   declarations, and reject `@runtime` references in group defaults in
   `packages/compiler/src/variables/` (attribution only).
5. Wire the pass into `compileEntry` for every style-imported module and the entry (wiring only).
6. Add `tests/compiler/groups.expansion.test.ts` (expansion half of `tests/compiler/groups*`) with
   IR, CSS, span, source-map, diagnostic, variant/`!important` and determinism cases.
7. Apply the documentation correction to ADR-0017 and `SPECIFICATION.md` §3.7; update the plan's G3
   row only.
8. Run `bun run verify`, then write this task, the report and the worker log.

## Owned files

- `packages/compiler/src/lowering/**` (new `expand-groups.ts`, lowering barrel JSDoc/exports)
- `packages/compiler/src/variables/**` (attribution only: `ast.ts` group-default index and
  use-site reference walks, `substitute.ts` origin scope + runtime rejection)
- `packages/compiler/src/index.ts` (pipeline wiring and its JSDoc only)
- `tests/compiler/groups.expansion.test.ts` (expansion half; no goldens, no `tests/fixtures/**`)
- `docs/decisions/ADR-0017-reusable-declaration-groups.md`, `SPECIFICATION.md` (the two directed
  corrections only)
- `.ai/plans/CSSX-PLAN-GROUPS.md` (G3 row only)
- `.ai/tasks/CSSX-A33.md`, `.ai/reports/CSSX-A33.md`, `.ai/reports/logs/CSSX-A33.log`

Off-limits: resolver, parser, lexer, `types/**` (frozen AST and diagnostic registry), formatter,
emitter, IR types, extension, examples, `button.cssx`, fixtures/goldens, `PROGRESS`/`todo`/
masterplan.

## Dependencies

- G1: `GroupDefinition` (`kind: "group-definition"`, top level) and `GroupUseSite`
  (`kind: "group-use-site"`, rule bodies at any depth), declarations-only, authored spans.
- G2: `ModuleRecord.groups` with `GroupResolution` (`resolved` defining module + `GroupDefinition`,
  or `ambiguous` ordered candidates); styles-only visibility; duplicate/alias/`$group.` handling.
- ADR-0017 accepted: (a) styles-only, (b) compile-time-only defaults, (c) reuse CHIKX2001.

## Constraints

- Frozen registry: only CHIKX1001/CHIKX2001; messages name the group and, for ambiguity, the
  defining modules.
- Expansion never filters, reorders, deduplicates or rewrites; spans stay authored; repeated builds
  are byte-identical; group-free sources are byte-identical (no golden change).
- `groupRuns` unchanged; `@group` definitions emit nothing.
- Do not change UI decisions; never weaken a test to pass; at most two fix attempts per work item.

## Acceptance

- Use site expands to defaults-then-overrides at the authored position; same-property repeats are
  present in the IR and in the CSS.
- Defining-module vs consuming-module `$ref` scoping proven (`cross-module-defining-tokens`); a
  spliced declaration's source map lands on the definition file/line.
- Unknown, ambiguous and `@runtime`-default cases each omit exactly the specified statements with
  CHIKX2001; an emptied rule is dropped; definitions stay inert.
- Inline variants in defaults expand in authored order; a default's `!important` is not beaten by a
  plain use-site declaration; repeated builds byte-identical.
- `bun run verify` green with the 723/43 baseline intact plus new tests; zero golden changes.
- ADR-0017 item 5/7 and `SPECIFICATION.md` §3.7 corrected for the `as group` recovery.

## Validation commands

```sh
bunx tsc -p packages/compiler/tsconfig.json --noEmit
bunx biome check packages/compiler/src/lowering packages/compiler/src/variables packages/compiler/src/index.ts tests/compiler/groups.expansion.test.ts
bun test tests/compiler/groups.expansion.test.ts
bun test tests/compiler
bun run verify
git status --porcelain
git status --porcelain tests/fixtures
```
