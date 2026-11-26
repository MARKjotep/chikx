# CSSX-MEDIA-MERGE — Opt-in merge grouping (`mediaGrouping: "merge"`)

## Summary

- Add an opt-in `mediaGrouping: "merge"` mode that merges same-selector/same-condition media runs
  across declarations of provably disjoint property families.
- Keep `safe` as the public default everywhere; `merge` changes nothing unless explicitly enabled.
- Expose `@setup { media-grouping: merge | safe | none; }` with project < file precedence,
  `CHIKX1001` on invalid values, editor value completion and a Markdown hover card.
- Prove cascade neutrality with a browser differential (`merge` vs `none`) and freeze the
  property-family data in unit tests.

## Objective

1. **Merge pass.** Keep the safe adjacent pass, then merge a conditional run `i` into a later run
   `j` iff the selector chain, condition string and native context are identical, both conditions
   are non-empty, every declaration of every run strictly between them is in a property family
   disjoint from every declaration of run `i`, and neither run contains a wildcard. Move source
   declarations before destination declarations, preserve relative order, delete the source run and
   iterate to a fixpoint. Native blocks are barriers.
2. **Property families.** Strip one of `-webkit-`, `-moz-`, `-ms-`, `-o-`; custom properties keep
   their full case-sensitive name; otherwise take the segment before the first `-`. Add a frozen,
   documented override table for standard shorthands/aliases that do not share that segment. `all`
   and values containing `var(` are wildcards.
3. **Wiring.** `MediaGroupingMode = "safe" | "none" | "merge"`, default `safe` in the compiler, CLI
   config and editor. `@setup media-grouping` resolves defaults < project config < file, with
   `CHIKX1001` and an in-bounds span on invalid values. Completion offers `merge`, `safe`, `none`;
   hover pins a mode card.
4. **Proof and gates.** Browser differential requires computed-style equality for `safe`, `none`
   and `merge` at every viewport/scheme/engine. Default-output goldens and all nine examples stay
   byte-identical (verified by SHA-256 before/after).

## Relevant files

- Compiler: `packages/compiler/src/lowering/property-families.ts`, `merge.ts`, `group.ts`,
  `lowering/index.ts`, `types/options.ts`, `index.ts`.
- CLI: `packages/cli/src/config.ts`, `packages/cli/src/compiler-api.d.ts`.
- Editor: `packages/vscode/src/intelligence.ts`, `analysis.ts`, `config.ts`,
  `packages/vscode/test/ui/completions.js`, `packages/vscode/test/ui/hovers.js`.
- Tests: `tests/compiler/property-families.test.ts`, `media-merge.test.ts`,
  `media-merge-setup.test.ts`, `tests/extension/provider.intelligence.test.ts`,
  `tests/integration/cli-config.test.ts`, `tests/browser/specs/grouping.pw.ts`,
  `tests/browser/harness/build.ts`, `tests/browser/harness/scenarios.ts`,
  `tests/browser/specs/support.ts`, `tests/stress/cli/exit-codes.test.ts` (error text).
- Docs/records: ADR-0024, SPECIFICATION, docs/configuration, docs/usage, docs/cascade,
  docs/compatibility, README, CHANGELOG, `.ai/todo.md`, `.ai/plans/CSSX-PLAN-PRODUCTION.md`.

## Constraints

- Soundness first; a missed merge is acceptable, a changed cascade is not.
- No default-output regeneration: `safe` remains the default, so goldens/examples must not change.
- No assertion weakening; explicit-mode tests keep their expectations.
- Deterministic output and sequential gates.

## Acceptance criteria

1. `merge` is opt-in; `safe`/`none` behaviour and bytes unchanged.
2. Allowed/blocked merge cases pinned by unit tests.
3. Browser differential green on all installed engines.
4. `@setup media-grouping` precedence + `CHIKX1001` pinned; editor completion/hover pinned and host
   assertions updated (15 setup keys).
5. Goldens/examples unchanged and hash-identical; sizes recorded.
6. ADR-0024 + docs + CHANGELOG + records + board/plan persisted.
7. `bun run verify`, `bun run release:check`, `bun run lint` green.

## Validation

`bun run --cwd packages/compiler build && bun run --cwd packages/cli build`; targeted
`bun test tests/compiler/… tests/integration/… tests/extension/…`;
`bunx playwright test tests/browser/specs/grouping.pw.ts`; `bun run verify`;
`bun run release:check`; `bun run lint`; example double builds with `shasum -a 256`.
