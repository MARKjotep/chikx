# Release checklist (v0.1)

This page records what `bun run release:check` validates, how to release, and the remaining manual
steps for the package owners.

**Current status (2026-11-26):** nothing is published. **PP4a — npm publication of
`@chikx/compiler` and `@chikx/cli` — is the next authorized action; PP4b, the VS Code Marketplace
extension, is deferred by the owner.** Publishing still needs explicit authorization; the local
VSIX is the interim extension distribution.

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
6. Build all nine examples through the CLI (`basic`, `responsive`, `variables`, `jsx`,
   `custom-output`, `overrides`, `groups`, `portfolio`, `modules`). Each example uses
   `--config examples/<name>/chikx.config.json` only when that file exists; config-less examples run
   `chikx build` from the example directory, which discovers the default `**/*.cssx` scope under the
   example's own `package.json` boundary ([ADR-0023](decisions/ADR-0023-zero-config-defaults.md)).
7. `bun run --cwd packages/vscode build` and `bunx @vscode/vsce package --no-dependencies` in
   `packages/vscode`; the gate fails if packaging fails, and the produced `chikx-<version>.vsix` is
   the release artifact.

Each sub-result is printed. `release:check` does not publish anything and does not commit.

## Manual pre-release steps

1. **Metadata URLs are final.** On 2026-11-26 the placeholder repository/homepage/bugs URLs were
   replaced with `https://github.com/MARKjotep/chikx` (repository `.git` URL, `#readme` homepage and
   `/issues` bugs). `release:check` asserts the extension manifest has a repository URL, homepage and
   bugs URL; no placeholder remains.
2. **Tag and publish**:
   - **2a · npm (PP4a):** `npm publish --workspace @chikx/compiler --access public`, then
     `npm publish --workspace @chikx/cli --access public` (compiler first; the CLI pins it).
   - **2b · VS Code Marketplace (PP4b, deferred by owner 2026-11-26):**
     `cd packages/vscode && vsce publish` (publisher `chikx`; needs a PAT with Marketplace *Manage*
     scope via `npx @vscode/vsce login chikx` or `VSCE_PAT`). Until then the local VSIX is
     self-contained and can be distributed by hand.
3. Install the VSIX locally (or open the folder in an Extension Development Host) and smoke-test
   activation, diagnostics, completion, preview and Compile File.

## Versions, names and identity

| Artifact | Value |
|---|---|
| Repository root | private `chikx` workspace, `0.1.0` |
| `@chikx/compiler` | `0.1.0`, MIT, `dist/**` payload plus package `README.md`/`LICENSE` |
| `@chikx/cli` | `0.1.0`, MIT, `dist/**` + `src/**` plus package `README.md`/`LICENSE`; `bin.chikx` → `dist/index.js` |
| VS Code extension | marketplace `name: chikx`, `version: 0.1.0`, publisher `chikx`, `icon: media/icon.png`, language `chikx` with `.cssx` |
| Diagnostics | `CHIKX####` (unchanged) |

## Extension packaging (vsce)

`vsce` requires an unscoped lowercase extension `name` (`^[a-z0-9][a-z0-9-]*$`). The manifest is
named `chikx`; `displayName` stays `Chikx`. The extension also ships `LICENSE` and the chick brand
assets (`icon.png`, `media/icon.png`, `media/file-icon.svg`, `media/file-icon-dark.svg`).
`packages/vscode/.vscodeignore` excludes `src/`, `test/` and `tsconfig.json`; the VSIX carries the
runtime payload (`out/`, `dist/`, `syntaxes/`, `media/`, `language-configuration.json`).

Recorded output of the packaging step:

```text
$ cd packages/vscode && bunx @vscode/vsce package --no-dependencies
DONE  Packaged: packages/vscode/chikx-0.1.0.vsix (18 files, 140.6 KB)
```

The `*.vsix` pattern is gitignored.

## Tarball contents (recorded)

| Package | Files | Root files included |
|---|---|---|
| `@chikx/compiler` | 323 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`) |
| `@chikx/cli` | 89 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`, `src/**`) |

Package-level `README.md` and `LICENSE` copies exist so npm tarballs are self-describing;
`release:check` fails if either is missing.

## Framework note

The extension-host smoke suite depends on `@vscode/test-electron 2.5.2`. On macOS with VS Code
1.147.0, the package's default launcher resolution looks for `…/MacOS/Electron`, but VS Code 1.147
ships only `…/MacOS/Code`. The repository test orchestrator resolves the executable itself and
passes `vscodeExecutablePath`.

## Rollback

Artifacts are generated deterministically. To revert a bad build, restore the previous source and run
`chikx build` again; last-good outputs are retained on errors. `chikx clean` removes only
manifest-owned files that have not been edited. Publishing cannot be rolled back — use a new version.
