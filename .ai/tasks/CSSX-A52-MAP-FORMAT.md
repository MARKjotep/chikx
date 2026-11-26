# CSSX-A52 — Class map: named const exports, opt-in declarations

**Status:** 🟢 done · **Requested by:** owner decision 2026-11-26 · **Scope:** compiler, CLI config, docs, examples, tests
**Packages:** `@chikx/compiler` (naming/mapgen, output planner defaults, setup decoding), `@chikx/cli` (setup and config plumbing)

## Summary

- The generated `.map.js` is now **one named `export const` per class**, in first-appearance order,
  with **no default export and no object literal**. Consumers write
  `import { contactPanel } from "./x.map.js"` and `class={contactPanel}`; this is the map's only
  purpose.
- Identifiers are deterministic: class names split on `-`/`_` and camelCase; invalid characters
  become `_`; digit-leading and reserved identifiers get a `_` prefix; duplicate identifiers get
  `_2`, `_3`, … in first-authored order. Each adjustment is a CHIKX4001 **warning**, never a build
  failure, so no class is dropped.
- The `.map.d.ts` is **opt-in and default off**: `@setup { map-types: true; }` or
  `"output": { "mapTypes": true }` emits one matching
  `export declare const <identifier>: "<emitted>";` line per class. The old `emit-types` /
  `output.emitTypes` spelling remains accepted as a deprecated alias.
- `map-name` / `map-dir` semantics are unchanged; only the file format and the declaration flag's
  default changed.

## Before / after

```js
// before — tests/fixtures/naming/prefix/expected/map.js
export const card = "ui-card";
export const cardHeader = "ui-card-header";
export default { card, "card-header": cardHeader, cardHeader };
```

```js
// after
export const card = "ui-card";
export const cardHeader = "ui-card-header";
```

```ts
// before — map.d.ts
export declare const card: "ui-card";
export declare const cardHeader: "ui-card-header";
declare const map: {
  readonly card: "ui-card";
  readonly "card-header": "ui-card-header";
  readonly cardHeader: "ui-card-header";
};
export default map;
```

```ts
// after — opt-in only
export declare const card: "ui-card";
export declare const cardHeader: "ui-card-header";
```

## Edge-case rules (frozen in SPECIFICATION.md §8)

| Authored class | Identifier | Note |
|---|---|---|
| `contact-panel` | `contactPanel` | interior `-`/`_` are separators |
| `panel_head` | `panelHead` | same rule for `_` |
| `__proto__` | `__proto__` | leading/trailing `_` runs preserved; a `const` binding is safe |
| `2col` | `_2col` | digit-leading alias prefixed |
| `default`, `delete` | `_default`, `_delete` | reserved words prefixed |
| `foo.bar` | `foo_bar` | non-identifier characters replaced |
| `foo-bar` + `fooBar` | `fooBar`, `fooBar_2` | first-authored keeps the name; one CHIKX4001 warning |
| `-` (no parts) | `_` | empty alias fallback |

## Acceptance criteria

1. `generateClassMap` emits only `export const` lines, in class-table order, and returns an empty
   string for an empty table. The follow-up sweep removed the CSS side-effect import entirely.
2. `.d.ts` mirrors the JS exactly, contains no `any`, no `readonly` map object and no default export.
3. `map-types` defaults to `false` at every layer (`@setup`, `chikx.config.json`, `planOutputs`);
   `emit-types` is honoured as a deprecated alias and loses to `map-types` when both are authored.
4. Determinism: repeated generation is byte-identical; the stress determinism/scale suites stay green.
5. Docs, examples, fixture goldens, CLI JSON golden and benchmark byte counts reflect the new format.

## Fix record

**Result:** 🟢 done.

- `packages/compiler/src/naming/mapgen.ts`: named-const emission, identifier adjustment pipeline,
  CHIKX4001 warnings, declaration mirroring, empty-table empty file.
- `packages/compiler/src/types/options.ts`, `output/resolve.ts`, `output/validate.ts`,
  `packages/compiler/src/index.ts`: `mapTypes` (default `false`) plus deprecated `emitTypes` alias,
  single resolved `emitTypes` flag; warning text says `map-types`.
- `packages/cli/src/setup.ts`, `config.ts`, `compiler-api.d.ts`: `map-types` / `output.mapTypes`
  decoding with the alias fallback; defaults flipped to declarations off.
- Tests: `tests/compiler/{mapgen,output,planner,compile,modules}.test.ts`,
  `tests/stress/consumer/{esm-consumer,type-inference}.test.ts` + `helpers.ts`,
  `tests/stress/scale/benchmark.test.ts` (recorded byte count), `tests/stress/cli/golden/check-error-json.txt`.
- Fixtures: 13 non-empty `expected/map.js` files reformatted; 46 default `expected/map.d.ts`
  placeholders removed; `canonical/button` and `naming/prefix` keep declaration goldens.
- Docs/examples: `SPECIFICATION.md` §2/§6.3/§8/§9/§14, `docs/{configuration,grammar,performance,known-limitations}.md`,
  ADR-0010 status note, root README, `examples/{basic,overrides,portfolio}` outputs and READMEs,
  `CHANGELOG.md` under Unreleased → `### Changed`.
- Out-of-scope note (superseded by the follow-up `## Compat sweep` in the report): `packages/vscode`
  now defaults declarations off, decodes `map-types`, and generates import-free maps; the extension's
  ignored `dist` bundle was rebuilt for verification. See `.ai/reports/CSSX-A52.md`.
