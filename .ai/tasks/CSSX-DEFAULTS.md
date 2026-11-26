# CSSX-DEFAULTS — zero-config defaults

**Status:** 🟢 done · **Requested by:** owner decision 2026-11-26 · **Scope:** CLI/compiler defaults,
example configs and module markers, release gate, docs/ADR, tests, records
**Packages:** `@chikx/compiler`, `@chikx/cli`, `@chikx/vscode` (comment only)

## Summary

- Make project configuration optional: a missing `chikx.config.json` is no longer an invocation
  error; the workspace root comes from the nearest `package.json` (ADR-0007) and discovery uses the
  default include `["**/*.cssx"]`. Explicit empty `include` and empty discovery still exit 2.
- Flip `compiler.strict` to `true` by default (unknown keys exit 2; `"strict": false` warns) and state
  `compiler.mediaGrouping: "safe"` explicitly in the CLI/compiler defaults and docs.
- Stop restating defaults in examples: delete boilerplate configs, add
  `@setup { module: true; }` to files that were listed in `exclude`, and keep only the
  `classes.prefix` config in `overrides` and `groups`.
- Add ADR-0023, update the release gate to build config-less examples from their own directory, and
  record the contract change in README/configuration/usage/release/CHANGELOG.
- Add tests for config-less discovery, default `include`, strict-by-default and explicit
  `strict: false`, plus config-less example discovery.

## Objective

1. Defaults: `strict: true`, `mediaGrouping: "safe"`, `include: ["**/*.cssx"]`, `exclude: []`.
2. Config-less project runs resolve the `package.json` workspace root and discover the default scope.
3. Examples demonstrate defaults; module files self-declare; committed output does not drift because
   of this change.
4. Release gate builds each example with `--config` only when that file exists.
5. Full gates green: `verify`, `release:check`, `lint`.

## Relevant files

- `packages/cli/src/config.ts`, `packages/cli/src/project.ts`, `packages/cli/src/compiler-api.d.ts`
- `packages/compiler/src/types/options.ts`
- `packages/vscode/src/config.ts` (comment only)
- `tests/integration/cli-config.test.ts`
- `examples/**` (configs, module markers, minimal `package.json` boundaries, READMEs)
- `package.json` (`release:check` examples loop)
- `docs/decisions/ADR-0023-zero-config-defaults.md`, `README.md`, `docs/configuration.md`,
  `docs/usage.md`, `docs/release.md`, `CHANGELOG.md`
- `.ai/tasks/CSSX-DEFAULTS.md`, `.ai/reports/CSSX-DEFAULTS.md`, `.ai/todo.md`,
  `.ai/plans/CSSX-PLAN-PRODUCTION.md`

## Dependency state

PP0–PP3 🟢; F18/F20/F21/F22/F23 + examples/modules 🟢. Baseline: verify 1284 pass / 2 skip / 0 fail,
host 14 scenarios / 872 assertions; browser 96/96; `release:check` nine examples; VSIX 18 files /
136.13 KB. No git commands; the uncommitted tree is preserved.

## Constraints

- Contract changes are documented in ADR-0023/CHANGELOG, never silent; no assertion weakening.
- Config deletion must not change discovery. Config-less examples therefore keep a minimal
  `package.json` so the workspace root stays the example directory instead of the enclosing repo.
- Gates sequential; long runs may background, never killed; preserve exit codes.
- If a config had to stay for discovery, record why. Only `overrides`/`groups` keep a config, because
  each demonstrates a non-default `classes.prefix`.

## Acceptance criteria

1. Config-less `chikx build` discovers `**/*.cssx` from the project directory; empty discovery exits 2;
   explicit configs still override.
2. `strict` defaults true and `"strict": false` warns; safe media grouping documented.
3. No `exclude` remains in `examples/`; module files carry `module: true`; boilerplate configs are
   deleted; all nine examples build and repeat builds are hash-identical.
4. Docs/ADR-0023/CHANGELOG and task/report/board/plan records are updated.
5. `bun run verify`, `bun run release:check` and `bun run lint` pass.

## Validation

```sh
bun run --cwd packages/compiler build && bun run --cwd packages/cli build
for example in basic responsive variables jsx custom-output overrides groups portfolio modules; do
  if [ -f "examples/$example/chikx.config.json" ]; then
    bun packages/cli/src/index.ts build --config "examples/$example/chikx.config.json"
  else
    (cd "examples/$example" && bun ../../packages/cli/src/index.ts build)
  fi
done
bun run verify
bun run release:check
bun run lint
```

## See also

- `.ai/reports/CSSX-DEFAULTS.md`
- `docs/decisions/ADR-0023-zero-config-defaults.md`
- `.ai/todo.md` feature 24
