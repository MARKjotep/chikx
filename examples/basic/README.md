# Basic example

The canonical Chikx stylesheet from [SPECIFICATION.md](../../SPECIFICATION.md) §2: one entry, a
token-only `@use` module, inline media variants, nested pseudo-selectors and a child selector, with
independent CSS and class-map output directories.

```text
basic/
  chikx.config.json        project entries (src/**/*.cssx, theme excluded)
  src/button.cssx         the canonical example, byte-for-byte
  src/theme.cssx          token-only module ($theme.primary)
  generated/styles/button.css
  generated/maps/button.map.js
  generated/maps/button.map.d.ts
```

`generated/` is committed output produced by the CLI, not hand-written CSS. It is deterministic:
rebuilding rewrites identical bytes.

## Build

From the repository root:

```sh
bun packages/cli/src/index.ts build --config examples/basic/chikx.config.json
```

Or from this directory with an installed `chikx` CLI:

```sh
cd examples/basic && chikx build
```

## What it demonstrates

- `@setup` with `prefix`, independent `css-dir`/`map-dir` and explicit basenames.
- `@use "./theme.cssx" as theme` namespaced compile-time tokens.
- Inline variants (`padding: $spacing @md 20px @xl 32px`) become ordinary media queries.
- `&:hover` / `&:disabled` flatten to `.ui-button:hover` / `.ui-button:disabled`.
- `& > .icon` renames the child class through the same prefix table (`ui-icon`).
- The class map exports `button` and `icon`, imports the generated CSS, and ships literal types.

Rebuilding after editing `src/button.cssx` updates `generated/`; the build exits 1 on any error
diagnostic and leaves the last successful artifacts untouched.
