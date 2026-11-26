# CSSX-CLASS-RENAME — single-file class rename inside `.cssx`

**Status:** 🟢 done (2026-11-26) · **Board item:** feature 27 · **Scope:** editor intelligence only
**Package / API:** `packages/vscode` — `src/intelligence.ts`, `src/providers/navigation.ts`, tests,
docs and records. No compiler, CLI, naming, map or `.d.ts` change.

## Summary

- F2 rename on a class token in a selector now updates every non-global occurrence of that class
  name in the current `.cssx` document. Only the name bytes change; the leading dot survives.
- `:global(...)` occurrences are excluded from a normal rename and refused when selected.
  Invalid identifiers, names that already exist in the file and non-class tokens are refused.
- JSX, the generated map and `.d.ts` are never edited: they follow the next build, so TypeScript
  catches a changed binding while literal `className="…"` strings are not caught.
- Token, group and keyframe rename behaviour is unchanged.

## Objective

**Rename scope and semantics.**
- Trigger: rename (F2) on a class token in a selector (base, `&` nesting, comma lists, inside
  `:is()`/`:not()`/`:has()`).
- Edit set: every occurrence of that class **name** in the current document's analysis, replacing
  only the name bytes (the leading `.` stays).
- **Exclude `:global(...)` occurrences** from the edit set: selecting an in-place rename there
  refuses with a clear message. Selecting a normal occurrence never rewrites the global ones.
- **Refuse** when: the new name is not a valid CSS identifier; a class with the new name already
  exists in this file (would silently merge two classes — U04 precedent); the token is not a class
  (ids, pseudo names, `$tokens`, groups, keyframes keep their current behaviour).
- Renaming to the identical name is a pinned no-op edit set.
- Never edit other files, never edit the generated map/`.d.ts`, never invent positions.
  `prepareRename` returns the class-name range (not the dot) with the current name as the
  placeholder.

## Relevant / allowed files (write set)

- `packages/vscode/src/intelligence.ts` (`renameClass`, exported `classAt`, class branch in
  `renameAt`), `packages/vscode/src/providers/navigation.ts` (prepare/rename wiring).
- `tests/extension/provider.navigation.test.ts`, `packages/vscode/test/ui/navigation.js`.
- `docs/usage.md` §5.2, `docs/known-limitations.md` §1/§5, `CHANGELOG.md`, `.ai/todo.md`,
  `.ai/plans/CSSX-PLAN-PRODUCTION.md`, this task prompt, `.ai/reports/CSSX-CLASS-RENAME.md`.
- Nothing else. No compiler/CLI changes; no examples; no map/`.d.ts` generation changes.

## Constraints

- Failing repro first: the previous generic class-token refusal is the failing case for the new
  contract.
- Exact-string document assertions in the host test; no sleeps; gates sequential.
- Preserve the uncommitted tree; no git commands.

## Acceptance criteria

1. Renaming a class updates every non-global occurrence in the current document and nothing else;
   the dot survives; nested/pseudo/comma shapes covered.
2. Global occurrences excluded and refused when selected; invalid/existing-name refusals pinned.
3. Token/group/keyframe rename behaviour unchanged; host suite green with the updated refusal set.
4. Docs/records persisted (feature 27 🟢, plan row, CHANGELOG).
5. Full gates green: `bun run verify`, `bun run release:check`, `bun run lint`.

## Validation

- `bun test tests/extension/provider.navigation.test.ts` during development.
- `bun test tests/extension/host.test.ts` for the real-host rename.
- `bun run verify`; `bun run release:check`; `bun run lint`; read-back of records.
