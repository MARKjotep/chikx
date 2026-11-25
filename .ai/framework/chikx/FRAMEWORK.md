# Chikx framework reference (handover)

**Status:** authoritative for v0.1 as implemented. Verified against code on 2026-11-25.
**Read this first**, then `SPECIFICATION.md` for normative language text and the governing ADR.
Where this document and the code disagree, the code wins — fix this document.

## 1. Identity

| Fact | Value |
|---|---|
| Public name | **Chikx**; prose never "CSSX" |
| Source extension | `.cssx` (ADR-0013; ADR-0001 originally chose `.chikx`) |
| Packages | `@chikx/compiler`, `@chikx/cli`, `@chikx/language-service`; private root `chikx`; VS Code package/name `chikx` |
| CLI command | `chikx` (`build`, `check`, `watch`, `clean`, `format`) |
| Diagnostics | `CHIKX####` families; CLI I/O uses `CHIKXCLI###` |
| VS Code language id / scope | `chikx` / `source.chikx` |
| Version | `0.1.0` (root and all packages) |
| Outputs | ordinary CSS, ESM class map, optional `.d.ts`, optional CSS source map (v3) |
| Runtime | none in the browser; no framework dependency; Node `>= 20` and Bun; compiler has zero runtime dependencies (no `dependencies` field) |

Compiler core is pure and filesystem-free: all reads/existence/canonicalization go through
`ModuleHost`, and `compile()` is the batteries-included wrapper that injects `createNodeHost`.
Public barrel exports `tokenize`, `parse`, `compile`, `compileProject`, `planOutputs`, `format`,
`createNodeHost`, `DIAGNOSTIC_CODES`, `error`, `warning` and the frozen types; `parseTokens` is
internal (public `parse()` wraps tokenize + parseTokens).

## 2. Repository map

