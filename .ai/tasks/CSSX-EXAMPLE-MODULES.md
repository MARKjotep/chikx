# CSSX-EXAMPLE-MODULES — zero-maintenance modules example

**Status:** 🟢 done · **Requested by:** owner request 2026-11-26 · **Scope:** one new example,
release-gate/docs/CHANGELOG registration, no compiler changes
**Packages:** none (example sources + release metadata)

## Summary

- Add `examples/modules/`: four `.cssx` files, no `exclude` list, three self-declared
  `@setup { module: true; }` modules and one entry that emits the only stylesheet and map.
- The entry writes one merged stylesheet to two in-workspace `css-dir` destinations, uses
  `map-inherit: false` on the rule-only ribbon module and keeps `import-css` at its `false` default.
- Committed output is minified by default (ADR-0022) and rebuilt byte-identically twice; `clean`
  removes only the three artifact records and leaves the hand-written `client/index.html`.
- Register the ninth example in `release:check`, `docs/release.md`, `README.md`, `docs/usage.md`,
  `CHANGELOG.md`; ignore the extra generated CSS in `biome.json`.

## Objective

1. `examples/modules/` with `chikx.config.json` (no `exclude`), token module, card module, ribbon
   module and entry.
2. Cascade order in `app.css`: tokens (values only) → card → ribbon → entry `.page`.
3. Map contains `page`, `card`, `cardIcon`; no `ribbon` binding.
4. `client/app.css` and `generated/styles/app.css` are byte-identical; manifest records 3 files.
5. Release gate builds nine examples; docs/CHANGELOG updated; gates green; records persisted.

## Relevant files

- `examples/modules/**` (new; sources, config, hand-written page, committed output, README)
- `package.json` (examples step only), `docs/release.md`, `docs/usage.md`, `README.md`,
  `CHANGELOG.md`, `biome.json` (generated example CSS ignore only)
- `.ai/tasks/CSSX-EXAMPLE-MODULES.md`, `.ai/reports/CSSX-EXAMPLE-MODULES.md`

## Dependency state

PP0–PP2 🟢; F18/F20/F21/F23/F22 🟢. Baseline `verify` 1283 pass / 2 skip / 0 fail (95 files, host
14 scenarios / 866 assertions), `release:check` green (eight examples, browser 96/96, VSIX 18
files). No git commands; the uncommitted tree is preserved.

## Constraints

- No `exclude` and no hand-edited CSS: output is exactly what the current compiler emits.
- Two consecutive builds byte-identical, with no manifest churn.
- Do not weaken or skip any gate; sequential gates; no compiler/CLI/editor source changes.
- `.ai/plans/CSSX-PLAN-PRODUCTION.md` and board item 24 untouched.

## Acceptance criteria

1. Build from the example config emits the two identical CSS copies, the map and the manifest, all
   minified; map has `page`/`card`/`cardIcon`, no `ribbon`.
2. Two builds and a clean→rebuild are byte-identical; `clean` removes only artifact records.
3. `release:check` builds nine examples and stays green; docs counts/indexes and CHANGELOG updated.
4. `bun run verify`, `bun run release:check`, `bun run lint` green.
5. Task + report persisted.

## Validation

```sh
bun run --cwd packages/compiler build && bun run --cwd packages/cli build
node packages/cli/dist/index.js build --config examples/modules/chikx.config.json   # twice
node packages/cli/dist/index.js clean --config examples/modules/chikx.config.json
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-EXAMPLE-MODULES.md`
- `docs/decisions/ADR-0014-rule-merge-imports.md`, ADR-0019, ADR-0020, ADR-0021, ADR-0022
