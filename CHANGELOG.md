# Changelog

All notable changes to Chikx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). Pre-1.0 syntax changes are called out explicitly.

## [Unreleased]

### Notes

- Source files use the `.cssx` extension; the language ID, packages, CLI command and diagnostics keep
  the Chikx name ([ADR-0013](docs/decisions/ADR-0013-cssx-file-extension.md)). `.chikx` files are not
  recognised.

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