| Path | Responsibility |
|---|---|
| `.ai/CSSX-MASTERPLAN.md` | Primary historical specification. **Never edit**; ADRs record deltas. |
| `.ai/PROGRESS.md` | Single source of truth for phase/task status (🟢🟡🔴⚪). Lead-owned. |
| `.ai/plans/CSSX-PLAN.md` | Phase/task plan (A01–A16), owned scopes, concurrency rules. |
| `.ai/tasks/`, `.ai/reports/`, `.ai/reports/logs/` | Per-task prompts, reports, worker logs. |
| `.ai/framework/<Framework>/bugs|features/` | External-framework defect/feature records (not app bugs). |
| `SPECIFICATION.md` | Normative language contract (§0–§14). |
| `docs/*.md` | Author-facing restatements: `grammar`, `cascade`, `configuration`, `compatibility`, `performance`, `known-limitations`, `release`. |
| `docs/decisions/ADR-0001..0014` | Architecture decisions; each is normative for its slice. |
| `packages/compiler/src/types/` | **FROZEN contracts**: `ast.ts`, `diagnostics.ts`, `options.ts`, `result.ts`, `span.ts`, `token.ts`. |
| `packages/compiler/src/lexer/` | Stateful tokenizer (`scanner.ts` + names/strings/urls/comments/numbers/dollar-refs/at-keywords) → `tokenize`. Never throws; always one trailing `eof`. |
| `packages/compiler/src/parser/` | Recursive-descent parser (`statements`, `rule`, `declaration`, `value`, `modifier`, `recovery`, `cursor`, `diagnostics`) → `parseTokens`. Always returns an AST. |
| `packages/compiler/src/resolver/` | `buildModuleGraph` (breadth-first load, canonical cache, cycle detection, containment), `scopes.ts` (symbol scopes), `styleModuleOrder` (ADR-0014 order). |
| `packages/compiler/src/lowering/` | `lower` (AST→IR, variant expansion, alias resolution, flush rules), `groupRuns` (safe grouping), `media.ts` (built-in table, merge, AND combination). |
| `packages/compiler/src/ir/` | Immutable IR shapes + factories (`RuleIr`, `DeclarationIr`, `NativeBlockIr`, `MediaConditionIr`, `AtRuleContextIr`). |
| `packages/compiler/src/variables/` | `substitute` (compile-time token expansion, runtime `var()` rewrite), `emitRuntimeTokens` (`:root` + conditional overrides), `naming.ts` (`--<prefix>-<name>`). |
| `packages/compiler/src/naming/` | `renameClasses` (prefix + `:global` unwrap), `generateClassMap` (ESM + `.d.ts`), `mergeClassTables` (ADR-0014 union + CHIKX4001), `table.ts` (CSS identifier rules). |
| `packages/compiler/src/selectors/` | `flattenSelector` / `flattenIr` (descendant nesting, `&` substitution, `:is()` specificity), `scan.ts`, `specificity.ts`. |
| `packages/compiler/src/emitter/` | `emitCss` (pretty/minify, native wrappers, flatten-failure diagnostics, source-map markers). |
| `packages/compiler/src/sourcemaps/` | `mappings.ts` (v3 mappings, comment, URL), `vlq.ts`. One mapping per selector and per declaration. |
| `packages/compiler/src/formatter/` | `format(source, file)` pure parse→print; errors return input unchanged. |
| `packages/compiler/src/output/` | `planOutputs` (pure), `resolve.ts` (defaults, precedence), `paths.ts`, `validate.ts` (CHIKX5001), `importPath.ts`, `manifest.ts`. |
| `packages/compiler/src/host/node.ts` | `createNodeHost` – the only `node:fs` use (`realpathSync` + `fs/promises`). There is no `host/index.ts`. |
| `packages/compiler/src/index.ts` | Public barrel + `compile`/`compileProject`/`parse`, `@setup` decoding, per-entry pipeline, diagnostic merge/dedupe. |
| `packages/cli/src/` | 17 `.ts` modules + `compiler-api.d.ts`: `args`, `compiler` (loader), `config`, `formatter` (loader), `glob`, `index` (`main`, exit codes), `manifest`, `paths`, `project`, `report`, `setup`, `writer`, `commands/{build,check,clean,format,watch}`. |
| `packages/language-service/` | Stub (`src/index.ts` is `export {}`); providers live in the VS Code package. No LSP yet. |
| `packages/vscode/` | `syntaxes/chikx.tmLanguage.json`, `language-configuration.json`, `src/{extension,controller,analysis,intelligence,adapter,config,glob,output,paths,project,service,providers/*}`, `test/` extension-host suite, `dist/`+`out/` build output, `chikx-0.1.0.vsix`. |
| `tests/fixtures/` | 48 `input.cssx` goldens in 12 groups + `cli/` project fixtures + `modules/merge/` 7 goldens using `entry.cssx`. |
| `tests/compiler/` | 24 files: unit + golden suite (lexer, parser, lowering, media, modules, merge, naming, output, planner, runtime, selectors, sourcemap, substitute, formatter, pipeline, contract). |
| `tests/browser/` | Playwright 3-engine computed-style gate (`harness/` scenarios + build, `server.ts`, `specs/*.pw.ts`). |
| `tests/integration/`, `tests/extension/` | CLI build/config/watch/format + Node smoke; grammar/scope, provider and extension-host suites. |
| `examples/` | `basic`, `responsive`, `variables`, `jsx`, `custom-output` (all built by `release:check`). |
| `scripts/benchmark.ts` | Deterministic 100/1000-file benchmark feeding `docs/performance.md`. |

## 3. Compile pipeline (exact order)

`compile(source, options)` first parses (lexical diagnostics before syntax), injects the Node host
(`workspaceRoot`, default `process.cwd()` at call time), canonicalizes the entry, decodes `@setup`
(unknown/duplicate keys are CHIKX1001 here, not in the parser), and builds a module graph: the real
graph via a recording host when the source has `@use`, otherwise a memory-only single-file graph.
It then resolves the effective setup as `defaults → module suppression → file @setup → explicit
options` and calls `compileEntry`.

`compileEntry` (shared by `compile` and `compileProject`):

