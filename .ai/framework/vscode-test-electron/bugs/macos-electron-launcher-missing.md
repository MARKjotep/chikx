# macOS: @vscode/test-electron looks for a removed `Electron` launcher in VS Code 1.147.0

## Summary

On macOS, `@vscode/test-electron` 2.5.2 cannot launch VS Code 1.147.0 unchanged. VS Code 1.147 ships
`Visual Studio Code.app/Contents/MacOS/Code`, while the package resolves the old
`…/Contents/MacOS/Electron` launcher path. The default `runTests` flow therefore points at a
non-existent executable.

## Framework

- `@vscode/test-electron` — the VS Code extension-host test harness.

## Affected API

- `runTests` (default launcher resolution on macOS).

## Framework versions (exact, verified)

| Component | Version | Verified from |
|---|---|---|
| `@vscode/test-electron` | **2.5.2** | `packages/vscode/node_modules/@vscode/test-electron/package.json` (`"version": "2.5.2"`) |
| VS Code under test | **1.147.0** | cached build `node_modules/.chikx-vscode-test/vscode-darwin-arm64-1.147.0`; `.app/Contents/MacOS/` contains `Code` and no `Electron` |

Related: `@vscode/test-electron` is declared as `^2.4.1` in `packages/vscode/package.json`; the
resolved/installed version is 2.5.2.

## Reproduction

1. Install the extension dependencies and cache VS Code 1.147.0 (or let the harness download it).
2. Call `runTests({ extensionDevelopmentPath, extensionTestsPath, … })` with no
   `vscodeExecutablePath`, or point it at the cached VS Code directory.
3. Observe the launcher resolution: the cached application at
   `node_modules/.chikx-vscode-test/vscode-darwin-arm64-1.147.0/Visual Studio Code.app/Contents/MacOS/Code`
   exists, but the package looks for `…/MacOS/Electron`.

The repository's orchestrator (`tests/extension/host.test.ts`) demonstrates the failing default and
the working override side by side.

## Expected behaviour

`runTests` resolves the actual VS Code executable for the downloaded build (`…/MacOS/Code` on macOS
for VS Code ≥ 1.147) and launches the extension host without extra host configuration.

## Actual behaviour

Launch fails because the resolved `Electron` executable does not exist. The
`downloadDirToExecutablePath` helper that would map the directory to the renamed binary is internal
and not exported, so callers cannot reuse it.

## Evidence

- CSSX-A13 recorded a **real VS Code 1.147.0 extension-host run** (activation, grammar, six commands,
  diagnostics, completion, Compile File and Preview) only after resolving the launcher manually.
  See `.ai/reports/CSSX-A13.md` §"Deviations, limitations and lead attention" item 3.
- Environment: macOS 27.3 arm64, Bun 1.4.5, Node 24.22.3.
- Cached build inspection:

  ```text
  $ ls node_modules/.chikx-vscode-test/vscode-darwin-arm64-1.147.0/Visual\ Studio\ Code.app/Contents/MacOS
  Code
  ```

  No `Electron` entry exists.
- `tests/extension/host.test.ts` resolves `…/MacOS/Code` first and falls back to `Electron`, passing
  `vscodeExecutablePath` to `runTests`; the recorded host smoke passes with that override.

## Workaround

Resolve the launcher yourself and pass it explicitly:

```ts
import { runTests } from "@vscode/test-electron";
import { existsSync } from "node:fs";
import { join } from "node:path";

const app = join(cacheDir, "Visual Studio Code.app", "Contents", "MacOS");
const executable = existsSync(join(app, "Code")) ? join(app, "Code") : join(app, "Electron");
await runTests({ vscodeExecutablePath: executable, extensionDevelopmentPath, extensionTestsPath });
```

The repository implementation also isolates the download/cache under
`node_modules/.chikx-vscode-test` and uses explicit `--user-data-dir`/`--extensions-dir` so the
repository linter does not scan the ~375 MB download. The test skips with a recorded reason when no
cached build exists and `CHIKX_EXTENSION_HOST_DOWNLOAD=1` is unset; it never fakes a pass.

## Status

**Open upstream.** Not reported to the `@vscode/test-electron` repository from this project (no
upstream change was made or authorized). The workaround is applied in `tests/extension/host.test.ts`.

## Related records

- Repository limitation summary: `docs/known-limitations.md` §6.
- Task report: `.ai/reports/CSSX-A13.md`; release task `.ai/reports/CSSX-A15B.md`.
