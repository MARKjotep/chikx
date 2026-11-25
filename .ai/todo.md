# Chikx bug & feature board

Report new bugs and feature requests under the matching section; the lead routes each entry to a task. Statuses: 🔴 open · 🟡 in progress · 🟢 done.

## Bug reports

1. No code suggest when the line is before the & symbol and no semicolon. The code also do not auto end the line with semicolon or no error suggestion that no semicolon and could cause error. — 🟢 fixed: compiler diagnostic via CSSX-A17, editor quick-fix via CSSX-A18

9. Property completion offers nothing when the previous line has no `;` or a nested `&` rule follows (owner report 2026-11-25). — 🟢 done in CSSX-A29

12. Editor completion gaps: no key completion after a completed `@setup` setting, nothing inside `@keyframes` bodies, no values right after `property:`, typing `&` did not reopen completions, and the animation longhands were missing; CSS functions in value context and `$keyframes.` discoverability added in the same pass. — 🟢 fixed in CSSX-A45 (11 intelligence tests; `@fn` namespace deferred as editor-only for v0.1). Function documentation followed up in CSSX-A47: hovering a call name (`calc`, `var`, `color-mix`, gradients, transforms, filters, …) shows the usage sentence and the sample call, and the function completion item renders the same text instead of the thin "CSS function, for example `…`" line (6 intelligence tests)

13. Editor completion bugs after a nested-selector starter (owner report): accepting a pseudo-class after typing `:` behind `&` duplicates colons (`&:` + `:hover` used to leave `&:::hover`), accepting a class after `&.` deletes the typed dot (`&.test > a` became `&test > a`), and no CSS property completions appear when the line being written sits directly above a line that starts with `&`. — 🟢 fixed in CSSX-A46 (replacement ranges cover the typed pseudo colons in front of the item, keep the typed class dot, and a selector the tolerant parser glued across line breaks inside a rule body is classified from the authored current line; 5 intelligence tests, `bun test` 865/45)

## Feature requests

2. The built in @ are not auto suggest outside any class body. sample is @keyframes and the others. — 🟢 done in CSSX-A18

3. Also, I'd like to request for keyframe name to become a variable? is that okay? so when I create animation-name: $keyframe.name — 🟢 done in CSSX-A19 (CSSX-A19: ADR-0015; `$keyframes.<name>`, also importable via `@use … styles`; plain-variable fallback `@variables { spin: spin }` + `$spin` already works)

4. Detect clashing variable names from multiple sources, and allow overriding them. Also: how do we strategize the actual CSS variables (the ones declared in :root)? — 🟢 done in CSSX-A20 (ADR-0016 merge-order override landed + lead-verified)

5. Create an example showing real CSS variables (--this-var style runtime tokens), importing modules that declare the same variable names, overriding them, and how the strategy plays out — make it a bit complex. — 🟢 done in CSSX-A21 (examples/overrides)

6. Editor follow-ups for $keyframes (completion/hover/rename) plus token-only-import keyframe names, string-named and conditional keyframes. — 🟢 editor half done in CSSX-A42 (`$keyframes.` completion/hover/rename with styles-only visibility; rename covers the definition, references and exact `animation-name` values); compiler-semantics half split out to item 11

7. Prettier-like formatting when hitting save — I'd like the code to also look pretty on save. — 🟢 done in CSSX-A22 (compiler format() as Format Document provider + chikx.editor.formatOnSave setting, default off; parse errors never mangle the file; @use styles keyword preservation fixed in CSSX-A24)

8. Add @group for reusable groups, customizable at each use site — @group.thisgroup {} defines it, and the bracket at the use site overrides any properties included there. — 🟢 done in CSSX-A30–A37 (ADR-0017; plan `.ai/plans/CSSX-PLAN-GROUPS.md` G0–G5 complete: compiler expansion, resolver, goldens, browser gate and formatter all landed; editor intelligence for groups landed in CSSX-A39/A40, G6)

10. JSDoc-style hover descriptions for every supported CSS property (owner request 2026-11-25). — 🟢 done in CSSX-A29

11. Keyframes semantics: token-only-import keyframe names, string-named and conditional keyframes — 🟢 done in CSSX-A44 (owner decisions 2026-11-25 recorded in ADR-0018: styles-only visibility stays permanent per ADR-0015, string-named and conditional keyframes rejected for v0.1; exclusions documented in known-limitations and SPECIFICATION §6.4/§13)

