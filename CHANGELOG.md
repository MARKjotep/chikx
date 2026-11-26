# Changelog

All notable changes to Chikx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). Pre-1.0 syntax changes are called out explicitly.

## [Unreleased]

### Notes

- Source files use the `.cssx` extension; the language ID, packages, CLI command and diagnostics keep
  the Chikx name ([ADR-0013](docs/decisions/ADR-0013-cssx-file-extension.md)). `.chikx` files are not
  recognised.

### VS Code extension

- Semantic token colorization: compile-time `$token` references, runtime tokens and `--var`
  references, the `$ns` prefix of a namespaced reference (with the member colored by its resolved
  kind) and resolved `$keyframes.<name>` members are colored by the active theme with no
  configuration. `contributes.semanticTokenScopes` maps each kind to a common theme scope
  (`variable.language`, `entity.name.type`, `keyword.control`, `entity.name.function`); the extension
  README documents the literal `editor.semanticTokenColorCustomizations` palette as the override,
  which outranks the scope fallback (CSSX-COLOR-TOKENS).

### Fixed

- Formatter: an at-rule prelude that leaves a `[`/`(` open no longer reabsorbs the printed `;`, so
  `format` is a fixed point and the reparsed IR matches (CSSX-T01).
- Formatter: adjacent `@`-markers keep the authored variant split, so `format` no longer turns one
  variant into two (CSSX-T02).
- Compiler: an invalid `$` setup prefix no longer produces a `CHIKX2001` span past the end of the
  source; generated `$` text is not re-reported as an authored reference (CSSX-T03).
- Compiler: `&` flattening is bounded per rule at 8 388 608 characters / 100 000 selectors, failing
  one over-budget rule with a single `CHIKX1001` that names the nesting depth instead of hanging
  (CSSX-T04).
- Formatter: the authored `$` sigil is re-emitted for namespaced token declarations
  (`$layout.margin`), so formatting no longer loses the declaration (CSSX-T05).
- Compiler and editor: a single-file document with duplicate `@variables`/`@runtime` keys or a
  compile-time/runtime name collision now reports exactly one `CHIKX2001`, and a token rename onto an
  existing name is refused before any edit (CSSX-U04).
- CLI: `watch` latches wakeups that arrive mid-build and always records the artifacts that landed, so
  edits are not dropped and the manifest matches the tree (CSSX-T06).
- CLI: `build` and `clean` sweep the writer's own `.<artifact>.<pid>.<n>.cssx-tmp` pattern, so an
  interrupted build leaves no residue (CSSX-T07).
- CLI: a newly created nested source directory triggers rediscovery and is watched without a restart
  (CSSX-T08).
- CLI: a project whose include globs match no `.cssx` file is a configuration error — exit 2 with the
  text and JSON diagnostics — instead of a silent green build (CSSX-T09).
- CLI: `clean` only deletes records that are artifact-shaped and point at an in-workspace `.cssx`
  source, closing the manifest-provenance delete primitive (CSSX-T10).
- CLI: a value flag no longer consumes a following option, so `--config --json` reports a missing
  path (as JSON when `--json` came first) (CSSX-T11).
- CLI: `check --dry-run` is rejected with exit 2 instead of being silently ignored (CSSX-T12).
- Editor: `@group`/`@keyframes` closures in cyclic import graphs are resolved in sorted canonical-path
  order through the shared memo, matching the compiler's visibility (CSSX-T13).
- Editor: the `$`-namespace completion item is `$theme.` (label and insert), preserving the sigil when
  accepted (CSSX-U01).
- Editor: nested-selector starters replace a typed lone `&`, so accepting `&:hover` yields `&:hover`,
  never `&&:hover` (CSSX-U02).
- Editor: a `&.` class context lists class names only, so accepting one keeps the typed dot
  (CSSX-U03).
- Editor: `$tokens` inside `@group` definition and use-site bodies now have hover, definition,
  references and rename (CSSX-U05).
- Editor: `Preview Compiled CSS` on a document with no producible CSS shows the existing warning and
  opens no empty preview tab (CSSX-U06).
- Editor: typing `!` after a declaration value suggests `!important`, and accepting it repairs the
  typed bang instead of stacking a second one; `!im` filters to the item, while selectors,
  property-name positions and empty values offer nothing (CSSX-U07).

## [0.1.0] - 2026-11-25

First public MVP. CSS-first, property-centric stylesheets compiling to ordinary CSS plus static
JavaScript class maps and TypeScript declarations.

### Naming

- Renamed the source file extension from `.chikx` to `.cssx` (owner decision, ADR-0013). Fixtures,
  examples, CLI defaults, the `.cssx-manifest.json` bookkeeping file and all documentation follow.
- Extension identity: marketplace name `chikx`, version `0.1.0`, chick logo and `.cssx` light/dark file
  icons; package-level `README.md`/`LICENSE` copies for the compiler and CLI tarballs.

### Language

- `@setup` with independent CSS/map directories, optional basenames, emit flags, prefix and
  minification.
- Inline media variants (`padding: 8px @md 16px`) and rule-scoped conditional blocks, including
  combined aliases (`@xl+dark`, logical AND).
