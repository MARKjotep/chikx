# Chikx Handover — 2026-11-26

**Read this file alone to run the release when it is authorized.** It is self-contained; the plan,
board and reports are linked at the end for detail only.

## Release status

**Owner decision (2026-11-26): split PP4.** **PP4a — npm publication of `@chikx/compiler` and
`@chikx/cli` — is the next authorized action** (owner-run, still parked until explicitly authorized).
**PP4b — the VS Code Marketplace extension — is deferred.** **Nothing is published** — not npm, not
the Marketplace. Do not tag, publish or push release artifacts without new explicit owner
authorization.

## State

- **Working tree is clean and pushed to `origin/main`.** `1ec431f`
  (`chore(release): v0.1.0`) is the v0.1.0 source-release commit; the docs-cleanup commit follows it.
- **Final gates, re-run on 2026-11-26:**
  - `bun run verify` exit 0 — **1351 pass / 2 skip / 0 fail** (1353 tests, **99 files**); extension
    host **15 scenarios / 928 assertions** (`navigation=42`); typecheck and Biome green
    (**459 files**).
  - Browser **96/96** — 32 per engine (Chromium, Firefox, WebKit).
  - `bun run release:check` exit 0 in about **4 minutes** — **nine** examples built, compiler
    tarball **323 files**, CLI tarball **89**, VSIX **18 files / 140.6 KB**.
- **Runtime:** Node.js **≥ 20** (`engines`) or Bun. Gates ran on Bun 1.4.5; only Node 24.22.3 was
  installed here, so **Node 20/22 are unverified**. The CLI entry is ESM with a node shebang.
- `opencode.jsonc` is present and carries the agent registrations; it is not deleted. `.ai/agents/`
  exists but is an empty directory.
- Full user guide: **[`docs/usage.md`](../docs/usage.md)**.

## What changed since the previous handover

Production phases **PP0–PP3 executed** (baseline, packaging, metadata/docs, owner manual smoke).
The feature wave and the editor wave landed on top. The authoritative per-item record is the plan's
`## Implementation Progress` table (`.ai/plans/CSSX-PLAN-PRODUCTION.md`); one line each:

| Area | Landed | Record |
|---|---|---|
| Release engineering | CLI `bin` → `dist/index.js` + node shebang; VSIX 84 → 18 files; manifest URLs → `MARKjotep/chikx`; CHANGELOG `[0.1.0]`; docs counts/limits aligned | `.ai/reports/CSSX-PP1.md`, `CSSX-PP2.md` |
| F18 `css-dir` lists | Comma-separated in-workspace stylesheet destinations, one artifact/manifest record per item | ADR-0019, `.ai/reports/CSSX-F18.md` |
| F20 `map-inherit` | Opt-out keeps a merged module's class bindings out of the importer's map/`.d.ts` | ADR-0020, `.ai/reports/CSSX-F20.md` |
| F21 `import-css` | Opt-in single side-effect CSS import at the top of `map.js` | ADR-0021, `.ai/reports/CSSX-F21.md` |
| F22 minified default | `minify` defaults true; `--no-minify` / `minify: false` opt out; CSS only | ADR-0022, `.ai/reports/CSSX-F22.md` |
| F23 group hover | Multi-line defaults list + separate use-site overrides section | `.ai/reports/CSSX-F23.md` |
| `examples/modules` | Ninth example: three modules, `map-inherit: false`, `css-dir` list, no `exclude` | `.ai/reports/CSSX-EXAMPLE-MODULES.md` |
| Zero-config defaults | Config optional, default include `**/*.cssx`, `strict: true`, safe grouping, module markers | ADR-0023, `.ai/reports/CSSX-DEFAULTS.md` |
| Media merge | Opt-in `mediaGrouping: "merge"`; `safe` stays default; browser differential **27/27** | ADR-0024, `.ai/reports/CSSX-MEDIA-MERGE.md` |
| Selector ids | `#` completion from document ids; single-file id rename (hash survives) | `.ai/reports/CSSX-ID-COMPLETE.md`, `CSSX-ID-RENAME.md` |
| Class rename | Single-file class rename, `:global(...)` excluded/refused | `.ai/reports/CSSX-CLASS-RENAME.md` |
| Attribute selectors | Full operator/flag/namespace matrix + browser proof; no behaviour change | `.ai/reports/CSSX-ATTR-TESTS.md` |
| Stale importer diagnostics | Dependency change invalidates caches and refreshes open importers | `.ai/reports/CSSX-STALE-DIAGS.md` |
| Reverse references | Find All References is bidirectional for `$token`/`@runtime`; rename stays single-file | `.ai/reports/CSSX-REVERSE-REFS.md` |
| Terminology | `@variables` vs `@runtime` note at usage §2.3/§2.4; alias deferred | `.ai/reports/CSSX-TERMINOLOGY.md` |
| Portfolio stale token | `$space.gutter` → `$space.gutters`; check 0, two byte-identical builds | `.ai/reports/CSSX-FIX-PORTFOLIO-TOKEN.md` |
| Bug 25 | Group-body (`@group.<name> {}`) CSS property completion | `.ai/reports/CSSX-FIX-GROUP-COMPLETE.md` |

