# CSSX-FIX-PORTFOLIO-TOKEN — stale `$space.gutter` reference after token rename

## Objective

1. Update the single stale reference in `examples/portfolio/src/layout.cssx` from
   `2 * $space.gutter` to `2 * $space.gutters`. Nothing else in that file.
2. Rebuild the portfolio example config-less from its directory
   (`packages/compiler` + `packages/cli` build first, then `node packages/cli/dist/index.js build`)
   and confirm `chikx check --json` exits 0 and the generated CSS is current.
3. Rebuild twice and confirm byte-identical output.
4. Run `bun run verify`, `bun run release:check`, `bun run lint` — all green.
5. Persist this task file plus `.ai/reports/CSSX-FIX-PORTFOLIO-TOKEN.md`.

## Provenance

The owner rename test renamed the token definition `gutter: 20px` → `gutters: 20px` in
`examples/portfolio/src/tokens.cssx:33` but left the importer in `layout.cssx` stale. The
compiler's `CHIKX2001` unknown-namespace-export diagnostic caught it; the config-less example
check in `tests/integration/cli-config.test.ts` ("config-less examples…") surfaced it as the only
failure in an otherwise green suite. The catcher works as intended — the fix is to complete the
rename, not to revert the definition. **No compiler or CLI change.**

## Write set

- `examples/portfolio/src/layout.cssx` (one reference)
- `examples/portfolio/generated/**` (rebuilt output + map)
- `.ai/tasks/CSSX-FIX-PORTFOLIO-TOKEN.md`, `.ai/reports/CSSX-FIX-PORTFOLIO-TOKEN.md`

## Constraints

- Do not revert the `gutters` definition; do not touch other examples, tokens, compiler, CLI or editor.
- No git commands; preserve the uncommitted working tree.
- Single intensive build slot, single Playwright runner (respected: gates run serially).

## Acceptance criteria

| # | Criterion | Status |
| - | --------- | ------ |
| 1 | Reference reads `$space.gutters`; `chikx check` exit 0 in `examples/portfolio` | 🟢 |
| 2 | Two consecutive builds byte-identical; token resolves to `20px` in output | 🟢 |
| 3 | `bun run verify` green (1345 pass / 2 skip / 0 fail) | 🟢 |
| 4 | `bun run release:check` green (incl. 96 browser tests) | 🟢 |
| 5 | `bun run lint` green | 🟢 |
| 6 | Records persisted; no other files touched | 🟢 |

## Validation commands

```
bun run --cwd packages/compiler build && bun run --cwd packages/cli build
cd examples/portfolio && node ../../packages/cli/dist/index.js check --json
cd examples/portfolio && node ../../packages/cli/dist/index.js build   # twice
bun run verify
bun run release:check
bun run lint
```
