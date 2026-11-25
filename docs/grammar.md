# Chikx grammar and lexical rules (v0.1)

The normative definition is [SPECIFICATION.md](../SPECIFICATION.md) §3. This page restates it for
authors and implementers, with the owner-locked decisions inline. Where this page and the
specification disagree, the specification wins.

## 1. Lexical rules

Chikx is parsed by a stateful tokenizer and a recursive-descent parser, never by splitting
declarations with regular expressions. Every token and AST node carries a source span (`start`,
`end`, `file`); diagnostics point at the authored range, and the language service maps spans to
line/column.

The tokenizer tracks:

- source offsets plus line and column;
- comments (`// …` and `/* … */`);
- escapes in identifiers, strings and selectors;
- quoted strings, including embedded `@`, `$`, `{`, `}`, `;`;
- balanced parentheses and brackets;
- brace nesting and statement boundaries.

### `@` recognition

`@` is only a Chikx construct when it is **not** inside a string, comment, `url(...)` or other
function argument, and only after whitespace at top-level value depth. Everything else is ordinary
CSS content:

```chikx
.icon { background: url("image@2x.png"); }
.label::after { content: "@md"; }
.note { width: calc(100% - 2rem); }
```

None of the `@` characters above are modifiers or directives. An unknown modifier at the correct
depth is reported (`CHIKX3001`) rather than emitted as CSS.

A file-level directive (`@setup`, `@use`, `@variables`, `@runtime`, `@media-types`) is recognised
only at the **top level**. The same names inside a rule are not directives.

### Strings and escapes

Strings are single- or double-quoted and may contain CSS escapes. Escaped characters are never
interpreted as syntax: `content: "\@md"` holds a literal `@`. Setup values are CSS-string decoded
(`css-dir: "../gen\ styles"`). Quotes inside a string are escaped with `\"`; a backslash at the end
of a string is an error.

CSS identifier escapes are preserved in selectors and class names. Class renaming applies to the
authored class token; the escape text is not rewritten inside attribute strings, `content` values or
other declaration values.

### Statements and semicolons

- Chikx declarations require a semicolon.
- An ordinary CSS final declaration without a trailing semicolon before `}` is accepted only when it
  contains **no** recognised modifier and **no** `$` reference (ADR-0011). Otherwise the parser
  reports `CHIKX1002`.
- Recovery happens at safe statement boundaries so the editor keeps working after an error. Each
  recoverable error is reported once; the affected construct is omitted rather than emitted as
  invalid CSS.
- Unknown or duplicate `@setup` keys, duplicate settings and invalid boolean values are
  `CHIKX1001` errors (`compile` reports them at the exact setting span).
- Chikx directives are reserved names and may not be reused as aliases or token names where that
  would conflict.

## 2. Grammar (EBNF)

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

This is **structural** grammar. CSS values and selectors are parsed as balanced token sequences:
`calc(100% - 2rem)`, `url(a(b).png)`, quoted strings, comments and escaped braces are not structural
punctuation. Aliases may begin with digits (`2xl`).

Multiple `@setup` blocks may appear at top level; they are merged in document order. A duplicate
setting key — within one block or across blocks — is rejected.

## 3. Directives

| Directive | Position | Purpose |
|---|---|---|
| `@setup { key: value; }` | top level | Output paths, filenames, emit flags, prefix. Keys are kebab-case. |
| `@use "path" [as ns] [styles];` | top level | Import compile-time tokens, optionally namespaced; the optional `styles` clause also merges the module's rules (ADR-0014). Paths are relative to the importing file and restricted to the workspace. |
| `@variables { name: tokens; }` | top level | Compile-time token definitions. Values substitute token sequences, not JavaScript. |
| `@runtime { name: value [@alias value]; }` | top level | Native custom properties with optional conditional values. |
| `@media-types { alias: condition; }` | top level | File-local media aliases, merged over built-ins and project config. |

`@use` imports compile-time tokens by default; without the `styles` clause it never imports rules.
The optional `styles` clause makes the import rule-bearing (ADR-0014): the module's rules are merged
into the importing build ahead of the importing file's own rules, depth-first in authored `@use`
order, and keep the imported module's own `@setup prefix`. The build writes one merged class map and
declaration file; the same original class name resolving to different emitted names, or a camelCase
export-alias collision, is `CHIKX4001`. A module that should never emit artifacts of its own declares
`@setup { module: true; }`, which suppresses its CSS, map, types and CSS import unless those keys are
authored explicitly. Modules are imported once; there is no implicit transitive re-export and no
network or executable import.

## 4. Declarations and inline variants

```chikx
.button {
  display: flex;
  padding: 12px @md 20px @xl 32px;
  background: white @dark #181818 @xl+dark #101010;
}
```

- A declaration is `property: baseValue [@alias[+alias] value]* ;`.
- A **base value is required** for inline variants. For conditional-only declarations use a
  conditional block inside the rule.
- Variants are emitted in authored order, after their base value, as independent CSS declarations.
- Duplicate aliases in one modifier are normalised (`@md+md` is `@md`). Combined aliases are logical
  **AND**.
