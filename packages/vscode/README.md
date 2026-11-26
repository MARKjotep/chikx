<p align="center"><img src="media/icon.png" alt="Chikx chick logo" width="128" height="128"></p>

# Chikx for VS Code

Language support for [Chikx](../../README.md), the CSS-first, property-centric stylesheet language.
The extension uses the same `@chikx/compiler` as the CLI and build tools; it adds no runtime
dependency to your project.

Chikx source files use the `.cssx` extension; the language ID stays `chikx`, and `.cssx` files get a
chick file icon in both light and dark themes ([ADR-0013](../../docs/decisions/ADR-0013-cssx-file-extension.md)).

## Features

- **Language registration** — `.cssx` files, language ID `chikx`, comments, brackets, auto-closing
  pairs and indentation.
- **Syntax highlighting** — a standalone TextMate grammar (`source.chikx`) covering directives,
  media aliases, `$tokens` and namespace members, selectors, properties, values, `!important` and
  native at-rules. CSS-compatible patterns reuse standard `.css` scopes, so existing themes work.
- **Diagnostics** — tolerant parse plus an in-memory compile, debounced at 150 ms with stale document
  versions discarded; stable `CHIKX####` codes and exact spans. Imported-file problems are logged
  rather than shown at the wrong offsets.
- **Completions** — property names, common values, `@` media aliases (built-in, project config and
  file `@media-types`), `$` tokens and namespace members, `@setup` keys, `@use "` import paths,
  nested selectors, pseudo-classes and the document's own id selectors after `#` (ids are
  document-global and are never renamed or mapped).
- **Navigation and insight** — hover for resolved token values, media conditions and generated class
  names; definition and references for tokens; single-file `$token` rename; color provider; outline.
- **Commands** (all under the `Chikx` category) — Compile File, Build Project, Preview Compiled CSS,
  Open Generated CSS, Open Class Map, Check Project.
- **Preview** compiles in memory to a read-only `chikx-preview:` document and never writes.
- **Status bar and output channel** — idle/success/error/stale state and a log of paths and problems.

## Token colors

The extension classifies five kinds of Chikx token with VS Code's semantic-token API. Declaration
sites (`@variables` / `@runtime` names and the left side of `--x:`) keep their property-name styling;
references get the kind's colour — with no configuration needed:

| Kind | Colours | Fallback scope | Default (2026 Dark) | Dark+ | Light+ |
|---|---|---|---|---|---|
| `variable` | compile-time `$token` references and resolved compile-time namespace members | `variable.language` | `#79C0FF` | `#569CD6` | `#0000FF` |
| `namespace` | the `$ns` prefix of `$ns.member` (including `$keyframes`) | `entity.name.type` | `#4EC9B0` | `#4EC9B0` | `#267F99` |
| `runtimeVariable` | `$name` declared in `@runtime`, and runtime namespace members | `keyword.control` | `#C586C0` | `#C586C0` | `#AF00DB` |
| `customProperty` | `--var` references, including inside `var()` | `keyword.control` | `#C586C0` | `#C586C0` | `#AF00DB` |
| `keyframe` | a resolved `$keyframes.<name>` member | `entity.name.function` | `#D2A8FF` | `#DCDCAA` | `#795E26` |
| media variant | `@md`, `@xl+dark`, `@dark {` and `@media-types` captions | `markup.deleted` | `#FFA198` | `#CE9178` | `#A31515` |

The first five rows are semantic token kinds mapped by `contributes.semanticTokenScopes`; the media
variant row is the TextMate scope used by the grammar's three variant rules (inline value variants,
block variant headers and `@media-types` captions), so it is painted even before analysis completes.
The `markup.deleted` family was chosen empirically: it is distinct from `constant.numeric` (pale
green), `variable.language` (blue), `entity.name.type` (teal), `keyword.control` (magenta) and the
`entity.name.function` keyframe colour in all three shipped themes (minimum ΔE 35), with contrast
9.6:1 / 6.3:1 / 7.9:1 on the 2026 Dark, Dark+ and Light+ backgrounds. Tradeoff: Dark+ and Light+ use
the same hex for strings, so quoted values and variant markers share a hue there; they remain
different constructs and all five mapped kinds stay distinct.

Colours follow the active theme; the values above are what the built-in themes resolve, and other
themes may differ. Text the classifier cannot resolve (before analysis finishes, or after a parse
error) uses the same scope fallback.

