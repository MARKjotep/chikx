# @chikx/cli

The Chikx command line interface: `chikx build`, `chikx watch`, `chikx check`, `chikx format` and
`chikx clean`. It uses the same `@chikx/compiler` as the API and the VS Code extension.

Source files use the `.cssx` extension (ADR-0013). The command, configuration file
(`chikx.config.json`) and diagnostic codes (`CHIKX####`) keep the Chikx name.

## Install

Published on npm as **0.1.0** (2026-11-26):

```sh
npm install --global @chikx/cli
# or run it without installing
npx @chikx/cli build
```

The published `bin` entry is the built `dist/index.js`, so `npx @chikx/cli` / `bunx chikx` no longer
need a TypeScript loader. The source and built entry use the `#!/usr/bin/env node` shebang, so the
CLI runs on a Node-only machine (Bun executes the same file).

## Commands

| Command | Purpose |
|---|---|
| `chikx build [file]` | Build one entry or the project from `chikx.config.json`. |
| `chikx watch [file]` | Rebuild affected entries on change. |
| `chikx check [file]` | Validate without writing. |
| `chikx format [file] [--check]` | Format source files or verify formatting. |
| `chikx clean` | Delete manifest-owned, unmodified generated files. |

Exit codes: `0` success, `1` compile/validation error, `2` invocation or configuration error.

## Documentation

The repository `README.md`, `docs/configuration.md`, `docs/release.md` and `CHANGELOG.md` describe
configuration, precedence, output safety and known gaps.

## License

MIT. See `LICENSE` in this package.
