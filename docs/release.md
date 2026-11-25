# Release checklist (v0.1)

This page records what `bun run release:check` validates, how to release, and the remaining manual
steps for the package owners.

Source files use the `.cssx` extension; the language ID, packages, CLI command and diagnostics stay
Chikx ([ADR-0013](decisions/ADR-0013-cssx-file-extension.md)).

## Aggregate gate

```sh
bun run release:check
```

It runs, in order:

1. `bun run verify` — typecheck, Biome and the full unit/integration/extension-provider suite.
2. `bun run test:browser` — Playwright computed-style gate (Chromium required; Firefox/WebKit when
   installed).
3. `bun run --cwd packages/compiler build` and `bun run --cwd packages/cli build` — emit `dist`.
4. Package metadata assertion: compiler/CLI/extension names, versions (`0.1.0`), licences, entry
   points, extension icon and the `chikx` language contribution with `.cssx` files.
5. `npm pack --dry-run --json --workspace @chikx/compiler` and `@chikx/cli` — assert the tarball
   contains `package.json`, `README.md`, `LICENSE` and `dist/**`.
6. Build all six examples through the CLI with `--config examples/<name>/chikx.config.json`
   (`basic`, `responsive`, `variables`, `jsx`, `custom-output`, `overrides`).
7. `bun run --cwd packages/vscode build` and `bunx @vscode/vsce package --no-dependencies` in
   `packages/vscode`; the gate fails if packaging fails, and the produced `chikx-<version>.vsix` is
   the release artifact.

Each sub-result is printed. `release:check` does not publish anything and does not commit.

## Manual pre-release steps

1. **Confirm metadata URLs.** `packages/vscode/package.json` points at
   `https://github.com/chikx/chikx` as a placeholder repository/homepage; replace it with the real
   canonical URL before publishing.
2. **Tag and publish**:
   - `npm publish --workspace @chikx/compiler`
   - `npm publish --workspace @chikx/cli`
   - `cd packages/vscode && vsce publish` (VS Code Marketplace)
3. Install the VSIX locally (or open the folder in an Extension Development Host) and smoke-test
   activation, diagnostics, completion, preview and Compile File.

## Versions, names and identity

| Artifact | Value |
|---|---|
| Repository root | private `chikx` workspace, `0.1.0` |
| `@chikx/compiler` | `0.1.0`, MIT, `dist/**` payload plus package `README.md`/`LICENSE` |
| `@chikx/cli` | `0.1.0`, MIT, `dist/**` + `src/**` plus package `README.md`/`LICENSE` |
| VS Code extension | marketplace `name: chikx`, `version: 0.1.0`, publisher `chikx`, `icon: media/icon.png`, language `chikx` with `.cssx` |
| Diagnostics | `CHIKX####` (unchanged) |

## Extension packaging (vsce)

`vsce` requires an unscoped lowercase extension `name` (`^[a-z0-9][a-z0-9-]*$`). The manifest is
named `chikx`; `displayName` stays `Chikx`. The extension also ships `LICENSE` and the chick brand
assets (`icon.png`, `media/icon.png`, `media/file-icon.svg`, `media/file-icon-dark.svg`).

Recorded output of the packaging step:

```text
$ cd packages/vscode && bunx @vscode/vsce package --no-dependencies
DONE  Packaged: packages/vscode/chikx-0.1.0.vsix (214 files, 351.31 KB)
```

The `*.vsix` pattern is gitignored.

## Tarball contents (recorded)

| Package | Files | Root files included |
|---|---|---|
| `@chikx/compiler` | 287 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`) |
| `@chikx/cli` | 89 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`, `src/**`) |

Package-level `README.md` and `LICENSE` copies exist so npm tarballs are self-describing;
`release:check` fails if either is missing.

## Framework note

The extension-host smoke suite depends on `@vscode/test-electron 2.5.2`. On macOS with VS Code
1.147.0, the package's default launcher resolution looks for `…/MacOS/Electron`, but VS Code 1.147
ships only `…/MacOS/Code`. The repository test orchestrator resolves the executable itself and
passes `vscodeExecutablePath`. Framework record:
[`.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md`](../.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md).

## Rollback

Artifacts are generated deterministically. To revert a bad build, restore the previous source and run
`chikx build` again; last-good outputs are retained on errors. `chikx clean` removes only
manifest-owned files that have not been edited. Publishing cannot be rolled back — use a new version.
