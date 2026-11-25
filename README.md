# Chikx

Chikx is a CSS-first, property-centric stylesheet language. Responsive values, theme overrides and
nested selectors live beside their base declarations, and compile to ordinary CSS plus static
JavaScript class maps with optional TypeScript declarations and source maps. There is **no browser
runtime**, no framework dependency and no editor requirement: `@chikx/compiler` is pure TypeScript
with zero runtime dependencies, the `chikx` CLI drives it from Node or Bun, and the VS Code extension
is an interface to the same compiler.

Chikx is at **v0.1** (release candidate). It is an MVP with a deliberately small, honest feature set —
read [compatibility](docs/compatibility.md) and [known limitations](docs/known-limitations.md) before
adopting it. The normative language definition is [SPECIFICATION.md](SPECIFICATION.md); architecture
decisions are recorded in [`docs/decisions/`](docs/decisions/).

Source files use the `.cssx` extension; the language ID, packages, CLI command and `CHIKX####`
diagnostics keep the Chikx name ([ADR-0013](docs/decisions/ADR-0013-cssx-file-extension.md)).

## Canonical example

```chikx
@setup {
  prefix: "ui";
  css-dir: "../generated/styles";
  css-name: "button.css";
  map-dir: "../generated/maps";
  map-name: "button.map.js";
}
@use "./theme.cssx" as theme;
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

With `theme.primary = #2563eb`, `src/button.cssx` compiles to `generated/styles/button.css`,
`generated/maps/button.map.js` and `generated/maps/button.map.d.ts`. The CSS contains `.ui-button`,
`.ui-button > .ui-icon`, ordinary media queries and flattened pseudo-selectors:

```js
// generated/maps/button.map.js
import "../styles/button.css";
export const button = "ui-button";
export const icon = "ui-icon";
export default { button, icon };
```

```tsx
// app code
import styles from "../generated/maps/button.map.js";
export function Button() {
  return <button className={styles.button}>Continue</button>;
}
```

The complete, committed output is in [`examples/basic/`](examples/basic/).

## Install

```sh
bun add @chikx/compiler        # programmatic compiler API
bun add -d @chikx/cli          # the chikx CLI (build, check, watch, clean)
```

