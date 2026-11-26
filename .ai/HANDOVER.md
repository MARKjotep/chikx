# Chikx Handover — 2026-11-26

**Read this file alone to run PP4.** It is self-contained; the plan, board and reports are linked at
the end for detail only.

## State

- **Working tree is uncommitted.** No commits, pushes, tags or publishes were made during this
  delivery. The tree also carries the pre-existing unstaged `.ai/agents/*` and `opencode.jsonc`
  deletions and the untracked `examples/portfolio/`; preserve all three exactly as the owner left
  them. No `git reset`, `stash` or destructive cleanup.
- **Final gates (the REFS run — the last full run on this tree):**
  - `bun run verify` exit 0 — **1351 pass / 2 skip / 0 fail** (1353 tests, **99 files**); extension
    host **15 scenarios / 928 assertions** (`navigation=42`); typecheck and Biome green.
  - Browser **96/96** — 32 per engine (Chromium, Firefox, WebKit).
  - `bun run release:check` exit 0 in **173.9 s** — **nine** examples built, compiler tarball 323
    files, CLI tarball 89, VSIX **18 files / 140.6 KB**.
  - `bun run lint` exit 0 — **459 files**.
- The id-rename phase's only red was the untracked portfolio's stale `$space.gutter` reference;
  CSSX-FIX-PORTFOLIO-TOKEN fixed it, and the REFS run above is green on the fixed tree.
- **Runtime:** Node.js **≥ 20** (`engines`) or Bun. Gates ran on Bun 1.4.5; only Node 24.22.3 was
  installed here, so **Node 20/22 are unverified**. The CLI entry is ESM with a node shebang.
- Full user guide: **[`docs/usage.md`](../docs/usage.md)**.

## What changed since the previous handover

Production phases **PP0–PP3 executed** (baseline, packaging, metadata/docs, owner manual smoke).
On top of them, under the owner's pre-release scope change, the feature wave and the editor wave
landed. The authoritative per-item record is the plan's `## Implementation Progress` table
(`.ai/plans/CSSX-PLAN-PRODUCTION.md`); one line each:

| Area | Landed | Record |
|---|---|---|
| Release engineering | CLI `bin` → `dist/index.js` + node shebang; VSIX 84 → 18 files; manifest URLs → `MARKjotep/chikx`; CHANGELOG `[0.1.0]`; docs counts/limits aligned | `CSSX-PP1.md`, `CSSX-PP2.md` |
| F18 `css-dir` lists | Comma-separated in-workspace stylesheet destinations, one artifact/manifest record per item | ADR-0019, `CSSX-F18.md` |
| F20 `map-inherit` | Opt-out keeps a merged module's class bindings out of the importer's map/`.d.ts` | ADR-0020, `CSSX-F20.md` |
| F21 `import-css` | Opt-in single side-effect CSS import at the top of `map.js` | ADR-0021, `CSSX-F21.md` |
| F22 minified default | `minify` defaults true; `--no-minify` / `minify: false` opt out; CSS only | ADR-0022, `CSSX-F22.md` |
| F23 group hover | Multi-line defaults list + separate use-site overrides section | `CSSX-F23.md` |
| `examples/modules` | Ninth example: three modules, `map-inherit: false`, `css-dir` list, no `exclude` | `CSSX-EXAMPLE-MODULES.md` |
| Zero-config defaults | Config optional, default include `**/*.cssx`, `strict: true`, safe grouping, module markers | ADR-0023, `CSSX-DEFAULTS.md` |
| Media merge | Opt-in `mediaGrouping: "merge"`; `safe` stays default; browser differential **27/27** | ADR-0024, `CSSX-MEDIA-MERGE.md` |
| Selector ids | `#` completion from document ids; single-file id rename (hash survives) | `CSSX-ID-COMPLETE.md`, `CSSX-ID-RENAME.md` |
| Class rename | Single-file class rename, `:global(...)` excluded/refused | `CSSX-CLASS-RENAME.md` |
| Attribute selectors | Full operator/flag/namespace matrix + browser proof; no behaviour change | `CSSX-ATTR-TESTS.md` |
| Stale importer diagnostics | Dependency change invalidates caches and refreshes open importers; CLI pin | `CSSX-STALE-DIAGS.md` |
| Reverse references | Find All References is bidirectional for `$token`/`@runtime`; rename stays single-file | `CSSX-REVERSE-REFS.md` |
| Terminology | `@variables` vs `@runtime` note at usage §2.3/§2.4; alias deferred | `CSSX-TERMINOLOGY.md` |
| Portfolio stale token | `$space.gutter` → `$space.gutters`; check 0, two byte-identical builds, gates green | `CSSX-FIX-PORTFOLIO-TOKEN.md` |
| Bug 25 | Group-body (`@group.<name> {}`) CSS property completion | `CSSX-FIX-GROUP-COMPLETE.md` |