| # | Step | Owner | What it does |
|---|---|---|---|
| 1 | `styleModuleOrder(graph, entryKey)` | resolver (A07/A16) | Canonical paths of style-imported modules: DFS **post-order** over `styleDependencies` in authored `@use` order, each once, entry excluded. Imported modules therefore precede the entry. |
| 2 | per module: `lower` → `substitute` → `renameClasses` | A05/A08/A09 | Module's own AST, its own `@media-types`, its own `@setup prefix`; `substitute` resolves `$refs` in the **defining** module; runtime `var()` uses the consuming build's prefix. |
| 3 | entry: `lower` → `substitute` → `renameClasses` | A05/A08/A09 | Same passes with the entry prefix. |
| 4 | `mergeClassTables([...moduleTables, entryTable])` | naming (A09/A16) | One union table; same name+same emitted unifies, same name+different emitted = CHIKX4001 (first wins, build fails). |
| 5 | `stylesheetIr([...module rules, ...entry rules])` | ir | Imported-first cascade order. |
| 6 | `emitRuntimeTokens(combinedIr, graph, entryKey, { prefix, media?, ruleModules? })` | variables (A08) | Prepends `:root` custom properties and conditional `:root` overrides; rewrites remaining runtime refs to `var(--…)`; dedupes by property, conflicts = CHIKX2001 first-wins. |
| 7 | `groupRuns(ir, mediaGrouping ?? "safe")` | lowering (A05) | Merges only **adjacent** runs with identical selector text, ancestors, condition and native-rule context. `none` returns the input instance. |
| 8 | `flattenIr(ir)` | selectors (A06) | Nested selectors → flat lists (descendant, `&`, `:is()`); failures are CHIKX1001 and the rule emits no CSS. |
| 9 | `planOutputs({sourceFile, setup, workspaceRoot, projectConfig?}, {host})` | output (A10) | Resolves/validates every destination before emission; errors are CHIKX5001 and the plan is empty. |
| 10 | `emitCss(flattened, { minify, sourceMap? })` | emitter (A06/A15a) | Source map is enabled only when `setup.sourceMap` **and** a CSS output was planned; its comment/file name is the planned CSS basename. |
| 11 | `generateClassMap(merged.table, { cssImport? })` when `emitMap` | naming (A09) | ESM map + `.d.ts`; `cssImport` comes from the planned JS artifact's `importSpecifier`. |

Result fields: `css` only when `emitCss`; `sourceMap` only when emitted; `js` only when `emitMap`;
`types` only when `emitMap && emitTypes`; `classes` is a frozen null-prototype map of non-global
classes; `diagnostics` is stage-ordered and deduped by (code, severity, file, start, end, message);
`dependencies` is reachable modules minus the entry, workspace-relative, sorted, containment-filtered.

`compileProject(entries, host, options)`: same graph shared by all entries; `options.output` is the
project layer (below file `@setup`), `options.naming.prefix` used only when the file does not author
`prefix`; results keyed by the exact entry strings supplied.

`compile()` never reads the source file itself; with `@use` it overrides the entry read and resolves
imports through the real Node host.

## 4. Frozen contracts rule

`packages/compiler/src/types/**` is immutable without lead/owner approval. It froze in A02 and now
carries the AST, diagnostics registry, options/host, results and token/span shapes.

- **The one approved additive change:** `UseImport.styles?: boolean` (ADR-0014). Precedent for any
  future change: additive optional field, JSDoc cites the ADR, fixtures/goldens updated deliberately.
  IR-only additions (`RuleIr.ancestors`, `NativeBlockIr.statement`) live in `ir/types.ts`, outside
  the frozen set.
- `DiagnosticCode` is the template `CHIKX${Digit}${Digit}${Digit}${Digit}`; new subcodes join
  `ReservedDiagnosticCode` + `DIAGNOSTIC_CODES` in `types/diagnostics.ts` (sanctioned registry edit,
  with lead approval).
- Spans are the debugging backbone: `Span { start, end, file }` is half-open UTF-16 offsets into the
  authored file; line/column are derived, never stored. Every diagnostic and IR node maps back to
  authored source (ADR-0005).
- Values are raw source slices exactly as authored, plus optional parsed token sequences when the
  slice contains `$` (ADR-0005). No stage rewrites AST text in place; lowering builds new IR.

## 5. Language semantics digest

### 5.1 `@setup` keys (top-level only, merged in document order)

| Key | Type | Default | Note |
|---|---|---|---|
| `prefix` | string | `""` | Class prefix; empty = unchanged. |
| `css-dir` | string | source dir | Relative to the **source file**, exact (no mirrored subdirs). |
| `css-name` | string | `<stem>.css` | Basename only; `.css` required. |
| `map-dir` | string | source dir | Same base rule. |
| `map-name` | string | `<stem>.map.js` | Basename only; `.js` required; declarations become `<stem>.d.ts`. |
| `emit-css` | bool | `true` | |
| `emit-map` | bool | `true` | |
| `emit-types` | bool | `true` | Auto-suppressed with a warning when `emit-map` is false. |
| `source-map` | bool | `false` | Never emitted when CSS is off. |
| `import-css` | bool | `true` | Must be false when `emit-css` is false (else CHIKX5001). |
| `minify` | bool | `false` | Structural whitespace only. |
| `module` | bool | — | Marker only, not a resolved setting (ADR-0014). |

