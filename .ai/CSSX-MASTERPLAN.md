# Chikx — Language, Compiler and VS Code Extension

**Status:** Proposed implementation specification · v0.1 target  
**Public name:** Chikx (`.chikx`), packages `@chikx/*`, CLI `chikx`, VS Code language ID `chikx`, diagnostic family `CHIKX####`.  
**Stack:** TypeScript, Bun workspaces, Node-compatible compiler and CLI, VS Code API.

**Change record — 2026-11-24:** At the project owner's request, Chikx replaces the former CSSX public name across package scope, command, source extension, editor language ID, and diagnostic codes. There is no legacy `.cssx` extension or public `cssx` command. CSS minification is added as an opt-in output setting, off by default; it compacts generated structural whitespace and preserves authored CSS tokens and declaration order. This record keeps the rename and output addition explicit in the primary specification.

## 1. Vision and scope

Build a CSS-first, property-centric stylesheet language that keeps responsive values, theme overrides and nested selectors beside their base declarations. Compile to ordinary CSS and static JavaScript class maps with optional TypeScript declarations and source maps. No browser runtime, framework dependency or editor requirement. The VS Code extension is an interface to the same compiler used by CLI and build tools.

MVP includes inline and block media aliases, combined conditions, variables and imports, nested selectors, prefixing, configurable output paths/names, class maps, opt-in compact CSS output, CLI build/check/watch, syntax highlighting, completions and diagnostics. Defer mixins, arbitrary expressions, container aliases, inline pseudo-state modifiers, hashing, advanced refactoring and aggressive CSS optimization until core semantics are stable.

## 2. Canonical example

```scss
@setup {
  prefix: "ui";
  css-dir: "../generated/styles";
  css-name: "button.css";
  map-dir: "../generated/maps";
  map-name: "button.map.js";
}
@use "./theme.chikx" as theme;
@variables {
  spacing: 12px;
  radius: 8px;
}
.button {
  display: flex;
  padding: $spacing @md 20px @xl 32px;
  border-radius: $radius;
  background: $theme.primary @dark #1e40af;
  font-size: 14px @md 16px;
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  & > .icon { width: 16px @lg 20px; }
}
```

Assume `theme.primary` is `#2563eb`. With source `src/button.chikx`, the outputs are `generated/styles/button.css`, `generated/maps/button.map.js` and `generated/maps/button.map.d.ts`. The stylesheet contains `.ui-button` and `.ui-button > .ui-icon`, ordinary media queries and flattened pseudo-selectors. The JS map exports `button` and `icon`.

```js
import "../styles/button.css";
export const button = "ui-button";
export const icon = "ui-icon";
export default { button, icon };
```

```tsx
import styles from "../generated/maps/button.map.js";
export function Button() {
  return <button className={styles.button}>Continue</button>;
}
```

## 3. Language specification

### 3.1 Lexical and grammatical rules

Use a stateful tokenizer and recursive-descent parser; never split declarations with regex alone. Track source offsets, line/column, comments, escapes, quoted strings, balanced parentheses/brackets and braces. Treat `@` inside strings, comments, URLs or functions as ordinary CSS content. Inline modifiers are recognized only at top-level value depth, after whitespace, outside escaped tokens. Unknown modifiers produce diagnostics. Preserve raw CSS token sequences and custom property values. Require semicolons for Chikx declarations in v0.1; ordinary CSS final declarations without semicolons may be accepted. Recover at safe statement boundaries for editor use.

```ebnf
file          = { setup | use | variables | runtime | mediaTypes | rule | nativeAtRule } ;
setup         = "@setup" "{" { setting } "}" ;
setting       = identifier ":" scalar ";" ;
use           = "@use" string [ "as" identifier ] ";" ;
variables     = "@variables" "{" { tokenDeclaration } "}" ;
runtime       = "@runtime" "{" { declaration } "}" ;
mediaTypes    = "@media-types" "{" { aliasDeclaration } "}" ;
rule          = selector "{" { declaration | rule | conditionalBlock | nativeAtRule } "}" ;
declaration   = property ":" cssValue { modifier cssValue } ";" ;
modifier      = "@" alias { "+" alias } ;
conditionalBlock = modifier "{" { declaration | rule | conditionalBlock } "}" ;
```

