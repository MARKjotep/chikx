# Release checklist (v0.1)

This page records what `bun run release:check` validates, how to release, and the remaining manual
steps for the package owners.

**Current status (2026-11-26):** **`@chikx/compiler@0.1.1` is published** (owner publish, 2026-11-26)
together with the previously published `@chikx/compiler@0.1.0` / `@chikx/cli@0.1.0` (compiler first;
the CLI pins the compiler to the exact version). **PP5a passed** on 2026-11-26 against the registry:
clean install, `npx`/`bunx` versions, and the `docs/usage.md` quick start end to end with
`chikx build`/`check`/`clean` ([report](../.ai/reports/CSSX-PP5A.md)). **`@chikx/cli@0.1.1` is
prepared and awaiting its publish** (compiler dependency pinned to `0.1.1`); publishing the CLI, then
tagging `v0.1.1` on the release commit, completes the 0.1.1 npm release. **PP4b — the VS Code
Marketplace extension — remains deferred by the owner**; the extension stays at `0.1.0` and the local
VSIX is the interim distribution. Publishing anything further needs new explicit owner
authorization. The unscoped `chikx` name reservation is prepared and awaiting the owner's publish
([Unscoped npm name](#unscoped-npm-name)).

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
4. Package metadata assertion: compiler/CLI/extension names, versions (`0.1.1`, `0.1.1`, `0.1.0`),
   licences, entry points, extension icon and the `chikx` language contribution with `.cssx` files.
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
   - **2a · npm (PP4a, executed 2026-11-26):**
     `npm publish --workspace @chikx/compiler --access public`, then
     `npm publish --workspace @chikx/cli --access public` (compiler first). Both resolved at `0.1.0`
     with integrity `sha512-aAKqebvb…kzFRqw==` (compiler) and `sha512-tbRmwcP+qdZQ…rXd0/Q==` (CLI).
     The CLI pins the compiler to an exact version (currently `"@chikx/compiler": "0.1.1"`): npm does
     not rewrite the `workspace:` protocol at pack/publish, so **every new compiler release requires
     bumping the CLI dependency in `packages/cli/package.json` to the same version, rebuilding and
     re-packing the CLI before its own publish**. Confirm the packed manifest before publishing:
     `tar -xzOf chikx-cli-0.1.1.tgz package/package.json | grep '@chikx/compiler'`.
     **0.1.1**: `@chikx/compiler@0.1.1` was published by the owner on 2026-11-26 (tarball
     byte-identical to the local pack, 398 files). Only the CLI remains:
     `npm publish --workspace @chikx/cli --access public`, pinned to `0.1.1`, after
     `npm view @chikx/compiler version` returns `0.1.1`; then tag `v0.1.1` on the release commit.
   - **2b · VS Code Marketplace (PP4b, deferred by owner 2026-11-26):**
     `cd packages/vscode && vsce publish` (publisher `chikx`; needs a PAT with Marketplace *Manage*
     scope via `npx @vscode/vsce login chikx` or `VSCE_PAT`). Until then the local VSIX is
     self-contained and can be distributed by hand.
3. Install the VSIX locally (or open the folder in an Extension Development Host) and smoke-test
   activation, diagnostics, completion, preview and Compile File.

## Versions, names and identity

| Artifact | Value |
|---|---|
| Repository root | public `chikx` name reservation, `0.1.1` (no code; `bin/chikx.js` stub only) |
| `@chikx/compiler` | `0.1.1`, MIT, `dist/**` + `src/**` payload plus package `README.md`/`LICENSE` |
| `@chikx/cli` | `0.1.1`, MIT, `dist/**` + `src/**` plus package `README.md`/`LICENSE`; `bin.chikx` → `dist/index.js` |
| VS Code extension | marketplace `name: chikx`, `version: 0.1.0`, publisher `chikx`, `icon: media/icon.png`, language `chikx` with `.cssx` |
| Diagnostics | `CHIKX####` (unchanged) |

## Unscoped npm name

The unscoped name `chikx` was unclaimed (registry 404 on 2026-11-26), so the repository root is a
minimal public package that only reserves it. It ships no code: `files` is limited to `README.md`,
`LICENSE` and `bin`, the sole bin is `bin/chikx.js`, and that stub prints a pointer to `@chikx/cli`
and exits 1. It is **not** the CLI and must not be used as one. The tarball is constrained by
`files` (the authoritative allowlist) with a root `.npmignore` as a second guard; npm ignores
`.npmignore` whenever `files` is present.

To publish (owner, from the repository root):

```sh
npm pack --dry-run --json   # must list exactly package.json, README.md, LICENSE, bin/chikx.js
npm publish
```

Unscoped names are public by default and `publishConfig.access` is `"public"`, so no `--access` flag
is needed. The root has no dependencies and no build step; this is a name reservation, not a release
of the compiler or CLI.

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
| `@chikx/compiler` | 398 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`, `src/**`) |
| `@chikx/cli` | 89 | `package.json`, `README.md`, `LICENSE` (+ `dist/**`, `src/**`) |
| `chikx` (root reservation) | 4 | `package.json`, `README.md`, `LICENSE` (+ `bin/chikx.js`) |

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
