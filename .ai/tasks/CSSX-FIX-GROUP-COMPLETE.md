# CSSX-FIX-GROUP-COMPLETE — group-body CSS completion

**Status:** 🟢 done · **Requested by:** owner smoke 2026-11-26 (board bug 25) · **Scope:**
editor completion context classification + failing repro tests + host assertion · **Packages:**
`@chikx/vscode`

## Summary

- Inside a `@group.<name> { … }` body, CSS property completion did not fire at the start of a
  declaration, while the same position inside a normal rule body listed properties normally.
- The interior of a group definition was classified as `none` because a group definition is not a
  style rule; a use-site body already worked through its enclosing rule but is now covered
  explicitly by the same declaration-context branch.
- The fix is classification-only: group bodies accept declarations only (ADR-0017), so they get the
  property set and the ordinary value state, never a selector list. Directive completion
  (`@gr` → `@group`), `@group.` name completion, `$token`/namespace completion, keyframes and
  `@setup` bodies are unchanged.
- No compiler, CLI or diagnostic change: groups already compile correctly.

## Objective

1. Write failing repro tests first at the owner's definition and use-site positions, asserting the
   CSS property set (label + `property` kind, `padding: $0;` snippet) and the value state after
   `padding: `.
2. Fix `contextAt` so a group definition/use-site interior is a declaration context.
3. Add a real-host assertion: a group definition body returns property items and accepting one
   writes `property: ;` on the right line.
4. Persist task/report, flip `.ai/todo.md` bug item 25 🟢, PP3 🟢 with the owner-verified note, and
   add one CHANGELOG editor line.
5. Run the full gates.

## Relevant files

- `packages/vscode/src/intelligence.ts` (`findEnclosingGroupBody`, `contextAt`)
- `tests/extension/provider.intelligence.test.ts` (new repro test)
- `packages/vscode/test/ui/completions.js` (additive host scenario)
- `.ai/todo.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md` (PP3 row), `CHANGELOG.md`,
  `.ai/tasks/CSSX-FIX-GROUP-COMPLETE.md`, `.ai/reports/CSSX-FIX-GROUP-COMPLETE.md`

## Dependency state

PP0–PP2 🟢; feature wave F18/F20/F21/F22/F23 + examples/modules 🟢; PP3 owner-verified with this one
finding. Baseline gates: verify 1283 pass / 2 skip / 0 fail (95 files), host 14 scenarios / 866
assertions, browser 96/96, release:check nine examples, VSIX 18 files / 136.06 KB. No git commands;
the uncommitted tree is preserved.

## Constraints

- Failing repro first (red before the fix), no assertion weakened.
- No change to directive or group-name completion; no selector list in group bodies.
- No compiler/CLI change; groups already compile correctly.
- Gates sequential; exit codes preserved.

## Acceptance criteria

1. Repro tests red before the fix and green after; definition and use-site bodies return the
   rule-body property set; applying a property produces `property: ;`.
2. `@gr` → `@group`, `@group.` names, keyframes/setup bodies and every existing completion state
   unchanged.
3. Host assertion added and green; new scenario/assertion totals recorded.
4. Records persisted (bug 25 🟢, task/report, PP3 🟢 with the note, CHANGELOG).
5. `bun run verify`, `bun run release:check` and `bun run lint` green.

## Validation

```sh
bun test tests/extension/provider.intelligence.test.ts   # red → green stepwise
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-FIX-GROUP-COMPLETE.md`
- `.ai/todo.md` item 25
- `docs/decisions/ADR-0017-reusable-declaration-groups.md` (groups accept declarations only)