This is structural grammar; CSS values/selectors require balanced token parsing rather than simple strings. Aliases may begin with digits (e.g. `2xl`). Setup/import/token definitions are top-level only. Require a base value for inline variants; use a conditional block for conditional-only declarations. Distinguish nested selectors from declarations by balanced lookahead, not the presence of a colon alone. Reserve Chikx directives and reject conflicting alias names. Native CSS at-rules retain their meaning.

### 3.2 Media conditions

Default aliases: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px (all min-width); `dark`/`light` prefers-color-scheme; `portrait`/`landscape` orientation; `print` print; `reduced` prefers-reduced-motion: reduce. Allow project and file overrides.

```scss
@media-types { compact: (max-width: 500px); }
.card {
  padding: 12px @md 20px @xl 32px;
  background: white @dark #181818 @xl+dark #101010;
  @xl { display: grid; gap: 24px; }
  @compact { display: block; }
}
```

Combined aliases are logical AND, not OR. Normalize duplicate aliases and combine nested conditions. In MVP support single media-query expressions per alias and reject unsupported combinations (e.g. incompatible media types or comma-list combinations) with explicit diagnostics; do not emit invalid CSS. Native media lists can pass through unchanged. Preserve native `@supports`, `@layer`, `@container`, `@keyframes`, `@font-face` and `@property` contexts; reject unsupported Chikx transformations inside them rather than silently changing semantics.

### 3.3 Cascade contract (critical)

Default mode is source-preserving: expand each declaration's base then variants in written order; emit contiguous runs with the same selector and at-rule context. Flush runs when encountering nested rules or conditional declarations. Later declarations retain their normal CSS precedence, including shorthand/longhand, duplicate fallbacks and `!important`. Within one inline declaration the last matching variant wins subject to native cascade. Recommend ascending mobile-first aliases and combined conditions last; warn about suspicious order but do not silently reorder. A later base declaration can override an earlier conditional declaration: document this explicitly.

Safe grouping merges only adjacent compatible rules/media contexts without changing declaration order, selector specificity, layer or scope. Global grouping at the bottom is not generally safe. A future opt-in ordered-media mode may define a different cascade contract; never call it semantics-preserving. Test overlapping selectors, dark + width, shorthand/longhand, repeated declarations, specificity, layers, native at-rules and important flags in real browsers.

### 3.4 Variables and modules

```scss
@use "./theme.chikx";
@use "./layout.chikx" as layout;
@variables { radius: 16px; gap: $layout.spacing; }
.card { padding: $gap; border-radius: $radius; }
```

Compile-time variables substitute token sequences, not JS expressions. Resolve forward references through a dependency graph; report undefined symbols and cycles with source locations. Local definitions override unqualified imported definitions; duplicate local definitions and ambiguous imports are errors. Namespaced imports remain independent. Imported values resolve in their defining module; local overrides do not mutate imported modules. No implicit transitive re-export. Imports are relative to the importing source, restricted to workspace by default, and import tokens only, not stylesheet rules. Token-only modules do not emit artifacts unless explicitly configured. Cache modules by canonical path; detect cycles and track reverse dependencies. No network imports or executable source.

Runtime variables emit native custom properties and references:

```scss
@runtime { primary: #2563eb @dark #60a5fa; }
.card { color: $primary; }
```

Emit `:root { --ui-primary: #2563eb; }`, conditional root overrides, and `color: var(--ui-primary)`. Runtime tokens are scoped by prefix/module policy; detect collisions across entrypoints. Imported runtime tokens must have a defined emission owner (MVP: emit in each consuming entrypoint, deduplicate within that entrypoint; warn on conflicting definitions across outputs). Compile-time and runtime symbols cannot share a local name. Native `var()` remains valid. Future: explicit defaults, theme scopes and shared runtime token bundles.

### 3.5 Selectors and classes

