# CSSX-ID-RENAME — single-file id rename inside `.cssx`

**Status:** 🟢 done (2026-11-26) · **Board item:** feature 28 · **Scope:** editor intelligence only
**Package / API:** `packages/vscode` — `src/intelligence.ts`, `src/providers/navigation.ts`, tests,
docs and records. No compiler, CLI, naming, map or `.d.ts` change.

## Summary

- F2 rename on an id token in a selector now updates every occurrence of that id name in the
  current `.cssx` document. Only the name bytes change; the leading `#` survives.
- Ids have no local/global split, so `:global(#x)` occurrences are included. Invalid identifiers,
  ids that already exist in the file and non-id tokens are refused.
- JSX/HTML `id="…"` anchors, inbound links, the generated map and `.d.ts` are never edited, and ids
  are not in the map.
- Class, token, group and keyframe rename behaviour is unchanged, and id completion still lists one
  item per distinct name in first-appearance order.

## Objective

**Rename scope and semantics.**
- Trigger: rename (F2) on an id token in a selector (base, `&` nesting, comma lists, inside
  `:is()`/`:not()`/`:has()`, and `:global(#x)`).
- Edit set: every occurrence of that id **name** in the current document's analysis, replacing only
  the name bytes (the leading `#` stays).
- **Refuse** when: the new name is not a valid CSS identifier; an id with the new name already
  exists in this file (would silently merge two ids — U04 precedent); the token is not an id
  (classes, pseudo names, `$tokens`, groups, keyframes keep their current behaviour).
- Renaming to the identical name is a pinned no-op edit set.
- Never edit other files, strings, attribute values, declaration values, the map or `.d.ts`, and
  never invent positions. `prepareRename` returns the id-name range (not the `#`) with the authored
  name as the placeholder.

## Relevant / allowed files (write set)

- `packages/vscode/src/intelligence.ts` (`collectIdOccurrences`, exported `idAt`, `renameId`, id
  branch in `renameAt`), `packages/vscode/src/providers/navigation.ts` (prepare wiring).
- `tests/extension/provider.navigation.test.ts`, `packages/vscode/test/ui/navigation.js`.
- `docs/usage.md` §5.2, `docs/known-limitations.md` §1/§5, `CHANGELOG.md`, `.ai/todo.md`,
  `.ai/plans/CSSX-PLAN-PRODUCTION.md`, this task prompt, `.ai/reports/CSSX-ID-RENAME.md`.
- Nothing else. No compiler/CLI changes; no examples; no map/`.d.ts` generation changes.

## Constraints

- Failing repro first: the previous generic id-token refusal is the failing case for the new
  contract.
- Exact-string document assertions in the host test; no sleeps; gates sequential.
- Preserve the uncommitted tree; no git commands.

## Acceptance criteria

1. Renaming an id updates every occurrence (including `:global(#x)`) and nothing else; the `#`
   survives.
2. Refusals pinned; class/token/group/keyframe rename untouched; id completion unaffected.
3. Host rename scenario green; suite counts recorded.
4. Docs/records persisted (feature 28 🟢, plan row, CHANGELOG).
5. Full gates green: `bun run verify`, `bun run release:check`, `bun run lint`.

## Validation

- `bun test tests/extension/provider.navigation.test.ts` during development.
- `bun test tests/extension/host.test.ts` for the real-host rename.
- `bun run verify`; `bun run release:check`; `bun run lint`; read-back of records.