Requires Node.js ≥ 20 or Bun. The compiler is ESM and has no runtime dependencies; the CLI is ESM and
is run with `bunx chikx` (Bun) or `node <path>/dist/index.js` (the package `bin` entry currently
relies on Bun's TypeScript loader — see [known limitations](docs/known-limitations.md#2-release-and-packaging-gaps)).

## Quick start

1. **Write** `src/button.cssx` using the example above.
2. **Configure the project** with `chikx.config.json` (optional for a single file):

   ```json
   {
     "include": ["src/**/*.cssx"],
     "exclude": ["src/theme.cssx", "node_modules", "dist", "generated"],
     "compiler": { "strict": true, "mediaGrouping": "safe" }
   }
   ```

3. **Build**:

   ```sh
   bunx chikx build            # project build from include globs
   bunx chikx build src/button.cssx
   bunx chikx watch            # rebuild changed entries until interrupted
   bunx chikx check            # diagnostics only; never writes
   bunx chikx format           # canonical source formatting (--check to report only)
   bunx chikx clean            # delete only compiler-owned, unmodified outputs
   ```

4. **Use the map in JSX** by importing the generated module as shown above. The `.d.ts` next to it
   gives literal types such as `"ui-button"`; the runtime value is a plain string, so no helper or
   client runtime is involved.

To build from a source checkout instead of the published packages:

```sh
bun install
bun run --cwd packages/compiler build
bun run --cwd packages/cli build
node packages/cli/dist/index.js build --config examples/basic/chikx.config.json
```

## Output configuration

File-level `@setup` controls one stylesheet. Project-level `chikx.config.json` sets defaults and
entry globs. Precedence is **defaults < project config < file `@setup` < explicit CLI flags**.

| Setting | Default | Meaning |
|---|---|---|
| `prefix` | `""` | Class-name prefix (`ui` → `ui-card`). |
| `css-dir` / `output.cssDir` | source directory | CSS output directory. |
| `css-name` / `output.cssName` | `<stem>.css` | CSS basename. |
| `map-dir` / `output.mapDir` | source directory | Class-map directory. |
| `map-name` / `output.mapName` | `<stem>.map.js` | Class-map basename (`classes.js` → `classes.d.ts`). |
| `emit-css` / `output.emitCss` | `true` | Write the stylesheet. |
| `emit-map` / `output.emitMap` | `true` | Write the JS class map. |
| `emit-types` / `output.emitTypes` | `true` | Write `.d.ts` beside the map. |
| `source-map` / `output.sourceMap` | `false` | Write a CSS v3 source map beside the stylesheet. |
| `import-css` / `output.importCss` | `true` | Add a relative CSS import to the map; must be `false` when CSS is disabled. |
| `minify` / `output.minify` | `false` | Compact generated whitespace, preserving tokens and order. |

`@setup` directories resolve relative to the source file and are exact. Project directories resolve
relative to the workspace root and mirror the source path. Full details, safety rules and examples:
[docs/configuration.md](docs/configuration.md).

## CLI

| Command | Behaviour |
|---|---|
| `chikx build [file]` | Project build from config include globs, or one file. Writes artifacts + manifest. |
| `chikx check [file]` | Same compilation and diagnostics, **never writes**. |
| `chikx watch [file]` | Initial build, then incremental rebuilds until SIGINT/SIGTERM. |
| `chikx clean` | Deletes only manifest-owned files whose hash still matches. |
| `chikx format [file]` | Reformats sources canonically in place; `--check` lists files that would change and writes nothing; parse errors never rewrite a file. |
| `chikx --help`, `chikx --version` | Usage / version, exit 0. |

Flags: `--config <path>`, `--json`, `--dry-run`, `--minify`, `--no-minify` (last wins), `--check`
(`format` only), `-h/--help`, `-v/--version`. `--json` emits JSON for build/check/clean/format and
NDJSON for watch.

| Exit | Meaning |
|---|---|
| `0` | Success (warnings allowed; `check` with no errors). |
| `1` | Compile/validation/formatting error, write or manifest failure, or `format --check` found changes. |
| `2` | Invocation or configuration error: unknown flag/command, missing config, invalid schema. |

## VS Code extension

The extension (`packages/vscode`) registers the `chikx` language and `.cssx` files with a standalone
TextMate grammar, language configuration and a chick file icon in light and dark themes. It provides:

- syntax highlighting for directives, aliases, `$tokens`, selectors, values and native at-rules;
- diagnostics from the tolerant parser and an in-memory compile, with exact spans and CHIKX codes;
- completions for properties, values, `@` aliases (built-in, project and `@media-types`), `$` tokens
  and namespace members, setup keys, import paths, nested selectors and pseudo-classes;
- hover for resolved tokens, media conditions and generated class names; definition, references,
  single-file token rename, colors and outline;
- commands **Compile File**, **Build Project**, **Preview Compiled CSS** (in memory, never writes),
  **Open Generated CSS**, **Open Class Map**, **Check Project**, plus a status bar and output
  channel;
- **compile on save is off by default** and only runs in a trusted workspace. Writing commands are
  blocked in Restricted Mode; no watcher is started by the extension.

Tested on VS Code 1.147.0 (manifest declares `^1.85.0`). See
[`packages/vscode/README.md`](packages/vscode/README.md).

## Testing and quality gates

```sh
bun run typecheck     # compiler, CLI and language-service packages
bun run lint          # Biome
bun test              # unit + integration + extension/provider suites
bun run verify        # typecheck && lint && test (the aggregate gate)
bun run test:browser  # Playwright computed-style cascade gate (Chromium required)
bun run benchmark     # masterplan §9 measurements -> docs/performance.md
```

`bun run verify` currently passes with 679 tests across 41 files, including a real VS Code
extension-host smoke suite. Browser coverage: 75/75 Playwright tests recorded on Chromium, Firefox and
WebKit, checking viewport boundaries, light/dark, reduced motion, hover/focus/disabled, specificity,
safe grouping and pretty-vs-minified parity.

## Repository layout

```text
chikx/
  README.md / SPECIFICATION.md / CHANGELOG.md / LICENSE
  docs/                  grammar, cascade, configuration, compatibility, performance, ADRs
  examples/              basic, responsive, variables, jsx, custom-output, overrides
                         (built output committed)
  packages/
    compiler/            lexer, parser, resolver, transformer, generators (zero runtime deps)
    cli/                 build, check, watch, clean, config, output planner writer
    language-service/    shared editor analysis (no vscode import)
    vscode/              extension manifest, grammar, providers, commands
  scripts/benchmark.ts   masterplan §9 benchmark harness
  tests/                 compiler, integration, extension, browser (Playwright)
```

Dependency direction: VS Code → language service → compiler; CLI → compiler. The compiler core is
pure and filesystem-independent through an injected host.

## Documentation

- [SPECIFICATION.md](SPECIFICATION.md) — normative language and compiler specification.
- [docs/grammar.md](docs/grammar.md) — grammar, lexical rules, D1–D3.
- [docs/cascade.md](docs/cascade.md) — the cascade contract with worked examples and browser evidence.
- [docs/configuration.md](docs/configuration.md) — every `@setup` and `chikx.config.json` key.
- [docs/compatibility.md](docs/compatibility.md) — what is supported, what is not.
- [docs/performance.md](docs/performance.md) — measured benchmark numbers and machine context.
- [docs/known-limitations.md](docs/known-limitations.md) — operational gaps and release blockers.
- [docs/decisions/](docs/decisions/) — ADRs.
- [examples/](examples/) — six working examples with committed output.

## License

MIT © Marky. See [LICENSE](LICENSE).
