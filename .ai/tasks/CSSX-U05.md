# CSSX-U05 — `$token` inside `@group` definition/use-site bodies has no hover and no definition

**Status:** 🟢 fixed · **Found by:** U5 (`.ai/reports/CSSX-U5.md` "CSSX-U5-A") · **Severity:** medium
**Package / API:** `packages/vscode` — `src/analysis.ts` `forEachDeclaration` (the declaration walk that
feeds `collectTokenReferences`) and therefore `src/intelligence.ts` `tokenAt` → `hoverAt`,
`definitionsAt`, `referencesAt` and rename.

## Summary

- A `$token` reference inside a `@group.<name>` **definition** body or a `@group.<name>` **use-site**
  body resolves in analysis (the document publishes **no** diagnostic) but returns **0 hovers and 0
  definitions** in the host.
- Cause: `collectTokenReferences` walks declarations through `forEachDeclaration`, whose switch handles
  `declaration`, `rule`, `conditional-block`, `runtime` and `native-at-rule` — there is **no case for
  `group-definition` or `group-use-site`**, so a `$` inside a group body is never recorded as a
  reference and every provider that starts from `tokenAt` comes up empty.
- The same token one line outside the group body behaves normally (`hover` = 1, `definition` = 1), and
  completion still answers at those positions (the `$` list is offset-based), so this is provider
  coverage, not a broken service or a broken analysis.
- Rename is affected too: a group-body reference is invisible, so renaming the token edits only the
  occurrences outside the group bodies — a silent partial rename of a symbol the analysis *does* resolve.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-U5.md` — "CSSX-U5-A — a `$token` inside a `@group.` body has no hover and no definition", two-window repro and the scope note |
| Source | `packages/vscode/src/analysis.ts:312-340` (`forEachDeclaration`: no `group-definition`/`group-use-site` case) → `:869-885` (`collectTokenReferences`) → `packages/vscode/src/intelligence.ts:2809-2830` (`tokenAt`) → `:2926` (`hoverAt`), `:3065` (`definitionsAt`), `:3076` (`referencesAt`) |
| Repro (host) | `@variables { gap: 8px; radius: 3px; }` · `@group.card { padding: $gap; }` → hover = 0, definition = 0 · `.a { padding: $gap; }` → hover = 1, definition = 1 · `&:hover { margin: $gap; }` → hover = 1, definition = 1 · `@group.card { border-radius: $radius; }` inside `.a` → hover = 0, definition = 0 |
| Diagnostics | `[]` for the whole document — the analysis resolves the token, so this cannot be dismissed as an invalid reference |
| Completion cross-check | 1 item at the same offsets (the `$` trigger answers), so the service is warm |
| Corpus note | TT6's generated document has the same shape (`@group.stress-card { padding: $gap; }`), so this is not an artefact of the U5 generator |
| Pin today | **none** — `CSSX-U5.md` records the repro instead of an assertion because the fix belongs to a task |

## Expected vs actual

- **Expected:** a `$token` reference in a group definition body or a group use-site body behaves like the
  same reference in a rule body: one hover card (`**$gap** — compile-time token` / `Value: \`8px\``), one
  definition target (the declaration), one reference hit per occurrence, and a rename that edits every
  occurrence.
- **Actual:** hover `0`, definition `0`, and the reference is skipped by rename.

## Owned files (fix task)

- `packages/vscode/src/analysis.ts` — `forEachDeclaration`: walk `group-definition` and
  `group-use-site` bodies (their declarations/items) so `collectTokenReferences` sees them.
- `packages/vscode/test/ui/hovers.js` and/or `packages/vscode/test/ui/navigation.js` — **add the red
  assertion pin first** (see below), then flip it to the positive property.
- If the group body needs a different declaration shape for `native-at-rule`-style nesting, check the
  same walk in `providers/symbols.ts` (outline) so the two do not diverge.

## Suggested fix direction

Add the two missing cases to `forEachDeclaration` and recurse into the group body item list exactly like
`rule`/`conditional-block` do. Verify that the resulting references use the authored offsets (group
bodies are expanded at compile time, but the editor must stay on authored spans — the same rule
`groups.ts` follows for visibility).

## Acceptance criteria

1. **A red assertion pin is added first** in `packages/vscode/test/ui/hovers.js` (a token inside a
   `@group.` definition and a use-site body), marked `CSSX-U05`, stating the measured `0` result; the
   suite stays green because the pin states current behaviour.
2. After the fix that pin is **removed** and replaced by the positive property: hover = 1 with the value
   line, definition = 1 on the declaration, for both a definition body and a use-site body.
3. A rename of that token edits the group-body occurrence as well (asserted through the existing
   `navigation.js` rename machinery), and the plain-rule cases stay unchanged.
4. No new diagnostic appears for the same document (the analysis was already clean — the fix must not
   start reporting group-body tokens as undefined).
5. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun test tests/extension/
bun run verify
```

## Fix record

Fixed 2026-11-26 (CSSX-FIX-EDITOR-ANALYSIS).

- `packages/vscode/src/analysis.ts` — `forEachDeclaration` now handles `group-definition` and
  `group-use-site` by visiting their `declarations` (authored spans, no expansion), so
  `collectTokenReferences` records group-body `$token` references and every provider that starts from
  `tokenAt` sees them. No new diagnostics: the analysis was already clean.
- `tests/extension/provider.intelligence.test.ts` — additive case `token references inside group
  definition and use-site bodies resolve (CSSX-U05)`: hover = 1 with `Value: \`8px\``, definition = 1 on
  the `@variables` name, for both a definition and a use-site body, `problems = []`.
- `tests/extension/provider.navigation.test.ts` — additive case `token rename covers group definition
  and use-site bodies (CSSX-U05)`: 4 edits (declaration + rule + group definition + group use site),
  edited slices `gap`, `$gap`, `$gap`, `$gap`.

Measured before/after on `.ai/tasks/CSSX-U05.md`'s repro document: hover `0 → 1`, definition `0 → 1`,
references `3 → 4`; the plain rule, `&:hover` and diagnostics results are unchanged.

Validation (actual outcomes):

- `bun test tests/extension/provider.intelligence.test.ts tests/extension/provider.navigation.test.ts` —
  117 pass, 0 fail.
- `bun test tests/extension/` — 194 pass, 0 fail (host: 13 scenarios, 802 assertions).
- `bun test tests/stress/editor/` — 50 pass, 0 fail (TT6 envelope unchanged: hover p95 19.1 ms,
  analyzeText p95 35.7 ms on the 10k-line document).
- `bunx tsc -p packages/vscode/tsconfig.json --noEmit` — clean.

No UI-host pin existed in `packages/vscode/test/ui/`, so no row was added or removed there.