Support `&:hover`, `&::before`, `&:nth-child(2n)`, `& > .icon`, `& + .button` and descendant nesting. Require explicit `&` for complex nesting in MVP; bare simple selectors may mean descendants. Parse selector lists at top-level commas, including functional pseudos. Preserve native nesting specificity: for mixed-specificity parent lists use `:is(...)` where needed or reject unsupported flattening rather than naïvely expanding. Validate multiple `&` references and escaped class identifiers. Never rewrite text inside attribute strings or declaration values.

All local class tokens, including nested references, use the same naming table. `:global(.external-icon)` escapes renaming and is removed from emitted selector. MVP supports simple global class escapes; complex global selectors can follow. Naming strategies: none and prefix first; file-scoped and stable hash later. Prefix `ui` produces `ui-card`; empty prefix leaves names unchanged. Validate CSS identifier compatibility. Detect collisions across sources when building a project; intentional shared global classes are allowed.

### 3.6 JavaScript and declarations

Default export maps original class names to emitted names using safe quoted keys; named exports use camelCase (`button-primary` → `buttonPrimary`). Provide camelCase aliases in the default map when unambiguous. Reject collisions such as `foo-bar` and `fooBar` or report and omit conflicting aliases according to a documented strict policy (MVP: error). Reserved/invalid JS identifiers remain accessible via quoted original keys, with named export omitted and warning. Handle `__proto__` safely using computed keys or a null-prototype map. Emit deterministic ordering. Global classes are not exported. Generate literal string types and readonly map properties. ESM is default; CSS side-effect import configurable for environments that cannot load CSS in JS. No runtime helper needed.

## 4. Output configuration — normative

File-level `@setup` supports independent output directories and optional filenames:

```scss
@setup {
  prefix: "dashboard";
  css-dir: "../styles";
  css-name: "dashboard.css";
  map-dir: "../modules";
  map-name: "dashboard.map.js";
  emit-css: true;
  emit-map: true;
  emit-types: true;
  source-map: true;
  import-css: true;
  minify: true;
}
```

| Setting | Default | Meaning |
|---|---|---|
| prefix | empty | Class name prefix |
| css-dir | source directory | CSS output directory |
| css-name | `<stem>.css` | Optional CSS basename |
| map-dir | source directory | JS class map output directory |
| map-name | `<stem>.map.js` | Optional JS basename |
| emit-css | true | Write stylesheet |
| emit-map | true | Write JS class map |
| emit-types | true | Write `.d.ts` beside JS map |
| source-map | false | Write CSS source map |
| import-css | true | Include relative CSS import in JS |
| minify | false | Compact generated CSS whitespace while preserving CSS tokens and declaration order |

File-level directories resolve relative to the source file, never current working directory. Project-level directories resolve relative to project root; preserve source-relative subdirectories by default to avoid basename collisions. A file-level directory is exact, without mirrored subfolders. Filenames are basenames only, no separators or traversal; require `.css` and `.js` respectively (optional extension normalization may be added later). A custom JS basename `classes.js` yields `classes.d.ts`; a CSS name `theme.css` yields `theme.css.map` when source maps enabled. The JS class map is distinct from the CSS debugging source map. If only a directory is specified, use default filename; if only filename specified, retain effective directory. Independent overrides must work.

Precedence: built-in defaults < project config < file setup < explicit CLI overrides. CLI overrides should be explicit and not silently flatten multiple outputs into one destination. Resolve all output paths before writing. Reject input/output overlap, duplicate targets, workspace escapes and symlink escapes unless an explicit trusted project policy permits external output. Reject unknown setup keys and duplicate settings. Create missing directories. Compute CSS import relative to JS map directory, use forward slashes and `./` when necessary; escape strings safely. If CSS emission is disabled, require `import-css: false`; if map disabled, types must be disabled or automatically suppressed with documented warning. No source map when CSS disabled.

Build must validate entire output plan before writing. Write temp files in destination directories and rename; per-file atomicity, not a claim of cross-file transactionality. On errors retain last successful outputs and mark stale status. Track generated files in a manifest; clean only files owned by compiler and not modified externally. On rename/config changes remove obsolete owned outputs after successful build, or report them if safe deletion cannot be established. Watcher excludes generated outputs and avoids feedback loops. Never overwrite unrelated user files without explicit opt-in.