To pin exact colours regardless of theme, add the rules to your user or workspace `settings.json`.
These rules outrank the scope fallback:

```json
{
  "editor.semanticHighlighting.enabled": true,
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "variable": "#4C8DF8",
      "namespace": "#4EC9B0",
      "runtimeVariable": "#D6409F",
      "customProperty": "#D6409F",
      "keyframe": "#D18616"
    }
  }
}
```

Use **Developer: Inspect Editor Tokens and Scopes** on a token to confirm which rule is winning.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `chikx.compileOnSave` | `false` | Compile the saved file and write its outputs. Off by default; requires a trusted workspace. |
| `chikx.previewSplitEditor` | `true` | Open preview beside the editor instead of replacing it. |

Compile/Build write through the compiler's `planOutputs` (validated destinations, temp-file plus
rename) and are blocked in Restricted Mode. Diagnostics, completion, hover, preview and Check Project
are read-only and work in Restricted Mode. No watcher is started by the extension: use one writer
(the CLI watcher or `compileOnSave`, not both).

Multi-root workspaces resolve the nearest `chikx.config.json` per document within its workspace
folder. Cross-module rename and class rename across JSX are not supported yet; use the generated
class map as the source of truth.

## Build and test

```sh
bun run typecheck                     # tsc --noEmit (moduleResolution: "bundler")
bun run build                         # bun build → dist/extension.js + out/ shim
bun test tests/extension              # providers, TextMate scopes, extension host
```

`main` is `out/extension.js`, a two-line shim written by `scripts/write-entry.mjs`; the CommonJS
bundle (`vscode` external) is `dist/extension.js` because the repository Biome configuration ignores
`dist` but not `out`. Release packaging runs through the root `bun run release:check`.

Provider logic is pure and tested without the `vscode` module: `src/analysis.ts`,
`src/intelligence.ts` and `src/service.ts` take `{ text, path, version }` and use injectable timers.
The extension-host smoke suite (`tests/extension/host.test.ts`) runs `@vscode/test-electron` when a
VS Code build is cached under `node_modules/.vscode-test-chikx` (or when
`CHIKX_EXTENSION_HOST_DOWNLOAD=1` allows a one-off download); otherwise it skips with that exact
reason rather than faking a pass.

VS Code 1.147 renamed the macOS launcher from `Electron` to `Code`. `@vscode/test-electron 2.5.2`
does not handle that rename, so the orchestrator resolves the executable itself and passes
`vscodeExecutablePath`.

## Grammar scopes

| Construct | Scope |
|---|---|
| Media alias (`@md`, `@2xl`, `@xl+dark`) | `markup.deleted.chikx` (inside `meta.variant.chikx`) |
| Directive (`@setup`, `@use`, `@variables`, `@runtime`, `@media-types`) | `keyword.control.directive.chikx` |
| `as` in `@use` | `keyword.other.chikx` |
| Class / id / tag / pseudo-class / pseudo-element | `entity.other.attribute-name.class.css`, `.id.css`, `entity.name.tag.css`, `.pseudo-class.css`, `.pseudo-element.css` |
| Parent `&` / combinators | `entity.other.attribute-name.parent-selector.css` / `keyword.operator.combinator.css` |
| Property / value constant | `support.type.property-name.css` / `support.constant.property-value.css` |
| `$var`, `$ns.member` | `variable.other.chikx`, member `variable.other.member.chikx` |
| Number and unit | `constant.numeric.css` + `keyword.other.unit.css` |
| `!important` | `keyword.other.important.css` |
| Native at-rules | `keyword.control.at-rule.css` + `meta.at-rule.<name>.css` |
| Punctuation | `punctuation.section.block.css`, `punctuation.definition.group.css`, `punctuation.terminator.rule.css` |

## Known gaps

- Formatting is whole-document only: **Format Document** and `chikx.editor.formatOnSave` run the
  compiler formatter; there is no range formatting or format-on-type.
- No CSS language-service projection: property hover and value/property completions use the built-in
  one-sentence property table and curated value lists, not the full `vscode-css-languageservice` data.
- Preview documents are keyed by basename, so two same-named files share one preview URI (reopening
  refreshes it).
- Cross-module rename is refused with guidance; class rename across JSX is future work.

## License

MIT © Marky.