There is **no media key** in `@setup`; media overrides come from project config `media` and
`@media-types` (ADR-0006). Unknown or duplicate keys are CHIKX1001 (reported by `decodeSetup` in
`index.ts`, and by the CLI config loader for its own document). Multiple `@setup` blocks merge in
order; the first occurrence of a duplicate key wins for resolution.

### 5.2 `@use` imports

- `@use "<specifier>" [as alias] [styles];` — relative, workspace-contained (ADR-0007); token-only
  by default, `styles` also merges rules (ADR-0014).
- Imported compile-time values resolve in their **defining** module; local overrides never mutate
  imported modules; no transitive re-export; forward references allowed.
- Style merge: merged rules keep the **imported module's own** `@setup prefix` (never the importer's,
  API or project `classes.prefix`); a module without `@setup` merges unprefixed;
  `naming.strategy: "none"` disables all prefixing.
- Cascade: imported modules first, depth-first in authored `@use` order, each once, then the
  importing file's rules (native-`@import`-like; local wins equal specificity).
- One merged map/`.d.ts`. Same original name + same emitted name unifies; different emitted names are
  CHIKX4001 (first result wins as documented recovery) and camelCase alias collisions are CHIKX4001
  (both named exports omitted). The build fails either way. Globals stay global, never exported.
- Style-imported modules emit no artifacts in the importing build; `@setup { module: true; }` makes a
  module's **own** build suppress `emit-css`, `emit-map`, `emit-types` and `import-css` unless the
  file (or an explicit override) restores them. Any `@use` cycle, style-bearing or not, is CHIKX2001
  at the closing edge; the merged walk still terminates.

### 5.3 Media aliases

Built-ins: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 (min-width); `dark`/`light`
(`prefers-color-scheme`), `portrait`/`landscape` (`orientation`), `print`, `reduced`
(`prefers-reduced-motion: reduce`).

- Merge **by key**: built-ins < project `media` < file `@media-types`; later layer replaces, distinct
  keys accumulate (ADR-0006). Definitions validate when used, so an unused bad alias is silent.
- Combinations are logical **AND**, never OR: `@xl+dark`. Duplicate aliases normalize (first wins).
- CHIKX3001 and no CSS for: unknown alias; comma lists; empty definition; unbalanced parentheses;
  trailing combinator; `only` without a media type; unsupported media type; combining `not`/`only`;
  combining a query containing `or`; two media types. A media type is emitted first (AND reordering
  is query normalization, not declaration reordering).
- Native `@media` preludes pass through unchanged.

### 5.4 Cascade contract

- Expand in authored order: base first, then each inline variant. Never reorder, merge or dedupe
  declarations.
- A run flushes at a nested rule, conditional block or native at-rule; nested rules emit where they
  appear (SPECIFICATION.md §5.1).
- A **later base declaration overriding an earlier conditional** is authored CSS and is BY DESIGN
  (SPECIFICATION.md §5.2). Do not "fix" it.
- `safe` grouping merges only adjacent runs with identical selector, ancestors, condition and native
  context; never global bottom grouping; `none` is a pure pass-through (SPECIFICATION.md §5.3).
- `!important` binds per value segment and is never propagated (ADR-0003).

### 5.5 Variables and runtime tokens

- Scopes hold locals, unqualified imports and namespaces. Local definitions override unqualified
  imports; duplicate locals, cross-kind (compile vs runtime) duplicates, ambiguous unqualified
  imports and duplicate namespace aliases are CHIKX2001.
- Substitution expands token sequences recursively in the defining module. Undefined token/namespace/
  member, bare namespace, cycle or over-deep chain = CHIKX2001 and the **declaration segment is
  omitted**; an all-omitted rule/native block is dropped. A `$` never reaches CSS.
- `@runtime { primary: … }` emits `:root { --<prefix>-<name>: … }` (or `--<name>` when unprefixed);
  inline variants become conditional `:root` overrides grouped by resolved query (base first), and
  references become `var(--<prefix>-<name>)`.