Acceptance cases: no setup; only CSS dir; only map dir; only names; both dirs and names; nested source; spaces in paths; Windows separators; output collision; invalid extension; traversal; symlink; disabled outputs; renamed source; custom source map URL; relative import across sibling directories.

## 5. Project configuration

Prefer declarative `chikx.config.json` for MVP, safe to read in untrusted workspaces. Optional trusted `chikx.config.ts` later, executed only by explicit trusted build. Example:

```json
{
  "include": ["src/**/*.chikx"],
  "exclude": ["node_modules", "dist"],
  "output": { "cssDir": "dist/styles", "mapDir": "dist/maps", "emitCss": true, "emitMap": true, "emitTypes": true, "sourceMap": false, "importCss": true, "minify": false },
  "classes": { "strategy": "prefix", "prefix": "ui" },
  "media": { "md": "(min-width: 768px)", "xl": "(min-width: 1280px)" },
  "compiler": { "strict": true, "mediaGrouping": "safe" }
}
```

Validate schema; reject unknown keys in strict mode. Document mapping between kebab-case source settings and camelCase JSON. Multi-root VS Code workspaces resolve nearest config per file, with explicit workspace boundary. Provide JSON schema and completion. Default media definitions merge by key.

## 6. Architecture and repository

```text
chikx/
  package.json / bun.lock / tsconfig.json
  README.md / SPECIFICATION.md / AGENTS.md
  packages/
    compiler/src/{lexer,parser,ast,resolver,transformer,generator,diagnostics}/
    cli/src/{build,watch,check,format,config,output}/
    language-service/src/{completion,hover,definition,references,formatter,diagnostics}/
    vscode/{package.json,language-configuration.json,syntaxes,src}/
  tests/{fixtures,compiler,browser,integration,extension}/
  examples/{basic,responsive,variables,jsx,custom-output}/
  docs/{grammar,cascade,configuration,decisions}/
```

Dependency direction: VS Code → language service → compiler; CLI → compiler. Shared output planner and project service may be extracted into a Node-compatible package. Compiler core is pure and filesystem-independent through injected resolver; no VS Code or Bun-only API in published core. Use Bun for development and bundling; test Node compatibility. Zero mandatory third-party compiler runtime dependencies is a goal, not a reason to implement unsafe selector parsing; evaluate a focused CSS parser if necessary. Use Microsoft's CSS language service for standard CSS intelligence, not as the Chikx compiler.

Pipeline: tokenize → parse AST → resolve modules/config → semantic validation → lower into ordered CSS IR → class rewrite → safe grouping → CSS/JS/types/source-map generation → output planning/writing. Preserve source spans through all stages. Source maps use standard v3 mappings; CSS source map comment points to actual output basename. Distinguish fatal errors from warnings. Deterministic output across runs and platforms.

```ts
interface Span { start: number; end: number; file: string }
interface Variant { aliases: string[]; value: string; span: Span }
interface Declaration { kind: "declaration"; property: string; value: string; variants: Variant[]; span: Span }
interface Diagnostic { code: string; severity: "error" | "warning"; message: string; span: Span }
interface CompileResult { css?: string; js?: string; types?: string; sourceMap?: string; classes: Record<string,string>; diagnostics: Diagnostic[]; dependencies: string[] }
```

Define public APIs `parse(source, options)`, `compile(source, options)`, `compileProject(entries, host, options)`, `planOutputs(...)`. Compiler returns artifacts, never writes files. Project host provides read/resolve and canonical path policy. IR records ordered selectors, declarations, at-rule stack, origin spans and condition keys. Keep AST immutable during transformation. Use stable diagnostic codes, e.g. CHIKX1001 syntax, CHIKX2001 undefined token, CHIKX3001 unknown media, CHIKX4001 export collision, CHIKX5001 output collision.

## 7. CLI and integration

