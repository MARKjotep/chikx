# CSSX-F20 — module-side map-inheritance opt-out (`map-inherit`)

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** compiler setup/merge/map
path, editor setup-key completion, docs, tests
**Packages:** `@chikx/compiler` (setup decoding, module merge table, map/types generation),
`@chikx/vscode` (setup-key completion)

## Summary

- A module can author `@setup { map-inherit: false; }` (project `output.mapInherit`). When that module
  is style-merged (`@use "…" styles;`), its rules still emit into the importing CSS in the normal
  imported-first cascade order, but its class bindings leave the importer's `map.js`, `.d.ts` and
  `CompileResult.classes`.
- Default is `true`, so existing output stays byte-identical. Precedence is defaults < project
  config < the module's own `@setup`.
- The module's own entry build is unaffected; excluded bindings cannot raise `CHIKX4001`; and
  `module: true` + `map-inherit: false` is allowed and silent (the documented rule-only escape hatch).
- ADR-0020 amends ADR-0014 §3's "one merged class table" lockstep with this single documented
  exception; the editor completion offers the key with boolean values.

## Objective

Implement board item 20 exactly as decided:

1. Decode `map-inherit` as a boolean `@setup` key with `output.mapInherit` in the project/API output
   layer; invalid values stay `CHIKX1001` with the setting span.
2. Compute each style-merged module's effective flag from its own `@setup` over the project/API base,
   and carry it on the merged-table source. Skip opted-out sources in `mergeClassTables` so the JS
   map, `.d.ts` and `classes` stay in lockstep and collisions are impossible.
3. Keep the entry's own table unconditional and runtime-token merging untouched.
4. Offer `map-inherit` in editor setup-key completion with a one-line doc and `true`/`false` values.
5. Persist ADR-0020, configuration/usage/SPEC/CHANGELOG updates, this task, the report and the board
   (item 20 → 🟢, items 21–23 appended verbatim).

## Relevant files

- `packages/compiler/src/index.ts` (setup key tables, decode/assign, `definedOutput`, module loop,
  `moduleMapInherit` plumbing)
- `packages/compiler/src/types/options.ts` (`OutputOptions.mapInherit`, `ResolvedSetup`)
- `packages/compiler/src/output/resolve.ts` (`OUTPUT_DEFAULTS.mapInherit`, `defaultSetupFor`)
- `packages/compiler/src/naming/merge.ts` (`ClassTableSource.mapInherit`, skip predicate)
- `packages/vscode/src/intelligence.ts` (completion key list, doc)
- `packages/cli/src/config.ts`, `packages/cli/src/setup.ts`, `packages/cli/src/compiler-api.d.ts`
  (config pair wiring)
- `tests/compiler/modules.test.ts`, `tests/integration/cli-map-inherit.test.ts`,
  `tests/extension/provider.intelligence.test.ts`
- `docs/decisions/ADR-0020-map-inheritance-opt-out.md`, `docs/configuration.md`, `docs/usage.md`,
  `SPECIFICATION.md`, `CHANGELOG.md`
- `.ai/tasks/CSSX-F20.md`, `.ai/reports/CSSX-F20.md`, `.ai/todo.md`

## Dependency state

PP0–PP2 🟢; F18 landed with 1248 pass / 2 skip / 0 fail across 92 files. F18's setup-list machinery
and the `module: true` decoding path are reused (boolean key plus marker handling). No git commands;
the uncommitted tree is preserved.

## Constraints

- Failing repro first; no assertion weakening.
- Default-true output byte-identical; existing map goldens must not move.
- Diagnostics keep valid spans.
- Full gates run sequentially: `bun run verify`, `bun run release:check`, `bun run lint`.

## Acceptance criteria

1. `@setup { map-inherit: false; }` and `output.mapInherit: false` work; default `true` leaves
   goldens byte-identical.
2. Style-merged module: CSS merges, bindings absent from the importer's `map.js` and `.d.ts`; own
   entry map unaffected; no `CHIKX4001` for excluded bindings; `module: true` composition silent.
3. Editor setup-key completion offers `map-inherit` with boolean values.
4. ADR-0020, docs, CHANGELOG, task/report and the board update are persisted.
5. `bun run verify`, `bun run release:check` and `bun run lint` pass.

## Validation

```sh
bun test tests/compiler/modules.test.ts tests/integration/cli-map-inherit.test.ts \
  tests/extension/provider.intelligence.test.ts
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-F20.md`
- `.ai/todo.md` item 20
- `docs/decisions/ADR-0020-map-inheritance-opt-out.md`
