# Known limitations (v0.1)

This page collects the gaps that matter operationally. It is intentionally blunt: v0.1 is a usable
MVP, not a finished CSS toolchain. The compatibility matrix in [compatibility.md](compatibility.md)
lists language features in more detail.

## 1. Unimplemented P7 work

| Gap | Effect | Status |
|---|---|---|
| Editor formatting | Format Document (⌥⇧F) and `chikx.editor.formatOnSave` run the compiler's canonical whole-document formatter; parse errors leave the document unchanged. Range formatting and format-on-type are not available because `format` is a document-level parse→print pass. | Document-level only |
| Editor CSS intelligence | The extension does not project Chikx onto `vscode-css-languageservice`. Property hover is empty and property/value completions are curated lists, not a full CSS database. | Deferred by design |
| Cross-module rename | Rename refuses namespace members and classes; only single-file `$token` rename works. Class rename across JSX does not exist. | Deferred |
| Keyframe name intelligence | `$keyframes.<member>` is not offered by completion, has no hover and is not renamed by the editor; only the compiler expands it (ADR-0015). | Deferred |
| LSP server | Only the VS Code extension is provided; there is no language server for other editors. | Deferred |

## 2. Release and packaging gaps

| Gap | Detail |
|---|---|
| CLI `bin` | `@chikx/cli` declares `"bin": { "chikx": "src/index.ts" }`. That entry relies on Bun's TypeScript loader. Node users must invoke `node dist/index.js`. A published package should point `bin` at a Node-compatible `dist` entry. |
| Extension packaging payload | The VSIX currently includes `src/`, `test/` and `tsconfig.json` beside `dist/` and `out/`. It works, but a `.vscodeignore` would trim the payload before a store submission. |

Package versions (`0.1.0`), package-level `README.md`/`LICENSE` copies and the unscoped extension name
(`chikx`) were resolved for v0.1; `bun run release:check` asserts all three.

## 2a. Source extension

`Chikx` source files use `.cssx` ([ADR-0013](decisions/ADR-0013-cssx-file-extension.md)). The language
ID, packages, CLI command, `chikx.config.json` and `CHIKX####` diagnostics keep the Chikx name. There
is no legacy extension alias, dual registration or migration path in v0.1.

## 3. Output and build behaviour

| Limitation | Detail |
|---|---|
| Project output mirrors the workspace path | With `include: ["src/**/*.cssx"]` and `output.cssDir: "dist/styles"`, `src/deep/widget.cssx` becomes `dist/styles/src/deep/widget.css`. The `src/` segment is repeated. File-level `@setup` directories are exact and do not have this issue. |
| No CLI path overrides | Only `--minify`/`--no-minify` override output. `--css-dir`-style flags are not implemented; path overrides remain an API-only concept. |
| `compileProject` does not read config | It accepts `output`/`naming`/`media`/`projectRoot`; `chikx.config.json` loading belongs to the CLI. Programmatic users must load and map the file themselves. |
| CLI duplicates setup resolution | `CompileResult` exposes no output plan or effective setup, so the CLI re-derives both with `parse` + `planOutputs`. A divergence would show up as wrong destinations; the fixture tests pin the current behaviour. |
| Manifest location | Fixed at `<workspaceRoot>/.cssx-manifest.json`. The strict config schema has no key to move it. |
| Build overwrites configured destinations | `build` treats configured output paths as explicit authorisation and overwrites them even when the manifest does not own them. `clean` is conservative and only deletes matching, unmodified, manifest-owned files. |
| No external output | The specification allows a future trusted policy for writing outside the workspace; the v0.1 planner always rejects it. |
| Source-map/diagnostic gap | The CLI decodes simple `\x` escapes for planning while the compiler performs full CSS unescaping. A path authored with hex escapes could plan differently. |
| Watch is not recursive | `fs.watch` is attached per directory (portable); coverage comes from source directories and include prefixes and is refreshed after each build. A brand-new deep directory is picked up through its parent's event. |
| Single writer | The extension never starts a watcher; compile-on-save is off by default. If you enable it while a CLI watcher is running, you own the coordination. |

## 4. Language limitations

| Limitation | Detail |
|---|---|
| No mixins/reusable groups | `@group`/`@apply` and mixins are deferred; they need an ADR and fixtures. |
| No arbitrary expressions | Variables substitute token sequences; there is no computation. |
| No container aliases | Native `@container` passes through, but Chikx aliases for container queries do not exist. |
| No inline pseudo-state modifiers | Use `&:hover { … }`; a modifier alias such as `@hover` is not supported. |
| No hashing/file-scoped naming | Only `none` and `prefix` strategies exist (ADR-0010). |
| No top-level conditional blocks | Rejected by design (D3); write conditions inside rules. |
| One media expression per alias | Comma lists and some `not`/`only` combinations are rejected rather than emitted. Native media lists pass through. |
| Runtime tokens per entrypoint | Imported runtime tokens are emitted in each consuming entrypoint. Within one build, duplicate custom-property names resolve in merge order (entry last; later module wins) with no diagnostic (ADR-0016). Collision handling across separate outputs/entrypoints is not implemented yet. |
| Simple `:global` only | `:global(.class)` is supported; complex global selectors are not. |
| Export collisions are fatal | `foo-bar` and `fooBar` cannot both be exported from one file (`CHIKX4001`). |
| Keyframe references need a rule-merge import | `$keyframes.<name>` sees the file's own top-level keyframes plus those of `@use "…" styles` modules. A token-only import's keyframes are not referenceable (`CHIKX2001`) because that module's CSS is not emitted; the `@variables { spin: spin; }` fallback still works. String-named keyframes, keyframes nested in a rule or inside another at-rule block (such as `@media`), and non-identifier preludes are native-only. Two merged modules may define the same name — both blocks are emitted and native cascade order decides (ADR-0015). |
| Native CSS coverage is tested, not complete | Supported at-rules and selectors are listed in [compatibility.md](compatibility.md); exotic combinations may be rejected or pass through untested. |

## 5. Editor limitations

| Limitation | Detail |
|---|---|
| Preview URIs keyed by basename | Two same-named files can share one `chikx-preview:` document; reopening refreshes content. |
| Diagnostics for imports | Problems in imported modules are logged rather than published at the current document's offsets. |
| No property documentation hover | Intentional until a CSS projection layer exists. |
| Restricted Mode | Analysis and preview work; writing commands are blocked. |

## 6. Platform and environment

- Compiler and CLI verified on Node `v24.22.3` (>= 20 required) and Bun `1.4.5`.
- Browser cascade tests recorded on Chromium, Firefox and WebKit (75/75). See
  [cascade.md](cascade.md#5-browser-evidence).
- VS Code extension tested on VS Code `1.147.0`; the manifest declares `^1.85.0` and older versions
  are untested.
- `@vscode/test-electron 2.5.2` cannot launch VS Code 1.147.0 on macOS without a manual launcher
  override. The framework record is
  [`.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md`](../.ai/framework/vscode-test-electron/bugs/macos-electron-launcher-missing.md);
  the test orchestrator resolves `…/MacOS/Code` itself.
- No telemetry. No network access at build time; imports are local and workspace-contained.
