# Chikx Plan — Reusable declaration groups (`@group.<name>`)

**Status:** planned, **not implemented**. No code may land on this plan before
`docs/decisions/ADR-0017-*` is written, accepted by the owner and integrated into
`SPECIFICATION.md` (invariants 10 and 11 in `.ai/framework/chikx/FRAMEWORK.md` §7). This plan is the
actionable form of a sanction that already exists:

- `.ai/CSSX-MASTERPLAN.md` §12 "Future features" lists reusable declaration groups (`@group`/`@apply`);
  each such feature "requires an ADR and regression fixtures before implementation".
- `SPECIFICATION.md` §13 "Deferred" defers "mixins and reusable declaration groups (`@group`/`@apply`)"
  to an ADR plus regression fixtures.
- `.ai/CSSX-MASTERPLAN.md` is **never edited**. Deltas are recorded in ADRs and `SPECIFICATION.md`.

Owner proposal and design decisions: 2026-11-25 (owner + lead). Board context lives in
`.ai/todo.md` item 8 (owned by another worker; this plan does not touch the board or
`.ai/PROGRESS.md`).

## Implementation Progress

| Phase | Deliverable | Acceptance condition | Status |
|---|---|---|---|
| G0 | ADR-0017 plus normative `SPECIFICATION.md` text; owner answers open decisions (a)–(c) | ADR accepted; spec section, §3.6 reserved names and §13 deferred list updated; no code | 🔴 |
| G1 | Grammar: lexer/parser support for `@group.<name>` definitions and use sites; additive AST nodes | Parser/lexer tests green; definitions top-level only; declarations-only recovery; frozen-AST change approved | 🔴 |
| G2 | Resolver: per-module group collection, `group` symbol kind, `styles` visibility, duplicate/ambiguity rules, alias reservation | Resolver tests green; `@use … as group` is CHIKX2001; precedence documented and pinned | 🔴 |
| G3 | Expansion: use sites splice into declaration runs; defining-module token scope; spans; diagnostics; empty-rule pruning | Unit tests + fixture inputs compile to the intended CSS; every rejection omits only what §2.5 allows | 🔴 |
| G4 | Fixtures/goldens (G4a), browser gate (G4b), author docs (G4c) | `bun run verify` and `bun run test:browser` green; golden diffs reviewed line by line; docs updated | 🔴 |
| G5 | Formatter round-trip for `@group` (parse→print) | `format()` reproduces group definitions/use sites; format-on-save never drops a group; tests green | 🔴 |
| G6 | Editor support (G6a–G6c): completion, hover, outline, rename, TextMate scopes | Extension provider tests green; the §7 G6 provider criteria met; no compiler semantics change | 🔴 |

## 1. Motivation

Declarations that must stay identical across rules (card chrome, control height, surface elevation)
are copied today, and every copy drifts independently. `@variables` cannot help: a token substitutes a
*value*, not a property/value pair, and a group must be overridable per use site without forking the
definition. The owner wants the repeated block written once and customized where it is used:

```chikx
@group.card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  color: black;
}

.panel {
  @group.card {
    padding: 20px;
    color: navy;
  }
}

.tile {
  @group.card {
    border-radius: 0;
  }
}
```

`.panel` keeps `border` and the group's `border-radius`, but uses its own `padding` and `color`;
`.tile` keeps everything except the radius. No new runtime concept, no generated code, no CSS
emitted for the definition itself.

## 2. Design (v1)

### 2.1 Definition

```ebnf
groupDefinition = "@group" "." groupName "{" { declaration } "}" ;
groupUseSite    = "@group" "." groupName "{" { declaration } "}" ;
```

- **Top-level only**, alongside `@setup`, `@use`, `@variables`, `@runtime`, `@media-types`. A
  definition inside a rule is a syntax error (CHIKX1001 family) with statement-scoped recovery.
- **Declarations only.** A definition block accepts declarations and nothing else. Nested rules,
  conditional blocks (`@md { … }`), native at-rules and further `@group.` use sites inside a
  definition are CHIKX1001-family syntax errors, one diagnostic per offending statement, and the
  statement is omitted. This is what keeps expansion a pure declaration splice and recursion
  impossible; group chaining is a v2 candidate (§4).
