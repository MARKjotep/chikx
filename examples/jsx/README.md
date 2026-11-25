# JSX example

A generated Chikx class map consumed by a small React component. The example deliberately has no
React or bundler dependency: the component is illustrative, while the committed class map and
declarations are real compiler output and can be type-checked on their own.

```tsx
// src/Button.tsx (not compiled by this example — shown for usage)
import styles from "../generated/maps/button.map.js";

export function Button() {
  return (
    <button className={`${styles.button} ${styles.isPrimary}`}>Continue</button>
  );
}
```

## Build

```sh
bun packages/cli/src/index.ts build --config examples/jsx/chikx.config.json
```

or `cd examples/jsx && chikx build`.

## What it demonstrates

- `&.is-primary` (a compound nested selector) becomes `.ui-button.ui-is-primary` and is exported
  both as the quoted original key `"is-primary"` and as the camelCase named export `isPrimary`.
- `generated/maps/button.map.js` imports the generated CSS as a side effect and exports literal
  strings; `button.map.d.ts` types `styles.button` as `"ui-button"` and the default map as readonly
  properties.
- The CSS import is relative to the map directory (`../styles/button.css`), so the map works from a
  bundler that understands CSS imports. If your environment cannot import CSS from JS, set
  `import-css: false` in `@setup` and load the stylesheet yourself (see
  [`custom-output`](../custom-output/README.md)).
- Global classes escaped with `:global(...)` never appear in the map; see
  [docs/compatibility.md](../../docs/compatibility.md).

To type-check the generated declarations directly:

```sh
cd examples/jsx
bunx tsc --noEmit --strict --moduleResolution bundler --module esnext \
  --allowJs false generated/maps/button.map.d.ts
```

The component file is omitted from `include` in `chikx.config.json` because the project only
discovers `.cssx` sources.
