# CSSX-A39 — G6a+G6b: editor intelligence for `@group`

## Summary

- Implement `@group.<name>` editor support in the pure extension layer: completion after `@group.`
  (local definitions first, imported names labelled, ambiguous names marked) with a block skeleton,
  the `@group` directive in both `@` lists, hover with resolved defaults plus the computed override
  list, and outline nodes for definitions and use sites.
- Group visibility must mirror the compiler's ADR-0017 rule (own top-level definitions + transitive
  `@use "…" styles;` closure, styles-only, local shadow, two imported definitions ambiguous) from the
  document AST and the existing `readModule` host — no compiler changes and no regex resolution.
- Rename a group definition and every reference across the visible module set, refusing ambiguous
  names; extend the provider so multi-file edits become one `WorkspaceEdit` while the single-file
  `$token` rename contract stays untouched.
- Extend `provider.intelligence.test.ts`, `provider.navigation.test.ts` and
  `provider.analysis.test.ts`; all existing tests stay green.

## Objective

Phases **G6a+G6b** of `.ai/plans/CSSX-PLAN-GROUPS.md` (editor half of §7 G6). The compiler phases
G0–G5 are complete and verified. No compiler, syntax, docs/ADR/plan-row (other than G6a/G6b),
todo/PROGRESS or example changes.

## Owned files

- `packages/vscode/src/analysis.ts`, `packages/vscode/src/intelligence.ts`,
  `packages/vscode/src/groups.ts` (new), `packages/vscode/src/positions.ts` (new),
  `packages/vscode/src/adapter.ts`, `packages/vscode/src/providers/navigation.ts`,
  `packages/vscode/src/providers/symbols.ts` (and `providers/completion.ts`/`hover.ts` only if
  required; they were not changed beyond pre-existing parallel work).
- `tests/extension/provider.intelligence.test.ts`, `tests/extension/provider.navigation.test.ts`,
  `tests/extension/provider.analysis.test.ts`.
- `.ai/tasks/CSSX-A39.md`, `.ai/reports/CSSX-A39.md`, `.ai/reports/logs/CSSX-A39.log`, and the plan's
  G6a/G6b rows only.

## Constraints

- Do not change compiler behaviour or its public API; if a public barrel export were strictly
  required, stop and report it as a blocker instead.
- Pure editor logic stays free of `vscode` imports; `vscode` only in `providers/`/`adapter.ts`.
- Preserve the existing token rename contract and all existing tests.
- Do not edit `.ai/PROGRESS.md`, `.ai/todo.md`, ADRs, specification, syntaxes, examples or the plan's
  other progress rows.

## Acceptance

- Completion lists visible groups after `@group.` with local definitions first and imports labelled;
  ambiguous names are marked; the item inserts the `name {\n  \n}` skeleton; `@group` completes after
  `@` at top level and inside rule bodies; definition context after a top-level `@group.` completes
  names too.
- Hover on a use site shows the resolved definition module, its defaults and the base properties the
  current use-site block overrides (analysis, not compilation); ambiguous names name both modules;
  unknown names are stated; definition hover shows the definition's declarations; the range covers
  `@group.<name>`.
- Outline lists top-level definitions and use sites nested inside their rules.
- Rename edits the definition and every reference across the visible modules and refuses ambiguity
  (naming both modules); token rename remains single-file.
- A document whose use site the compiler reports ambiguous resolves ambiguous in the editor (pinned
  by a test).
- `bun run verify` green (798/45 baseline plus new tests); extension suite green.

## Validation

- `bun test tests/extension`
- `bun run verify`
