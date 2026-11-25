# CSSX-A21 — `examples/overrides` token-strategy showcase

## Summary

- Add a sixth worked example, `examples/overrides/`, that demonstrates the token strategies settled
  by ADR-0015 and ADR-0016: real `--ui-*` runtime custom properties, two style-imported theme
  modules declaring the same `primary` property, an entry `@runtime` override that wins over both,
  module-order resolution, compile-time local overrides, namespace disambiguation and an imported
  keyframe reference.
- Build and commit the example's deterministic output (`generated/` + `.cssx-manifest.json`) the way
  the existing five examples do, with zero diagnostics.
- Wire the example into `release:check` and update the example list in `docs/release.md`; refresh the
  stale runtime-conflict rows in `FRAMEWORK.md`; flip todo items 4 and 5 after verification.
- Validation: the example build command and `bun run verify`.

## Objective

1. Create `examples/overrides/` with:
   - `chikx.config.json` applying the `ui` prefix to entry classes (`classes.prefix`; the CLI schema
     has no `naming` section — `classes` is the documented key and runtime names follow the same
     effective prefix);
   - `src/theme-base.cssx` — base runtime defaults (`primary`, `surface`, `on-surface`) plus the
     `@keyframes fade` block;
   - `src/theme-alt.cssx` — a clashing runtime `primary` source imported later;
   - `src/tokens.cssx` — compile-time `radius`, `primary`, `gap` used through a namespace;
   - `src/entry.cssx` — style-imports both theme modules, imports tokens with an alias, defines a
     local runtime `primary` that overrides both imports, shadows the unqualified compile-time
     `radius`, shows `$tokens.radius`/`$tokens.primary` alongside, and references
     `$keyframes.fade`;
   - `README.md` in the existing example style;
   - committed `generated/styles/*.css`, `generated/maps/*.js|.d.ts` and `.cssx-manifest.json`.
2. One rule per demonstrated strategy, each with a comment naming the strategy. Document in a
   comment that `theme-alt` would win the module-order resolution if the entry did not define
   `primary`.
3. Verify the built CSS: `:root` carries the entry's `--ui-primary`, `--ui-surface` comes from
   `theme-base`, the imported `@keyframes fade` block and `animation-name: fade` are present, entry
   classes are `ui-*`, and diagnostics are empty.
4. Add the example build to `release:check` and update `docs/release.md` "five examples" wording.
5. Refresh FRAMEWORK.md §3 step 6 and the §5.5 runtime-token row to describe ADR-0016 merge order;
   add the ADR-0015/ADR-0016 landed note to §11. Touch nothing else in that file.
6. Flip `.ai/todo.md` items 4 and 5 only after verification passes.

## Files

- New: `examples/overrides/**`, `.ai/tasks/CSSX-A21.md`, `.ai/reports/CSSX-A21.md`,
  `.ai/reports/logs/CSSX-A21.log`
- Edit: `package.json` (`release:check` example list only), `docs/release.md` (example list only),
  `.ai/framework/chikx/FRAMEWORK.md` (§3 step 6, §5.5 runtime row, §11 note only), `.ai/todo.md`
  (items 4/5 only)

## Dependencies

- ADR-0014 (`@use … styles`), ADR-0015 (`$keyframes.<name>`), ADR-0016 (runtime merge order).
- Existing CLI example builds (`bun packages/cli/src/index.ts build --config …`).
- No compiler/parser/CLI source change is expected; the example must build through the existing
  tooling.

## Constraints

- Exclusive write scope as listed above; `packages/**`, `tests/**`, SPECIFICATION.md, other docs and
  other `.ai` files are off-limits. A concurrent worker owns the formatter.
- Never weaken tests; output must be deterministic; no ad-hoc `bun build`/`tsc`.
- Preserve unrelated working-tree changes.

## Acceptance criteria

- `examples/overrides` builds with zero diagnostics and the CSS demonstrates entry-wins runtime
  override, module-order resolution (documented), compile-time local override, namespace
  disambiguation and an imported keyframe reference.
- Release wiring includes the sixth example and its build command passes.
- FRAMEWORK.md rows refreshed; todo items 4/5 flipped only after verification.
- `bun run verify` green (out-of-scope failures from the concurrent formatter worker reported by
  name).

## Validation

```sh
bun packages/cli/src/index.ts build --config examples/overrides/chikx.config.json
bun run verify
```
