# Configuration reference (v0.1)

Chikx output is configured at three layers: per-file `@setup`, per-project `chikx.config.json`, and a
small set of explicit CLI flags. The normative definition is [SPECIFICATION.md](../SPECIFICATION.md)
§9–§10. This page is the practical reference.

## 1. Precedence

```text
built-in defaults  <  project chikx.config.json  <  file @setup  <  explicit CLI overrides
```

- `--minify` / `--no-minify` are the only output overrides the current CLI exposes. They win over
  both project config and file `@setup`. When a file authors a conflicting `minify` value, the CLI
  recompiles that entry with the flag and prints an informational warning such as
  `setup minify false overridden by CLI flag (--minify).`
- CLI path overrides are specified as single-entry only; no path flags are implemented yet.
- Unknown `@setup` keys and duplicate settings are always errors (`CHIKX1001`). Unknown
  `chikx.config.json` keys are errors when `compiler.strict` is `true` and warnings otherwise.
- Class prefix precedence:
  - `compile()` API: `options.prefix` → `options.naming.prefix` → file `@setup prefix` → `""`.
  - `compileProject()` / CLI: file `@setup prefix` wins over project `classes.prefix`.
  - `classes.strategy: "none"` (API `naming.strategy`) disables prefixing entirely, whatever
    `prefix` says.

## 2. `@setup` keys

`@setup` is top-level only. Several blocks are merged in document order; a key may appear only once
across all of them. String values are CSS-string decoded; booleans must be `true` or `false`.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `prefix` | string | `""` | Class-name prefix. `ui` turns `card` into `ui-card`; empty leaves names unchanged. |
| `css-dir` | string | source directory | CSS output directory, resolved relative to the source file. Exact — no mirrored subfolders. |
| `css-name` | string | `<stem>.css` | CSS basename. Must end in `.css`; no separators or traversal. |
| `map-dir` | string | source directory | Class-map output directory, resolved relative to the source file. |
| `map-name` | string | `<stem>.map.js` | Class-map basename. Must end in `.js`; declarations become `<stem>.d.ts`. |
| `emit-css` | boolean | `true` | Write the stylesheet. |
| `emit-map` | boolean | `true` | Write the JS class map. |
| `emit-types` | boolean | `true` | Write `.d.ts` beside the JS map. Suppressed with a warning when `emit-map` is false. |
| `source-map` | boolean | `false` | Write a CSS v3 source map (`<css-name>.map`) beside the stylesheet. |
| `import-css` | boolean | `true` | Add a relative CSS side-effect import to the JS map. Must be `false` when `emit-css` is `false`. |
| `minify` | boolean | `false` | Compact generated structural whitespace; authored tokens and declaration order are preserved. |

Example:

```chikx
@setup {
  prefix: "dashboard";
  css-dir: "../styles";
  css-name: "dashboard.css";
  map-dir: "../modules";
  map-name: "dashboard.map.js";
  emit-css: true;
  emit-map: true;
  emit-types: true;
  source-map: false;
  import-css: false;
  minify: false;
}
```

## 3. `chikx.config.json`

