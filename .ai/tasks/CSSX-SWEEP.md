# CSSX-SWEEP — `.cssx` source extension, release identity and chick logo

## Summary

- Rename every source-file reference from `.chikx` to `.cssx`: fixtures, CLI discovery/config defaults, docs, examples, README, SPECIFICATION.md, test strings — language ID, packages, CLI command and diagnostics stay Chikx/CHIKX.
- Extension identity: marketplace name `chikx`, versions 0.1.0, chick logo as marketplace icon + `.cssx` file icon, `module` setup key learned by the extension analysis.
- Release hygiene: package README/LICENSE copies, scaffold-test name update, full `release:check` green including vsce.

## Objective

Apply the owner decision of 2026-11-25 (source extension `.cssx`, everything else Chikx) across the whole
repository, record it as ADR-0013, and finish extension/release identity (marketplace name, versions,
package docs, chick logo, `module` setup key).

## Dependencies

- A15B (docs/release/`release:check`) and A16 (`module` setup key) are complete.

## Allowed files

- `tests/fixtures/**`, `tests/**`, `examples/**`
- `packages/compiler/src/**` (literal `.chikx` discovery/default strings only)
- `packages/cli/src/**` (config defaults, discovery, manifest filename)
- `packages/language-service/**`, `packages/vscode/**`
- `SPECIFICATION.md`, `README.md`, `docs/**`, `CHANGELOG.md`, root `package.json`, `.gitignore`, `bun.lock`
- `.ai/tasks/CSSX-SWEEP.md`, `.ai/reports/CSSX-SWEEP.md`, `.ai/reports/logs/CSSX-SWEEP.log`,
  `docs/decisions/ADR-0013-cssx-file-extension.md`

Protected: `.ai/CSSX-MASTERPLAN.md`, `AGENTS.md`, `opencode.jsonc`, `.ai/agents/**`, `.ai/PROGRESS.md`,
historical `.ai/tasks|reports|framework` records.

## Requirements

1. Rename every `*.chikx` fixture/module/example/source file to `*.cssx`, preserving content except
   extension strings.
2. Content sweep: every literal `.chikx` in source, tests, docs, examples, README, SPECIFICATION.md,
   CHANGELOG → `.cssx`. VS Code `contributes.languages[0].extensions` becomes `[".cssx"]` while the
   language ID stays `chikx`. ADR-0013 cited in extension docs.
3. Extension identity: `name: chikx`, `version: 0.1.0`, `icon: media/icon.png`, language file icon,
   `module` setup key in `src/{analysis,output,intelligence}.ts`. Versions 0.1.0 in compiler, CLI,
   language-service and root manifests.
4. Tarball hygiene: package-level `README.md` + `LICENSE` in compiler and CLI packages.
5. Chick logo: generated marketplace PNG at `packages/vscode/icon.png`, hand-crafted
   `packages/vscode/media/file-icon.svg`, source render `packages/vscode/media/logo-source.png`.
6. Validation: `bun install`, `bun run verify`, `bun run test:browser`, `bun run release:check` (vsix
   produced), example builds, plain-Node smoke.

## Constraints

- No commits/pushes, no semantic changes beyond the naming decision; preserve unrelated content.
- Do not mark `.ai/PROGRESS.md` rows.

## Acceptance criteria

1. `bun run verify`, `bun run test:browser`, `bun run release:check` exit 0; vsce produces the vsix.
2. Zero functional `.chikx` references remain outside the masterplan and ADR-0013 historical mentions.
3. Extension: name `chikx`, version 0.1.0, chick icons wired, language id `chikx` with `.cssx`.
4. Report with rename inventory and evidence.

## Validation commands

```sh
bun install
bun run verify
bun run test:browser
bun run release:check
grep -ri "\.chikx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=out .
```
