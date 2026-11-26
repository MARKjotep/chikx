# CSSX-BASIC-EXAMPLE — align the `examples/basic` README with the current source

## Summary

- The owner decided (2026-11-26) to keep the personal-test content now in
  `examples/basic/src/button.cssx` and update the example's documentation to match it, instead of
  restoring the canonical §2 file.
- `examples/basic` is therefore no longer "the canonical example, byte-for-byte"; the README and the
  doc references that still claim so must describe what it actually demonstrates.
- Source and committed output are not edited; only docs and these records.

## Objective

Document the current `examples/basic` source honestly: a feature tour on the canonical project layout
(`@setup` with `minify: false`, token-only `@use`, `@variables`, `@runtime` with a dark override, an
unused `@group.clr`, inline variants, nesting, dropped empty rules, a keyframe with a substituted
token) and the output it produces (pretty-printed CSS, `button`/`icon`/`test` map bindings).

## Files

- `examples/basic/README.md`
- Narrow corrections in `docs/grammar.md` and `docs/usage.md`; root `README.md` checked and left
  unchanged (its "Canonical example" block is the SPECIFICATION §2 snippet, and its
  "complete, committed output" sentence remains true).
- `.ai/tasks/CSSX-BASIC-EXAMPLE.md`, `.ai/reports/CSSX-BASIC-EXAMPLE.md`

## Constraints

- No edits to `examples/basic/src/**`, `examples/basic/generated/**` or any other example.
- Keep the existing build instructions, the deterministic-output paragraph and the example-README
  voice.
- No git commands, no dependency changes.

## Acceptance criteria

1. `examples/basic/README.md` matches the current source and output; no false "canonical
   byte-for-byte" claim remains.
2. Remaining doc references that call `basic` canonical are corrected.
3. Two clean rebuilds are hash-identical to the committed output; `bun run lint` is green.
4. Records persisted.

## Validation

```sh
bun run --cwd packages/compiler build
bun run --cwd packages/cli build
cd examples/basic && node ../../packages/cli/dist/index.js build   # twice
shasum -a 256 generated/styles/button.css generated/maps/button.map.js
bun run lint
```
