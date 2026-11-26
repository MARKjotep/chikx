# CSSX-U06 — Preview of a dead document opens an empty tab instead of the warning

**Status:** 🟢 fixed · **Found by:** U4 (`.ai/reports/CSSX-U4.md` "CSSX-U4-A") · **Severity:** low
**Package / API:** `packages/vscode` — `src/controller.ts` `previewCss` (the `css === undefined` guard)
and the compiled-CSS preview virtual document (`chikx-preview:`).

## Summary

- `Chikx: Preview Compiled CSS` on a document that cannot be compiled opens a `chikx-preview:` tab with
  **empty text** instead of the intended warning — the tab looks like a broken feature rather than a
  failed compile.
- The guard in `previewCss` only fires when the compiler returns `undefined` CSS. The tolerant compiler
  returns an **empty string** for a dead document, so the warning branch is unreachable and the preview
  is published with `""`.
- Measured: all five probe documents (`unterminated`, `garbage`, `bad-setup`, `empty`, `comment-only`)
  still opened a `chikx-preview:` document; only `garbage`, `empty` and `comment-only` produced empty
  CSS. A *broken but tolerant* document (missing semicolon) correctly previews the surviving CSS **and**
  keeps its diagnostic, so the tolerance itself is right — the defect is only the empty-output path.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-U4.md` — "CSSX-U4-A — Preview of a dead document opens an empty tab instead of the warning (pinned, not skipped)" |
| Source | `packages/vscode/src/controller.ts:397-403` — `const css = outcome.state.compiled?.css; if (css === undefined) { showWarningMessage("Chikx: no CSS was produced …"); return; }`; the preview is published at `:407-408` (`this.preview.set(uri, css)`) |
| Pinned test | `packages/vscode/test/ui/commands-matrix.js:235` — `"pinned: a dead document previews as an empty tab instead of the warning (CSSX-U4-A)"` |
| Repro (host) | temp workspace document `!!! not a stylesheet !!!` → `chikx.previewCompiledCss` → a `chikx-preview:*.cssx` document is opened with `getText() === ""` and `CHIKX1001` is published |
| Contrast case that is correct | `.button { color: red; padding: 4px; }` (missing semicolon) → preview contains `.app-button {\n  padding: 4px;\n}\n` and `CHIKX1002` stays |

## Expected vs actual

- **Expected:** when a compile produces no CSS at all, the command shows the existing warning
  ("no CSS was produced for this document; check the diagnostics") and **does not** open a preview tab.
- **Actual:** an empty `chikx-preview:` tab opens; the warning is never shown; the user sees a blank
  editor with no explanation.

## Owned files (fix task)

- `packages/vscode/src/controller.ts` — `previewCss` `:397-403`: treat an empty/whitespace-only `css` as
  "no CSS" (or gate the preview on the absence of error-severity diagnostics for the document), and keep
  the tolerant preview for documents whose CSS is non-empty.
- `packages/vscode/test/ui/commands-matrix.js:220-240` — **remove the pin** and assert the fixed
  behaviour (no `chikx-preview` document opened, previous active editor unchanged).
- Optional (same task): confirm the warning text is the one already used, so no new message string is
  introduced.

## Suggested fix direction

`if (css === undefined || css.trim() === "")` before publishing, reusing the existing warning. A stronger
variant gates on `outcome.state.analysis.problems.some((problem) => problem.severity === "error" &&
problem.file === analysis.file)` so a document that compiles to nothing *because* of errors never opens a
tab; pick one and record it — the tolerance for partially-broken documents must stay.

## Acceptance criteria

1. `Preview Compiled CSS` on a document with no producible CSS opens **no** preview document and shows
   the existing warning; the previously active editor stays active.
2. The tolerant case is unchanged: a document with a missing semicolon still previews its surviving CSS
   and keeps `CHIKX1002`; a clean document still previews its compiled CSS (both existing assertions).
3. The pin at `packages/vscode/test/ui/commands-matrix.js:235` is **removed** and replaced by the positive
   assertion above.
4. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun run verify
```

## Fix record

**Result:** 🟢 fixed.

- `packages/vscode/src/controller.ts` `previewCss`: the guard is now
  `css === undefined || css.trim() === ""`, so a tolerant compile that produces no CSS (the dead
  document returns `""`) shows the existing warning
  ("Chikx: no CSS was produced for this document; check the diagnostics.") and opens no
  `chikx-preview:` document. No new message string. Non-empty tolerant CSS (missing semicolon) still
  previews and keeps `CHIKX1002`.
- Pin removed and replaced with positive assertions in
  `packages/vscode/test/ui/commands-matrix.js:223-242`: the dead document stays the active editor
  and no `chikx-preview:` editor naming it is visible.

**Validation:** `bun test tests/extension/host.test.ts` → 13 scenarios, 826 assertions
(commands-matrix 101), exit 0. `bunx tsc -p packages/vscode/tsconfig.json --noEmit` → exit 0.
`bun run verify` not run (campaign instruction).