`chikx build [file]`, `chikx watch [file]`, `chikx check [file]`, `chikx format [file]`, `chikx clean` (manifest-owned only). Support `--config`, `--json`, `--dry-run`, `--minify`, `--no-minify`, `--help`, `--version`; minification flags apply to project builds and single-entry builds, while path overrides remain single-entry only. Exit 0 success, 1 compile/validation error, 2 invocation/config error. Check never writes. Format supports check mode. Watch debounces changes, tracks import reverse graph, handles deletion/config changes, serializes writes and ignores stale build generations. Initial full build, then incremental affected entries. No reliance on editor save hooks for CI.

Provide package exports for compiler API and CLI bin. Example Bun scripts: `bun run chikx:build`, `bun run chikx:watch`; integrate via prebuild or programmatic compiler in existing frontend framework. Browser bundler must support CSS imports, or set import-css false and load CSS separately. No JSX-specific dependency.

## 8. VS Code extension

Register language ID `chikx`, aliases and `.chikx` extension through `contributes.languages`; register TextMate grammar and language configuration (comments, brackets, auto-closing pairs, indentation). Activate on language or commands. Use direct VS Code providers initially; extract LSP server later if other editors need it. Bundle for Node extension host; do not assume Bun installed.

Completion contexts: property names, CSS values, `@` aliases, `$` variables and namespace members, setup keys, import paths, nested selectors and pseudo-selectors. Reuse `vscode-css-languageservice` via projected ordinary CSS with offset mapping; do not feed custom syntax directly and expose false errors. Hover shows resolved token value, condition expression and generated class. Diagnostics from tolerant parser and semantic analyzer; debounce and discard stale document versions. Add color provider, outline, definition, references, rename and formatter progressively. Rename must avoid strings/comments and respect module scope; class rename across JSX is later work.

Commands: Chikx: Compile File, Build Project, Preview Compiled CSS, Open Generated CSS, Open Class Map, Check Project. Status bar shows success/error/stale state; output channel reports paths and diagnostics. Preview compiles in memory without writes. Compile on save is configurable, off by default until trusted; avoid simultaneous CLI watcher and extension writers (use one writer or explicit coordination). Respect workspace trust; no executable config or automatic writes in restricted mode. Support cancellation, multi-root projects and unsaved buffer diagnostics. Generated files can be hidden through optional user settings, never forcibly.

## 9. Testing and quality gates

Unit tests for lexical boundaries (`url("image@2x.png")`, `content: "@dark"`, `calc()`, comments, escapes), parser recovery, nested selectors, variables/import cycles, runtime tokens, media combinations, naming and output planning. Golden fixtures contain input, expected CSS, JS, declarations and diagnostics. Test valid native CSS pass-through and unsupported constructs. Property-based/fuzz tests for parser termination and malformed input. Snapshot deterministic output; parse generated CSS with independent tooling.

Playwright tests in Chromium, Firefox and WebKit: verify computed styles at 320, 767, 768, 1279, 1280px; light/dark, reduced motion, hover/focus/disabled, combined conditions, overlapping selectors and specificity. Compare safe grouping on/off and minified/pretty computed styles. Minification tests preserve quoted strings, custom values, `calc()` spacing, at-rule prelude whitespace, source-map mappings, and declaration order. Test generated JS imports and TS type checking in a sample JSX project. Test output paths on macOS/Linux/Windows CI, collisions, permission failures, stale files and watch invalidation. VS Code extension-host integration tests cover activation, completions, diagnostics, commands and trust behavior.

Quality gates: typecheck, lint, unit tests, golden tests, browser tests, Node CLI smoke test, extension package smoke test. Benchmark 100 and 1,000 source files; record cold build, incremental build, completion latency and memory. Initial targets (measure before promising): completion under 100ms for cached ordinary files; single-file incremental compile under 100ms excluding filesystem overhead. No silent invalid CSS or unsafe writes.

## 10. Execution roadmap and agent delegation