## Plans and board

- Production plan: **PP0–PP3 🟢**, **PP4 and PP5 🔴** (owner-authorized only). Testing and UI
  campaigns are closed.
- Board (`.ai/todo.md`): feature items **18–28** and bugs **25–27** are 🟢. Item **24** was reused
  for zero-config defaults; the old CSS→cssx converter idea was scrapped — **do not resurrect it**.

## ⏭ NEXT: PP4 — publish (owner-run, in a different CLI)

Everything below is release execution only. No source changes are expected or authorized here.

### 1. Prerequisites

1. npm: `npm whoami` must return the account that owns, or is a member of, the **`@chikx`** scope
   (user or org). If not logged in, `npm login`. Have an OTP ready if 2FA is enabled.
   Scoped packages default to restricted, so **every npm publish below needs `--access public`**.
2. VS Code Marketplace: publisher **`chikx`**, and a PAT with Marketplace *Manage* scope.
   `npx @vscode/vsce login chikx` stores it (or export `VSCE_PAT`).
3. Git identity and credentials for the authorized commit and tag.
4. Do not paste tokens, OTPs or account names into the repo, a task file or a report.

### 2. Shell note

The repository path contains `$`, so **quote it** in every command:

```sh
cd '/Users/Marky/Desktop/$/chikx'
```

### 3. Step 0 — the gate (must be green immediately before publishing)

```sh
bun run release:check
```

Exit **0** is the requirement. Expect roughly the reference numbers: verify 1351/2/0 (99 files,
host 15/928), browser 96/96, nine examples, VSIX 18 files / 140.6 KB, ~174 s. Small timing drift is
fine; a red or partial gate is not. Publishing is irreversible — do not proceed on a hunch.

### 4. Authorized commit and tag

Only after explicit owner authorization, and only after deciding scope with the owner:

1. Decide what the release commit includes. The pre-existing `.ai/agents/*` and `opencode.jsonc`
   deletions should stay deleted; do not restore them silently.
2. `examples/portfolio/` is **untracked**, but `release:check` builds it and the README/docs list
   nine examples. Omitting it makes a fresh checkout's gate red. Include it unless the owner also
   wants the gate and docs reverted.
3. Commit, then tag the commit: `git tag v0.1.0` (annotated `-a` is fine). Push commits/tags only
   if the owner authorized the push.
4. If the tag lands after **2026-11-26**, bump the `[0.1.0]` date in `CHANGELOG.md` **before**
   tagging, and rebuild nothing else.

### 5. Publish (order matters: compiler first)

```sh
npm publish --workspace @chikx/compiler --access public
npm publish --workspace @chikx/cli --access public
cd packages/vscode && npx @vscode/vsce publish
```

- The CLI depends on the compiler; npm rewrites `workspace:*` to the exact published version.
- `vsce publish` takes the publisher from the manifest (`chikx`); no extra flag is needed.

### 6. Immediate post-checks

```sh
npm view @chikx/compiler version     # 0.1.0
npm view @chikx/cli version          # 0.1.0
mkdir -p /tmp/chikx-pp4 && cd /tmp/chikx-pp4
npm init -y && npm i @chikx/cli@0.1.0
npx chikx --version                  # 0.1.0
npx -y @chikx/cli@0.1.0 --version    # unambiguous package specifier
bunx @chikx/cli@0.1.0 --version
```

- `npx chikx` alone resolves a package literally named `chikx`; the CLI package is `@chikx/cli`,
  so install it first (as above) or use the specifier.
- Confirm the Marketplace listing: publisher `chikx`, version `0.1.0`, icon and description render.

### 7. Failure rules

- **Published versions are immutable.** Never `npm unpublish` or withdraw. A bad release is
  superseded by **0.1.1**, never removed.
- If one artifact succeeds and a later step fails, publish the remaining artifact anyway (a
  partial release is better than an unreachable one) and record exactly what shipped where.
- If the failure is auth/transient, retry the same version. If code must change in an
  already-published package, bump that package (and the CLI, whose dependency is pinned to the
  published compiler version).
- Marketplace failure after npm success: npm artifacts stay; retry `vsce publish` or publish the
  VSIX from the Marketplace UI. Do not re-publish npm just to "match".
- Record the outcome, version and any partial state in `.ai/reports/` immediately.

### 8. PP5 — after a successful publish

From a clean environment (fresh profile, no workspace symlinks):

1. `npm i @chikx/cli && npx chikx --version`; `bunx @chikx/cli --version`.
2. Install the extension from the Marketplace **and** the local VSIX in a clean profile; check
   activation, diagnostics, completion, semantic token colors and color swatches.
3. Run the `docs/usage.md` quick start end to end: optional config, two `.cssx` files, `chikx build`,
   generated CSS/map, JSX import, and a rendered page.
