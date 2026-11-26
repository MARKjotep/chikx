# CSSX-ATTR-TESTS — attribute-selector coverage before release

## Summary

- Add the missing attribute-selector coverage before the release: the full operator/flag matrix in
  compiler tests, one attribute-driven declaration proven in real browsers, rename/completion
  isolation pins, and a compatibility-matrix row.
- Additive coverage only. No compiler behaviour change is expected; if a test uncovers a real defect,
  stop and report it with a repro instead of landing a known-failing case.

## Objective

1. **Compiler emission/selector tests** (new file or the natural existing selector/emit test):
   - Operators `[attr]`, `[attr="v"]` (double and single quotes), unquoted `[attr=v]`, `[attr~="v"]`,
     `[attr|="v"]`, `[attr^="v"]`, `[attr$="v"]`, `[attr*="v"]`, flags `i`/`s`, namespaced
     `[ns|attr]`, and whitespace variations inside the brackets.
   - Values that look like Chikx syntax survive byte-for-byte: `".icon"`, `"#id"`, `"A & B"`,
     `"$token"`, URLs, escaped quotes and unicode.
   - Selector composition: `h1#hero > .card[data-x=".icon"]:not(#id)`, `&[aria-expanded="true"]:hover`
     flattening, comma lists mixing attributes with classes.
   - Prefixing/renaming: local classes outside brackets are renamed; attribute names, operators,
     values and flags are never touched; attribute selectors never enter the class map.
   - Parser rejects stay in `selectors.test.ts` and are not duplicated.
2. **Rename/completion isolation**: class rename leaves an attribute value equal to the class name
   unchanged; completion offers no class suggestions inside an attribute value.
3. **Real-browser proof**: extend the existing `states` scenario with one attribute-driven
   declaration and assert its computed value; keep pretty/minified and grouping/merge parity green
   in Chromium, Firefox and WebKit.
4. **Docs/records**: `docs/compatibility.md` §1 row, optional `docs/usage.md` sentence, this task,
   the report and one `ATTR` row in `.ai/plans/CSSX-PLAN-PRODUCTION.md`. No CHANGELOG and no todo item.

## Write set

`tests/compiler/**`, `tests/extension/**`, `tests/browser/**`, `docs/compatibility.md`,
`docs/usage.md`, `.ai/tasks/CSSX-ATTR-TESTS.md`, `.ai/reports/CSSX-ATTR-TESTS.md`,
`.ai/plans/CSSX-PLAN-PRODUCTION.md`. No `packages/**/src` changes unless a test proves a defect.

## Acceptance criteria

1. The operator/flag matrix and value-preservation cases are pinned.
2. Rename/completion isolation pinned (attribute values untouched; no suggestions inside values).
3. One attribute-driven declaration verified by computed style in all three engines; parity/grouping
   specs still green.
4. Compatibility row, plan row, task and report persisted; all gates green.
5. If a real defect surfaced: reported with repro, no failing test landed, status PARTIAL.

## Validation

`bun test tests/compiler/ tests/extension/` during development; `bun run verify`;
`bun run release:check`; `bun run lint`; read-back of records.