- Runtime tokens visible to the entry (own + imported + referenced members of rule modules) are
  emitted per consuming entrypoint, deduped by property name; two definitions for one name =
  CHIKX2001 first-wins. Native `var()` remains valid.

### 5.6 Selectors and naming

- A bare nested selector is a **descendant** (ADR-0002). `&` substitutes in any position with native
  nesting semantics: trailing, repeated (`& + &`, `&&`), inside compounds; `\&` stays literal;
  `&` inside strings/comments/attributes is untouched (ADR-0012).
- A complex parent or mixed/unknown-specificity parent list substitutes as `:is(list)`; equal known
  specificity expands as the authored cross-product. Pseudo-element items that `:is()` cannot accept
  are rejected rather than mis-flattened. A selector starting with a combinator requires an explicit
  `&` (else CHIKX1001, no CSS for that rule).
- Class rewriting touches only `.` + identifier outside `:global()`, strings, comments and attribute
  values; class tokens inside `:is()`/`:not()` are renamed. `:global(.x)` escapes renaming and the
  wrapper is removed (simple single-class argument only); globals are recorded but never exported.
- Strategies: `none` | `prefix`. Prefix produces `<prefix>-<name>`; invalid prefix or invalid
  prefixed identifier = CHIKX4001 with the class left unprefixed. Escaped class identity is decoded
  once and, when prefixed, re-emitted as a valid bare identifier.

### 5.7 Generated class map and declarations

- ESM, no runtime helper; `import "<relative css>";` first when `import-css` applies. Named exports are
  camelCase aliases when valid, non-reserved and unambiguous; default export keys are the original
  class names with literal emitted values.
- `foo-bar` + `fooBar` = CHIKX4001 error; both named exports omitted, default map keeps original keys.
  Reserved/invalid identifiers stay reachable by original key; named export omitted with a CHIKX4001
  **warning**. `__proto__` is emitted as a computed key. Order is first appearance (deterministic).
- `.d.ts` mirrors the JS exactly: literal string types, `readonly` map, same named exports/omissions.

### 5.8 Output planning and precedence (exactly as coded)

- `compile`: defaults < `module: true` suppression < file `@setup` < explicit `CompileOptions` fields.
  Prefix: `options.prefix` → `options.naming.prefix` → file `prefix` → `""`.
- `compileProject`: defaults < `options.output` < `module: true` suppression < file `@setup`.
  Prefix: file `prefix` → `options.naming.prefix`.
- CLI: defaults < project `chikx.config.json` < `module` suppression < file `@setup` < `--minify`.
- `naming.strategy: "none"` forces an empty prefix everywhere.

Safety (CHIKX5001, empty plan, nothing written): non-absolute workspace root; source outside root;
`emit-css: false` + `import-css: true`; empty/traversal/path-separator/NUL/wrong-extension names;
duplicate targets; input/output overlap; workspace or symlink escape; cross-entry occupied targets.
No trusted external-output policy exists in v0.1. Files are written atomically (temp + rename in the
destination directory) and tracked in `<root>/.cssx-manifest.json`; `clean` deletes only owned,
unmodified files.

## 6. Diagnostics registry and producers