- `!important` binds **per value segment** (D2):

  ```chikx
  padding: 10px @md 20px !important;
  ```

  emits `padding: 10px` and, inside `md`, `padding: 20px !important`. The flag is never propagated
  from one segment to another. See [ADR-0003](decisions/ADR-0003-important-per-segment.md).

### Owner-locked decision D1 — bare nested selectors are descendants

A nested rule whose selector has no `&` is a **descendant** selector, exactly as if it were written
with a leading `& `:

```chikx
.button {
  .icon { width: 16px; }
}
```

lowers to `.ui-button .ui-icon`. `&` is still required for compound, sibling and other complex
nesting in v0.1. Nested rules are distinguished from declarations by balanced lookahead: a `{` at
top level before the statement terminator means a rule, not a declaration. See
[ADR-0002](decisions/ADR-0002-descendant-nesting.md).

### Owner-locked decision D3 — conditional blocks are rule-scoped

```chikx
.card {
  @md { display: grid; gap: 24px; }
}
```

Conditional blocks are valid **only inside rules**. A top-level conditional block is a
`CHIKX1001`-family syntax error:

```chikx
@md {              /* CHIKX1001: conditional block outside rule */
  .card { padding: 20px; }
}
```

The parser reports the error once, recovers at the next safe statement boundary, and emits no CSS
for the rejected block. Native top-level at-rules keep their native meaning and are not conditional
blocks. See [ADR-0004](decisions/ADR-0004-rule-scoped-conditionals.md).

### Owner-locked decision D2 — `!important` is per segment

See §4 above and [ADR-0003](decisions/ADR-0003-important-per-segment.md). Each inline variant
segment is an independent declaration and carries only its own flag.

## 5. Rules, nesting and selectors

Blocks may contain declarations, nested rules, conditional blocks and native at-rules. Supported
nesting forms in v0.1:

| Authored | Emitted (prefix `ui`) |
|---|---|
| `&:hover` | `.ui-button:hover` |
| `&::before` | `.ui-button::before` |
| `&:nth-child(2n)` | `.ui-button:nth-child(2n)` |
| `& > .icon` | `.ui-button > .ui-icon` |
| `& + .button` | `.ui-button + .ui-button` |
| `&.is-active` | `.ui-button.ui-is-active` |
| `.icon` (bare) | `.ui-button .ui-icon` (D1) |

Selector lists are split only at top-level commas, including functional pseudos such as
`:is(.a, .b)`. Native nesting specificity is preserved: for mixed-specificity parent lists the
emitter uses `:is(...)` where needed, or rejects unsupported flattening instead of expanding it
naïvely. Multiple `&` references and escaped class identifiers are validated. Text inside attribute
strings and declaration values is never rewritten.

A leading `&` is preserved as authored through lowering and resolved during selector flattening.

## 6. Media conditions

Default aliases (all `min-width` unless noted):

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

Aliases merge by key: built-ins < project `media` config < file `@media-types`; the later layer wins
for the same key and distinct keys accumulate. MVP supports **one media-query expression per
alias**. Comma lists, two media types in one modifier, and aliases defined with `not`/`only` in a
combination are rejected with `CHIKX3001`; native media lists pass through untouched. See
[ADR-0006](decisions/ADR-0006-media-alias-merge.md).

## 7. Native at-rules

Native CSS at-rules retain their meaning and are emitted around Chikx-generated declarations.
Supported pass-through contexts include `@media`, `@supports`, `@layer`, `@container`,
`@keyframes`, `@font-face`, `@property` and classic `@page`.

`@keyframes`, `@font-face` and `@property` are **restricted contexts**: inline modifiers and
conditional blocks inside them are rejected (`CHIKX3001`, "Unsupported Chikx transformation in this
context") instead of silently changing semantics. Plain declarations and keyframe steps pass
through. See [compatibility.md](compatibility.md#native-at-rules).

## 8. Diagnostics

| Family | Meaning | Anchor |
|---|---|---|
| `CHIKX1xxx` | Syntax and lexical errors, including top-level conditional blocks | `CHIKX1001` |
| `CHIKX2xxx` | Symbols and modules (undefined token, cycle, ambiguity) | `CHIKX2001` |
| `CHIKX3xxx` | Media and condition errors | `CHIKX3001` |
| `CHIKX4xxx` | Naming and export errors | `CHIKX4001` |
| `CHIKX5xxx` | Output planning (collision, escape, overlap) | `CHIKX5001` |

Every diagnostic has a stable code, severity, message and span. Errors reject the affected
construct; warnings leave output in place. Invalid CSS is never emitted.

## See also

- [cascade.md](cascade.md) — what the emitted order means in the browser.
- [configuration.md](configuration.md) — `@setup`, `chikx.config.json` and output planning.
- [compatibility.md](compatibility.md) — supported and unsupported constructs.
- [`examples/basic`](../examples/basic/) — the canonical stylesheet, compiled.
