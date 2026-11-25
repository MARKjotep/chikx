# Chikx bug & feature board

Report new bugs and feature requests under the matching section; the lead routes each entry to a task. Statuses: 🔴 open · 🟡 in progress · 🟢 done.

## Bug reports

1. No code suggest when the line is before the & symbol and no semicolon. The code also do not auto end the line with semicolon or no error suggestion that no semicolon and could cause error. — 🟢 fixed: compiler diagnostic via CSSX-A17, editor quick-fix via CSSX-A18

## Feature requests

2. The built in @ are not auto suggest outside any class body. sample is @keyframes and the others. — 🟢 done in CSSX-A18

3. Also, I'd like to request for keyframe name to become a variable? is that okay? so when I create animation-name: $keyframe.name — 🟢 done in CSSX-A19 (CSSX-A19: ADR-0015; `$keyframes.<name>`, also importable via `@use … styles`; plain-variable fallback `@variables { spin: spin }` + `$spin` already works)

4. Detect clashing variable names from multiple sources, and allow overriding them. Also: how do we strategize the actual CSS variables (the ones declared in :root)? — 🟢 done in CSSX-A20 (ADR-0016 merge-order override landed + lead-verified)

5. Create an example showing real CSS variables (--this-var style runtime tokens), importing modules that declare the same variable names, overriding them, and how the strategy plays out — make it a bit complex. — 🟢 done in CSSX-A21 (examples/overrides)

6. Editor follow-ups for $keyframes (completion/hover/rename) plus token-only-import keyframe names, string-named and conditional keyframes. — 🔴 backlog (surfaced by CSSX-A19 report)

7. Prettier-like formatting when hitting save — I'd like the code to also look pretty on save. — 🟢 done in CSSX-A22 (compiler format() as Format Document provider + chikx.editor.formatOnSave setting, default off; parse errors never mangle the file; @use styles keyword preservation fixed in CSSX-A24)

8. Add @group for reusable groups, customizable at each use site — @group.thisgroup {} defines it, and the bracket at the use site overrides any properties included there. — 🔴 planned (CSSX-A23 plan written to .ai/plans/CSSX-PLAN-GROUPS.md; implementation deferred until owner signs off + ADR-0017)
