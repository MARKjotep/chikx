# Custom output example

Two entries in one project with independent output directories, explicit basenames and one entry
that emits no CSS.

| Entry | CSS | Class map | Notes |
|---|---|---|---|
| `src/panel.cssx` | `generated/styles/theme.css` + `theme.css.map` | `generated/maps/classes.js` + `.d.ts` | `css-name: "theme.css"`, `map-name: "classes.js"`, `source-map: true`; the map imports `../styles/theme.css` |
| `src/plain.cssx` | — | `generated/maps/plain.js` + `.d.ts` | `emit-css: false`, `import-css: false` |

## Build

```sh
bun packages/cli/src/index.ts build --config examples/custom-output/chikx.config.json
```

or `cd examples/custom-output && chikx build`.

## What it demonstrates

- `css-dir`/`map-dir` are resolved relative to the **source file** for `@setup`; the directories are
  exact and are not mirrored per entry.
- `css-name` and `map-name` are basenames only. `classes.js` yields `classes.d.ts`; `theme.css` with
  `source-map: true` yields `theme.css.map`, and the emitted CSS ends with
  `/*# sourceMappingURL=theme.css.map */`.
- `emit-css: false` requires `import-css: false`; the planner rejects the inconsistent combination.
  The map for `plain.cssx` therefore has no CSS side-effect import, while it still exports its
  class names and declarations.
- Output planning validates every destination before writing: no input/output overlap, no
  traversal, no workspace escape, no duplicate targets. See
  [docs/configuration.md](../../docs/configuration.md).

Artifacts under `generated/` are committed, byte-stable CLI output.
