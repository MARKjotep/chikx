# CSSX-A08 — Compile-time substitution + runtime tokens (P3)

## Summary

- Implement compile-time variable substitution as a pure post-lowering pass: `$ref` expansion inside `DeclarationIr` values (including namespaced members and recursive token-to-token references with cycle detection), resolved against A07's module scopes.
- Implement runtime token emission: `@runtime` blocks become `:root` custom-property rules (prefix-aware) with conditional overrides, and runtime references in declarations become `var(--...)`.
- Complete the deferred `$`-reference golden fixtures (e.g. `canonical/button`) with the emitter pipeline; A06 owns the emitter, you consume it read-only.

## Objective

Close the variables/runtime story of the pipeline. Persist this task as `.ai/tasks/CSSX-A08.md` and
results as `.ai/reports/CSSX-A08.md` (worker log `.ai/reports/logs/CSSX-A08.log`).

## Dependencies

- `SPECIFICATION.md` §3.4, §6.1, §6.2, §7.2, §11, §12, §14; `.ai/CSSX-MASTERPLAN.md` §3.4, §6.
- `docs/decisions/ADR-0007-workspace-root-and-containment.md` (imports/workspace policy).
- A07 handoff in `.ai/reports/CSSX-A07.md`: `TokenScope`, `ScopedToken`, `ScopedNamespace`,
  `buildModuleGraph` (`packages/compiler/src/resolver/`).
- Frozen IR (`packages/compiler/src/ir/types.ts`), lowering (`lower`, `groupRuns`,
  `buildMediaAliasTable`, `resolveMediaCondition`), lexer (`tokenize`), diagnostics
  (`CHIKX2001`/`CHIKX3001`).
- A06 emitter/selectors facade (`emitCss`, `flattenIr`) — consumed read-only for goldens.

## Allowed files (exclusive ownership)

- `packages/compiler/src/variables/**` (new — substitution + runtime emission)
- `tests/compiler/variables*.test.ts`, `tests/compiler/substitute*.test.ts`,
  `tests/compiler/runtime*.test.ts` (new)
- Deferred golden fixture files only: `tests/fixtures/**/expected/css` for the `$`-reference fixtures
  A06 defers (`canonical/button`, `variables/*`, `runtime/*`); never `input.chikx`, configs,
  diagnostics or A06's non-deferred goldens
- `.ai/tasks/CSSX-A08.md`, `.ai/reports/CSSX-A08.md`, `.ai/reports/logs/CSSX-A08.log`

Frozen types, lexer, parser, resolver, lowering, selectors, emitter, the barrel, configs, docs and
`.ai/PROGRESS.md` are out of scope.

## Requirements

1. Pure `substitute(ir, graph, entryFile)` in `src/variables/substitute.ts` (exact signature documented
   in the report): re-scan every `DeclarationIr` value (including values inside `NativeBlockIr`
   children, descriptors and keyframe steps) with `tokenize`; resolve `$name` against the entry
   module's `TokenScope` (local wins over unqualified imports) and `$ns.member` against
   `ScopedNamespace` members only; splice compile-time values recursively in their **defining**
   module; detect token-reference cycles and depth; report CHIKX2001 at the reference span and omit
   the offending declaration so no `$` leaks to CSS; keep the substituted slice raw-faithful.
2. Pure `emitRuntimeTokens(...)` in `src/variables/runtime.ts`: `:root { --<prefix>-<name>: value }`
   per `@runtime` token (empty prefix → `--<name>`); inline variants become conditional `:root`
   overrides using A05's alias resolution; references to runtime tokens become `var(--...)`;
   deterministic authored order, entrypoint-scoped emission.
3. Document the canonical pipeline position (no barrel wiring): `parse → buildModuleGraph → lower →
   substitute → emitRuntimeTokens → (P4: class rewrite → groupRuns) → emitCss`.
4. Tests: `variables/basic`, `local-overrides-imported`, `namespaced-members`, `undefined-ref`,
   recursive defining-module expansion, token cycle, descriptor/keyframe values; runtime `basic`,
   `with-variant`, references, prefix/empty-prefix; deferred goldens with the full chain.
5. Purity/determinism: same inputs → byte-identical output; never throws on adversarial IR.

## Constraints

- Zero dependencies; pure functions; JSDoc on all exports; no input mutation.
- A06 is in flight: consume `src/emitter`/`src/selectors` read-only; flag coupling in the report.
- Do not mark `.ai/PROGRESS.md`; the lead flips statuses after verification.

## Acceptance criteria

1. `bun run verify` exit 0; all A08 tests pass.
2. Undefined refs, token cycles, unknown members/namespaces → CHIKX2001 with spans; no invalid CSS
   leaks.
3. Runtime tokens emit prefix-aware custom properties with conditional overrides; references become
   `var()`.
4. Deferred `$` goldens authored and passing; report lists them and remaining deferrals.
5. Report: created files, API surface, naming/omission policies with spec citations, A06-coupling
   notes, blockers.

## Validation commands

```sh
bun test tests/compiler/substitute.test.ts tests/compiler/runtime.test.ts tests/compiler/variables.golden.test.ts
bun run verify
```
