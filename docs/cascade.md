# The Chikx cascade contract (v0.1)

Chikx does **not** invent a new cascade. It expands your declarations into ordinary CSS in the order
you wrote them, and the browser's normal cascade decides the winner. This page restates
[SPECIFICATION.md](../SPECIFICATION.md) §5 with worked examples, states what the compiler promises,
and points at the browser evidence.

## 1. Source-preserving mode

For each rule, declarations are expanded in **authored order**:

1. the base declaration first;
2. then each inline variant, in the order the variants were written;
3. conditional blocks are emitted where they appear;
4. nested rules are lowered and emitted where they appear.

Consecutive expanded declarations with the same selector and at-rule context form one contiguous
run. Runs are flushed when a nested rule or a conditional declaration interrupts them. The output
preserves authored declaration order — including duplicate fallbacks, shorthand/longhand pairs and
`!important` flags.

### Worked example — base then variants

```chikx
.button {
  padding: 12px @md 20px @xl 32px;
  border-radius: 8px;
  background: white @dark #181818;
}
```

```css
.ui-button {
  padding: 12px;
}

@media (min-width: 768px) {
  .ui-button {
    padding: 20px;
  }
}

@media (min-width: 1280px) {
  .ui-button {
    padding: 32px;
  }
}

.ui-button {
  border-radius: 8px;
  background: white;
}

@media (prefers-color-scheme: dark) {
  .ui-button {
    background: #181818;
  }
}
```

The base value is always present and comes first. `border-radius` and the base `background` were
adjacent in the same context, so safe grouping put them in one rule; the `@dark` background is a
separate run. At 768–1279px the browser applies `padding: 20px`; at ≥1280px, `padding: 32px`.

## 2. Precedence

Later declarations keep their normal CSS precedence. This applies to shorthand/longhand
interactions, duplicate fallbacks, specificity and `!important`. Within one inline declaration the
last matching variant wins subject to that same cascade.

### Worked example — a later base overrides an earlier conditional

```chikx
.card {
  color: red @md green;
  color: blue;
}
```

```css
.ui-card {
  color: red;
}

@media (min-width: 768px) {
  .ui-card {
    color: green;
  }
}

.ui-card {
  color: blue;
}
```

At every width the final matching declaration is `color: blue`, because it comes **last** in the
stylesheet. The `@md green` declaration is earlier at the same specificity, so it loses. This is
valid authored CSS; the compiler documents it rather than "fixing" it. If the intent was
"green from 768px up, blue below", write the base first and the variant last:

```chikx
.card {
  color: blue @md green;
}
```

Authors **SHOULD** order mobile-first ascending aliases (`sm`, `md`, `lg`, `xl`, `2xl`) and place
combined conditions last. The compiler MAY warn about suspicious order, but it **MUST NOT** silently
reorder declarations.

### Worked example — `!important` per segment

`!important` belongs to the value segment it terminates (D2,
[ADR-0003](decisions/ADR-0003-important-per-segment.md)):

```chikx
.button {
  padding: 10px !important @md 20px;
}
```

```css
.ui-button {
  padding: 10px !important;
}

@media (min-width: 768px) {
  .ui-button {
    padding: 20px;
  }
}
```

The flag is not copied to the `md` segment. To make both important, write `!important` in both
segments.

## 3. Safe grouping

Safe grouping **merges only adjacent compatible rules and media contexts** without changing
declaration order, selector specificity, `@layer` or scope. It never moves a declaration across a
nested rule, a conditional block or a different at-rule context.

```chikx
.card { color: red; }
.card { margin: 0; color: blue; }
@media print { .card { color: black; } }
.card { padding: 1px; }
```

With the default `mediaGrouping: "safe"`:

```css
.ui-card {
  color: red;
  margin: 0;
  color: blue;
}

@media print {
  .ui-card {
    color: black;
  }
}

.ui-card {
  padding: 1px;
}
```

With `"none"` the first two rules stay separate:

```css
.ui-card {
  color: red;
}

.ui-card {
  margin: 0;
  color: blue;
}
/* … */
```

The computed styles are identical in both modes; only the emitted text differs. Grouping never
crosses the intervening `@media print` rule.

### What is *not* done

- **No reordering promises.** The compiler never promises that a different declaration order would
  compute differently, and never moves declarations to make a variant win.
- **No global grouping at the bottom.** Moving all rules for one selector into a single block at the
  end of the file is not generally safe (it can beat or lose to other rules and layers), so it is
  not offered.
- **No "ordered media" mode in v0.1.** A future opt-in ordered-media mode may define a different
  cascade contract; it must never be described as semantics-preserving.
- **No cascade repair.** If an earlier conditional is overridden by a later base, that is the
  authored result. Move the declaration yourself.
- **No specificity rewriting.** Flattened selectors keep native nesting specificity; mixed-specificity
  parent lists use `:is(...)` rather than naïve expansion.

## 4. Nested rules and flush boundaries

Nested rules are emitted at their authored position and flush the current run:

```chikx
.card {
  border: 1px solid;
  &:hover { opacity: 0.8; }
  background: white;
}
```

```css
.ui-card {
  border: 1px solid;
}

.ui-card:hover {
  opacity: 0.8;
}

.ui-card {
  background: white;
}
```

`border` and `background` share a selector and context, but they are not adjacent — the nested rule
sits between them — so they are not merged. This is exactly what keeps declaration order intact.

## 5. Browser evidence

The contract is verified in real engines, not just in golden strings:

```sh
bun run test:browser          # Playwright: Chromium (required), Firefox and WebKit when installed
bunx playwright test --project=chromium
```

Specs live in [`tests/browser/specs/`](../tests/browser/specs/):

| Spec | What it proves |
|---|---|
| `cascade.pw.ts` | Exact computed values at 320 / 767 / 768 / 1279 / 1280px boundaries. |
| `themes.pw.ts` | Light/dark, combined `@xl+dark`, runtime custom properties. |
| `interactions.pw.ts` | Reduced motion, hover, focus and disabled states. |
| `specificity.pw.ts` | `.card.card` beats `.card`; later duplicate declarations win. |
| `parity.pw.ts` | Pretty vs minified output produce identical computed styles. |
| `grouping.pw.ts` | Safe grouping vs `mediaGrouping: "none"` produce identical computed styles. |

The harness compiles every scenario through the public `compile()` API and serves generated CSS to
the browser; no stylesheet is hand-written. Current recorded result (CSSX-BROWSER-01): **75 passed**
— 25 tests on each of Chromium, Firefox and WebKit, with no console errors, page errors, failed
requests or HTTP ≥ 400 responses. See [`tests/browser/README.md`](../tests/browser/README.md) for
engine setup and harness details.

## See also

- [grammar.md](grammar.md) — the syntax that produces these declarations.
- [configuration.md](configuration.md) — `mediaGrouping` and output settings.
- [compatibility.md](compatibility.md) — supported constructs and known gaps.