- **Non-parametric.** `@group` is not a mixin: no arguments, no parameters, no interpolation.
  Customization is exactly "override at the use site".
- A definition emits nothing; if a group is never used, it has no output (like an unused
  `@variables` entry, which v0.1 also tolerates silently).
- Empty definitions are legal and inert (authoring detail in §6, proposal: no diagnostic).

### 2.2 Use site

Inside any rule body, at any nesting depth:

```chikx
.selector {
  @group.<name> {
    <overrides>;
  }
}
```

- The block is **required** in v1; a bare `@group.<name>;` is out of v1 (§4).
- The use-site block accepts declarations only. Nested rules and conditional blocks inside it are
  CHIKX1001 (the conditional use-site form `@group.x @md+dark { … }` is explicitly out of v1).
- Expansion happens **at the authored position**, as one declaration run:
  the group's defaults in definition order, then the use-site block's declarations in authored
  order. Nothing else about the surrounding rule changes: selector, ancestors, native-rule context
  and following declarations are untouched, and the next authored statement flushes normally
  (`SPECIFICATION.md` §5.1).

`.panel` above therefore lowers as if the author had written:

```chikx
.panel {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
  color: black;
  padding: 20px;
  color: navy;
}
```

### 2.3 Override semantics: emergent cascade, never a filter

This is the load-bearing rule of the whole feature:

- Expansion **splices** declarations. It must **not** remove, reorder, deduplicate or rewrite the
  group's own lines, even when a later use-site line repeats the same property. The override works
  because the use-site declaration comes later at equal specificity — exactly FRAMEWORK §5.4 /
  `SPECIFICATION.md` §5.2, "later base declaration wins", **BY DESIGN**.
- Invariant 3 ("never reorder, merge or deduplicate declarations") applies to expanded output in full.
  A compiler that filtered `padding: 12px` out of the example would silently change behaviour under
  conditional variants and `!important`, and is wrong by construction.
- Consequences to document and test:
  - A use-site **base** declaration for property `P` beats a group default `P` that appears
    earlier — including beating it at every width when the group default for `P` was an inline
    variant (`@md`), because the base declaration is later in source. That is §5.4 by design, not a
    bug; the browser gate must pin it (D2 in §8).
  - `!important` binds per value segment (ADR-0003). A group default authored `!important` cannot be
    overridden by a plain use-site declaration; the emitted CSS does the talking.
  - "Which properties the use site overrides" is **analysis**, not compilation: hover (E1) derives it
    by comparing base property names; the compiler never acts on it.
- Identical semantics apply at every use site independently; two rules using the same group each get
  their own expanded run. Safe grouping (`groupRuns`) is unchanged: adjacent runs with identical
  selector/ancestors/condition/native context may still merge; the expansion just adds declarations
  to a run.

### 2.4 Where group names live

- Group names live in their **own symbol kind** (`group`), separate from locals, unqualified import
  aliases, namespaces and the built-in `keyframes` namespace. `GroupName` is a plain CSS identifier;
  matching is exact and case-sensitive, and the member text after `@group.` must equal the addressable
  name byte for byte (the same rule ADR-0015 applies to `$keyframes.<name>`).
- `group` becomes a reserved directive name (`SPECIFICATION.md` §3.6): `@use "…" as group` is
  CHIKX2001 at the `@use` span and creates no namespace — the built-in `group` construct cannot be
  shadowed by an alias, mirroring ADR-0015 item 4 for `keyframes`.
- Groups are **not** addressable as values. `$group.<name>` is an unknown token namespace (CHIKX2001);
  no new value-level syntax is introduced.
- **Visibility (default proposal, mirrors ADR-0015):** a module sees its own top-level group
  definitions plus the definitions of every module reached through `@use "…" styles;` transitively in
  authored order (ADR-0014). Same-file visibility always applies. Because group definitions emit no
  CSS by themselves, this is a *proposal on convention*, not an emit-safety requirement — unlike
  keyframes, expanding a group from a token-only module would produce valid CSS. That is exactly why
  token-only visibility is an **open owner decision** (§5a) rather than inherited silently.
