# Chikx Implementation Plan

**Primary specification:** `.ai/CSSX-MASTERPLAN.md`; normative language contract:
`SPECIFICATION.md`. Decisions live in `docs/decisions/` (ADR-0001–ADR-0014). Owner-locked language
decisions dated 2026-11-25: descendant bare nesting (D1), per-segment `!important` (D2),
rule-scoped conditional blocks (D3).

Status: P0–P7 complete (🟢), including A16 rule-merge imports (`@use … styles`, ADR-0014). Tasks were
scheduled only when dependencies were satisfied; per-task verification lives in `.ai/PROGRESS.md`,
and the lead flips status only after verifying each gate.

## Phases

| Phase | Deliverables | Dependencies | Exit criteria |
|---|---|---|---|
| P0 | Freeze grammar, cascade, output and naming contracts; scaffold workspaces and governance; ADRs and specification | none | Reviewed examples and acceptance fixtures; `bun run verify` passes on the scaffold |
| P1 | Workspace, AST, lexer, parser, diagnostics | P0 | Parser tests and recovery pass |
| P2 | Media lowering, nesting, CSS generator | P1 | Golden and browser cascade tests pass |
| P3 | Variables, imports, runtime tokens | P1 | Module graph and cycle tests pass |
| P4 | Class naming, JS/types, output planner | P1, P0 | Custom output and JSX tests pass |
| P5 | CLI, project graph, watcher, manifest | P2–P4 | End-to-end build/check/watch pass |
| P6 | VS Code grammar, providers, commands | P1; integrate P5 | Extension-host smoke tests pass |
| P7 | Source maps, formatting, performance, docs, release | P5–P6 | Full quality gates pass |

## Tasks

| Task | Phase | Deliverable | Owned file scope | Depends on |
|---|---|---|---|---|
| A01 | P0 | Scaffold workspaces, tooling, specification, ADRs, plan/progress | root `package.json`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `README.md`, `SPECIFICATION.md`, `docs/`, package manifests and stubs, `tests/` placeholders, `examples/` stubs, `.ai/PROGRESS.md`, `.ai/plans/CSSX-PLAN.md`, own task/report/log | — |
| A02 | P0 | Freeze token/AST/diagnostic/API types and golden fixture catalog | `packages/compiler/src/{contracts,ast,diagnostics,api}` (new), `tests/fixtures/` | A01 |
| A03 | P1 | Stateful lexer with recovery-safe termination | `packages/compiler/src/lexer/`, `tests/compiler/lexer/` | A02 |
| A04 | P1 | Recursive-descent parser, nested-rule lookahead, error recovery | `packages/compiler/src/parser/`, `tests/compiler/parser/` | A02 (may run in parallel with A03 against lexer contract) |
| A05 | P2 | CSS IR and media lowering/grouping | `packages/compiler/src/ir/`, `packages/compiler/src/media/`, `tests/compiler/media/` | A03, A04 |
| A06 | P2 | Selector lowering and CSS generator | `packages/compiler/src/selector/`, `packages/compiler/src/generator/`, `tests/compiler/generator/`, `tests/browser/` | A03, A04 (integration with A05 via frozen IR) |
| A07 | P3 | Module resolver: import graph, cycles, workspace bounds | `packages/compiler/src/resolver/`, `tests/compiler/modules/` | A02 |
| A08 | P3 | Compile-time substitution and runtime custom properties | `packages/compiler/src/variables/`, `packages/compiler/src/runtime/`, `tests/compiler/variables/` | A02 (runs parallel with A07 against resolved-token contract) |
| A09 | P4 | Prefix naming, JS class maps, `.d.ts` emission | `packages/compiler/src/classes/`, `packages/compiler/src/emit-js/`, `tests/compiler/classmap/`, `tests/fixtures/classmap/` | A02, A04 |
| A10 | P4 | Output planner: paths, safety, manifest | `packages/compiler/src/output/`, `tests/compiler/output/` | A02, A09 |
| A11 | P5 | CLI build/check/watch/format/clean, exit codes 0/1/2 | `packages/cli/`, `tests/integration/cli/`, `tests/fixtures/cli/` | A05–A10 |
| A12 | P6 | TextMate grammar and language configuration | `packages/vscode/syntaxes/`, `packages/vscode/language-configuration.json` | A03 (token classes) |
| A13 | P6 | Completion, hover and diagnostics providers | `packages/language-service/`, `packages/vscode/src/`, `tests/extension/` | A03, A04, A08, A09, A11 |
| A14 | P7 | Cross-browser computed-style matrix | `tests/browser/` | A05, A06, A09 |
| A15 | P7 | Source maps, formatter, benchmarks, docs, packaging | `packages/compiler/src/sourcemap/`, `packages/compiler/src/format/`, `docs/`, README/CHANGELOG, packaging config, `tests/integration/node-smoke/` | A05–A13 |
| A16 | P7 | Rule-merge imports (`@use ... styles`) per owner decision and ADR-0014 (🟢 lead-verified 2026-11-25) | `packages/compiler/src/` resolver/naming/lowering/index, `packages/cli/src/setup.ts`, `tests/compiler/modules*`, `tests/compiler/merge*`, `tests/fixtures/modules/`, ADR-0014 and SPECIFICATION §3.2/§6 | A05–A09 |