```json
{
  "include": ["src/**/*.cssx"],
  "exclude": ["node_modules", "dist", "generated"],
  "output": {
    "cssDir": "dist/styles",
    "mapDir": "dist/maps",
    "emitCss": true,
    "emitMap": true,
    "emitTypes": true,
    "sourceMap": false,
    "importCss": true,
    "minify": false
  },
  "classes": { "strategy": "prefix", "prefix": "ui" },
  "media": { "md": "(min-width: 768px)", "xl": "(min-width: 1280px)" },
  "compiler": { "strict": true, "mediaGrouping": "safe" }
}
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `$schema` | string | — | Accepted and ignored, so editors can validate the document. |
| `include` | string[] | required for project builds | Entry globs. Missing or empty in project mode exits 2. Optional for single-file mode. |
| `exclude` | string[] | `[]` | Glob patterns and directory names removed from discovery. `node_modules` and `.git` are never walked. |
| `output.cssDir` | string | source directory | Project CSS directory, relative to the workspace root. Mirrors the source path (see §4). |
| `output.cssName` | string | `<stem>.css` | Project default CSS basename. |
| `output.mapDir` | string | source directory | Project class-map directory. |
| `output.mapName` | string | `<stem>.map.js` | Project default class-map basename. |
| `output.emitCss` | boolean | `true` | See the emit-flag rules in §5. |
| `output.emitMap` | boolean | `true` | See §5. |
| `output.emitTypes` | boolean | `true` | See §5. |
| `output.sourceMap` | boolean | `false` | See §6. |
| `output.importCss` | boolean | `true` | See §5. |
| `output.minify` | boolean | `false` | Compact CSS output. |
| `classes.strategy` | `"prefix"` \| `"none"` | `"prefix"` | Naming strategy. |
| `classes.prefix` | string | `""` | Prefix used by the `prefix` strategy. |
| `media` | object | `{}` | Alias overrides merged after built-ins and before file `@media-types`. |
| `compiler.strict` | boolean | `false` | Reject unknown configuration keys (error instead of warning). |
| `compiler.mediaGrouping` | `"safe"` \| `"none"` | `"safe"` | Safe grouping of adjacent compatible runs. |

### Kebab-case ↔ camelCase mapping

| Source `@setup` | JSON key |
|---|---|
| `prefix` | `classes.prefix` |
| `css-dir` | `output.cssDir` |
| `css-name` | `output.cssName` |
| `map-dir` | `output.mapDir` |
| `map-name` | `output.mapName` |
| `emit-css` | `output.emitCss` |
| `emit-map` | `output.emitMap` |
| `emit-types` | `output.emitTypes` |
| `source-map` | `output.sourceMap` |
| `import-css` | `output.importCss` |
| `minify` | `output.minify` |

`output.prefix` is not a schema key; class naming lives under `classes` so strategy and prefix stay
together. Writing `output.prefix` is an unknown key (`strict`: error).

### Discovery and workspace root

- **Project mode** (`chikx build`, no file argument): the CLI walks up from the working directory to
  the nearest `chikx.config.json`; `--config <path>` overrides the walk. The config directory is the
  workspace root. No config means exit 2 — there are no include globs to expand.
- **Single-file mode** (`chikx build src/button.cssx`): the nearest config is still used if found;
  otherwise the nearest ancestor `package.json` (else the file's directory) is the workspace root
  ([ADR-0007](decisions/ADR-0007-workspace-root-and-containment.md)).
- Globs support `*` (within a segment), `**` (across segments; `**/` also matches zero segments),
  `?` and `{a,b}`. Character classes are literal. Discovery only considers `.cssx` files, never
  walks `.git`/`node_modules`, skips symlinks, and sorts entries deterministically.
- Multi-root VS Code workspaces resolve the nearest config per file, bounded by the workspace folder.

## 4. Paths, names and collisions

- File-level directories resolve **relative to the source file** and are used exactly:
  `css-dir: "../styles"` in `src/button.cssx` writes `styles/button.css`.
- Project-level directories resolve **relative to the workspace root** and mirror the source path
  relative to the workspace root. With `include: ["src/**/*.cssx"]` and `cssDir: "dist/styles"`,
  `src/deep/widget.cssx` writes `dist/styles/src/deep/widget.css`. This keeps same-named sources
  apart; it also means the `src/` segment is repeated under the output directory in v0.1 (a known
  gap, recorded in [known-limitations.md](known-limitations.md)).
- A file-level directory and a project-level directory can be mixed: the file value wins for that
  file.
- If only a directory is set, the default filename applies. If only a filename is set, the effective
  directory is retained.
- `css-name` must end in `.css`; `map-name` must end in `.js`. Both must be basenames: no `/`, `\`,
  `.`/`..`, NUL or traversal. Extension normalisation is not implemented.
- A CSS source map is named `<css-name>.map`; a JS map `classes.js` has declarations `classes.d.ts`.
- The same destination planned by two entries is a collision (`CHIKX5001`), as is a target that
  equals its own input source.

## 5. Emit-flag consistency rules

| Combination | Result |
|---|---|
| `emit-css: false` + `import-css: true` | **Error** `CHIKX5001`: the map cannot import a stylesheet that is not written. |
| `emit-css: false` + `import-css: false` | Valid. No CSS artifact; maps and declarations are still produced. |
| `emit-map: false` + `emit-types: true` | Types are suppressed and a `CHIKX5001` **warning** asks you to set `emit-types: false` explicitly. |
| `emit-map: false` + `emit-types: false` | Valid. No JS or declarations. |
| `source-map: true` + `emit-css: false` | No source map is planned or written. |
| `emit-css: false` | `compile()` omits `css`; class maps and declarations are still returned. |

`minify` only compacts generated structural whitespace. It preserves quoted strings, custom values,
`calc()` spacing, at-rule prelude whitespace and declaration order; it never changes computed styles.

## 6. Source maps

`source-map: true` (settings: `@setup`, project `output.sourceMap`, or API `options.sourceMap`)
writes a standard v3 CSS source map beside the stylesheet:

- file name: `<css-name>.map` in the same directory as the CSS (`theme.css` → `theme.css.map`);
- `file` names the emitted CSS basename; `sources` are workspace-relative Chikx paths;
  `sourcesContent` is included so the map is self-contained;
- the emitted CSS ends with `/*# sourceMappingURL=<css-name>.map */`;
- `CompileResult.sourceMap` carries the serialized JSON and the CLI writes it atomically and tracks
  it as a `cssSourceMap` manifest entry;
- no map is planned or written when `emit-css: false`.

Source maps are new in 0.1.0 and covered by `tests/compiler/sourcemap.test.ts` and
`tests/compiler/mapgen.test.ts`. They are distinct from the JS class map (`map-name`), which is a
runtime module, not a debugging artifact.

## 7. Safety and writing

Before anything is written, the whole output plan is validated with `planOutputs`:

- every destination must stay inside the workspace root (v0.1 has **no** trusted override for
  external output);
- a destination reached through a symlink that resolves outside the workspace root is rejected
  (`CHIKX5001`);
- a destination equal to its input source, or to another entry's target, is rejected;
- unknown setup keys, invalid booleans, bad basenames and inconsistent emit flags are rejected
  before generation.

Validated files are written atomically per file: a temp file in the destination directory, then a
rename. This is per-file atomicity, not cross-file transactionality. On failure the last successful
outputs are retained and reported as stale. The CLI records generated files in
`<workspaceRoot>/.cssx-manifest.json` (fixed location) and `chikx clean` deletes only
manifest-owned files whose hash still matches; externally modified files are reported and kept.
Obsolete owned outputs are pruned after a successful full build. Unrelated user files are never
deleted.

## 8. CLI flags relevant to configuration

| Flag | Effect |
|---|---|
| `--config <path>` | Use a specific `chikx.config.json`; the config directory becomes the workspace root. |
| `--minify` / `--no-minify` | Highest-precedence CSS compaction; the last flag wins. |
| `--check` | With `format`: list files that would change and write nothing; exits 1 when any would change. |
| `--dry-run` | Report work that would be written/deleted; nothing is written. |
| `--json` | Machine-readable results (NDJSON for `watch`). |

See the [README CLI section](../README.md#cli) for commands and exit codes.

## See also

- [grammar.md](grammar.md) — `@setup`, `@media-types` and directive syntax.
- [compatibility.md](compatibility.md) — supported features and gaps.
- [`examples/custom-output`](../examples/custom-output/) — independent directories, names and
  `emit-css: false`.