15. CSS-native completion polish: accepting a CSS property should insert `property: ;` and leave the cursor between the colon and the semicolon (like the built-in CSS support), gated by a `chikx.editor.completePropertyWithSemicolon` setting (default on, off keeps the plain `property: ` insert); typing a number in a declaration value should suggest the CSS units that can follow it (`rem`, `px`, `%`, …) and append them after the typed digits (`margin: 1|` → `1rem`, `1r` filters the list, `.5|` → `.5rem`, digits never deleted, an authored `%` is kept as typed). — 🟢 done in CSSX-A48 (6 intelligence tests; `bun test` 877/45, typecheck and lint exit 0)

16. Property-aware value suggestions: properties that accept a `<color>` (`color`, `background-color`, `border-color` and its four sides, `outline-color`, `text-decoration-color`, `accent-color`, `caret-color`, `column-rule-color`, `fill`, `stroke`) should offer the standard CSS named colors, filtered by the typed word and sorted with the keyword values, while non-color properties never list a color. — 🟢 done in CSSX-A49 (148 frozen CSS Color 4 names wired through a `COLOR_PROPERTIES` set derived from `CSS_PROPERTIES`; 10 color properties added with docs; `detail "CSS color"`, `0-` sort family; 2 intelligence tests covering all 14 properties and the non-color guard; `bun test` 881/45, typecheck and lint exit 0)

17. Duplicate class suggestions after a nested-selector starter (owner report): typing `&.class` (or a plain `.class` in a rule body) showed `.class` twice when the class was defined and referenced again or defined twice. — 🟢 fixed in CSSX-A49 (class items deduped by name in the `selector` case, preferring the occurrence with the `generated class .<prefixed>` detail; analysis occurrences untouched and A46's typed-dot range kept; 1 intelligence test, `bun test` 881/45)

18. `(`-triggered function suggestions (owner request 2026-11-26): typing `(` in a declaration value reveals the curated CSS functions and accepting one replaces the typed `(` with the call, so `width: (|` → `clamp(` yields `width: clamp(` instead of `(clamp(`. Keyword values, named colors and units stay out of that state; typing after the paren filters the list (`width: (cl|` → `clamp(`); a second `(` behaves the same, while editing inside an existing call (`calc(100% - 2|`, `calc(100%|`, `calc(|`) keeps the ordinary value behaviour. — 🟢 done in CSSX-A50 (`(` added to the registered trigger characters; `callOpenerStart()` + a shared `functionItems()` helper in `intelligence.ts`; 5 intelligence tests; `bun test` 886/45, typecheck and lint exit 0)

19. Color intellisense parity with the built-in CSS support (owner request 2026-11-26): color-accepting properties should also offer a curated hex palette beside the named colors, color entries should render as colors in the suggest widget, and named/hex values in declaration values should show the inline color decoration with VS Code's native picker (picking writes back lowercase `#rrggbb`, alpha only when non-1). Typing `#` in a color value lists the colors and accepting one replaces the typed `#…` prefix (`color: #|` → `red` gives `color: red`); outside a color property `#` offers nothing. — 🟢 done in CSSX-A51 (35-entry frozen `CSS_HEX_COLORS`, 148-entry frozen `CSS_NAMED_COLOR_HEX`, `SuggestionKind` `"color"` → `CompletionItemKind.Color`, `#` trigger + `hashColorStart()`/`hashColorItems()`, pure `colorsAt()` behind `providers/color.ts`; 6 intelligence tests; `bun test` 892/45, typecheck and lint exit 0)

20. A50 follow-ups (owner report): the paren state could be hidden by VS Code's own narrowing because the replacement range starts at the typed `(` (`(cl` vs the `clamp(` label), and the `providers/completion.ts` header comment still listed only the pre-A50 trigger characters. — 🟢 fixed in CSSX-A51 (`CompletionSuggestion.filterText` passthrough honoured by the adapter, set to `(` + name for paren items and `#` + name/hex for the `#` state; header comment now lists `(`, `/` and `#`; the adapter behaviour is typecheck-verified and the pure filter text is unit-tested, the extension-host suite lives in `packages/vscode/test/suite.js` outside this task's write set)