| Code | Family | Default | Produced in | Triggers | Recovery |
|---|---|---|---|---|---|
| `CHIKX1001` | syntax | error | `lexer/` | Unterminated string/comment/`url()`, malformed `url()`, invalid escape, illegal control character. | Token-level skip; tokenizer never throws. |
| `CHIKX1001` | syntax | error | `parser/` | General syntax errors, top-level conditional block, native at-rule inside a conditional, unclosed/missing blocks, empty selector/property, missing `:`, unexpected at-rule. | One diagnostic per statement, resume at next boundary. |
| `CHIKX1001` | syntax | error | `index.ts` (`decodeSetup`) | Unknown `@setup` key, duplicate setting, non-boolean boolean value. | Key ignored / first value kept. |
| `CHIKX1001` | syntax | error | `lowering/lower.ts` | Declaration or conditional block outside a rule (defensive path). | Node omitted. |
| `CHIKX1001` | syntax | error | `emitter/` | Selector that cannot flatten (defensive); empty property or empty value. | Rule/declaration omitted, no CSS. |
| `CHIKX1001` | syntax | error | `selectors/` (`flattenIr`) | Nested selector that cannot be flattened (leading combinator without `&`, pseudo-element in a mixed-specificity `:is()` list, unbalanced selector). | Rule omitted; no CSS. |
| `CHIKX1002` | syntax | error | `parser/` | Missing semicolon on a Chikx-syntax declaration (has modifier or `$`). Plain CSS final declarations may omit it (ADR-0011). | Rejected declaration omitted, next statement parsed. |
| `CHIKX1003` | syntax | error | `parser/` | Unbalanced parentheses/brackets in a value or condition; unrecoverable statement. | Statement-scoped recovery. |
| `CHIKX2001` | variables/modules | error | `resolver/graph.ts`, `resolver/scopes.ts` | Missing/unreadable module, empty specifier, workspace/symlink escape, unresolved import, cycle, duplicate local, compile+runtime name clash, ambiguous unqualified import, duplicate namespace. | Edge/node dropped; graph still returns records; first definition wins. |
| `CHIKX2001` | variables/modules | error | `variables/expand.ts`, `substitute.ts`, `runtime.ts` | Undefined token/namespace/member, bare namespace, reference cycle, over-deep chain, conflicting runtime definitions. | Declaration segment omitted (first runtime definition wins). |
| `CHIKX3001` | media | error | `lowering/media.ts`, `lower.ts`, `variables/runtime.ts` | Unknown alias, invalid/uncombinable alias definition, Chikx modifier/conditional inside `@keyframes`/`@font-face`/`@property`-style restricted contexts, bad runtime condition. | Condition dropped; affected declaration/block omitted. |
| `CHIKX4001` | naming | error (warning for omitted named exports) | `naming/rewrite.ts`, `table.ts`, `mapgen.ts`, `merge.ts` | Invalid prefix or prefixed identifier, camelCase alias collision, merged-table same-name/different-emitted conflict; warning for reserved/invalid named export. | Class stays unprefixed / exports omitted, output still deterministic. |
| `CHIKX5001` | output | error | `output/index.ts`, `output/validate.ts` | Unsafe or inconsistent output plan (see §5.8). | Empty plan; caller must not write. |

Routing rule: find the code, then the producer module above; that module owns the fix. `CHIKXCLI001`
(write failure) and `CHIKXCLI002` (source read failure) are CLI-only and not compiler codes.

## 7. Invariants — never break these

1. **Never emit invalid CSS.** A construct that cannot be emitted is omitted after an error
   diagnostic; never guess a replacement.
2. **Never silently drop authored constructs.** Anything not representable is reported
   (`CHIKX1001`-family), not swallowed.
3. **Never reorder, merge or deduplicate declarations.** Only adjacent safe grouping may merge runs;
   the cascade contract (§5.4) is deliberate, including later-base-overrides-earlier-conditional.
4. **Spans survive every stage.** Diagnostics, IR, source maps and editor ranges all derive from the
   authored `Span`; never invent positions.
5. **Minify differs from pretty only in structural whitespace** (indentation, newlines, space after
   `:`, brace spacing, trailing newline). Values, selectors, strings, `calc()` internals and order are
   byte-identical.
6. **Goldens are byte-exact.** Update expected files only for an intended output change and review
   every diff. There is no regeneration script; empty-output error fixtures use
   `/* no css: see expected/diagnostics.json */`.
7. **Deterministic output** across runs and platforms (sorts are explicit; `\n` structural newlines).
8. **Zero runtime dependencies** in `@chikx/compiler`; the compiler core is pure, all I/O via
   `ModuleHost`.
9. **Consumers import the public barrel only.** CLI loads `@chikx/compiler` (then `dist`, then `src`
   under Bun); the extension compiles the same barrel source (`../../compiler/src/index.js`). No deep
   imports into pipeline internals.
10. **Language/grammar changes require an ADR plus owner/lead approval**, SPECIFICATION.md update and
    fixtures. Never change semantics silently.
11. **`.ai/CSSX-MASTERPLAN.md` is never edited.** ADRs and `SPECIFICATION.md` record deltas.
12. **Never weaken tests, delete goldens or relax assertions to make a build pass.**

## 8. Quality gates and commands