- **Precedence, mirroring §5.5:** a local definition shadows imported definitions of the same name
  (no error). Two visible definitions with no local definition are ambiguous: CHIKX2001 at the use
  site and the use-site block is omitted. Duplicate definitions inside one module are CHIKX2001 at the
  later definition, first definition wins. (See §5 item 4 for the exact diagnostic placement proposal.)
- **Interactions:**
  - `@keyframes` (ADR-0015): independent. A module may declare `@keyframes spin` and `@group.spin`
    with no conflict; `@group.keyframes` is legal (the member name is just an identifier) and does not
    affect `$keyframes`.
  - Import aliases: `@use "…" as g` only names the token namespace `g`; groups are never addressed
    through it. Cross-module group renaming is out of v1.
  - Class names, media aliases, `@setup` keys and property names share no namespace with groups.
- **Merged builds:** visibility is computed per module at graph time, like keyframes, and stored on
  the module record. Expansion uses the consuming module's view, so a group used in the entry from a
  `styles`-imported module resolves against the entry's visible set.

### 2.5 Diagnostics and recovery

No new diagnostic code is proposed for v1. Reuse the frozen registry: `types/diagnostics.ts` is
immutable without lead approval, and new subcodes need the frozen-registry process (FRAMEWORK §4,
§9 item 5):

| Situation | Code | Recovery |
|---|---|---|
| Definition inside a rule; non-declaration statement inside a definition or use-site block; malformed `@group.<name>` (e.g. missing name) | CHIKX1001 (parser) | One diagnostic per statement; offending statement omitted; parsing resumes at the next boundary |
| Unknown group at a use site (not visible, or from a token-only import if (a) resolves to invisible) | CHIKX2001 | **The whole use-site block is omitted**, consistent with §5.5 undefined-member semantics; the rest of the rule continues, and an emptied rule is dropped like any other |
| Ambiguous visible group (two imported definitions, no local) | CHIKX2001 | Use-site block omitted; both definitions remain inert; first-wins does not apply because neither is more local |
| Duplicate definition in one module | CHIKX2001 | First definition wins; later definition is ignored (consistent with duplicate locals) |
| `@use "…" as group` | CHIKX2001 at the `@use` | No namespace created; import tokens still resolve if the edge is otherwise valid |
| `$group.<name>` | CHIKX2001 (existing unknown-namespace path) | Declaration segment omitted (§5.5) |

Rejected recovery (record it in the ADR so it is not re-litigated): emitting the use-site block's
declarations *without* the group's defaults on an unknown group. It would silently reinterpret
"override" as "declare" and produce declarations the author never meant as standalone values.

If the owner later wants an actionable subcode (`CHIKX2002` "unknown group"), it must go through the
frozen-registry process: `ReservedDiagnosticCode` + `DIAGNOSTIC_CODES` with a stable summary, a
producer citation, fixtures and lead approval. That is open decision (c).

### 2.6 Spans, substitution and module attribution

- Every expanded declaration keeps **the authored span and file it came from**: group defaults carry
  the definition's spans in the defining module; use-site declarations carry the use site's spans in
  the consuming module. No positions are invented (invariant 4, ADR-0005). Consequence: a diagnostic
  about `$token` inside a group default points at the *definition* line, in the defining file, even
  when the use site is in another module; the editor may additionally show the use-site location as
  related information (E1).
- **Compile-time substitution resolves in the defining module** (`SPECIFICATION.md` §5.2: imported
  compile-time values resolve where they are defined). Group defaults are authored in the defining
  module, so their `$refs` must resolve against that module's locals, imports and namespaces. Use-site
  declarations resolve against the consuming module. Implementation consequence: expansion cannot be
  a naive copy of AST declarations into another module's tree before substitution; either expansion
  happens per module before that module's own `substitute` pass (defaults resolved in their module,
  overrides in the consumer) or each expanded declaration carries an origin-module token table. This
  is the largest design/engineering risk (§12).
- **Runtime tokens** (`@runtime` → `var(--<prefix>-<name>)`) in group defaults are rewritten with the
  *consuming build's* prefix, because `substitute` runs per build for runtime refs (FRAMEWORK §3
  step 2/3). Whether group defaults may contain runtime references at all is open decision (b), and it
  interacts with (a): a token-only import exposes no runtime tokens, so a runtime-bearing group from
  such a module could not be emitted safely.
