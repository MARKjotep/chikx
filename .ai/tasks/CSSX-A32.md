# CSSX-A32 — G2: resolver collection, `group` symbol kind and `styles` visibility

## Summary

- Implement phase **G2** of `.ai/plans/CSSX-PLAN-GROUPS.md`: collect top-level `@group.<name>`
  definitions per module, resolve visibility through the transitive `styles` `@use` closure (owner
  decision (a): styles-only), and encode duplicate/local-shadow/ambiguity precedence per ADR-0017
  item 5.
- `@use "…" as group` is CHIKX2001 at the `@use` and creates no namespace, mirroring the existing
  `as keyframes` rejection. Duplicate definitions in one module are CHIKX2001 at the later
  definition and the first one wins.
- No use-site diagnostics and no lowering/expansion in this phase: ambiguity is returned as
  resolver data for G3's use-site CHIKX2001.
- Lead-directed documentation correction: a definition-in-rule is impossible by grammar (position
  decides: top level = definition, rule body = use site), so ADR-0017 item 1/7, SPECIFICATION §3.7
  and the plan no longer claim it is CHIKX1001.

## Objective

1. Read `AGENTS.md`, ADR-0017, `SPECIFICATION.md` §3.2/§3.6/§3.7, the plan (§2.4–§2.7, §6 G2, §7
   G2, §8, §9) and the G1 report (`.ai/reports/CSSX-A31.md`) before coding.
2. Study `resolver/keyframes.ts` (ADR-0015) and the `styles` closure / `ModuleRecord`
   (`graph.ts`, `types.ts`) and mirror their structure: per-module collection, memoized
   cycle-safe closure, resolver-internal record field.
3. Add `resolver/groups.ts` (`collectGroups`, `visibleGroups`, `GROUP_DIRECTIVE`) and the public
   `VisibleGroup` / `GroupResolution` shapes plus `ModuleRecord.groups`.
4. Reject `@use … as group` in `scopes.ts` exactly like `as keyframes`, but with a message naming
   the reserved directive.
5. Pin the §2.5 resolver rows in `tests/compiler/groups.resolver.test.ts`: duplicate, alias,
   shadow-no-error, ambiguity, transitive visibility, token-only exclusion, cycle safety, and the
   `$group.<name>` unknown-namespace path.
6. Apply the documentation correction to ADR-0017, `SPECIFICATION.md` §3.7 and the plan (§2.1, §7
   G1 wording, §8 fixture row, G2 progress row).
7. Run `bun run verify`, then write this task, the report and the worker log.

## Owned files

- `packages/compiler/src/resolver/**`
- `tests/compiler/**` (resolver tests only — no golden fixtures, no `tests/fixtures/**`)
- `docs/decisions/ADR-0017-reusable-declaration-groups.md`, `SPECIFICATION.md`,
  `.ai/plans/CSSX-PLAN-GROUPS.md` (only the documented corrections and the G2/§8 rows)
- `.ai/tasks/CSSX-A32.md`, `.ai/reports/CSSX-A32.md`, `.ai/reports/logs/CSSX-A32.log`

Off-limits: lowering, emitter, formatter, lexer, parser, extension, `types/diagnostics.ts`
(frozen), `types/ast.ts`, public compiler barrel, `PROGRESS`/`todo`/masterplan, examples,
`button.cssx`, `tests/fixtures/**`.

## Dependencies

- G1 complete: `GroupDefinition` (`kind: "group-definition"`) at top level and `GroupUseSite`
  (`kind: "group-use-site"`) in rule bodies; duplicates keep both nodes; no CHIKX2001 existed yet.
- ADR-0017 accepted by the owner (decisions (a) styles-only, (b) compile-time-only defaults, (c) reuse
  CHIKX2001).

## Constraints

- Frozen diagnostic registry: only existing CHIKX2001 (and parser-owned CHIKX1001) codes; message
  style mirrors existing diagnostics.
- Group-free output byte-identical; all existing goldens/suites green; no golden changes.
- Resolver data stays internal except what G3 needs (`ModuleRecord.groups` and its types).
- Do not change UI decisions; never weaken a test to pass; limit fix attempts to two per work item.

## Acceptance

- Per-module collection in authored order; visibility = own + transitive `styles` closure, memoized
  and cycle-safe; token-only imports expose no groups.
- Duplicate definition → CHIKX2001 at the later definition, first wins; local shadow → no
  diagnostic; two imported definitions with no local → returned as ambiguity (candidates include
  defining modules) with no resolver error.
- `@use … as group` → CHIKX2001 at the `@use`, no namespace, edge still resolves.
- `$group.<name>` still CHIKX2001 through the existing unknown-token-namespace path.
- Tests cover the resolver-side rows of the §2.5 matrix: duplicate, as-group alias, shadow-no-error,
  ambiguity detection, transitive visibility, token-only exclusion, cycle safety.
- ADR-0017 item 1/7, SPECIFICATION §3.7 and the plan no longer contradict the implemented grammar.
- `bun run verify` green with the 712 baseline intact plus new tests; zero golden changes.

## Validation commands

```sh
bunx tsc -p packages/compiler/tsconfig.json --noEmit
bunx biome check packages/compiler/src/resolver tests/compiler/groups.resolver.test.ts
bun test tests/compiler/groups.resolver.test.ts
bun test tests/compiler
bun run verify
git status --porcelain
git diff --stat -- SPECIFICATION.md .ai/plans/CSSX-PLAN-GROUPS.md packages/compiler/src/resolver
```
