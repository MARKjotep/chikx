# CSSX-0.1.1 — staging record

- Date: 2026-11-26
- Scope: stage 1 packaging defects from the 0.1.0 audits; no version bump, publish or tag
- Environment: macOS, Bun 1.4.5, Node 24.22.3, npm 11.19.1; npm unauthenticated

## Implementation Progress

| Phase | Deliverable | Acceptance condition | Status |
|---|---|---|---|
| 1 | Clean `dist` in both package builds | stale `dist/output/importPath.*` gone after build | 🟢 |
| 1 | Source-map policy | every map `sources` entry resolves inside the tarball | 🟢 |
| 1 | `docs/usage.md` §1.2 example | `chikx format --check` exits 0 on the documented files | 🟢 |
| 1 | Validation | `bun run verify` 0, pack + tarball-only consumer smoke | 🟢 |
| 2 | (next stage) | pending | 🔴 |

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
  remains in either `dist`.
- CLI tarball: 89 files (68 `dist/`, 18 `src/`, plus LICENSE/README/package.json); manifest keeps
  `"@chikx/compiler": "0.1.0"`.
- Compiler tarball: 398 files (316 `dist/`, 79 `src/`, plus LICENSE/README/package.json).
- Consumer smoke (tarball-only temp project): `npx chikx --version` → `0.1.0`; two-file `build`
  wrote CSS/map/types with 0 warnings; `check` exited 0; `format --check` clean.

## Docs

`docs/usage.md` §1.2 `src/button.cssx` expanded to the formatter's output (multi-line nested rules);
a note after the map-import snippet states the generated map is ESM and needs `"type": "module"`
(or a bundler).
