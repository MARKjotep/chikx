# Chikx Handover — 2026-11-26

## State

- Full suite green at handover (re-verified for this document): `bun run typecheck` exit 0,
  `bun run lint` exit 0 (`Checked 422 files`), `bun test` **892 pass / 0 fail, 892 tests across
  45 files** (17.47s). Extension suite also re-verified: `bun test tests/extension/` **192 pass /
  0 fail across 10 files** (9.45s). Shorthand `192/10` in the A51 record means tests/files, not
  pass/fail.
- No commits were made during the wave; all A45–A51 work is in the working tree (source edits plus
  untracked `.ai/tasks/CSSX-A45…A51.md` and `.ai/reports/CSSX-A45…A51.md`). Do not commit, push,
  reset or stash without owner authorization.
- Working tree also contains pre-wave changes (compiler, grammar, docs, examples) from earlier
  completed tasks — preserve them untouched. It also carries pre-existing unstaged deletions
  (`.ai/agents/AGENTS.md`, `.ai/agents/opencode.jsonc`, `opencode.jsonc`); leave them as the owner
  left them. `git status --porcelain` reported 123 entries (64 untracked) before this handover
  file was added — it is the 124th entry and is intentionally untracked.

## Recently completed (editor intelligence wave)

| Task | Deliverable |
|---|---|
| CSSX-A45 | five completion-context bugs + curated CSS functions in value context + `$keyframes.` item |
| CSSX-A46 | `&:` colon duplication, `&.` dot removal, property completion above an `&` line; records |
| CSSX-A47 | CSS function tooltips: `CssFunction.usage` for all 25 functions, shared doc body, hover branch |
| CSSX-A48 | `chikx.editor.completePropertyWithSemicolon` (default on) snippet accept + 27 unit suggestions after numbers |
| CSSX-A49 | 148 named colors for color-accepting properties (derived `COLOR_PROPERTIES`), one-line rule parity pin, class dedupe |
| CSSX-A50 | `(` trigger: bare paren reveals curated functions and replaces the paren on accept; `@fn` removed from the board |
| CSSX-A51 | hex palette + `#` trigger + `CompletionItemKind.Color`; `DocumentColorProvider` swatches + native picker via pure `colorsAt()`; paren/`#` filterText fix |

Task specs in `.ai/tasks/CSSX-A*.md`, reports in `.ai/reports/CSSX-A*.md`, plan table in
`.ai/PROGRESS.md` (`P8 · A45`…`P8 · A51` rows), live board in `.ai/todo.md` (bug items 12, 13;
feature items 15–20).

Data sets verified in `packages/vscode/src/intelligence.ts`: `CSS_FUNCTIONS` 25 entries,
`CSS_NAMED_COLORS` 148, `CSS_NAMED_COLOR_HEX` 148, `CSS_HEX_COLORS` 35, `CSS_UNITS` 27,
`COLOR_PROPERTIES` derived from `CSS_PROPERTIES`, exported `colorsAt()` / `DocumentColor`.

## Token colors (CSSX-COLOR-TOKENS)

- The extension classifies five token kinds in a parse-only `DocumentSemanticTokensProvider`:
  `variable` (compile-time `$token`), `namespace` (the `$ns` prefix of `$ns.member`, including
  `$keyframes`), `runtimeVariable` (`@runtime` names), `customProperty` (`--var`, including inside
  `var()`) and `keyframe` (a resolved `$keyframes.<name>` member). Declaration sites (`@variables` /
  `@runtime` names, the left side of `--x:`) are excluded and keep property-name styling.
- Final palette:

  | Kind | Hex | Colours |
  |---|---|---|
  | `variable` | `#4C8DF8` | compile-time references and resolved compile-time members |
  | `namespace` | `#4EC9B0` | the `$ns` / `$keyframes` prefix (matches the `@use … as` styling) |
  | `runtimeVariable` | `#D6409F` | runtime tokens and runtime members |
  | `customProperty` | `#D6409F` | `--var` references, including `var()` arguments |
  | `keyframe` | `#D18616` | resolved `$keyframes.<name>` members |

