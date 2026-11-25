# CSSX-A42 — Editor intelligence for `$keyframes.<name>`

## Summary

- Add editor-side keyframe visibility for `$keyframes.<name>`: `@keyframes` names from the document
  plus modules reached through transitive `@use "…" styles;` (ADR-0015). Token-only imports expose
  nothing; duplicate names across visible modules are listed, never diagnosed.
- `$keyframes.` completion lists visible names local-first with imported/duplicate/ambiguous details;
  hover shows the defining module and a frames summary and states unknown/ambiguous names; rename
  rewrites the definition, every attributed `$keyframes.<name>` reference and exact
  `animation-name: <name>` values across visible modules, refusing ambiguity, duplicates and invalid
  identifiers.
- Scope excludes todo item 6's compiler-semantics items (token-only-import keyframe names,
  string-named and conditional keyframes), which remain owner decisions pending an ADR-0015
  amendment. No compiler, syntax, example, docs, ADR, plan or todo change.
- Validation: `bun run verify` green at **849 pass / 0 fail / 45 files** (826 baseline + 23 new
  tests); typecheck and Biome clean.

## Objective

Implement task CSSX-A42, the editor half of `.ai/todo.md` item 6, mirroring the A39 group pattern:

1. Pure, `vscode`-free keyframe visibility/resolution from the document AST plus the existing sync
   `readModule` host, exposed on `AnalyzeResult` as `keyframes`.
2. `$keyframes.` member completion: local first, imported modules marked, duplicates each listed.
3. Hover for definitions and `$keyframes.<name>` references: module, frames, unknown (CHIKX2001
   wording) and ambiguous (both modules).
4. Multi-file rename: definition + attributed references + exact `animation-name` values; refuse
   ambiguous sets, later duplicate definition headers, invalid CSS identifiers and collisions.
5. Verify the outline still lists `@keyframes` blocks.
6. Tests in `provider.intelligence.test.ts` and `provider.navigation.test.ts`; keep token and group
   contracts untouched.

## Owned files

- `packages/vscode/src/keyframes.ts` (new), `analysis.ts`, `intelligence.ts`,
  `providers/navigation.ts`.
- `tests/extension/provider.intelligence.test.ts`, `tests/extension/provider.navigation.test.ts`.
- `.ai/tasks/CSSX-A42.md`, `.ai/reports/CSSX-A42.md`, `.ai/reports/logs/CSSX-A42.log`.

## Constraints

- Editor keyframe visibility must agree with the compiler: styles-only, local names first, token-only
  imports invisible.
- No compiler, lexer/parser/types, syntax, examples, docs/ADR/plan/todo/PROGRESS, fixtures or
  `button.cssx` changes; no new dependencies.
- Pure editor logic stays free of `vscode`; provider changes are limited to routing rename.
- Preserve the existing `$token` completion/hover/rename and `@group` contracts.
- `animation:` shorthand is intentionally not rewritten; only declarations whose property is exactly
  `animation-name` and whose whole value is the keyframe name.

## Acceptance

- `$keyframes.` completion: local first, imported marked with defining module, duplicates each listed
  with no diagnostic.
- Hover: defined (module + frames), unknown (references CHIKX2001), ambiguous (both modules), range
  covers the whole `$keyframes.<name>` reference.
- Rename: definition name + `$keyframes.<name>` references + exact `animation-name` values, multi-file
  through `WorkspaceEdit`; refuses ambiguity (naming both modules), invalid identifiers, existing
  names in scope and later duplicate definition headers.
- `@keyframes` blocks still appear in the outline.
- `bun run verify` green (826/0/45 baseline plus new tests).

## Validation

- `bun run typecheck` — green.
- `bun run lint` — green (422 files).
- `bun test tests/extension/provider.intelligence.test.ts tests/extension/provider.navigation.test.ts`
  — 72 pass / 0 fail.
- `bun test tests/extension` — 149 pass / 0 fail.
- `bun run verify` — 849 pass / 0 fail / 45 files.