| Command | What it proves |
|---|---|
| `bun install` | Workspace links (Bun workspaces; `packages/*`). |
| `bun run typecheck` | `tsc --noEmit` for compiler, CLI, language-service **and vscode** (4 projects). |
| `bun run lint` | Biome (recommended rules, 2-space, 100 cols, double quotes). Ignores `.ai`, `docs`, `dist`, lockfile, `opencode.jsonc`, root `AGENTS.md`. |
| `bun test` / `bun run test` | 612 tests / 37 files (unit, goldens, merge/module suites, CLI integration incl. Node smoke, extension providers/host). |
| `bun run verify` | `typecheck && lint && test` — the required gate for every change. |
| `bun run test:browser` | `playwright test`: 75 computed-style tests = 25 × Chromium/Firefox/WebKit (recorded in `docs/cascade.md` §5); Chromium required, other engines auto-detected. |
| `bun run release:check` | `verify` + browser + compiler/CLI builds + package-metadata assertions + `npm pack --dry-run` (both tarballs contain `package.json`, `README.md`, `LICENSE`, `dist/**`) + 5 example builds + VS Code build + `vsce package`. |
| `bun run benchmark` | Deterministic 100/1000-file benchmark; medians recorded in `docs/performance.md`. |

CLI surface (`chikx`), exit codes contractual:

- `build [file] [--config <path>] [--json] [--dry-run] [--minify|--no-minify]` → 0 success, 1
  compile/validation errors, 2 invocation/config errors. `check …` plans without writing (1 on any
  error). `watch …` does an initial build then debounced, serialized rebuilds and never watches its
  own outputs. `clean [--dry-run]` removes only manifest-owned unmodified files.
- `format [file] [--check] [--dry-run]` → canonical in-place rewrite; `--check` writes nothing and
  exits 1 on changes; parse errors never rewrite. Also `--help`, `--version`.

Definition of done: **all relevant gates green AND goldens reviewed deliberately.** A red gate is
never "fixed" by editing expectations unless the output change is the intended behavior.

## 9. Bug-fix protocol for agents

1. **Read the contract.** Locate the feature in `SPECIFICATION.md` and read the governing ADR
   (table in §10). Do not infer semantics from tests alone.
2. **Reproduce with a fixture or failing test.** Fixtures are the regression format:
   `tests/fixtures/<group>/<case>/input.cssx` (or `entry.cssx` for merged builds) plus
   `expected/{css,map.js,map.d.ts,diagnostics.json}`. `diagnostics.json` is `null` (unchecked), `[]`
   (explicitly clean) or an array of `{code, severity, messageContains?, line?, column?}`.
   Single-file fixtures may ship sibling modules, `chikx.config.json` or `source-path.txt`.
3. **Fix in the owning module** — use the routing table at the end of this section.
4. **Semantics change ⇒ ADR + `SPECIFICATION.md` edit + owner/lead approval.** Never silent.
5. **New diagnostics must join the frozen registry** (`types/diagnostics.ts`:
   `ReservedDiagnosticCode` + `DIAGNOSTIC_CODES`) with a stable code in the right family and an
   accurate summary; producers cite it.
6. **Update goldens only for intended output changes**, reviewing the diff; never regenerate blindly.
7. **Run `bun run verify`**; add `bun run test:browser` when CSS output or cascade behavior changed.
8. **Persist** a task under `.ai/tasks/`, a report under `.ai/reports/`, a worker log under
   `.ai/reports/logs/`, and update `.ai/PROGRESS.md` rows per its convention (lead flips status).

Routing table (symptom → owning module):

| Symptom | Owning module |
|---|---|
| Wrong tokens, escapes, comment/string/url boundaries | `lexer/` |
| Wrong AST, recovery, semicolon/rule-vs-declaration decisions | `parser/` |
| Import resolution, cycles, scope/ambiguity errors | `resolver/` |
| Wrong variant expansion, media query text/combining, flush order, native contexts | `lowering/` |
| Wrong `$` expansion/omission, `:root` emission, `var()` | `variables/` |
| Wrong prefix, `:global`, class table, JS map, `.d.ts` | `naming/` |
| Wrong flattening/`&`/`:is()` behavior | `selectors/` |
| Wrong CSS text, minify, source map, emitter-side omission | `emitter/` + `sourcemaps/` |
| Wrong destination, extension, overlap/escape, import path | `output/` |
| Setup decoding/defaults/API precedence | `index.ts` (+ `output/resolve.ts`) |
| CLI discovery, config, exit code, manifest, watch | `packages/cli/src/**` |
| Editor grammar, providers, commands | `packages/vscode/**` |