- Colors work zero-config: `contributes.semanticTokenScopes` maps each kind to a scope the common
  themes already style distinctly (blue / teal / magenta / violet-or-amber) — `variable` → `variable.language` (default 2026 Dark
  `#79C0FF` / Dark+ `#569CD6` / Light+ `#0000FF`), `namespace` → `entity.name.type` (Dark+
  `#4EC9B0` / Light+ `#267F99`), `runtimeVariable` and `customProperty` → `keyword.control` (Dark+
  `#C586C0` / Light+ `#AF00DB`), `keyframe` → `entity.name.function` (Dark+ `#DCDCAA` / Light+
  `#795E26`). Colors follow the active theme, so other themes may vary. The literal palette above is
  the optional override: users add the README “Token colors” snippet (`editor.semanticHighlighting.enabled` +
  `editor.semanticTokenColorCustomizations.rules` with the five hexes) to `settings.json`, and those
  rules outrank the scope fallback. The same scope map styles text the classifier has not resolved
  (pre-analysis and degraded parses).
- Verify in the editor: **Developer: Inspect Editor Tokens and Scopes** on `$spacing` (`variable`),
  `$theme` (`namespace`), `$theme.primary` (member `variable`), `var(--x)` (`customProperty`) and
  `$keyframes.spin` (`keyframe`). A `!` after a value offering only `!important` (and accepting it
  without a doubled bang) is the freshness signal that the current build is loaded.
- Records: `.ai/reports/CSSX-COLOR-TOKENS.md` (diagnosis + final palette), `.ai/tasks/CSSX-COLOR-TOKENS.md`.
- Re-verified for this section: `bun run verify` exit 0 — typecheck + lint + **1223 pass / 2 skip /
  0 fail** (1225 tests across 89 files, 994856 `expect()` calls); extension host **14 scenarios /
  856 assertions** (`semantic-tokens=21`). Painted colours with no user settings: the 1.147 default
  “2026 Dark” theme paints `$spacing` `rgb(121, 192, 255)` (`#79C0FF`) and `$theme`
  `rgb(78, 201, 176)` (`#4EC9B0`); Dark+ paints `$spacing` `rgb(86, 156, 214)` (`#569CD6`).

## Deferred / out of scope

- `@fn` author-function namespace: removed by owner decision — raw CSS functions plus A47/A50
  discoverability make it unnecessary. A46 recorded it as owner-deferred (2026-11-25) and A50
  deleted todo item 14. Do not reintroduce without an owner request.
- Token completion inside function arguments (`calc($ui.space|)`) — possible follow-up, not scoped.
- A51 adapter behavior (suggest-widget swatches, picker interaction) is pure-layer unit-tested and
  typecheck-verified only; the in-extension-host smoke harness (`packages/vscode/test/suite.js`)
  was outside the task write sets and is unchanged by the wave.
- CSSX-A51 report records `tests/extension/` 192/0; the `P8 · A51` PROGRESS row shows `192/10`.
  Both are consistent: `192/10` counts tests/files — the run above is 192 pass / 0 fail / 10 files.

## Manual smoke checklist (worth doing in the editor once)

1. `color: ` → 148 names + 35 hex, kind Color; `width: ` → neither.
2. `color: #f0` narrows; accept replaces `#…` without duplication; `width: #` → nothing.
3. `width: (` → 25 functions; accept `clamp(` → `width: clamp(`; `calc(100% - 2` keeps normal values.
4. Property accept → `color: ;` cursor before `;` (toggle `chikx.editor.completePropertyWithSemicolon`).
5. `margin: 1` → units; `1r` → `rem`; digits never deleted.
6. `&:` + accept → `&:hover`; `&.` + accept keeps the dot; property completion works above an `&` line.
7. Named/hex values show clickable swatches; picker writes lowercase hex.

## Conventions

- Roles/routing per root `AGENTS.md` (build orchestrates, code writes, specialists verify; max 4 workers).
- Editor features are pure-layer first (`packages/vscode/src/intelligence.ts`, no `vscode` imports),
  adapter/provider thin; trigger characters live in `packages/vscode/src/controller.ts`
  (currently `@ $ . : / & ( #`).
- Always: failing repro test first, no assertion weakening, full gates before claiming done,
  task/report/PROGRESS/todo records persisted per task.
