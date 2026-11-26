# CSSX-F23 — group hover readability (multi-line defaults + override section)

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** editor intelligence
hover Markdown + host hover assertion · **Packages:** `@chikx/vscode`

## Summary

- `@group.<name>` hovers already resolved defaults (CSSX-A39), but consecutive inline-code entries
  soft-collapsed into one Markdown paragraph. Defaults now render as one bullet per declaration.
- A use site that overrides a default property gets a separate **Overrides at this use site**
  section listing property names only; a use site with no overrides omits the section entirely.
- Empty definitions keep the existing `_No default declarations._` line and get no empty heading.
- Analysis-only formatting refinement: no compiler behaviour, diagnostics or ADR.

## Objective

1. `groupHover` definition branch: `**Defaults**` heading + `- \`property: value\`` bullets in
   authored order, spacing after the colon preserved.
2. `groupHover` use-site branch: the same defaults section plus a bulleted overrides section when
   `groupOverrides` is non-empty.
3. Pin the exact Markdown for definition/use-site with and without overrides/empty definitions.
4. Extend the host hover scenario so the multi-line contract holds in the real extension host.
5. Persist task/report, flip `.ai/todo.md` item 23 to 🟢 and add one CHANGELOG editor line.

## Relevant files

- `packages/vscode/src/intelligence.ts` (`groupDefaultSection`, `groupHover`)
- `tests/extension/provider.intelligence.test.ts` (exact Markdown pins)
- `packages/vscode/test/ui/hovers.js` (additive host default/override bullets)
- `CHANGELOG.md`, `.ai/tasks/CSSX-F23.md`, `.ai/reports/CSSX-F23.md`, `.ai/todo.md`

## Dependency state

PP0–PP2 🟢; F18/F20/F21 🟢 (1282 pass / 2 skip / 0 fail, 95 files; host 14 scenarios / 858
assertions; release:check green, browser 96/96, VSIX 18 files). No git commands; uncommitted tree
preserved.

## Constraints

- Plain Markdown only: `- ` bullets, no HTML and no fenced code blocks.
- Existing summary sentences and other hover content stay byte-identical.
- Empty definitions: no empty **Defaults** heading.
- Exact-string pins where the content is deterministic; host regex only to prove line separation.
- No compiler change, no new diagnostic, no ADR.

## Acceptance criteria

1. Definition and use-site hovers render defaults as bulleted multi-line lists; the overrides
   section appears only at use sites that override a default.
2. Empty definitions unchanged (`_No default declarations._` at use sites, the inert sentence at
   definitions).
3. Intelligence tests and the host hover assertion are green; no other assertion weakened.
4. `bun run verify`, `bun run lint` and `bun run release:check` pass.
5. Task/report/board item 23 🟢/CHANGELOG line persisted.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts tests/extension/host.test.ts
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-F23.md`
- `.ai/todo.md` item 23