- Source maps: expanded declarations map to their authored spans, so debugging a use site lands on
  the group definition. Document that as intended (the CSS text is authored there).

### 2.7 Grammar and lexing shape

- `@group` joins the directive at-keywords; the dotted form `@group.<name>` must be recognised as one
  construct for highlighting and completion. Proposal (settled in ADR-0017; see §5 item 2): the three parts are
  contiguous (`@group.foo`), no whitespace between `group`, `.` and the name; whitespace is a
  CHIKX1001. `@group` without a following `.name` is CHIKX1001.
- AST change is **additive** to the frozen `types/ast.ts`: a `GroupDefinition` added to
  `StylesheetItem` and a `GroupUseSite` added to `BlockItem`, each with a `name` plus its
  declarations and spans, JSDoc citing ADR-0017 (the approved precedent is `UseImport.styles`,
  FRAMEWORK §4). Requires lead approval before G1 starts. IR needs no new node kind: expansion
  produces ordinary `DeclarationIr` entries.
- Formatter: `format()` is parse→print, so G5 must print both new node kinds or format-on-save would
  rewrite a file and drop a group (a silent destructive bug, exactly what A22 guarded against).

## 3. Explicitly out of v1

Record each as a limitation in `docs/known-limitations.md` and a §13 deferred entry where applicable:

1. Conditional/variant use-site blocks (`@group.x @md+dark { … }`) and conditional definitions.
2. Nested rules or native at-rules inside a definition or use-site block.
3. `@apply` alternative syntax (masterplan lists the pair; v1 ships only `@group.<name>`).
4. Group parameters, interpolation or argument lists (not a mixin).
5. Groups referencing other groups (chaining/composition).
6. Cross-module group renaming (`@use … as` for groups) and re-export of groups.
7. Bare include form `@group.<name>;` with no block.
8. Keyframe-style `$group.<name>` value references.
9. Editor support (G6) in the same release as the compiler phase; that is a follow-up by design.

## 4. Open decision points (owner, required before G1)

| # | Question | Options | Lead recommendation |
|---|---|---|---|
| a | Is a group defined in a **token-only** import visible? | (i) No — `styles` only, mirroring ADR-0015. (ii) Yes — groups are compile-time like tokens, and expansion emits valid CSS. | (i) for consistency and one visibility model; revisit if authors hit the wall |
| b | May a group default contain **`@runtime`** references? | (i) Compile-time values only; runtime refs are CHIKX2001 with segment omission. (ii) Allowed, rewritten to `var()` with the consuming prefix. | (i) in v1: keeps expansion provably safe and independent of (a); runtime needs are served by authoring the reference at the use site |
| c | Diagnostics: reuse **CHIKX2001** or add a `CHIKX2xxx` subcode for "unknown group"? | (i) Reuse CHIKX2001 per §5.5 precedent (ADR-0015 did the same). (ii) New subcode via the frozen-registry process. | (i); add (ii) only if the message cannot be made actionable |

## 5. Authoring details for ADR-0017

These do not need owner arbitration but must be written down and pinned by tests:

1. **Inline variants in defaults** — proposal: allowed, because `property: a @md b` is one declaration
   in Chikx grammar, and it makes conditional group defaults useful. Expansion keeps the segments in
   authored order; §2.3 records the override consequences.
2. **Whitespace** in `@group.<name>` — proposal: contiguous form only (§2.7).
3. **Empty definition** — proposal: legal, emits nothing, no diagnostic.
4. **Duplicate at-file placement** — proposal: diagnostic span on the later definition; first wins.
5. **Diagnostic element order** — CHIKX2001 messages should name the group (`Unknown group "@group.card"
   …`) and, for ambiguity, the two defining modules.
6. **Formatter layout** — proposal: definition and use site print like other at-rule blocks; one
   declaration per line; blank-line preservation follows existing formatter rules.

## 6. Phases and tasks

Owned scopes are **exclusive**; a worker never edits another task's files. Shared/frozen contracts
(`packages/compiler/src/types/**`, the public barrel, `SPECIFICATION.md`) change only with lead
approval. Every task writes `.ai/tasks/<id>.md`, `.ai/reports/<id>.md` and
`.ai/reports/logs/<id>.log`, with `## Summary` first.

