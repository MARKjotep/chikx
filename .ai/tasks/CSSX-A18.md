# CSSX-A18 — Editor intelligence: native at-rules + missing-semicolon quick fix

## Summary

- Typing `@` outside any rule body now offers the native at-rules Chikx passes through (`@keyframes`, `@media`, `@font-face`, `@import`, `@property`, `@supports`, `@layer`, `@container`, `@page`, `@charset`, …) after the five Chikx directives, with prefix filtering intact.
- Native at-rules are only offered where the specification allows them: everything at top level, only CSS-nesting-legal at-rules inside a rule body, and nothing mid-value.
- A `CHIKX1002` (missing semicolon) diagnostic gets a **Quick Fix → Add semicolon** code action that inserts `;` at the diagnostic's reported position; pure logic is unit-tested without an editor.
- `.ai/todo.md` becomes the permanent bug/feature intake board with the users' original wording preserved.

## Objective

Deliver the two editor-intelligence reports from `.ai/todo.md` on the editor side only:

1. `packages/vscode/src/intelligence.ts` — extend the `directive` completion context so native
   at-rules complete at top level (and the nesting-legal subset inside rule bodies), keeping the
   five Chikx directives first and prefix filtering working, and make top-level `@` detection
   text-based so recovery-pending lines cannot suppress it.
2. Editor semicolon help — a `vscode.CodeActionProvider` with an "Add semicolon" quick fix for
   `CHIKX1002`, wired in `src/controller.ts`, with the pure decision logic in its own testable
   module.
3. Reproduce the reported completion failure as a failing test before the fix (natives absent
   today) and prove it passes after.
4. Restructure `.ai/todo.md` into the bug/feature board given by the lead.

The compiler-side `&`-before-nested-rule diagnostic is **not** in this scope (parallel worker
CSSX-A17). The quick fix keys off whatever `CHIKX1002` diagnostic the compiler reports.

## Relevant files (exclusive write scope)

- `packages/vscode/src/intelligence.ts` — directive context + native at-rule table/items.
- `packages/vscode/src/quickfixes.ts` — **new** pure quick-fix logic (no `vscode` import).
- `packages/vscode/src/providers/code-actions.ts` — **new** thin `CodeActionProvider` adapter.
- `packages/vscode/src/providers/completion.ts`, `packages/vscode/src/adapter.ts` — map the new
  optional suggestion field (only if needed) and the analysis range conversion.
- `packages/vscode/src/controller.ts` — register the code action provider (existing pattern).
- `tests/extension/provider.intelligence.test.ts` — completion tests (before/after evidence).
- `tests/extension/provider.quickfix.test.ts` — **new** quick-fix tests.
- `.ai/tasks/CSSX-A18.md`, `.ai/reports/CSSX-A18.md`, `.ai/reports/logs/CSSX-A18.log`, `.ai/todo.md`.

## Dependencies (read-only)

- `SPECIFICATION.md` §3.2–§3.5 (grammar, nesting, native at-rules), §4 (media), §8 (editor
  surface), ADR-0004 (conditional blocks are rule-scoped), ADR-0011 (semicolon policy).
- `packages/compiler/src/parser/rule.ts` `NATIVE_AT_RULES` (the pass-through list the editor
  mirrors; the barrel exports no predicate) and `parser/declaration.ts` (CHIKX1002 span =
  declaration start … last value character, i.e. the insertion point).
- Existing provider patterns: `providers/{completion,diagnostics,navigation}.ts`,
  `AnalysisService.analyzeNow`, `adapter.ts` `toEditorRange`/`toEditorDiagnostic`.

## Constraints

- Do **not** touch `packages/compiler/**`, `SPECIFICATION.md`, ADRs, `.ai/PROGRESS.md` or any
  `.ai` file owned by another worker (`.ai/tasks/CSSX-A17.md`, …).
- `intelligence.ts` and `quickfixes.ts` stay free of the `vscode` import (pure, bun-testable).
- Preserve public imports/keys/behavior and type inference; additive optional fields only.
- Never weaken existing tests; no fixed sleeps; no ad-hoc `bun build`/`tsc`.
- Chikx directives must stay visually ahead of native at-rules; Chikx directives remain
  top-level-only (they are not offered inside rule bodies).

## Acceptance criteria

- Failing-before/passing-after test: at top level `@` offers the required native at-rules with
  `detail: "native at-rule"`, documentation, and the five Chikx directives still present.
- Prefix filtering works for both families; top-level `@` still fires when the document has
  recovery-pending lines and an unterminated construct.
- Native at-rules inside a rule body are limited to CSS-nesting-legal ones and are not offered
  mid-declaration; media aliases keep completing in value position.
- "Add semicolon" quick fix is produced for overlapping `CHIKX1002` diagnostics only, inserts `;`
  at the diagnostic range end, dedupes, and is registered as a `quickfix` code action provider.
- `.ai/todo.md` matches the lead's board structure with original wording verbatim.
- `bun run verify` fully green.

## Validation

- `bun run verify`
