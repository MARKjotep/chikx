# Chikx Language and Compiler Specification

**Status:** v0.1 frozen (P0)  
**Public name:** Chikx (`.cssx`), packages `@chikx/*`, CLI `chikx`, VS Code language ID `chikx`,
diagnostic family `CHIKX####`. Source files use `.cssx` by owner decision
([ADR-0013](docs/decisions/ADR-0013-cssx-file-extension.md)); every other public name stays Chikx.  
**Derived from:** `.ai/CSSX-MASTERPLAN.md` §1–§6 and the owner decisions of 2026-11-25. This
document is normative for v0.1. Where it is silent, the masterplan governs; where the masterplan
defers a feature, it is listed under [Deferred](#13-deferred).

## 0. Owner-locked decisions

Three language questions were resolved by the project owner on 2026-11-25 and are normative:

| # | Decision | Recorded in |
|---|---|---|
| D1 | A bare nested selector without `&` is a **descendant** selector. | ADR-0002, §3.5, §7 |
| D2 | `!important` binds **per value segment**; each inline variant segment is an independent CSS declaration. | ADR-0003, §3.3, §5 |
| D3 | Conditional blocks (`@md { ... }`) are **rule-scoped only** in v0.1; a top-level conditional block is a syntax error with statement-boundary recovery. | ADR-0004, §3.4, §4 |

The keywords MUST, MUST NOT, SHOULD and MAY are used normatively.

## 1. Vision and scope

Chikx is a CSS-first, property-centric stylesheet language. Responsive values, theme overrides and
nested selectors live beside their base declarations. It compiles to ordinary CSS and static
JavaScript class maps, with optional TypeScript declarations and source maps. There is no browser
runtime, framework dependency or editor requirement. The VS Code extension is an interface to the
same compiler used by the CLI and build tools.

The MVP includes inline and block media aliases, combined conditions, variables and imports, nested
selectors, prefixing, configurable output paths and names, class maps, opt-in compact CSS output,
CLI build/check/watch, syntax highlighting, completions and diagnostics.

Out of scope for v0.1 includes mixins, arbitrary expressions, container aliases, inline pseudo-state
modifiers, hashing, advanced refactoring and aggressive CSS optimization. See §13.

## 2. Canonical example

```scss
@setup {
  prefix: "ui";
  css-dir: "../generated/styles";
  css-name: "button.css";
  map-dir: "../generated/maps";
  map-name: "button.map.js";
}
@use "./theme.cssx" as theme;
@variables {
  spacing: 12px;
  radius: 8px;
}
.button {
  display: flex;
  padding: $spacing @md 20px @xl 32px;
  border-radius: $radius;
  background: $theme.primary @dark #1e40af;
  font-size: 14px @md 16px;
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  & > .icon { width: 16px @lg 20px; }
}
```

Assume `theme.primary` is `#2563eb` and the source is `src/button.cssx`. The outputs are
`generated/styles/button.css`, `generated/maps/button.map.js` and
`generated/maps/button.map.d.ts`. The stylesheet contains `.ui-button` and `.ui-button > .ui-icon`,
ordinary media queries and flattened pseudo-selectors. The JS map exports `button` and `icon`:

```js
import "../styles/button.css";
export const button = "ui-button";
export const icon = "ui-icon";
export default { button, icon };
```

```tsx
import styles from "../generated/maps/button.map.js";
export function Button() {
  return <button className={styles.button}>Continue</button>;
}
```

## 3. Lexical and grammatical rules

### 3.1 Tokenizer

The implementation MUST use a stateful tokenizer and a recursive-descent parser. Declarations MUST
NOT be split with regular expressions alone. The tokenizer tracks:

- source offsets plus line and column for every token and span;
- comments (ordinary and preserved where required for output fidelity);
- escapes in identifiers, strings and selectors;
- quoted strings, including embedded `@`, `$`, `{`, `}` and `;`;
- balanced parentheses and brackets;
- brace nesting and statement boundaries.

An `@` inside a string, comment, URL or function is ordinary CSS content. Inline modifiers are
recognized only at top-level value depth, after whitespace, outside escaped tokens and outside
strings, comments, URLs and functions. Unknown modifiers produce diagnostics.

Raw CSS token sequences and custom property values MUST be preserved. Chikx declarations in v0.1
require semicolons; ordinary CSS final declarations without a semicolon MAY be accepted. An ordinary
CSS final declaration without a trailing semicolon before `}` is accepted only when it contains no
recognized modifier and no `$` reference; a declaration that carries either and lacks its terminating
semicolon is reported as `CHIKX1002` (ADR-0011). Recovery happens at safe statement boundaries so the
editor can continue.

### 3.2 Grammar (EBNF)

```ebnf
file          = { setup | use | variables | runtime | mediaTypes | rule | nativeAtRule } ;
setup         = "@setup" "{" { setting } "}" ;
setting       = identifier ":" scalar ";" ;
use           = "@use" string [ "as" identifier ] [ "styles" ] ";" ;
variables     = "@variables" "{" { tokenDeclaration } "}" ;
runtime       = "@runtime" "{" { declaration } "}" ;
mediaTypes    = "@media-types" "{" { aliasDeclaration } "}" ;
rule          = selector "{" { declaration | rule | conditionalBlock | nativeAtRule } "}" ;
declaration   = property ":" cssValue { modifier cssValue } ";" ;
modifier      = "@" alias { "+" alias } ;
conditionalBlock = modifier "{" { declaration | rule | conditionalBlock } "}" ;
```

This is structural grammar. CSS values and selectors require balanced token parsing rather than
simple strings. Aliases may begin with digits (for example `2xl`). Setup, `@use`, `@variables`,
`@runtime` and `@media-types` are top-level only. Multiple `@setup` blocks MAY appear at top
level; they are merged in document order, and a duplicate setting key within a block or across
blocks is rejected with a CHIKX1001-family diagnostic (masterplan §4 rejects duplicate settings).

The optional `styles` clause of `@use` (ADR-0014) marks a rule-merge import: the target's
stylesheet rules are merged into the importing build in addition to its tokens (§6.3). Without the
clause the import stays token-only.

### 3.3 Declarations, variants and `!important`

A declaration carries a property, a base value and zero or more inline variants. Each variant is a
modifier alias combination plus a value. A base value is required for inline variants; use a
conditional block for conditional-only declarations.

`!important` binds **per value segment** (D2). It terminates the value segment in which it appears
and is ordinary CSS token content of that segment. Each inline-variant segment is an independent
CSS declaration.

```scss
padding: 10px @md 20px !important;
```

emits the base declaration `padding: 10px` (normal) and the `md` declaration
`padding: 20px !important`. `!important` is never propagated from one segment to another. See §5.4.

### 3.4 Rules, nesting and conditional blocks

A rule is a selector followed by a block. Blocks may contain declarations, nested rules,
conditional blocks and native at-rules.

Nested rules are distinguished from declarations by **balanced lookahead**, not by the presence of a
colon alone. If the statement reaches a `{` at top level before its terminator (accounting for
strings, comments, parentheses, brackets and escapes), it is a nested rule; otherwise it is a
declaration.

A nested rule without `&` is a descendant selector (D1):

```scss
.button {
  .icon { width: 16px; }
}
```

lowers to `.ui-button .ui-icon`, equivalent to `& .icon`. `&` remains required for compound and
complex nesting in v0.1; see §7.

Conditional blocks are valid **only inside rules** (D3). A top-level conditional block is a syntax
error in the CHIKX1001 family:

```scss
@md {
  .card { padding: 20px; }
}
```

The parser reports one CHIKX1001-family diagnostic ("conditional block outside rule"), recovers at
the next safe statement boundary, and emits no CSS for the rejected block. Native top-level CSS
at-rules (`@media`, `@supports`, `@layer`, `@keyframes`, `@font-face`, `@property`) keep their
native meaning and are not conditional blocks.

### 3.5 Native at-rules

Native CSS at-rules retain their meaning. `@supports`, `@layer`, `@container`, `@keyframes`,
`@font-face` and `@property` contexts are preserved. Unsupported Chikx transformations inside them
MUST be rejected with diagnostics rather than silently changing semantics.

### 3.6 Reserved names

Chikx directives are reserved and MUST NOT be used as aliases, variables or class-map keys where
that would conflict. Conflicting alias names are rejected. Native CSS keywords keep their native
meaning.

## 4. Media conditions

### 4.1 Default aliases

| Alias | Condition |
|---|---|
| `sm` | `(min-width: 640px)` |
| `md` | `(min-width: 768px)` |
| `lg` | `(min-width: 1024px)` |
| `xl` | `(min-width: 1280px)` |
| `2xl` | `(min-width: 1536px)` |
| `dark` | `(prefers-color-scheme: dark)` |
| `light` | `(prefers-color-scheme: light)` |
| `portrait` | `(orientation: portrait)` |
| `landscape` | `(orientation: landscape)` |
| `print` | `print` |
| `reduced` | `(prefers-reduced-motion: reduce)` |

### 4.2 Definitions and overrides

Aliases may be overridden by project configuration (`media`) and by file-level `@media-types`:

```scss
@media-types { compact: (max-width: 500px); }
.card {
  padding: 12px @md 20px @xl 32px;
  background: white @dark #181818 @xl+dark #101010;
  @xl { display: grid; gap: 24px; }
  @compact { display: block; }
}
```

Definitions merge by key: built-in defaults < project config `media` < file-level `@media-types`.
For the same key the later layer wins; distinct keys accumulate (ADR-0006). A file-level definition
is local to that file.

### 4.3 Combined aliases

Combined aliases are logical **AND**, never OR: `@xl+dark` becomes
`(min-width: 1280px) and (prefers-color-scheme: dark)`. Duplicate aliases in one modifier are
normalized. Nested conditions are combined with `and`.

MVP supports one media-query expression per alias. Unsupported combinations (incompatible media
types, comma-list combinations, aliases that cannot be combined) are rejected with CHIKX3001-family
diagnostics. Invalid CSS MUST NOT be emitted; the affected declaration or block is omitted after the
diagnostic. Native media lists pass through unchanged.

### 4.4 Conditional blocks

A conditional block applies a modifier to every declaration and nested rule in its block:

```scss
.card {
  @xl { display: grid; gap: 24px; }
}
```

Conditional blocks nest and combine conditions. They are only valid inside rules (D3, §3.4).

## 5. Cascade contract

### 5.1 Source-preserving mode

The default mode is **source-preserving**. For each rule, declarations are expanded in written
order: the base declaration first, then each variant in its written order. Consecutive expanded
declarations with the same selector and at-rule context form a contiguous run.

Runs are flushed when a nested rule or a conditional declaration is encountered. Nested rules are
lowered and emitted at the position where they appear. The output preserves authored declaration
order.

### 5.2 Precedence

Later declarations retain normal CSS precedence, including shorthand/longhand interactions,
duplicate fallbacks and `!important`. Within one inline declaration, the last matching variant wins
subject to the native cascade. A later base declaration can override an earlier conditional
declaration; this is valid authored CSS and is documented rather than "fixed".

Authors SHOULD order mobile-first ascending aliases and place combined conditions last. The
compiler MAY warn about suspicious order but MUST NOT silently reorder declarations.

### 5.3 Grouping

Safe grouping merges only adjacent compatible rules/media contexts without changing declaration
order, selector specificity, layer or scope. Global grouping at the bottom is not generally safe.
Grouping MUST NOT change computed styles.

A future opt-in ordered-media mode may define a different cascade contract; it MUST never be
described as semantics-preserving.

### 5.4 `!important`

Per D2 and §3.3, `!important` belongs to the segment it terminates:

```scss
padding: 10px !important @md 20px;
```

emits `padding: 10px !important` and, inside `md`, `padding: 20px` (normal). The compiler MUST NOT
promote or copy `!important` across segments. Conformance tests cover important flags on the base
only, on variants only, on multiple segments, and combined with shorthand/longhand declarations.

## 6. Variables and modules

### 6.1 Compile-time variables

```scss
@use "./theme.cssx";
@use "./layout.cssx" as layout;
@variables { radius: 16px; gap: $layout.spacing; }
.card { padding: $gap; border-radius: $radius; }
```

Variables substitute **token sequences**, not JavaScript expressions. Resolution follows a
dependency graph and supports forward references. Undefined symbols and cycles are errors with
source locations.

- Local definitions override unqualified imported definitions.
- Duplicate local definitions are errors.
- Ambiguous imports are errors.
- Namespaced imports remain independent.
- Imported values resolve in their defining module; local overrides do not mutate imported modules.
- There is no implicit transitive re-export.

Imports are relative to the importing source and restricted to the workspace by default. By default
an import may bring in tokens only, not stylesheet rules; the `styles` clause lifts that
restriction for one module (§6.3, ADR-0014). Token-only modules do not emit artifacts unless
explicitly configured. Modules are cached by canonical path; cycles are detected and reverse
dependencies tracked. Network imports and executable source are not supported.

### 6.2 Runtime variables

```scss
@runtime { primary: #2563eb @dark #60a5fa; }
.card { color: $primary; }
```

Runtime variables emit native custom properties and references, for example:

```css
:root { --ui-primary: #2563eb; }
@media (prefers-color-scheme: dark) {
  :root { --ui-primary: #60a5fa; }
}
.card { color: var(--ui-primary); }
```

Runtime tokens are scoped by the prefix/module policy. Collisions across entrypoints are detected.
Imported runtime tokens must have a defined emission owner; in the MVP they are emitted in each
consuming entrypoint, deduplicated within that entrypoint, with a warning on conflicting definitions
across outputs. Compile-time and runtime symbols cannot share a local name. Native `var()` remains
valid.

### 6.3 Rule-merge imports

`@use "<specifier>" [as <alias>] styles;` imports the module's **rules** as well as its tokens
(ADR-0014, owner decision of 2026-11-25). The clause is opt-in: without it the import is token-only
as described in §6.1.

- **Prefix ownership.** Merged rules keep the imported module's own `@setup prefix`. The importing
  file's prefix, the API prefix and project-level `classes.prefix` never apply to them. A module
  without `@setup` merges unprefixed (`naming: none` still disables prefixing everywhere).
- **Cascade order.** Merged CSS emits imported modules first — depth-first in authored `@use` order,
  each module once — then the importing file's own rules. This is native-`@import`-like: local rules
  win equal-specificity ties, and no declaration is reordered within a module.
- **Class table.** The importing build writes one merged JS map and one `.d.ts` covering its own
  classes plus every style-imported module's classes. The same original class name resolving to the
  same emitted name in several modules unifies. Different emitted names for one original name, and
  camelCase named-export alias collisions across modules, are CHIKX4001 errors (§8, ADR-0010); the
  first result wins as documented recovery so output stays deterministic, but the build fails.
  Global classes stay global and are never exported.
- **Artifacts.** Style-imported modules do not emit artifacts in the importing build, and the
  importing build is unaffected by a module's own output flags. A file that is module-only marks
  itself with `@setup { module: true; }`: its own build suppresses `emit-css`, `emit-map`,
  `emit-types` and `import-css`. Precedence is built-in defaults < project config <
  `module: true` < the file's own explicit `emit-*`/`import-css` keys < explicit API/CLI overrides,
  so authoring a key restores it. A project-glob entry that is style-imported elsewhere still builds
  standalone under its own resolved flags.
- **Tokens.** Compile-time values resolve in their defining module (§6.1). Runtime tokens of merged
  modules are emitted into the consuming build under §6.2: deduplicated there, named with the
  consuming build's prefix, and includes runtime properties referenced only by a merged module's
  rules.
- **Cycles.** A cycle through any `@use` edge, style-bearing or not, is CHIKX2001 at the edge that
  closes it (§6.1). The merged walk still terminates deterministically.

## 7. Selectors and classes

### 7.1 Supported nesting

Supported forms include `&:hover`, `&::before`, `&:nth-child(2n)`, `& > .icon`, `& + .button` and
descendant nesting. `&` is required for compound, sibling and complex nesting in v0.1. A bare nested
selector is a descendant (D1, §3.4).

Selector lists are parsed at top-level commas, including functional pseudos. Native nesting
specificity is preserved: mixed-specificity parent lists use `:is(...)` where needed, or unsupported
flattening is rejected rather than naïvely expanded. Multiple `&` references and escaped class
identifiers are validated. Text inside attribute strings and declaration values is never rewritten.

### 7.2 Class renaming

All local class tokens, including nested references, use the same naming table. `:global(.external-icon)`
escapes renaming and is removed from the emitted selector. MVP supports simple global class escapes;
complex global selectors may follow.

MVP strategies are `none` and `prefix` (ADR-0010):

- `prefix` uses the file-level `prefix` setup key: `ui` produces `ui-card`; empty leaves names
  unchanged.
- CSS identifier compatibility is validated.
- Collisions across sources are detected when building a project. Intentional shared global classes
  are allowed and are never renamed or exported.

## 8. JavaScript maps and declarations

The default export maps original class names to emitted names using safe quoted keys. Named exports
use camelCase (`button-primary` → `buttonPrimary`), with camelCase aliases in the default map when
unambiguous.

- Collisions such as `foo-bar` and `fooBar` are an error (CHIKX4001); the compiler MUST NOT silently
  merge or omit conflicting aliases.
- Reserved or invalid JS identifiers remain accessible via quoted original keys; the named export is
  omitted with a warning.
- `__proto__` is handled safely using computed keys or a null-prototype map.
- Output ordering is deterministic.
- Global classes are not exported.
- Generated declarations use literal string types and readonly map properties.
- ESM is the default. The CSS side-effect import is configurable for environments that cannot load
  CSS in JS.
- No runtime helper is required.

When map emission is disabled, type declarations are automatically suppressed with a documented
warning unless types were explicitly disabled. The JS map is distinct from the CSS debugging source
map.

## 9. Output configuration

File-level `@setup` supports independent output directories and optional filenames:

```scss
@setup {
  prefix: "dashboard";
  css-dir: "../styles";
  css-name: "dashboard.css";
  map-dir: "../modules";
  map-name: "dashboard.map.js";
  emit-css: true;
  emit-map: true;
  emit-types: true;
  source-map: true;
  import-css: true;
  minify: true;
}
```

| Setting | Default | Meaning |
|---|---|---|
| `prefix` | empty | Class name prefix |
| `css-dir` | source directory | CSS output directory |
| `css-name` | `<stem>.css` | Optional CSS basename |
| `map-dir` | source directory | JS class map output directory |
| `map-name` | `<stem>.map.js` | Optional JS basename |
| `emit-css` | `true` | Write stylesheet |
| `emit-map` | `true` | Write JS class map |
| `emit-types` | `true` | Write `.d.ts` beside JS map |
| `source-map` | `false` | Write CSS source map |
| `import-css` | `true` | Include relative CSS import in JS |
| `minify` | `false` | Compact generated CSS whitespace while preserving CSS tokens and declaration order |

### 9.1 Path resolution

File-level directories resolve relative to the source file, never the current working directory.
Project-level directories resolve relative to the project root; source-relative subdirectories are
preserved by default to avoid basename collisions. A file-level directory is exact, without mirrored
subfolders.

Filenames are basenames only: no separators or traversal. `css-name` requires `.css` and `map-name`
requires `.js` (optional extension normalization may be added later). A custom JS basename
`classes.js` yields `classes.d.ts`; a CSS name `theme.css` yields `theme.css.map` when source maps
are enabled. If only a directory is specified, the default filename is used; if only a filename is
specified, the effective directory is retained. Independent overrides must work.

Precedence: built-in defaults < project config < file `@setup` < explicit CLI overrides. CLI
overrides are explicit and MUST NOT silently flatten multiple outputs into one destination.

### 9.2 Safety and writing

All output paths are resolved before any write. The planner rejects input/output overlap, duplicate
targets, workspace escapes and symlink escapes unless an explicit trusted project policy permits
external output. Unknown setup keys and duplicate settings are rejected. Missing directories are
created. The CSS import in JS is computed relative to the JS map directory using forward slashes and
`./` where necessary, with safe string escaping.

If CSS emission is disabled, `import-css: false` is required. If map emission is disabled, types
must be disabled or are automatically suppressed with a documented warning (§8). No source map is
written when CSS is disabled.

The build validates the entire output plan before writing. Files are written to temp files in the
destination directory and renamed: per-file atomicity, not cross-file transactionality. On errors the
last successful outputs are retained and marked stale. Generated files are tracked in a manifest;
`clean` removes only compiler-owned files not modified externally. On renames or configuration
changes, obsolete owned outputs are removed after a successful build, or reported when safe deletion
cannot be established. The watcher excludes generated outputs and avoids feedback loops. Unrelated
user files are never overwritten without explicit opt-in.

### 9.3 Acceptance cases

No setup; only CSS directory; only map directory; only names; both directories and names; nested
source; paths with spaces; Windows separators; output collision; invalid extension; traversal;
symlink; disabled outputs; renamed source; custom source map URL; relative import across sibling
directories.

## 10. Project configuration

The MVP uses declarative `chikx.config.json`, safe to read in untrusted workspaces. A trusted
`chikx.config.ts` may come later and is executed only by an explicit trusted build.

```json
{
  "include": ["src/**/*.cssx"],
  "exclude": ["node_modules", "dist"],
  "output": {
    "cssDir": "dist/styles",
    "mapDir": "dist/maps",
    "emitCss": true,
    "emitMap": true,
    "emitTypes": true,
    "sourceMap": false,
    "importCss": true,
    "minify": false
  },
  "classes": { "strategy": "prefix", "prefix": "ui" },
  "media": { "md": "(min-width: 768px)", "xl": "(min-width: 1280px)" },
  "compiler": { "strict": true, "mediaGrouping": "safe" }
}
```

The schema is validated; unknown keys are rejected in strict mode. Kebab-case source settings map
to camelCase JSON (`css-dir` ↔ `cssDir`). Multi-root VS Code workspaces resolve the nearest config
per file with an explicit workspace boundary. A JSON schema and completions are provided. Media
definitions merge by key (§4.2).

The workspace root is the nearest ancestor containing `chikx.config.json`, else the nearest ancestor
containing `package.json` (ADR-0007).

## 11. Public API

The compiler exposes pure APIs; it returns artifacts and never writes files. Project hosts provide
read/resolve operations and canonical path policy. Shared interface shapes from masterplan §6:

```ts
interface Span {
  start: number;
  end: number;
  file: string;
}
interface Variant {
  aliases: string[];
  value: string;
  span: Span;
}
interface Declaration {
  kind: "declaration";
  property: string;
  value: string;
  variants: Variant[];
  span: Span;
}
interface Diagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  span: Span;
}
interface CompileResult {
  css?: string;
  js?: string;
  types?: string;
  sourceMap?: string;
  classes: Record<string, string>;
  diagnostics: Diagnostic[];
  dependencies: string[];
}
```

Public entry points:

- `parse(source, options)` — tolerant parse to a file AST plus diagnostics, with spans.
- `compile(source, options)` — compile one source to a `CompileResult`.
- `compileProject(entries, host, options)` — resolve modules/configuration and compile entries
  through an injected host.
- `planOutputs(...)` — validate and return the output plan before writing.

AST value fields hold raw source slices. Values containing `$` references additionally carry a
parsed token sequence; spans are preserved through all stages (ADR-0005). The IR records ordered
selectors, declarations, at-rule stack, origin spans and condition keys. The AST is immutable
during transformation.

Pipeline: tokenize → parse AST → resolve modules/config → semantic validation → lower into ordered
CSS IR → class rewrite → safe grouping → CSS/JS/types/source-map generation → output planning/writing.
Output is deterministic across runs and platforms. Source maps use standard v3 mappings; the CSS
source map comment points to the actual output basename. Fatal errors and warnings are distinct.

The exact TypeScript signatures and result types beyond these shapes are frozen by task A02. Changes
require lead approval.

## 12. Diagnostics

Codes are stable and belong to families:

| Family | Meaning | Canonical member |
|---|---|---|
| CHIKX1xxx | Syntax and lexical errors, including top-level conditional blocks | `CHIKX1001` syntax |
| CHIKX2xxx | Symbol and module errors (undefined token, cycle, ambiguity) | `CHIKX2001` undefined token |
| CHIKX3xxx | Media and condition errors (unknown/rejected alias) | `CHIKX3001` unknown media |
| CHIKX4xxx | Naming and export errors (collision) | `CHIKX4001` export collision |
| CHIKX5xxx | Output planning errors (collision, escape, overlap) | `CHIKX5001` output collision |

Every diagnostic carries a stable code, severity (`error` or `warning`), message and `Span`.
Recoverable syntax errors are reported once per statement and recovery resumes at the next safe
boundary. Invalid CSS is never emitted; affected constructs are omitted after an error diagnostic.

## 13. Deferred

The following are explicitly deferred beyond v0.1 and require an ADR plus regression fixtures:

- mixins and reusable declaration groups (`@group`/`@apply`);
- arbitrary expressions and computation;
- container aliases and attribute-based theme conditions;
- inline pseudo-state modifiers;
- explicit token defaults and shared runtime token bundles;
- file-scoped and stable hash naming;
- top-level conditional blocks (D3 may be revisited by a future ADR);
- trusted executable `chikx.config.ts`;
- LSP server, cross-language rename and class rename across JSX;
- safe advanced optimization and richer native CSS support;
- source formatting beyond the initial formatter task.

## 14. Conformance

A conforming v0.1 implementation:

1. parses the grammar in §3.2 with recovery and reports the diagnostic families in §12;
2. applies the locked decisions D1–D3 without configuration;
3. honours the cascade contract in §5 and never silently reorders declarations;
4. emits CSS, JS maps and declarations per §8–§9 or fails with diagnostics;
5. keeps compiler core free of mandatory third-party runtime dependencies;
6. runs on Node.js >= 20 and Bun, without a browser runtime.