| Task | Phase | Deliverable | Owned file scope | Depends on |
|---|---|---|---|---|
| G0 | docs | ADR-0017 (owner decision, visibility, recovery, rejected options) + normative `SPECIFICATION.md` §3.x group section, §3.6 `group` reserved name, §12 notes if (c) changes, §13 deferred adjustment | `docs/decisions/ADR-0017-*.md`, `SPECIFICATION.md`, own task/report/log | owner sign-off; (a)–(c) answered |
| G1 | grammar | Lexer/parser support: `@group.<name>` definition (top-level, declarations only) and use site (rule bodies); additive AST nodes; recovery | `packages/compiler/src/lexer/`, `packages/compiler/src/parser/`, `packages/compiler/src/types/ast.ts` (lead-approved additive), `tests/compiler/{lexer,parser}/`, owns its task/report/log | G0 |
| G2 | resolve | Per-module group collection, `group` symbol kind, `styles` closure, `as group` rejection, duplicate/ambiguity/precedence rules; `ModuleRecord` field (resolver-internal) | `packages/compiler/src/resolver/`, `tests/compiler/modules/`, `tests/compiler/groups/` (resolver half), owns task/report/log | G1 |
| G3 | expand | Splice use sites into declaration runs before/during lowering with defining-module token attribution, spans, CHIKX2001 recovery, empty-rule pruning; pipeline wiring in `index.ts` | `packages/compiler/src/lowering/`, `packages/compiler/src/variables/` (expansion attribution only), `packages/compiler/src/index.ts` (wiring, lead-approved), `tests/compiler/lowering/`, `tests/compiler/groups/` (expansion half) | G1, G2 |
| G4a | fixtures | `tests/fixtures/groups/**` goldens for the matrix in §8 (single-file + merged); byte-exact `expected/{css,diagnostics.json}`; fixture README rows | `tests/fixtures/groups/`, `tests/fixtures/README.md`, `tests/compiler/groups.golden.test.ts`, `tests/compiler/golden.test.ts` (fixture-count row only) | G3 |
| G4b | browser | Playwright scenarios and computed-style assertions per §8 (D1–D5), 3 engines, pretty/minify and safe/none parity | `tests/browser/harness/**`, `tests/browser/specs/**` | G4a |
| G4c | docs | Author-facing docs: `docs/grammar.md` (syntax), `docs/compatibility.md` (feature row + rejected constructs), `docs/known-limitations.md` (v1 exclusions), `docs/cascade.md` §override example | `docs/grammar.md`, `docs/compatibility.md`, `docs/known-limitations.md`, `docs/cascade.md` | G3 (behaviour frozen) |
| G5 | format | `format()` round-trip for definitions and use sites; semicolon/interpolation-free printing; no construct loss | `packages/compiler/src/formatter/`, `tests/compiler/formatter.test.ts`, `tests/extension/formatter.current-grammar.test.ts` | G1 (AST), G3 (semantics) |
| G6a | editor | Completion after `@group.` (visible names, local first), hover showing resolved defaults and which base properties the current use site overrides, diagnostics already flow | `packages/vscode/src/intelligence.ts`, `packages/vscode/src/providers/completion.ts`, `packages/language-service/`, `tests/extension/provider.intelligence.test.ts` | G3 |
| G6b | editor | Outline nodes (definition + use sites) and rename of a group definition/references, workspace-scoped | `packages/vscode/src/**` (outline/rename owners), `tests/extension/**` | G6a |
| G6c | editor | TextMate scopes for `@group` definitions vs `@group.` members, distinct from media aliases and other directives | `packages/vscode/syntaxes/chikx.tmLanguage.json`, `tests/extension/grammar` | G1 |

Sequencing: **G0 is a hard gate** — G1 may not start before ADR-0017 is accepted and (a)–(c) are
answered. G2 needs the AST shape from G1; G3 needs G2's visibility. After G3 lands, G4a must precede
G4b (browser scenarios consume generated harness inputs); G4c, G5 and G6a are parallel to G4b with
disjoint files. G6a/G6b are in the editor release after the compiler phase, never bundled into it.

