# CSSX-0.1.1 — staging record

- Date: 2026-11-26
- Scope: stage 1 packaging fixes (commit `e55bcb0`) and stage 2 release preparation (version bump,
  changelog, docs, gate, staged tarballs); no tag and no CLI publish
- Environment: macOS, Bun 1.4.5, Node 24.22.3, npm 11.19.1; npm unauthenticated

## Implementation Progress

| Phase | Deliverable | Acceptance condition | Status |
|---|---|---|---|
| 1 | Clean `dist` in both package builds | stale `dist/output/importPath.*` gone after build | 🟢 |
| 1 | Source-map policy | every map `sources` entry resolves inside the tarball | 🟢 |
| 1 | `docs/usage.md` §1.2 example | `chikx format --check` exits 0 on the documented files | 🟢 |
| 1 | Validation | `bun run verify` 0, pack + tarball-only consumer smoke | 🟢 |
| 2 | Version bump | root/compiler/CLI `0.1.1`, CLI dep `0.1.1`, extension `0.1.0`, lockfile refreshed | 🟢 |
| 2 | Changelog + docs + records | `[0.1.1]` entry, release/handover/plan/todo reflect the compiler publish | 🟢 |
| 2 | Full gate + staged tarballs | `release:check` exit 0; compiler 398 / CLI 89; dry-runs and smoke recorded | 🟢 |

## Source-map policy: ship sources (declaration maps cannot be self-contained)

`inlineSources: true` was applied to `tsconfig.base.json` and both packages rebuilt. Evidence:

| Map | `sourcesContent` |
|---|---|
| `packages/compiler/dist/index.js.map` | non-empty (37 138 chars) |
| `packages/compiler/dist/index.d.ts.map` | **absent** (TypeScript never inlines sources into declaration maps) |
| `packages/cli/dist/index.js.map` | non-empty (4 741 chars) |
| `packages/cli/dist/index.d.ts.map` | absent |

Falling back per plan: `inlineSources` reverted, `files` is `["dist","src"]` for both packages
(compiler gained `src`). A tarball check walked all 192 maps; 0 `sources` entries unresolved —
every `../src/**.ts` target ships in the tarball.

## Packaging results

- Builds: `node -e "require('node:fs').rmSync('dist',…)" && tsc -p tsconfig.json`; no `importPath.*`
  remains in either `dist` after a clean rebuild.
- CLI tarball: 89 files (68 `dist/`, 18 `src/`, plus LICENSE/README/package.json); manifest
  `0.1.1` with `"@chikx/compiler": "0.1.1"`.
- Compiler tarball: 398 files (316 `dist/`, 79 `src/`, plus LICENSE/README/package.json); manifest
  `0.1.1`, `files: ["dist","src"]`.
- Consumer smoke (tarball-only temp project): `npx chikx --version` → `0.1.1`; two-file `build`
  wrote CSS/map/types with 0 warnings; `check` exited 0; installed compiler and CLI `dist/index.js.map`
  sources resolve (`../src/index.ts` present).

## Stage 2 — version and manifests

| Artifact | Version | Payload |
|---|---|---|
| Repository root (private) | `0.1.1` | workspace |
| `@chikx/compiler` | `0.1.1` | `dist/**` + `src/**` |
| `@chikx/cli` | `0.1.1` | `dist/**` + `src/**`; dep `@chikx/compiler@0.1.1` |
| VS Code extension | `0.1.0` (unchanged, PP4b deferred) | not repackaged at 0.1.1 |

`bun install` refreshed `bun.lock` (three version entries) and `bun install --frozen-lockfile` exited
0. The root `release:check` metadata assertion now expects compiler/CLI `0.1.1` and extension `0.1.0`.

## Published compiler 0.1.1 audit (owner publish, 2026-11-26)