## Plans and board

- Production plan: **PP0–PP3 🟢**; **PP4a (npm) is the next authorized action**, **PP4b
  (Marketplace) is deferred**, **PP5a/PP5b 🔴** — all parked until explicit owner authorization
  (owner decision 2026-11-26). Testing and UI campaigns are closed.
- Board (`.ai/todo.md`): feature items **18–28** and bugs **25–27** are 🟢. Item **24** was reused
  for zero-config defaults; the old CSS→cssx converter idea was scrapped — **do not resurrect it**.
- `.ai/PROGRESS.md` is the historical execution log; `.ai/reports/` holds the evidence for every
  task. Task prompts are disposable and are **not** retained (there is no task-prompt directory).

## Documentation layout after the 2026-11-26 cleanup

- **`SPECIFICATION.md` is the single normative source.** `docs/usage.md` is the user guide.
  `AGENTS.md` is the workflow contract.
- Removed as superseded or redundant: the pre-rename design proposal, the original P0–P7 plan, the
  completed task prompts, the three redirect README stubs under the grammar, cascade and
  configuration directories, and raw worker `.log` files. `.ai/reports/logs/*.json` and
  `logs/ui-screens/**` remain.
- `docs/grammar.md`, `docs/cascade.md` and `docs/configuration.md` are the real references.
- Retired framework bug records were removed; the macOS launcher workaround is documented in
  `docs/release.md`, `docs/known-limitations.md` and `packages/vscode/README.md`.

## ⏭ PP4a — npm publication (compiler + CLI; owner-run, parked until authorized)

The owner decided on 2026-11-26 to split the release: **npm first (`@chikx/compiler` + `@chikx/cli`),
the VS Code Marketplace extension later**. Everything below is release execution only. No source
changes are expected or authorized here.

### 1. Prerequisites (npm)

1. `npm whoami` must return the account that owns, or is a member of, the **`@chikx`** scope (user
   or org). If not logged in, `npm login`. Have an OTP ready if 2FA is enabled.
   Scoped packages default to restricted, so **every npm publish below needs `--access public`**.
2. Git identity and credentials for the authorized commit and tag.
3. Do not paste tokens, OTPs or account names into the repo or a report.

### 2. Shell note

The repository path contains `$`, so **quote it** in every command:

```sh
cd '/Users/Marky/Desktop/$/chikx'
```

### 3. Step 0 — the gate (must be green immediately before publishing)

```sh
bun run release:check
```

Exit **0** is the requirement. Expect roughly: verify 1351/2/0 (99 files, host 15/928), browser
96/96, nine examples, VSIX 18 files / 140.6 KB, about 4 minutes. Small timing drift is fine; a red or
partial gate is not. Publishing is irreversible — do not proceed on a hunch.

### 4. Authorized commit and tag

Only after explicit owner authorization:

1. Confirm `git status` is empty and the gates above are green on the current `origin/main` commit.
2. Commit any newly authorized changes, then tag the commit: `git tag -a v0.1.0`. Push commits/tags
   only if the owner authorized the push.
3. If the tag lands after **2026-11-26**, bump the `[0.1.0]` date in `CHANGELOG.md` **before**
   tagging, and rebuild nothing else.

### 5. Publish (order matters: compiler first)

```sh
npm publish --workspace @chikx/compiler --access public
npm publish --workspace @chikx/cli --access public
```

- The CLI depends on the compiler; npm rewrites `workspace:*` to the exact published version, so the
  compiler must exist first.

### 6. npm post-checks

```sh
npm view @chikx/compiler version     # 0.1.0
npm view @chikx/cli version          # 0.1.0
mkdir -p /tmp/chikx-pp4a && cd /tmp/chikx-pp4a
npm init -y && npm i @chikx/cli@0.1.0
npx chikx --version                  # 0.1.0
npx -y @chikx/cli@0.1.0 --version    # unambiguous package specifier
bunx @chikx/cli@0.1.0 --version
```

- `npx chikx` alone resolves a package literally named `chikx`; the CLI package is `@chikx/cli`,
  so install it first (as above) or use the specifier.

### 7. Docs follow-up after success

Only after the publish succeeds, update the docs that carry the "not yet published" caveat: drop the
registry caveat in `README.md`, `docs/usage.md`, `packages/compiler/README.md` and
`packages/cli/README.md`, and state that the **extension is not yet on the Marketplace**. Never claim
a publish before it succeeds.

### 8. Failure rules

- **Published versions are immutable.** Never `npm unpublish` or withdraw. A bad release is
  superseded by **0.1.1**, never removed.
- If one package succeeds and the second fails, publish the remaining package anyway and record
  exactly what shipped where.
- If the failure is auth/transient, retry the same version. If code must change in an
  already-published package, bump that package (and the CLI, whose dependency is pinned to the
  published compiler version).
- Record the outcome, version and any partial state in `.ai/reports/` immediately.

