# CSSX PP4A — npm Staging (@chikx/compiler, @chikx/cli 0.1.0)

**Status: 🔴 BLOCKED — do not publish.** Packed CLI manifest retains `"@chikx/compiler": "workspace:*"`; a clean consumer install fails with `EUNSUPPORTEDPROTOCOL`. Second, independent gate: no npm auth (`npm whoami` fails).

Repo: `/Users/Marky/Desktop/$/chikx` @ `1ec431f`, npm 11.19.1, Bun 1.4.5, Node 24.22.3.
Builds: `bun run --cwd packages/compiler build` exit 0; `bun run --cwd packages/cli build` exit 0.

## Build sanity

| Check | Result |
| --- | --- |
| `node packages/cli/dist/index.js --version` | `0.1.0` (exit 0) |
| `head -1 packages/cli/dist/index.js` | `#!/usr/bin/env node` |
| `packages/compiler/dist/index.js`, `dist/index.d.ts` | present (32.7 kB / 6.2 kB) |
| Files on disk (dist) | compiler 320, CLI 68 |

## Tarballs (`npm pack --pack-destination $TMP`)

| Package | Tarball | Bytes | Unpacked | Files | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| @chikx/compiler | chikx-compiler-0.1.0.tgz | 242801 | 1036105 | 323 | `4091673425ceaffe6d6d7e0ee87f588172f1b440f12ef8e411faa3880aac89a6` |
| @chikx/cli | chikx-cli-0.1.0.tgz | 85436 | 386768 | 89 | `68419af610a038f4d993a60e4d9c6519049a9bc85b68685d60dbe580c0abf32e` |

File counts match expectation (323 / 89). Each tarball contains `package.json`, `README.md`, `LICENSE`, `dist/**`; compiler adds no `src/`, CLI adds 18 `src/` files (intended by `files: ["dist","src"]`). Compiler tarball has no `dependencies` key; `files: ["dist"]`, `main`/`types`/`exports` all point at `./dist/*`.

## Blocker 1 — `workspace:*` survives packing (verbatim, from tarball)

`tar -xzOf chikx-cli-0.1.0.tgz package/package.json`:

```json
"dependencies": {
  "@chikx/compiler": "workspace:*"
}
```

npm 11.19.1 does not rewrite the `workspace:` protocol at pack/publish (that rewrite is a pnpm/bun-pack feature). Proven consumer impact (temp dir, tarballs only):

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
INSTALL_EXIT=1
```

Per instructions the smoke test was stopped here; no manifest was modified.

Candidate fixes (both unapplied):
1. Set `packages/cli/package.json` → `"@chikx/compiler": "0.1.0"`, then refresh `bun.lock` (`bun install`) and re-pack/verify.
2. Publish via a tool that substitutes the protocol at pack time (e.g. `pnpm pack`/`pnpm publish` on the workspace, or `bun publish`), leaving the manifest source unchanged — verify the resulting tarball manifest before pushing.

## Blocker 2 — npm auth

`npm whoami` → failure (no usable credential/2FA session). `npm config get registry` → `https://registry.npmjs.org/`. Owner must authenticate locally before any real publish (no login performed by this task).

## Dry-run publish (safe, nothing written to registry)

| Command | Exit | name@version | Files | Package size | shasum |
| --- | --- | --- | --- | --- | --- |
| `npm publish --workspace @chikx/compiler --access public --dry-run` | 0 | `@chikx/compiler@0.1.0` | 323 | 242.8 kB | `5068435d…` |
| `npm publish --workspace @chikx/cli --access public --dry-run` | 0 | `@chikx/cli@0.1.0` | 89 | 85.4 kB | `ba646f97…` |

Both logged `Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)`. Dry-run does not validate dependency resolvability, so exit 0 does not clear Blocker 1.

## Consumer smoke test

Not run — blocked at step 4 by the surviving `workspace:*` (install itself fails, see evidence above). The ESM-import, `npx chikx --version`, and `build`/`check` checks remain unverified and must be rerun after the fix.

## Commands for the owner (only after both blockers clear)

```bash
cd "/Users/Marky/Desktop/$/chikx"
npm publish --workspace @chikx/compiler --access public
npm publish --workspace @chikx/cli --access public
```

## Observations

- Neither package declares `engines` (root does: node >=20); consumers get no Node floor warning.
- Neither declares `publishConfig` (fine for public scoped publish with `--access public`, but explicit `{"access":"public"}` would prevent accidental private scoping).
- No `repository`/`homepage`/`bugs` in either manifest — npm pages will lack source links.
- `dist/` is gitignored and there is no `prepack`/`prepublishOnly` build, so publishing from a clean checkout would ship stale or missing output.
- CLI ships TypeScript `src/` (18 files) plus `.map` files in both packages; intentional but adds ~40% to CLI tarball.
- Source maps reference `../../src/*.ts` that consumers do not receive for the compiler.