| Phase | Work | Depends on | Exit criteria |
|---|---|---|---|
| P0 | Freeze grammar, cascade, output and naming contracts; ADRs | none | Reviewed examples and acceptance fixtures |
| P1 | Workspace, AST, lexer, parser, diagnostics | P0 | Parser tests and recovery pass |
| P2 | Media lowering, nesting, CSS generator | P1 | Golden and browser cascade tests pass |
| P3 | Variables, imports, runtime tokens | P1 | Module graph and cycle tests pass |
| P4 | Class naming, JS/types, output planner | P1, P0 | Custom output and JSX tests pass |
| P5 | CLI, project graph, watcher, manifest | P2–P4 | End-to-end build/check/watch pass |
| P6 | VS Code grammar, providers, commands | P1; integrate P5 | Extension-host smoke tests pass |
| P7 | Source maps, formatting, performance, docs, release | P5–P6 | Full quality gates pass |

Parallelize P2/P3 and then P4/grammar work where interfaces are frozen. Suggested rough focused effort: 3–6 weeks for a usable MVP; production-quality CSS compatibility and language intelligence can take substantially longer. Do not treat estimates as deadlines.

### Agent execution protocol

Lead orchestrator owns architecture, contracts, integration and final verification. Use up to two concurrent implementation workers with disjoint file ownership. Assign DeepSeek implementation tasks and GLM browser/DOM validation if available in your configured tooling; model selection is configurable, not a compiler dependency. Give each task its own `.ai/tasks/<id>.md` and `.ai/reports/<id>.md`, never a shared mutable TASK file. Use isolated branches/worktrees where appropriate. Do not let workers change shared interfaces without lead approval. Each task specifies objective, dependencies, owned files, constraints, examples, tests and acceptance criteria. Workers report changed files, commands, actual results and unresolved issues. Lead reviews diff, independently runs gates, resolves conflicts and updates progress. Never mark a phase complete based solely on agent claims.

Suggested first tasks: A01 scaffold workspaces and CI; A02 freeze AST/diagnostic interfaces and fixtures; A03 lexer; A04 parser; A05 media IR; A06 selector lowering; A07 module resolver; A08 variable substitution; A09 class map; A10 output planner; A11 CLI/watch; A12 TextMate grammar; A13 completions/diagnostics; A14 browser verification; A15 release/docs. Schedule only when dependencies are satisfied.

## 11. Release and maintenance

Publish compiler/CLI independently of VS Code VSIX. Use semantic versioning; pre-1.0 syntax changes documented in changelog. Pin supported Node and VS Code versions after testing. Bundle extension with `@vscode/vsce`; test locally via Extension Development Host and VSIX installation. Include license, README, examples, config schema, migration notes and known limitations. No telemetry by default. CI validates package tarballs and generated artifacts. Avoid claiming full CSS compatibility until tested; maintain a compatibility matrix.

## 12. Future features

Container aliases, reusable declaration groups (`@group`/`@apply`), attribute-based theme conditions, inline pseudo-state modifiers, explicit token defaults, file-scoped/hash naming, shared runtime token bundles, richer native CSS support, LSP, cross-language rename and safe advanced optimization. Each requires an ADR and regression fixtures before implementation.

## 13. Definition of done for MVP

- [ ] Source language and documented cascade contract are stable.
- [ ] Inline and block media conditions compile correctly without manual grouping.
- [ ] Nested selectors and variables/imports work with actionable errors.
- [ ] Prefixing, JS class maps and TypeScript declarations work in JSX.
- [ ] Independent CSS and map output directories and optional names work, including relative CSS imports.
- [ ] Compiler runs independently of VS Code on supported Node and Bun environments.
- [ ] CLI build/check/watch and output safety tests pass.
- [ ] VS Code highlights, completes, diagnoses and previews Chikx.
- [ ] Browser computed-style tests pass and output is deterministic.
- [ ] Documentation, examples and release artifacts are reproducible.

## 14. Starting instruction for the orchestrator

Read this master plan completely. Inspect the existing repository before changing files. Identify any contradictions or missing decisions and record them in ADRs; ask the project owner only about decisions that materially change the language or public API. Convert phases into dependency-aware tasks with explicit acceptance criteria. Begin with P0 and P1; do not implement the extension before the compiler contract is established. Maintain a progress file and independently verify every completed task. Preserve the property-centric syntax and independent output configuration as core product requirements. Do not introduce a browser runtime or mandatory frontend framework.