## ⏭ PP4b — VS Code Marketplace (deferred by owner 2026-11-26)

### 1. Prerequisites

1. Publisher **`chikx`** on the VS Code Marketplace.
2. A PAT with Marketplace *Manage* scope; `npx @vscode/vsce login chikx` stores it (or export
   `VSCE_PAT`).
3. Do not paste tokens into the repo or a report.

### 2. Publish

```sh
cd packages/vscode && npx @vscode/vsce publish
```

`vsce publish` takes the publisher from the manifest (`chikx`); no extra flag is needed.

### 3. Version rule

**0.1.0 is still publishable later if the extension source is unchanged** since `1ec431f`. If the
extension source changed in the meantime, publish **0.1.1** instead — never republish 0.1.0 from
different sources.

### 4. Interim distribution

The local `chikx-0.1.0.vsix` produced by `release:check` is self-contained (no CLI, npm or Bun
needed) and can be distributed by hand in the meantime.

### 5. Failure rule

Marketplace failure after npm success: npm artifacts stay; retry `vsce publish` or publish the VSIX
from the Marketplace UI. Never re-publish npm to "match". Record the outcome in `.ai/reports/`.

## ⏭ PP5a — npm post-release verification

From a clean environment (fresh profile, no workspace symlinks):

1. `npm i @chikx/cli && npx chikx --version`; `bunx @chikx/cli@0.1.0 --version`.
2. Run the `docs/usage.md` quick start end to end with `chikx build`: optional config, two `.cssx`
   files, generated CSS/map, JSX import, and a rendered page.
3. Write the checklist with **actual outputs** to `.ai/reports/CSSX-PP5A.md`. Any mismatch opens a
   follow-up task; never edit a published claim in place.

## ⏭ PP5b — extension post-release verification (after PP4b)

1. Install the extension from the Marketplace **and** the local VSIX in a clean profile.
2. Check activation, diagnostics, completion, semantic token colours, color swatches and preview.
3. Write the checklist with **actual outputs** to `.ai/reports/CSSX-PP5B.md`. Any mismatch opens a
   follow-up task.

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
  (`examples/portfolio/README.md#replace-placeholder-content`). It is committed and its generated
  output is rebuilt by `release:check`.
- **`examples/portfolio/src/nas.cssx`** is a scratch stylesheet; it now declares `module: true` so
  ad-hoc builds emit nothing into `src/`. The `nas.css`/`nas.map.js` artifacts captured by the
  release gate's example build in `1ec431f` were deleted.
- **`bunx chikx` at the repo root** cannot resolve the workspace bin (no root install link;
  pre-existing). For local runs use the built entry (`node packages/cli/dist/index.js`); the
  published package is unaffected.
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

- **Normative:** [`SPECIFICATION.md`](../SPECIFICATION.md).
- **User guide:** [`docs/usage.md`](../docs/usage.md) — start here for users.
- **References:** [`docs/grammar.md`](../docs/grammar.md), [`docs/cascade.md`](../docs/cascade.md),
  [`docs/configuration.md`](../docs/configuration.md), [`docs/compatibility.md`](../docs/compatibility.md),
  [`docs/known-limitations.md`](../docs/known-limitations.md), [`docs/release.md`](../docs/release.md).
- **Decisions:** ADRs **0019–0024** in `docs/decisions/` (output lists, map inherit, CSS import,
  minify default, zero-config, media merge).
- **Reports:** `.ai/reports/CSSX-REVERSE-REFS.md`, `CSSX-FIX-PORTFOLIO-TOKEN.md`,
  `CSSX-MEDIA-MERGE.md`, `CSSX-DEFAULTS.md`, `CSSX-F18/F20/F21/F22/F23.md`,
  `CSSX-ID-COMPLETE.md`, `CSSX-ID-RENAME.md`, `CSSX-CLASS-RENAME.md`, `CSSX-STALE-DIAGS.md`,
  `CSSX-TERMINOLOGY.md`, `CSSX-FIX-GROUP-COMPLETE.md`, `CSSX-FIX-INTEGRATION.md`.
- **Board/plan:** `.ai/todo.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md`, `.ai/PROGRESS.md`. There is no
  task-prompt directory and no superseded design proposal.

## Where to look

- **Users:** `README.md`, `docs/usage.md`, `docs/configuration.md`, `examples/`.
- **LLMs/agents:** `AGENTS.md`, this handover, `SPECIFICATION.md`,
  `.ai/plans/CSSX-PLAN-PRODUCTION.md`, `.ai/reports/`.

## Conventions

- Roles/routing per root [`AGENTS.md`](../AGENTS.md): `build` orchestrates, `code` writes,
  specialists verify; max four workers, disjoint write sets.
- No commit, push, tag, reset or stash without owner authorization. Publishing is a separate,
  explicit authorization.
- Full gates (`bun run release:check`) before claiming done; never weaken an assertion.
- Persist reports and board records; a mismatch opens a follow-up task.
- Read before editing; keep the smallest coherent change; report pre-existing failures separately.
