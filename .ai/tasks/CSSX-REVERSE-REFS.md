# CSSX-REVERSE-REFS — bidirectional, resolution-aware token references

**Status:** QUEUED (2026-11-26) · **Board:** bug 27 · **Scope:** editor references only

## Summary

- Find All References now works from a `$token`/`@runtime` definition in its exporting module:
  the result is the definition plus every use that resolves to it in workspace `.cssx` files, not
  only the definition itself.
- From an importer the same set is returned (definition + all resolving uses), including unqualified
  imports that the old cursor logic could not resolve.
- Resolution decides inclusion per file: namespace aliases, unqualified and style imports count;
  local shadows, ambiguous unqualified imports (`CHIKX2001`) and transitive re-exports do not.
- References only. Rename stays single-file; no provider-side edits or invented declarations.

## Objective

From a resolved definition at `@variables`/`@runtime` in the defining module, return the definition
(honouring `context.includeDeclaration`) plus every reference that resolves to it across workspace
`.cssx` files. From an importer, return the same complete set without regressing today's local
cases. Locations are deduped and sorted deterministically.

## Write set

- `packages/vscode/src/providers/navigation.ts`
- `packages/vscode/src/intelligence.ts` (pure resolution helpers)
- `packages/vscode/test/ui/navigation.js`
- `tests/extension/provider.navigation.test.ts`
- Docs and records: `docs/usage.md` §5.2, `docs/known-limitations.md` §5, `CHANGELOG.md`,
  `.ai/todo.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md`, this task and its report.

## Constraints

- Deterministic waits only (`pollUntil`/`waitFor`); no sleeps and no assertion weakening.
- Bounded, on-demand scan; no watchers; cache only within one request (per-file analysis).
- Do not change compiler/CLI behaviour, examples, or rename's single-file scope.
- Preserve the uncommitted tree; no Git commands.

## Acceptance criteria

1. Definition direction: definition + all resolving references across direct importers; shadows and
   ambiguous imports excluded; `includeDeclaration` honoured.
2. Importer direction: same set; existing navigation cases unchanged.
3. Host evidence with exact URIs/ranges; suite counts recorded.
4. Docs/records persisted (board bug 27 🟢, plan row, CHANGELOG).
5. `bun run verify`, `bun run release:check` and `bun run lint` green.

## Validation

`bun test tests/extension/` during development; `bun run verify`; `bun run release:check`;
`bun run lint`; read-back of the records.
