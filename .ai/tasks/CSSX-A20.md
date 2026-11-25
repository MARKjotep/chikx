# CSSX-A20 — Runtime token merge-order override (ADR-0016)

## Summary

- Owner-approved language change (decision of 2026-11-25): runtime tokens (`@runtime` → `:root`
  custom properties) resolve in **merge order** instead of erroring on conflict. The entry's
  `@runtime` definition wins over style-imported modules; among modules the later one in merge order
  wins (later `:root` in the cascade).
- Compile-time tokens keep the existing override story: a local `@variables` definition wins over
  unqualified imports, namespaces disambiguate, and clash detection stays CHIKX2001 wherever no
  override exists.
- This is a semantics change, so it lands as ADR-0016 plus normative `SPECIFICATION.md` text and
  fixtures — never silently (invariant 10). No new diagnostic codes; parser/lexer/frozen types are
  untouched.
- The board item "detect clashing variable names and allow overriding them" moves to
  🟡 in progress under this task; the showcase example stays with CSSX-A21.

## Objective

1. Record the owner decision and the merge-order rule in
   `docs/decisions/ADR-0016-runtime-token-override.md`, following ADR-0015's format.
2. In `packages/compiler/src/variables/runtime.ts`, stop reporting a CHIKX2001 first-wins conflict
   when the same post-prefix custom-property name comes from the entry and/or style-imported
   modules. Resolve it deterministically in merge order:
   - style-imported modules in canonical DFS `@use` order (dependencies before importers),
   - then other reachable runtime-token modules in graph topological order,
   - then the entry last.
   Conditional `:root` override rules keep the same order per query group: base first, then one
   `:root` per resolved query; the winning definition supplies its base and its variants, so the
   entry's variant beats an imported module's same-query variant.
3. Keep every other error semantic: duplicate locals in one file (compile-time or runtime),
   compile-time/runtime cross-kind locals, ambiguous unqualified imports and duplicate namespace
   aliases remain CHIKX2001. `@use … as keyframes` shadowing (ADR-0015) is untouched.
4. Verify the compile-time question "two unqualified imports export one name and the consumer also
   defines that name locally": the local already wins silently (`resolveUnqualified` skips providers
   when a local exists), so pin it with a fixture rather than changing behavior. Improve the
   ambiguous-import CHIKX2001 message so it names every clashing source path and its symbol kind.
5. Update normative and author-facing text: `SPECIFICATION.md` §6.1/§6.2/§6.3, `docs/cascade.md`
   (runtime custom-property precedence), `docs/compatibility.md`, `docs/known-limitations.md`.
6. Add fixtures and goldens:
   - (a) entry `@runtime` overrides a style-imported module's same-named property,
   - (b) two style-imported modules with the same property resolve later-in-order with no
     diagnostic,
   - (c) two ambiguous unqualified imports plus a local definition → local wins, no diagnostic,
   - (d) unchanged negatives: ambiguous without a local, duplicate locals, cross-kind clash all stay
     CHIKX2001,
   - (e) variant/query-group override ordering.
   Plus unit tests in `tests/compiler/runtime.test.ts` (and count/list updates where new
   `input.cssx` fixtures enter the catalog).
7. Update `.ai/todo.md`: item 3 → 🟢 done in CSSX-A19, item 4 → 🟡 in progress (CSSX-A20 …), and
   append item 6 after item 5 exactly as requested by the lead. Keep the user's wording verbatim.

## Files

Exclusive write scope:

- `packages/compiler/src/variables/**` — runtime emission and its docs (`runtime.ts`, `index.ts`).
- `packages/compiler/src/resolver/**` — ambiguity diagnostic wording (`scopes.ts`); no scope-policy
  change.
- `tests/compiler/**` — `runtime.test.ts`, deferred-golden list/CASES and catalog counts.
- `tests/fixtures/**` — new `runtime/*` merged fixtures, new `variables/*` fixtures and README rows.
- `SPECIFICATION.md`, `docs/**` (including `docs/decisions/ADR-0016-runtime-token-override.md`).
- `.ai/tasks/CSSX-A20.md`, `.ai/reports/CSSX-A20.md`, `.ai/reports/logs/CSSX-A20.log`,
  `.ai/todo.md`.

Hard off-limits: `packages/compiler/src/parser/**`, `packages/compiler/src/lexer/**`,
`packages/compiler/src/types/**` (frozen), `packages/vscode/**`, `examples/**`, `.ai/PROGRESS.md`.

## Dependencies

- ADR-0014 rule-merge imports: style-imported modules' rules and `@runtime` values are emitted in
  the consuming build, which is what makes module-order override observable.
- ADR-0015 / CSSX-A19 just landed and owns `resolver/keyframes.ts`, the catalog counts and the
  fixture README; this task only bumps counts for its own fixtures and never rewrites A19 entries.
- Existing CHIKX2001 scope policy in `resolver/scopes.ts` (local-over-import, ambiguity, cross-kind).

## Constraints

- Compiler core stays pure, filesystem-free and dependency-free; no new diagnostic codes.
- Deterministic output; declaration order inside a module is untouched; only the resolved value of
  one custom property changes.
- Never weaken tests, delete goldens or regenerate them blindly; review every golden diff.
- Unqualified-import symbol ambiguity is deliberately unchanged: namespaces or a local definition
  are the author's escape hatch. Runtime property merge order does not silence `$name` ambiguity.

## Acceptance criteria

- Fixtures prove: entry `@runtime` wins over a style import; later style module wins over an earlier
  one with no diagnostic; local compile-time definition wins over two ambiguous unqualified imports;
  ambiguous-without-local, duplicate-local and cross-kind clashes still report CHIKX2001; entry
  variant values win per query group.
- `emitRuntimeTokens` no longer produces a runtime-name conflict diagnostic, and its output is a
  single resolved declaration per property, still deterministic across runs.
- ADR-0016 records the owner decision, merge order, rationale (native custom properties are live
  cascade values; the §5.4 "later wins is deliberate" precedent) and rejected alternatives (strict
  errors forever, opt-in override marker).
- `SPECIFICATION.md` and author docs state the merge order normatively and mark "later wins"
  deliberate.
- `bun run verify` is fully green.

## Validation

```sh
bun run verify
```

## Handoff

Write `.ai/reports/CSSX-A20.md` (`## Summary` first; changed files, before/after evidence, golden
diff list, blockers) and `.ai/reports/logs/CSSX-A20.log`. Report changed files, fixtures added,
gate status and any remaining board follow-ups.
