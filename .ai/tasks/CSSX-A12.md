# CSSX-A12 — VS Code TextMate grammar and language configuration (P6)

## Summary

- Implement `packages/vscode/syntaxes/chikx.tmLanguage.json` per the approved UI contract (source.chikx, yellow alias scopes, magenta directives, category-distinguishable selectors).
- Add `language-configuration.json` (comments, bracket pairs, auto-closing, indentation) and the manifest `contributes` (language `chikx`, `.chikx` extension, aliases, grammar).
- Validate the grammar structurally and (if the toolchain installs cleanly) with vscode-textmate scope rendering over fixture samples.

**Status:** implemented; structural and rendered-scope tests pass and `bun run verify` is green. Awaiting lead verification.

## Objective

Deliver syntax highlighting for Chikx in VS Code from a standalone TextMate grammar and a language
configuration, wired through the extension manifest, without any runtime dependency on the built-in
CSS extension and without affecting compilation output.

## Owned files (exclusive)

- `packages/vscode/**` — manifest, `syntaxes/chikx.tmLanguage.json`, `language-configuration.json`,
  `src/extension.ts` activation stub, package README.
- `tests/extension/**` — grammar structural and rendered-scope tests plus the harness.
- `.ai/tasks/CSSX-A12.md`, `.ai/reports/CSSX-A12.md`, `.ai/reports/logs/CSSX-A12.log`.

Nothing else may be edited. `tests/fixtures/`, other packages, root configs and `.ai/PROGRESS.md`
stay untouched (the lead flips status).

## Approved UI contract (normative, from the `ui` specialist)

- Root scope `source.chikx`; standalone grammar, plain `include` chains, no injections, no runtime
  dependency on vscode-css; CSS-ish patterns vendored with `.css`-suffixed scopes.
- Media aliases (inline + block, `@md`, `@dark`, `@2xl`, `@xl+dark`): `entity.name.function.chikx`
  (yellow in Dark+/Light+), grouped in `meta.variant.chikx`.
- Directives (`@setup`, `@use`, `@variables`, `@runtime`, `@media-types`):
  `keyword.control.directive.chikx` (magenta). Directives must be tried before the generic alias
  rule; aliases may start with a digit and join with `+`.
- `as` in `@use`: `keyword.other.chikx`. Class/id/type/pseudo scopes:
  `entity.other.attribute-name.class.css`, `.id.css`, `entity.name.tag.css`,
  `entity.other.attribute-name.pseudo-class.css`, `.pseudo-element.css`. Parent `&`:
  `entity.other.attribute-name.parent-selector.css`. Combinators:
  `keyword.operator.combinator.css`. `:global`: pseudo-class scope, argument re-enters selector
  context. Properties: `support.type.property-name.css`; values: `support.constant.property-value.css`;
  strings/comments standard CSS scopes with `@`/`$`/braces inert; `$var` and `$ns.member`:
  `variable.other.chikx` (member `variable.other.member.chikx`); numbers/units:
  `constant.numeric.css` + `keyword.other.unit.css`; `!important`: `keyword.other.important.css`;
  function calls (`calc(`): `support.function.calc.css`; native at-rules:
  `keyword.control.at-rule.css` + `meta.at-rule.<name>.css` with prelude tokens using
  property/constant scopes (never alias yellow); punctuation: `punctuation.section.block.css`,
  `punctuation.definition.group.css`, `punctuation.terminator.rule.css`. Setup/runtime keys use the
  property-name scope.
- Include graph: `#root` → `#comment` → `#directives` → `#native-at-rule` → `#alias-block-start` →
  `#selector` → error recovery; `#block-body` → `#nested-rule` → `#conditional-block` →
  `#native-at-rule` → `#declaration` → `#value` (aliases re-enter value context).

## Requirements

1. Full grammar covering directives and bodies, native at-rule preludes (`@media`, `@supports`,
   `@keyframes` steps, `@font-face`/`@property` descriptors), selector categories including
   functional pseudos and attribute selectors, declarations with inline aliases, inert strings,
   comments, escapes, numbers/units, `!important`, `:global(...)`, balanced nested rules,
   conditional blocks, and unterminated-construct recovery.
2. Language configuration with `//` and `/* */`, `{}`/`[]`/`()` brackets, auto-closing, surrounding
   pairs, brace indentation and a word pattern covering escapes and `$name`.
3. Extension manifest with language/grammar contributes, activation on the language, and a small
   `src/extension.ts` activation stub (`main`).
4. `tests/extension/grammar*.test.ts` proving JSON validity, include resolution, directive-before-
   alias order, regex safety, and — best effort — rendered scopes through `vscode-textmate` +
   `vscode-oniguruma`. No fake scope assertions if the toolchain is unavailable.
5. `bun run verify` exits 0 with a clean lint.

## Constraints

- Pattern safety: every pattern must consume input or use anchors/lookaheads safely; no empty
  `match` rules (TextMate tokenizers hang on zero-length matches). Rule selectors use a brace
  lookahead; `{`/`}` are consumed by a balanced block context.
- Grammar-only change: no compilation behaviour is touched.
- No UI decision changes; no test weakening.

## Acceptance criteria

1. `bun run verify` exit 0; grammar tests pass.
2. The five UI acceptance checks are verifiable from grammar structure, each mapped to patterns and
   scopes in the report.
3. Manifest contributes are valid per the VS Code schema (languages + grammars wired to real files).
4. Report records created files, vendoring decisions, test evidence (or toolchain fallback reason),
   deviations and blockers.

## Validation commands

```sh
bun test tests/extension
bunx biome check packages/vscode tests/extension
bun run verify
./node_modules/.bin/tsc --noEmit --strict --module nodenext --moduleResolution nodenext \
  --target ES2022 --skipLibCheck packages/vscode/src/extension.ts
```

## Dependencies

A03 token classes (landed), the frozen specification (§3 grammar, §4 media, §7 selectors, §9 setup)
and the approved A12 UI contract above.