4. Write the checklist with **actual outputs** to a new report (for example
   `.ai/reports/CSSX-PP5-RELEASE.md`). Any mismatch opens a follow-up task; never edit a published
   claim in place.

## Caveats and known non-issues

- **Two skipped tests** are the opt-in soak suites (`tests/stress/soak/watch-soak.test.ts`,
  `cold-build.test.ts`, gated by `CHIKX_SOAK`). Deliberate; not failures.
- **Gate flakes:** a watcher rename-prune race (`tests/stress/fs/watch.test.ts`) and extension-host
  timing can fail under load. Rerun the single test and then the full gate before investigating. If a
  timed-out `chikx watch` test leaves an orphan process, identify and kill **only** the watcher that
  test spawned.
- **`examples/basic`** holds the owner's personal-test content (kept deliberately; README updated).
  Its `@keyframes ss` emits `background-color: 8px` from a textual `$radius` substitution; this is
  authored test content, not validation, and the browser suite does not exercise that keyframe.
- **`examples/portfolio`** is placeholder CV content the owner may still edit
  (`examples/portfolio/README.md#replace-placeholder-content`). It sits in the untracked directory
  and its generated output is rebuilt by `release:check`.
- **`bunx chikx` at the repo root** cannot resolve the workspace bin (no root install link; pre-existing).
  For local runs use the built entry (`node packages/cli/dist/index.js`); the published package is
  unaffected.
- **`var(--x)` / custom-property values are preserved, not validated** (SPECIFICATION §3.1).
- **Module-internal diagnostics** are logged rather than published at the importer's offsets.
  Importers refresh on dependency change/save; diagnostics are not re-based into the importer.
- **Media-merge family table** may only be extended with a documented shorthand relationship and a
  re-run of the grouping differential (27/27).
- **Class/id rename is single-file.** Literal `className="…"` / HTML `id="…"` anchors, inbound links,
  the map and `.d.ts` are not edited.
- **References are bidirectional; rename is not.** Find All References crosses files, rename does
  not.

## Deferred / v0.2

| Item | Why it waits |
|---|---|
| Cross-file `$token`/`@runtime` rename | REVERSE-REFS provides the reverse edge scan and resolution; multi-file edit application and a conflict policy remain. |
| Imported-class references/completion | Needs cross-module class resolution; prefix ownership makes the same authored name ambiguous. |
| Implicit module rule | Literal "no `@setup` → module" was rejected (breaks config-mirroring pages); an import-aware variant is the candidate. |
| Dead-declaration dedupe | Needs a shorthand-aware optimizer to stay cascade-safe. |
| Media hoist / global grouping | Rejected as cascade-unsafe. |
| `@variables` naming alias | Deferred pending user evidence (terminology note shipped instead). |
| CSS→cssx converter | Scrapped by the owner — do not resurrect. |

## Docs map

- **Usage:** [`docs/usage.md`](../docs/usage.md) — start here.
- **Reference:** [`SPECIFICATION.md`](../SPECIFICATION.md), [`docs/configuration.md`](../docs/configuration.md),
  [`docs/compatibility.md`](../docs/compatibility.md), [`docs/cascade.md`](../docs/cascade.md),
  [`docs/known-limitations.md`](../docs/known-limitations.md), [`docs/release.md`](../docs/release.md).
- **Decisions:** ADRs **0019–0024** in `docs/decisions/` (output lists, map inherit, CSS import,
  minify default, zero-config, media merge).
- **Reports:** `.ai/reports/CSSX-REVERSE-REFS.md`, `CSSX-FIX-PORTFOLIO-TOKEN.md`,
  `CSSX-MEDIA-MERGE.md`, `CSSX-DEFAULTS.md`, `CSSX-F18/F20/F21/F22/F23.md`,
  `CSSX-ID-COMPLETE.md`, `CSSX-ID-RENAME.md`, `CSSX-CLASS-RENAME.md`, `CSSX-STALE-DIAGS.md`,
  `CSSX-TERMINOLOGY.md`, `CSSX-FIX-GROUP-COMPLETE.md`, `CSSX-FIX-INTEGRATION.md`.
- **Board/tasks/plan:** `.ai/todo.md`, `.ai/tasks/`, `.ai/plans/CSSX-PLAN-PRODUCTION.md`,
  `.ai/PROGRESS.md`.

## Conventions

- Roles/routing per root [`AGENTS.md`](../AGENTS.md): `build` orchestrates, `code` writes,
  specialists verify; max four workers, disjoint write sets.
- No commit, push, tag, reset or stash without owner authorization. Publishing is a separate,
  explicit authorization.
- Full gates (`bun run release:check`) before claiming done; never weaken an assertion.
- Persist task, report, PROGRESS and board records; a mismatch opens a follow-up task.
- Read before editing; keep the smallest coherent change; report pre-existing failures separately.