- Default aliases `sm`, `md`, `lg`, `xl`, `2xl`, `dark`, `light`, `portrait`, `landscape`, `print`,
  `reduced`; project `media` and file `@media-types` overrides merged by key.
- Nested selectors: `&:hover`, `&::before`, `&:nth-child()`, `& > .icon`, `& + .button`, compound
  classes and bare descendant nesting (D1). Mixed-specificity parent lists use `:is(...)`.
- Compile-time `@variables` with token-sequence substitution, forward references and cycle
  detection; `@use` imports with optional namespaces, workspace containment and no implicit
  re-export.
- `@runtime` custom properties with conditional overrides and `var(--prefix-name)` references.
- Class prefixing (`none` and `prefix` strategies), simple `:global(.class)` escapes, deterministic
  class maps with camelCase aliases, literal types and `__proto__` safety.
- Owner-locked decisions: bare nested selectors are descendants (D1), `!important` binds per inline
  segment (D2), conditional blocks are rule-scoped (D3).
- Opt-in CSS minification that preserves authored tokens and declaration order.
- Native at-rule pass-through: `@media`, `@supports`, `@layer`, `@container`, `@keyframes`,
  `@font-face`, `@property`, `@page`, plus statement at-rules. Chikx transformations inside
  restricted contexts are rejected with diagnostics.
- Source-preserving cascade: base then variants in authored order, no reordering, safe adjacent
  grouping only.

### Compiler API (`@chikx/compiler`)

- Public `parse`, `compile`, `compileProject` and `planOutputs`, returning artifacts and diagnostics
  without writing files; zero runtime dependencies; Node ≥ 20 and Bun.
- Opt-in CSS v3 source maps (`source-map: true`) with `sourcesContent`, workspace-relative sources and
  a `sourceMappingURL` comment; `CompileResult.sourceMap` carries the serialized map.
- Injected `ModuleHost` (default Node host exported) and canonical-path containment.
- Frozen, immutable AST/IR and deterministic output; spans preserved for diagnostics and tooling.
- Stable `CHIKX####` diagnostic families: syntax, symbols/modules, media, naming, output planning.
- Output planning validates overlap, duplicates, workspace and symlink escapes before writes.

### CLI (`@chikx/cli`)

- `chikx build`, `check`, `watch`, `clean`, `format`.
- `chikx format [file]` reprints sources canonically in place; `--check` reports without writing and
  exits 1 on changes, `--dry-run` reports the same; parse errors leave the file untouched.
- `chikx.config.json` discovery and schema validation (strict unknown-key rejection), zero-dependency
  include/exclude globs, kebab↔camel configuration mapping.
- Atomic per-file writes, `.cssx-manifest.json` ownership, safe `clean`, stale-build handling and
  retained last-good outputs on failure.
- Debounced watch with reverse import graph, config reload, deleted-entry pruning, stale-generation
  guard and NDJSON output.
- Exit codes `0` success, `1` compile/validation/write error, `2` invocation/config error.
- `--config`, `--json`, `--dry-run`, `--minify`, `--no-minify`, `--help`, `--version`; CLI minify
  flags override file `@setup` with a warning.
- Node compatibility smoke tests run the built `dist` CLI under plain Node.

### VS Code extension

- `chikx` language ID, `.cssx` files, standalone TextMate grammar and language configuration
  (comments, brackets, auto-closing, indentation); chick marketplace icon and light/dark `.cssx` file
  icons.
- Diagnostics from a tolerant parse plus in-memory compile, debounced, with stale-document discard
  and imported-file problem routing. `@setup { module: true }` is understood (ADR-0014).
- Completions for properties, values, media aliases, `$` tokens and namespace members, setup keys,
  import paths, selectors and pseudos; hover, definition, references, single-file token rename,
  colors and outline.
- Commands: Compile File, Build Project, Preview Compiled CSS (in memory), Open Generated CSS, Open
  Class Map, Check Project; status bar, `Chikx` output channel, multi-root config resolution.
- Workspace-trust respect and compile-on-save **off by default**.
- Extension-host smoke suite via `@vscode/test-electron` with a documented macOS launcher workaround.

### Verification

- Unit, integration, golden, Node smoke and extension-provider suites; aggregate `bun run verify`.
- Playwright computed-style gate on Chromium, Firefox and WebKit: 75/75 recorded pass across viewport
  boundaries, themes, reduced motion, interactions, specificity, safe grouping and minified parity.
- Masterplan §9 benchmarks for 100 and 1,000 files recorded in `docs/performance.md`.

### Documentation and examples

- Full README, grammar, cascade, configuration, compatibility, performance and known-limitations
  documentation; ADRs 0001–0014, including the `.cssx` source-extension decision (ADR-0013).
- Five buildable examples with committed generated output: `basic`, `responsive`, `variables`, `jsx`,
  `custom-output`.
- `release:check` aggregate script for verify, browser tests, tarball checks, example builds and
  extension packaging.

### Known issues

- The VS Code extension has no formatting provider yet (use `chikx format` in the CLI).
- Project-level output directories repeat the workspace-relative source path (for example
  `dist/styles/src/…`).
- No mixins, container aliases, inline pseudo-state modifiers, hashing or file-scoped naming.
