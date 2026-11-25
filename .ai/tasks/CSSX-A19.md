# CSSX-A19 — Built-in `keyframes` namespace (`$keyframes.<name>`)

## Summary

- Authored `@keyframes <name>` blocks register `<name>` in a built-in `keyframes` namespace, so a
  declaration can reference the name as `$keyframes.<name>` and compile to the plain name text
  (`animation-name: $keyframes.spin` → `animation-name: spin`) with the keyframe block emitted as
  native CSS.
- Owner decision (2026-11-25, syntax chosen by the owner; extended mid-task to importable names):
  names visible to a build are the file's own `@keyframes` blocks plus those of modules imported with
  `@use "…" styles;`. Token-only imports do **not** make names referenceable.
- Unknown member and bare `$keyframes` are CHIKX2001 with the declaration segment omitted (existing
  §5.5 semantics); an `@use … as keyframes` alias is CHIKX2001 because the built-in namespace cannot
  be shadowed. No new diagnostic codes.
- Grammar/semantics change ⇒ ADR-0015, SPECIFICATION.md normative text, fixtures/goldens and unit
  tests. Parser/lexer and the frozen `types/**` contracts are untouched.

## Objective

1. Collect keyframe names per module and make them visible per build (own top-level `@keyframes`
   blocks plus the transitive `styles` `@use` closure, because that is exactly the CSS the consuming
   build emits).
2. Expand `$keyframes.<name>` in declaration values at compile time as literal text; reject unknown
   members, bare `$keyframes` and `@use … as keyframes` with CHIKX2001 and omit the affected segment.
3. Record the design in `docs/decisions/ADR-0015-keyframes-namespace.md`, add the normative section to
   `SPECIFICATION.md`, and update `docs/grammar.md`, `docs/compatibility.md`,
   `docs/known-limitations.md` and the fixture README.
4. Add fixtures (same-file reference, unknown member, bare namespace, style-import visibility,
   token-only negative) plus unit tests for collection/expansion/visibility.

## Files

Allowed write scope (exclusive):

- `packages/compiler/src/variables/**` — expansion (`expand.ts`), facade docs (`index.ts`).
- `packages/compiler/src/resolver/**` — keyframe collection and visibility (`keyframes.ts`), module
  record field (`types.ts`), alias rejection (`scopes.ts`), graph wiring (`graph.ts`), barrel.
- `tests/compiler/**` — new `keyframes.test.ts` plus count/list updates in the golden, pipeline,
  formatter and source-map runners.
- `tests/fixtures/**` — new `keyframes/` group and README index rows.
- `SPECIFICATION.md`, `docs/**` (including `docs/decisions/ADR-0015*`).
- `.ai/tasks/CSSX-A19.md`, `.ai/reports/CSSX-A19.md`, `.ai/reports/logs/CSSX-A19.log`.

Hard off-limits: `packages/compiler/src/parser/**`, `packages/compiler/src/lexer/**` (CSSX-A17 owns
them), `packages/compiler/src/types/**` (frozen), `packages/vscode/**`, `.ai/todo.md`,
`.ai/PROGRESS.md`.

## Dependencies

- ADR-0014 rule-merge imports: style-imported modules' IR (including native `@keyframes` blocks) is
  already emitted in the consuming build, which is what makes imported keyframe names safe to
  reference.
- ADR-0005 (AST keeps raw values plus parsed tokens) and the existing CHIKX2001 substitution policy in
  `variables/expand.ts`.

## Constraints

- No parser or lexer change: `@keyframes` is already a native at-rule with a raw prelude.
- Compiler core stays pure and filesystem-free; zero runtime dependencies.
- Reuse CHIKX2001 only; the frozen diagnostic registry is not touched.
- Deterministic output; no declaration/keyframe reordering.
- Never weaken tests or regenerate goldens blindly; every new golden is authored and reviewed.

## Acceptance criteria

- `animation-name: $keyframes.spin;` with a same-file `@keyframes spin` compiles to
  `animation-name: spin` plus the emitted keyframe block (golden fixture).
- A keyframe defined in a `@use "…" styles;` module is referenceable from the importing file (merged
  `entry.cssx` fixture); a token-only import does not expose it (negative fixture + CHIKX2001).
- Unknown member and bare `$keyframes` produce CHIKX2001 with segment omission (fixtures).
- `@use "…" as keyframes` is CHIKX2001 and does not shadow the built-in namespace (unit test).
- ADR-0015 cites the owner decision; SPECIFICATION.md normative text updated; known limitation for
  non-style imports documented.
- `bun run verify` fully green with no unrelated golden diffs.

## Validation

```sh
bun run verify
```

## Handoff

Write `.ai/reports/CSSX-A19.md` (`## Summary` first, changed files, before/after evidence, golden diff
list, blockers, todo-board note) and the worker log `.ai/reports/logs/CSSX-A19.log`.
