# CSSX-COLOR-TOKENS — semantic colors for tokens, namespaces, custom properties and keyframes

**Status:** 🟢 done · **Owner:** Quick Note 1 (`.ai/todo.md`) + owner addition 2026-11-26 · **Package:** `packages/vscode`
**Sources:** `.ai/tasks/CSSX-COLOR-TOKENS.md` brief (ui specialist §SPEC), owner keyframe color addition, owner `!important`
follow-up tracked separately as `.ai/tasks/CSSX-U07.md`

## Summary

- Compile-time `$token` references render **blue** (`#4C8DF8`), runtime tokens (`$name` declared in `@runtime`)
  and `--var` references (including inside `var()`) render **magenta** (`#D6409F`).
- In `$ns.member` the `$ns` prefix renders **teal** (`#4EC9B0`, matching the `@use … as` styling) and the member takes
  the color of the kind it resolves to (blue for a compile-time member, magenta for a runtime member). Resolved
  `$keyframes.<name>` members render **amber** (`#D18616`); the `$keyframes` prefix stays teal.
- Classification is a hybrid: a new semantic-token provider supplies exact ranges and kinds, while the TextMate
  grammar keeps its scopes as the fallback for pre-analysis and parse-degraded states. Semantic colours are user
  settings (`editor.semanticTokenColorCustomizations`, documented in `packages/vscode/README.md`); VS Code has no
  `semanticTokenColors` extension contribution point, so the manifest only carries `semanticTokenScopes`.

## Mechanism

1. **Pure classifier** — `packages/vscode/src/semantic-tokens.ts` (no `vscode` import): legend
   `["variable", "namespace", "runtimeVariable", "customProperty", "keyframe"]`, no modifiers, and
   `semanticTokensFor(text, analysis)` returns sorted, non-overlapping UTF-16 span records. `encodeSemanticTokens`
   produces the five-number delta layout the provider registers.
2. **Provider** — `packages/vscode/src/providers/semantic-tokens.ts` runs parse-only `analyzeText` with the synchronous
   module reader, registers the legend, and degrades to an empty result (grammar fallback) instead of throwing.
3. **Manifest** — `contributes.semanticTokenScopes` maps each type to its grammar fallback scope for `chikx`.
   There is no colour block: `semanticTokenColors` is inert as an extension contribution point, and users set the
   palette through `editor.semanticTokenColorCustomizations` (README “Token colors”).
4. **Grammar (additive)** — `#variable` is split into `#variable-keyframes` → `#variable-namespaced` →
   `#variable-simple`; new `#custom-property` is included in `#value` and retargets the unpinned `@property` `--x`
   capture; `#runtime-declaration` adds `variable.other.declared.runtime.chikx` inside `@runtime` only. No existing pin
   changed.

## Acceptance table

| # | Row | Expected | Level | Status |
|---|---|---|---|---|
| 1 | compile-time `$spacing` | `variable` `#4C8DF8` | unit + host | 🟢 |
| 2 | local runtime `$accent` | `runtimeVariable` `#D6409F` | unit + host | 🟢 |
| 3 | `--brand`, `var(--brand)` | `customProperty` `#D6409F` | unit + host | 🟢 |
| 4 | `$ui.primary` (compile member) | prefix `namespace` `#4EC9B0`, member `variable` | unit + host | 🟢 |
| 5 | imported runtime member `$ui.tone` | prefix `namespace`, member `runtimeVariable` | unit | 🟢 |
| 6 | local `@use "./layout.cssx"` default alias | prefix `namespace`, member `variable` | unit | 🟢 |
| 7 | `$keyframes.spin` (resolved) | prefix `namespace`, member `keyframe` `#D18616` | unit + host | 🟢 |
| 8 | `$keyframes.nope` (unresolvable) | prefix only; member grammar styling | unit + host | 🟢 |
| 9 | `$ui.missing` / `$ghost.member` | prefix only | unit + host | 🟢 |
| 10 | bare `$ghost` | no semantic token | unit + host | 🟢 |
| 11 | declaration sites (`@variables`, `@runtime`, `--x:`) | no semantic token (property-name styling) | unit + host | 🟢 |
| 12 | parse-error document | classifier never throws; grammar fallback | unit | 🟢 |
| 13 | encoding | sorted spans; exact five-number deltas | unit | 🟢 |
| 14 | grammar `$ns` capture | `variable.other.namespace.chikx` (additive pin) | grammar | 🟢 |
| 15 | grammar `--x` value | `variable.other.custom-property.chikx` (additive pin) | grammar | 🟢 |
| 16 | grammar `$keyframes.member` | member + `variable.other.keyframe.chikx` (additive pin) | grammar | 🟢 |
| 17 | grammar `@runtime` declaration | `variable.other.declared.runtime.chikx` only there (additive pin) | grammar | 🟢 |
| 18 | manifest legend/scopes | five legend types, five scope fallbacks, no inert colour block | unit + host | 🟢 |
| 19 | rendered color on Dark+/Light+ | readable, distinct hues | manual | ⚪ manual (no fake assertion) |

## Validation

```sh
bun test tests/extension/provider.semantic-tokens.test.ts tests/extension/grammar.scopes.test.ts
bun test tests/extension/host.test.ts
bun run verify
```

## Fix record

**Result:** 🟢 done.

- New `packages/vscode/src/semantic-tokens.ts` (legend, `semanticTokensFor`, `customPropertyReferencesInSegment`,
  `encodeSemanticTokens`) and `packages/vscode/src/providers/semantic-tokens.ts` (`ChikxSemanticTokensProvider`, parse-only,
  never throws). Registered in `controller.ts` `activate()` through `registerSemanticTokens()`.
- Manifest: the `chikx` `semanticTokenScopes` fallback map only (the inert `semanticTokenColors` block was removed
  during finalization; colours are the documented user settings).
- Grammar: `#variable` split (keyframe / namespaced / simple), `#custom-property` in `#value` and `@property`,
  `#runtime-declaration` inside `@runtime`. Existing scopes and pins unchanged.
- Tests: 19 classifier/legend cases in `tests/extension/provider.semantic-tokens.test.ts`; 5 additive grammar pin
  groups in `tests/extension/grammar.scopes.test.ts`; host scenario `packages/vscode/test/ui/semantic-tokens.js`
  (fixture `packages/vscode/test/fixtures/ui/semantic.cssx`) wired into `packages/vscode/test/suite.js`.
- Keyframe color landed as requested: resolved member `keyframe` (`#D18616`), prefix `namespace`, unresolvable member
  prefix-only.

**Out-of-nominal-write-set test support (necessary to keep the gate green):**
`packages/vscode/test/ui/accessibility.js` expected-contribution inventory carries `semanticTokenScopes` but not the
inert `semanticTokenColors` (the decision is recorded in its comment); the unit and host semantic-token scenarios
assert the block is absent. `tests/stress/editor/vscode-host.ts` and `tests/stress/editor/activation.test.ts` gained
the semantic-token API fakes and updated registration counts (27→28 disposables, 9→10 language providers).

**Validation:** see `.ai/reports/CSSX-COLOR-TOKENS.md` for commands and measured numbers.