Owned scopes are exclusive. Shared contracts (`Span`, AST, diagnostics, IR, public API) are changed
only with lead approval.

## Concurrency

- A03 ∥ A04 after A02 freezes the token and AST contracts.
- A05 ∥ A06: media/IR work and selector/generator work integrate through the frozen CSS IR.
- A07 ∥ A08 after A02 freezes resolved-token and runtime shapes.
- A09 ∥ A10: class-map emission and output planning use the frozen class naming contract.
- Maximum **two concurrent implementation workers**, with disjoint file ownership. No worker edits
  another worker's owned files; handoff happens only after completion or abandonment.
- Independent tasks start as soon as slots free; do not wait for a whole batch. Tasks expected to
  exceed ~10 minutes are split into independently verifiable stages.

## Worker protocol

1. Each task gets a unique `.ai/tasks/<id>.md` with summary, objective, owned files, dependencies,
   constraints, acceptance criteria and validation commands. Never share a mutable task file.
2. Each task reports to `.ai/reports/<id>.md` with changed files, commands and actual results,
   deviations, blockers and a handoff for staged work. Worker logs go to `.ai/reports/logs/<id>.log`.
3. Workers run their own unit/integration checks and assigned test commands; they do not delegate.
4. The lead independently reviews the diff and runs the quality gates. A task or phase is never
   marked complete from an agent claim alone.
5. No shared interface changes without lead approval. No git commit or push without owner
   authorization.
6. At most two automatic correction attempts per task; unresolved issues are escalated to the lead.
7. Progress statuses: 🟢 complete, 🟡 partial/in progress, 🔴 open/blocked, ⚪ not applicable.

## P6 highlighting requirements (owner notes, 2026-11-25)

Owner preferences for the TextMate grammar (task A12) and language configuration:

- Custom media condition aliases (`@md`, `@lg`, `@dark`, `@xl+dark`, custom aliases from `@media-types`) must be visually distinct; the owner prefers YELLOW. Choose a TextMate scope that renders yellow/gold in default VS Code themes (e.g. a tag-like gold scope) — final scope mapping to be decided with the ui specialist in A12, since themes control actual colors.
- Chikx directives (`@setup`, `@use`, `@variables`, `@runtime`, `@media-types`) must be a different scope from media aliases so the two categories are distinguishable.
- Selectors must be distinguishable by category: class (`.foo`), id (`#foo`), type/element and pseudo-classes/pseudo-elements each get distinct scopes.
- Highlighting is grammar-only and must never affect compilation output.

