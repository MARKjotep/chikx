# CSSX-U03 — `&.` lists `&`-prefixed starters that would produce `&.&:hover`

**Status:** 🟢 fixed · **Found by:** U3 (`.ai/reports/CSSX-U3.md` "Findings from the captured states" #4, candidate task U3-A) · **Severity:** medium
**Package / API:** `packages/vscode` — `src/intelligence.ts` `completionsAt` `"selector"` case: the
nested-selector starter items are added in every selector state, including the one entered by a typed
`&.` (a class-concatenation context).

## Summary

- Typing `&.` inside a rule body opens the selector state, which offers the class items **and** the
  six `&`-prefixed starters (`&`, `&:hover`, `&:disabled`, `&:focus-visible`, `& > `, `& + `).
- Those starters are wrong for that context: `&.` means "this selector plus a class", so accepting
  `&:hover` inserts a second `&` and yields `&.&:hover`. The captured screen
  (`.ai/reports/logs/ui-screens/suggest-amp-dot.png`) shows the mixed list, so the defect is visual
  evidence today, not only a source reading.
- The class items in the same state are correct (A46 keeps the typed dot: `&.` + `.card` → `&.card`).
  The bug is that a class-only context still offers selector starters at all.

## Evidence

| Item | Value |
|---|---|
| Report | `.ai/reports/CSSX-U3.md` — finding 4 + "Candidate tasks routed from U3" row `U3-A` |
| Screenshot / DOM record | `.ai/reports/logs/ui-screens/suggest-amp-dot.png` and its `manifest.json` entry: `labels: ["&","& +","& >","&:disabled","&:focus-visible","&:hover",".badge"]` |
| Source | `packages/vscode/src/intelligence.ts:2737-2750` (`"selector"` case): `SELECTOR_STARTERS.map(...)` is unconditional; `SELECTOR_STARTERS` at `:961-968` |
| Range behaviour | after `&.` the word is `.`, so `dot === 0` ⇒ `replaceStart = offset` (empty range at the caret) — accepting a starter appends it after the typed dot |
| Pin today | **none** — the acceptance was never driven in the host (`CSSX-U3.md`: "asserted nowhere yet because it needs an acceptance run, not a screenshot") |

## Expected vs actual

- **Expected:** in a `&.` class context the list contains class names only (plus, at most, members that
  are valid after a class), never a bare `&` starter; or, if starters stay, accepting one cannot produce
  a second `&` (`&.` + `&:hover` must not become `&.&:hover`).
- **Actual:** six `&`-prefixed starters are offered beside `.badge`; accepting one yields `&.&:hover`.

## Owned files (fix task)

- `packages/vscode/src/intelligence.ts` — `"selector"` case: suppress (or re-shape) `SELECTOR_STARTERS`
  when the authored word begins with `.` (a class context); the empty/`&` states keep them.
- `packages/vscode/test/ui/completions.js` — **add the red assertion pin first** (see below): a new
  case in the `&.` block asserting that no item label starts with `&`, or that accepting one yields no
  second ampersand.

## Suggested fix direction

Gate the starter items on "the caret is not already inside a class concatenation": if
`context.word.startsWith(".")` or the character before the word is `.`, skip the `&`-starter block and
keep only the class items. The complementary decision (keep the starters but repair the range) is
acceptable too, but it makes `&.` accept two different meanings — record whichever is chosen in the same
task.

## Acceptance criteria

1. **A red assertion pin is added first** in `packages/vscode/test/ui/completions.js` (next to the
   existing `&.` class assertion), marked `CSSX-U03`, stating the measured behaviour; the suite stays
   green because the pin states the current result.
2. After the fix, that pin is **removed** and replaced by the acceptance property: a `&.` list contains
   no `&`-prefixed starter, or accepting `&:hover` there produces no second ampersand.
3. The A46 positive assertions (`&.` + `.card` → `&.card`, typed dot kept) and the `&:` state (19
   pseudos, `&:hover`) stay green.
4. A fresh U3-style capture of the `&.` state no longer shows the mixed list (the `manifest.json`
   `labels` entry records the change) — the screenshot is evidence, the assertion is the gate.
5. `bun test tests/extension/host.test.ts` green (13 scenarios, assertions ≥ 802) and `bun run verify`
   green.

## Validation

```sh
bun test tests/extension/host.test.ts
bun packages/vscode/test/ui/capture.js --screen suggest-amp-dot --out /tmp/chikx-shots
bun run verify
```

## Fix record

- Changed `packages/vscode/src/intelligence.ts` (`"selector"` case): the `SELECTOR_STARTERS` are now
  offered only when the authored word does not begin with `.`; a `&.` (class concatenation) context
  lists the class items only, so accepting one can no longer produce `&.&:hover`. Chosen direction:
  suppress (not re-shape) the starters, per the task's first option.
- Changed `packages/vscode/test/ui/completions.js`: the `&.` case now asserts no item label starts with
  `&` and that the document classes are still listed, beside the existing typed-dot acceptance.
- Changed `packages/vscode/test/ui/checklist.js` row 6 (outside the initial write set; required to keep
  the host checklist aligned): the `&.` block asserts the class-only list.
- Added a unit case in `tests/extension/provider.intelligence.test.ts` ("a `&.` class context lists
  classes only") for the empty and typed class prefixes.
- Validation: `bun test tests/extension/provider.intelligence.test.ts` → 98 pass / 0 fail;
  `bun test tests/extension/host.test.ts` → 13 scenarios, 827 assertions, exit 0 (twice);
  `bunx tsc -p packages/vscode/tsconfig.json --noEmit` → clean. The fresh `suggest-amp-dot` capture and
  `bun run verify` were not run in this task; the host assertion is the gate (acceptance #4).