Known-limitations work is the best first-bug territory: `docs/known-limitations.md` (formatting
provider, CSS intelligence, cross-module rename, LSP, project output mirroring, CLI path overrides,
watch recursion, `:global` scope, etc.).

External-framework records (only for defects/features in a third-party dependency, not this app) go
to `.ai/framework/<Framework>/bugs|features/` with summary, framework, affected API, **exact installed
version from package metadata or the resolved lockfile** (or `unknown` plus the reason), reproduction,
expected/actual (bugs) or acceptance criteria (features), evidence, workaround and status. Example:
`.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md`.

## 10. Documentation index

| Doc | One line |
|---|---|
| `SPECIFICATION.md` | Normative v0.1 language/compiler contract; §0 owner decisions, §3 grammar, §5 cascade, §6 modules, §9 outputs, §12 diagnostics. |
| `docs/grammar.md` | Author-facing restatement of lexical rules and grammar. **Stale on `@use styles`** (says rules are never imported; code/spec support the clause). |
| `docs/cascade.md` | Cascade contract with worked examples and browser evidence. |
| `docs/configuration.md` | `@setup`/`chikx.config.json`/CLI precedence reference. |
| `docs/compatibility.md` | Feature-by-feature supported/rejected matrix with test evidence. |
| `docs/performance.md` | Measured benchmark medians and method (100/1000 files). |
| `docs/known-limitations.md` | Blunt gap list; good first-bug territory. |
| `docs/release.md` | What `release:check` validates and the manual publish steps. |
| `ADR-0001` | Chikx is the only public name (amended only for the extension by ADR-0013). |
| `ADR-0002` | Bare nested selector = descendant. |
| `ADR-0003` | `!important` binds per inline value segment. |
| `ADR-0004` | Conditional blocks are rule-scoped in v0.1 (top-level is CHIKX1001). |
| `ADR-0005` | AST values keep raw source slices + optional token sequences; spans everywhere. |
| `ADR-0006` | Media aliases merge by key (built-ins < project < file). |
| `ADR-0007` | Workspace root = nearest `chikx.config.json`, else `package.json`; containment rules. |
| `ADR-0008` | Bun workspaces, `bun test`, Node>=20 smoke, Biome, `bun run verify`, zero runtime deps. |
| `ADR-0009` | Governance: `.ai` layout, max two workers, `.ai/PROGRESS.md`, masterplan precedence. |
| `ADR-0010` | Naming `none|prefix`, strict CHIKX4001 collisions, reserved-export warnings, `__proto__` safety, type suppression. |
| `ADR-0011` | Semicolonless final declarations only for plain CSS (no modifier/`$`). |
| `ADR-0012` | `&` follows native CSS nesting substitution in any position. |
| `ADR-0013` | Source extension is `.cssx`; every other public name stays Chikx; `.cssx-manifest.json`. |
| `ADR-0014` | `@use … styles` rule-merge imports: own-prefix, imported-first, one merged table, `module: true`. |
| `.ai/PROGRESS.md` | Single source of truth for phase/task status. |
| `.ai/tasks/`, `.ai/reports/` | Per-task prompt and result convention (`## Summary` first, evidence, blockers). |
| `.ai/plans/CSSX-PLAN.md` | Phase/task plan, dependencies, exclusive scopes. |

## 11. Current state (2026-11-25)

- **v0.1.0**; all plan phases **P0–P7 plus A16 are 🟢** (lead-verified; `.ai/PROGRESS.md`).
- `bun run verify` green: 612 tests / 37 files; typecheck includes the VS Code project; Biome clean.
- Browser gate: 75 passed (25 × Chromium/Firefox/WebKit) per `docs/cascade.md`; Chromium is required.
- Extension packaged: `packages/vscode/chikx-0.1.0.vsix` (built by `release:check`).
- **Not published** to npm/Marketplace and the repository has **no commits** (both pending owner
  decisions). Do not commit, push or publish without authorization.
- Known documentation drift: `docs/grammar.md` §2/§3 and `docs/compatibility.md` still describe
  `@use` as token-only; the code, `SPECIFICATION.md` §6.3 and ADR-0014 support the `styles` clause.
