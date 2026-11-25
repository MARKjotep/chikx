# CSSX-A22 — Prettier-like format-on-save for `.cssx` in VS Code

## Summary

- Wire the compiler's existing pure `format(source, file)` into the VS Code extension: a
  full-document `DocumentFormattingEditProvider` plus a `chikx.editor.formatOnSave` setting
  (default **false**) implemented with `workspace.onWillSaveTextDocument`.
- Manual **Format Document** / ⌥⇧F and `editor.formatOnSave: true` work through the provider;
  the Chikx-specific setting formats on save without enabling global format-on-save.
- Formatting is document-level only (the compiler formatter is parse→print): no range formatter,
  documented in `docs/known-limitations.md`.
- Parse-error documents are saved byte-identical; a `CHIKX1002` (missing semicolon) is never
  silently repaired by the formatter — the authoritative canonical printer still adds `;` to
  semicolonless plain-CSS final declarations.

## Objective

1. Add a pure (`vscode`-free) formatting module that calls the compiler barrel's `format()` and
   returns a single full-document edit **only** when the canonical output differs from the input
   and parsing produced no error.
2. Add the adapter provider and register it for `chikx`; add the `chikx.editor.formatOnSave`
   setting (boolean, default false) and a `onWillSaveTextDocument` listener that requests the
   formatting edit for manual/auto saves (not focus-out saves).
3. Pin formatter robustness for the current grammar (`$keyframes.<name>` values from ADR-0015 and
   `@use "…" as x styles;` from ADR-0014) with round-trip tests under `tests/extension/`.
4. Verify the save path: default off saves untouched; parse errors save untouched; no interaction
   with the `CHIKX1002` quick fix; report the formatter's actual semicolonless behavior.
5. Replace only the "formatting provider" known-limitation row with the remaining
   document-level-only limitation.

## Files

- Create: `packages/vscode/src/formatting.ts` (pure logic, compiler barrel only)
- Create: `packages/vscode/src/providers/formatting.ts` (VS Code adapter)
- Modify: `packages/vscode/src/controller.ts` (register provider + will-save listener)
- Modify: `packages/vscode/package.json` (contribute `chikx.editor.formatOnSave`)
- Modify: `packages/vscode/test/suite.js` (extension-host acceptance checks)
- Modify: `tests/extension/host.test.ts` (always rebuild the extension bundle before the host run)
- Create: `tests/extension/provider.formatting.test.ts` (pure formatting tests)
- Create: `tests/extension/formatter.current-grammar.test.ts` (`$keyframes.` / `styles` round trip)
- Modify: `docs/known-limitations.md` (only the editor-formatting row)
- Create: `.ai/reports/CSSX-A22.md`, `.ai/reports/logs/CSSX-A22.log`

## Dependencies

- Compiler public barrel already exports `format(source, file)` (`FormatResult`); no compiler change
  is required or permitted.
- Existing extension patterns: `intelligence.ts` / `quickfixes.ts` are pure modules; the controller
  owns registration and disposal.
- ADR-0014 (`@use … styles`) and ADR-0015 (`$keyframes.<name>`) are normative; their formatter
  behavior is verified, not changed here.

## Constraints

- Exclusive write scope: `packages/vscode/**`, `tests/extension/**`, `.ai/tasks/CSSX-A22.md`,
  `.ai/reports/CSSX-A22.md`, `.ai/reports/logs/CSSX-A22.log`.
- **HARD OFF-LIMITS:** `packages/compiler/**`, `tests/compiler/**`, `tests/fixtures/**`,
  `.ai/todo.md`, `SPECIFICATION.md`, `docs/**` except the single formatting row in
  `docs/known-limitations.md`.
- Preserve existing public imports/keys/behavior; keep the pure logic free of `vscode`; deterministic
  tests with no fixed sleeps; never weaken existing assertions.
- A formatter defect discovered for new syntax is reported as a blocker, not fixed in the compiler.

## Acceptance criteria

- The pure module returns no edit for already-formatted input or a parse-error document, and one
  full-document edit otherwise.
- Format Document works in the extension-host suite; `chikx.editor.formatOnSave: true` formats on
  save there; the default (`false`) leaves files untouched; parse-error saves are unchanged.
- Round-trip tests pass for `$keyframes.<name>` and, once the compiler formatter preserves the
  `styles` flag, for `@use "…" as x styles;` (current behavior is recorded and reported).
- `bun run verify` is green for the extension scope; any unrelated failing file is named in the
  report.

## Validation

- `bun run verify`
- `bun test tests/extension`
- `bun test tests/extension/provider.formatting.test.ts tests/extension/formatter.current-grammar.test.ts`