- `npm view @chikx/compiler version dist-tags` → `0.1.1`, `{ latest: '0.1.1' }`.
- `npm pack @chikx/compiler@0.1.1 --json` → **398 files**, manifest `version 0.1.1`,
  `files: ["dist","src"]`, no `workspace:*`, no `dist/output/importPath.*` (0 entries), README line 25
  `const result = await compile(source, …)`, 79 `src/` + 316 `dist/` entries.
- SHA-256 `db7bf4738a36e2b4211e6334cd5da65bd32d41d4d6031eddc6dc0e2399eda97f` — **byte-identical** to
  the local workspace pack (`cmp` clean). Verdict: published tarball correct.

## Staged tarballs (local `npm pack`)

| Package | Files | Bytes | SHA-256 |
|---|---|---|---|
| `@chikx/compiler@0.1.1` | 398 | 342 295 | `db7bf473…eda97f` |
| `@chikx/cli@0.1.1` | 89 | 85 567 | `eee292e2…c524e5` |

Both manifests: `0.1.1`, no `workspace:*`, no `importPath.*`, no `node_modules`, `src/` present.

## Gate

- **Attempt 1** — `release:check` exit **1**: `verify` 1350 pass / 2 skip / 1 fail. The single failure
  was the documented watcher flake `tests/stress/fs/watch.test.ts` → “watch churn > coalesces 20 rapid
  edits instead of rebuilding per event” (`last rapid edit timed out after 15000ms`).
- **Single-test rerun** — `bun test tests/stress/fs/watch.test.ts` → 5 pass / 0 fail (1.3 s).
- **Attempt 2** — `release:check` exit **0**: verify **1351 pass / 2 skip / 0 fail** (1353 tests,
  99 files; host **15 scenarios / 928 assertions**), browser **96/96**, compiler tarball **398**,
  CLI **89**, nine examples, VSIX **18 files / 140.57 KB** (0.1.0).
- **Dry runs** — `npm publish --workspace @chikx/cli --access public --dry-run` exit **0** (0.1.1,
  latest, public). `--workspace @chikx/compiler` dry-run exits **1** only because 0.1.1 is already
  published by the owner (`You cannot publish over the previously published versions: 0.1.1`); the
  pack details are correct (398 files, 342.3 kB), so this is expected, not a packaging failure.

## Consumer smoke (tarball-only)

Fresh temp project with the two local tarballs installed by path:

- `npx chikx --version` → `0.1.1`.
- `npx chikx build` → `2 entries, 3 files written, 0 warnings` (exit 0) for the `docs/usage.md` §1.2
  `theme.cssx` + `button.cssx` pair.
- `npx chikx check` → `2 entries checked, 0 errors, 0 warnings` (exit 0).
- `node_modules/@chikx/{compiler,cli}/dist/index.js.map` each have 1 `sources` entry
  (`../src/index.ts`) and it exists in the installed package (0 missing).

## Publish state and exact commands

`@chikx/compiler@0.1.1` is live and latest (owner publish, 2026-11-26).
`@chikx/cli@0.1.1` is **not published** (`npm view @chikx/cli versions` → `0.0.0-stage`, `0.1.0`).
No tag exists. Remaining owner steps, in order:

```sh
npm view @chikx/compiler version                 # must return 0.1.1
npm publish --workspace @chikx/cli --access public
npm view @chikx/cli version                      # must return 0.1.1
git tag -a v0.1.1                                 # on the release commit
```

The extension stays at 0.1.0; PP4b and PP5b remain deferred. `@chikx/compiler@0.0.0-stage`
deprecation is an owner step.

## Docs

`docs/usage.md` §1.2 `src/button.cssx` expanded to the formatter's output (multi-line nested rules);
a note after the map-import snippet states the generated map is ESM and needs `"type": "module"`
(or a bundler). `CHANGELOG.md` gained `[0.1.1] - 2026-11-26` (`### Packaging`); `docs/release.md`,
`.ai/HANDOVER.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md` and `.ai/todo.md` reflect that the compiler is
published and only the CLI publish remains.