## 7. Acceptance criteria per phase

- **G0** — ADR-0017 is accepted and follows ADR-0015's format (status, context, decision, rejected
  alternatives, consequences, related links). It states the definition grammar, splice semantics,
  visibility rule, diagnostics/recovery, the v1 exclusions and the three owner answers. SPECIFICATION
  grammar/§3.6/§13 are updated; `bun run verify` is untouched-but-green (docs only) and no golden
  changed.
- **G1** — `@group.x { … }` parses at top level; a use site parses in a rule body; definitions inside
  rules, non-declaration blocks inside either, and malformed dotted names are CHIKX1001 with
  statement-level recovery and no crash. AST nodes carry spans and are documented as ADR-0017
  additions. Parser/lexer tests prove acceptance *and* rejection; no output change for group-free
  sources (existing goldens untouched).
- **G2** — Resolver collects top-level definitions per module in sorted/canonical order; visibility is
  own + transitive `styles` closure (or the (a) answer), memoized and cycle-safe; `@use … as group` is
  CHIKX2001; duplicate/local-shadow/ambiguous cases resolve exactly as §2.4. Tests cover every row of
  the §2.5 diagnostic matrix. No lowering change yet.
- **G3** — A use site expands to the group's declarations followed by the block's declarations at the
  authored position; same-property repeats are **all** emitted (no dedupe/filter — assert the duplicate
  lines exist in IR); defining-module `$refs` resolve against the defining module and use-site `$refs`
  against the consumer; unknown/ambiguous group omits exactly the block and drops an emptied rule;
  spans point at authored files; deterministic across repeated builds. `bun run verify` green.
- **G4a** — Every case in §8 exists with byte-exact goldens reviewed line by line;
  `expected/diagnostics.json` records the exact codes; no pre-existing golden changes except the
  intentional fixture-catalog count this plan owns.
- **G4b** — D1–D5 pass in Chromium/Firefox/WebKit; pretty vs minify and safe vs `none` grouping produce
  identical computed styles; no new console errors or failed requests.
- **G4c** — Docs describe only shipped behaviour, list the v1 exclusions bluntly, and do not claim
  `@apply`/parameters/conditional use sites.
- **G5** — `format(format(x)) === format(x)` for sources with definitions and use sites; a file with a
  group is never emptied or structurally changed by formatting; parse-error input is returned
  unchanged (existing contract).
- **G6** — Completion lists visible groups after `@group.` and inserts a block skeleton; hover shows
  defaults plus overridden properties from actual scope resolution (not a regex); outline lists
  definitions and use sites; rename updates the definition and every reference across visible modules,
  refusing when ambiguous. Highlighting never affects output.

## 8. Fixture and browser matrix

Single-file fixtures (`tests/fixtures/groups/<case>/input.cssx` → `expected/css`, `diagnostics.json`):

| Case | Proves |
|---|---|
| `same-file` | definition + use with overrides; all repeated properties emitted in authored order |
| `no-override` | defaults only; empty-equivalent use block behaves |
| `two-use-sites` | independent expansion, no cross-contamination, safe grouping unchanged |
| `unknown-group` | CHIKX2001, block omitted, emptied rule dropped |
| `duplicate-definition` | CHIKX2001 at the later definition, first wins |
| `definition-in-rule` | CHIKX1001, definition omitted |
| `nested-rule-in-definition` | CHIKX1001, statement omitted, rest of group survives |
| `conditional-use-site` | CHIKX1001 (`@group.x @md { … }` is out of v1) |
| `inline-variant-default` | variant segments in defaults expand in order (§5 item 1 of this plan) |
| `important-default` | group `!important` not beaten by a plain override |
| `empty-group` | legal, inert, no CSS |
| `group-named-keyframes` | `@group.keyframes` legal, `$keyframes` unaffected |
| `alias-group` | `@use … as group` → CHIKX2001 |

Merged fixtures (`entry.cssx`, real `compileProject`):

| Case | Proves |
|---|---|
| `style-import` | group from a `styles` module usable in the entry; defaults resolved in the defining module |
| `token-only` | the (a) answer, whichever way it lands, as a pinned negative or positive |
| `ambiguous-import` | two `styles` modules, same group name, no local → CHIKX2001 at use site |
| `local-shadows-import` | local definition wins without a diagnostic |
| `transitive-visibility` | `A styles→ B styles→ C`, group in C usable in A |
| `cross-module-defining-tokens` | group default uses a token local to the defining module; entry's identically named token must not leak in |
| `runtime-ref` | the (b) answer (accepted `var()` rewrite or CHIKX2001 segment omission) |

Browser scenarios (`tests/browser/harness/**` + `specs/*.pw.ts`), each asserted in all three engines:

- **D1** override wins at every breakpoint (320/767/768/1279/1280) for width-independent properties.
- **D2** group default with `@md` variant + use-site base override: base wins at all widths (the §5.4
  by-design case), pinned so nobody "fixes" it later.
- **D3** non-overridden properties keep the group value in the presence of `@dark`/reduced-motion.
- **D4** `!important` from a group default is not overridden by a plain use-site declaration.
- **D5** pretty/minify and safe/`none` grouping compute identically for an expanded rule.

## 9. Quality gates

Language change ⇒ **ADR + SPECIFICATION.md + fixtures + goldens** (invariants 10, 11; FRAMEWORK §9):

| Gate | When |
|---|---|
| `bun run verify` (typecheck + lint + test) | every task, before reporting |
| `bun test tests/compiler` and the task-specific file | G1–G3, G5 |
| `bun run test:browser` | G3 completion and G4b; cascade-visible feature, so it is mandatory, not optional |
| `bun run release:check` | only the integrating release task (packaging/examples), not per-phase |
| Golden review | G4a: every new/changed `expected/**` diff read line by line; no regeneration blind |
| Determinism | G3/G4a: repeat-run byte comparison, as the existing golden suite does |

A red gate is never "fixed" by editing expectations unless the output change is the intended
behaviour. Never weaken a test, delete a golden or relax an assertion.

## 10. Concurrency and ownership

- Maximum four active child workers (AGENTS.md); two implementation workers on disjoint scopes is the
  practical limit for this plan.
- G2 ∥ G1 is not possible: the resolver needs the AST nodes. G4c ∥ G4b ∥ G5 ∥ G6a is possible after G3
  because their file sets are disjoint.
- Frozen-contract edits (`types/ast.ts`, public barrel) are serialized and lead-approved; only one
  worker may hold them at a time.
- Handoff requires a completed or explicitly abandoned scope; ownership transfer is recorded in the
  report.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Naive AST splicing resolves a group's `$refs` against the *consumer* (wrong module, wrong value) | G3 acceptance test `cross-module-defining-tokens`; explicit attribution design in §2.6 |
| Someone "optimizes" overrides by filtering the group's lines | Invariant 3 restated in ADR + G3 test asserting duplicate properties survive in IR and CSS; D2 browser pin |
| Formatter silently drops `@group` (parse→print without new nodes) | G5 is a release blocker before any extension ships format-on-save with groups |
| Frozen AST churn | Additive nodes only, lead approval, JSDoc cites ADR-0017, group-free goldens untouched |
| Ambiguity/precedence confusion across merged modules | Mirror §5.5 rules exactly; merged fixture set pins local-shadow and ambiguous cases |
| Visibility decision (a) changes late | G2 reads a single visibility predicate; flipping (a) flips one function and the `token-only` fixture |
| Runtime prefix/visibility interplay | (b) recommended to forbid runtime refs in v1; `runtime-ref` fixture pins whatever is chosen |
| Span/editor confusion ("hover points at the definition") | Documented as intended; hover shows both definition and use-site override list |
| Golden churn in examples/release builds | Expansion only affects files that author `@group`; existing goldens and examples must be untouched (asserted in G3) |

## 12. Non-goals

- No `.ai/CSSX-MASTERPLAN.md` edit, ever; no change to `.ai/PROGRESS.md` (lead-owned) or
  `.ai/todo.md` (other worker) from these tasks.
- No new runtime, no framework dependency, no compiler dependency.
- No mixin/parameter system, no `@apply` alias, no conditional use sites, no editor support in the
  compiler phase.
- No implementation in this planning task: `.ai/tasks/CSSX-A23.md` and this file only.
