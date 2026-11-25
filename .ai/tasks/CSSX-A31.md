# CSSX-A31 — G1: `@group.<name>` lexer/parser and additive AST nodes

## Summary

- Phase **G1** of `.ai/plans/CSSX-PLAN-GROUPS.md` (design CSSX-A23, normative text CSSX-A30): teach the
  parser the `@group.<name>` definition (top level, declarations only) and use site (rule bodies, any
  depth), with additive AST nodes and statement-scoped CHIKX1001 recovery.
- ADR-0017 / `SPECIFICATION.md` §3.2/§3.6/§3.7 are frozen inputs. G0 is complete and G1 may not change
  them.
- The lexer already produces the contiguous `at-keyword`, `.` delim and identifier triple; G1 pins that
  contract with tests and recognises the dotted form in the parser by token adjacency, because joining
  it into one token would contradict the frozen `at-keyword` token JSDoc.
- No expansion (G3), no resolver/visibility work (G2), no formatter printing (G5). Group-free output must
  stay byte-identical.

## Objective

1. Add `GroupDefinition` to `StylesheetItem` and `GroupUseSite` to `BlockItem` in
   `packages/compiler/src/types/ast.ts`: `kind`, `name`, `declarations: readonly Declaration[]`, `span`,
   with JSDoc citing ADR-0017. Additive only.
2. Parse `@group.<name> { declarations… }` at the top level into `GroupDefinition`; the same construct in
   any rule body (any depth) into `GroupUseSite`. The dotted form is contiguous: whitespace inside it, a
   missing name or a non-identifier name is CHIKX1001 with statement recovery.
3. Blocks are declarations-only: a nested rule, conditional block, native at-rule or further `@group.`
   statement inside either block is one CHIKX1001 per offending statement, the statement is omitted and
   the rest of the block survives. Malformed headers recover at the next statement boundary without a
   crash.
4. Keep both duplicate definition nodes in the AST; do **not** add CHIKX2001 (G2 owns it).
5. A trailing `@md { … }` after a complete use-site block parses as an ordinary conditional block of the
   enclosing rule; a conditional use site `@group.x @md { … }` is CHIKX1001 and out of v1.
6. Extend the lexer and parser tests (acceptance and rejection, exact spans, existing CHIKX1002 recovery
   with group nodes present).
7. Update the plan's G1 row to 🟢 only after `bun run verify` is green; write this task file, the report
   and the log.

## Files (exclusive write scope)

- `packages/compiler/src/lexer/**` (contract notes + lexer tests)
- `packages/compiler/src/parser/**` (new `group.ts`, `statement.ts`; `rule.ts`, `statements.ts`,
  `diagnostics.ts`, `index.ts`)
- `packages/compiler/src/types/ast.ts` (lead-approved additive nodes)
- `packages/compiler/src/index.ts` (additive AST type export only)
- `tests/compiler/lexer.test.ts`, `tests/compiler/groups.parser.test.ts`
- `.ai/plans/CSSX-PLAN-GROUPS.md` (G1 row only), `.ai/tasks/CSSX-A31.md`,
  `.ai/reports/CSSX-A31.md`, `.ai/reports/logs/CSSX-A31.log`

Everything else (docs, fixtures/goldens, `.ai/PROGRESS.md`, `.ai/todo.md`, lowering, formatter, resolver,
emitter, diagnostics registry) is out of scope.

## Dependencies

- `docs/decisions/ADR-0017-reusable-declaration-groups.md` (accepted, normative)
- `SPECIFICATION.md` §3.2, §3.6, §3.7
- `.ai/plans/CSSX-PLAN-GROUPS.md` §2.5, §2.7, §6, §7 (G1), §9
- ADR-0002 (rule vs declaration lookahead), ADR-0004 (conditional blocks), ADR-0005 (raw values/spans),
  ADR-0011 (semicolonless final declarations)
- `.ai/framework/chikx/FRAMEWORK.md` §4, §7 (invariants 3, 4, 10, 11)

## Constraints

- Frozen registry: `types/diagnostics.ts` unchanged; only CHIKX1001 in this phase.
- No expansion/lowering, resolver, formatter or emitter behaviour change. If an exhaustive `kind` switch
  broke typecheck, the only allowed edit would be an explicit inert skip; none did.
- Group-free sources must compile and format byte-identically; no golden or fixture edit.
- Preserve unrelated parallel worktree changes. No commit or push.

## Acceptance criteria (plan §7 G1)

- `@group.x { … }` parses at top level and in rule bodies; all rejection cases are CHIKX1001 with
  statement-level recovery and no crash; nodes carry exact spans and ADR-0017 JSDoc.
- Lexer/parser tests prove acceptance and rejection, including `@group.keyframes`, empty definitions,
  malformed dotted forms, declarations-only recovery and the CHIKX1002 `color: red` ⏎ `&:hover { … }`
  path with group nodes present.
- `bun run verify` green; 681 baseline tests still pass with the new tests added; zero golden changes.
- Plan G1 row 🟢 after verification; report and log written.

## Validation

```sh
bunx tsc -p packages/compiler/tsconfig.json --noEmit
bun test tests/compiler/lexer.test.ts tests/compiler/groups.parser.test.ts
bun test tests/compiler
bun run verify
git status --porcelain
```

## Handoff

Report `.ai/reports/CSSX-A31.md` records files changed, evidence tails, observed counts, the explicit
group-free-output statement, the in-rule definition/use-site spec contradiction and the pre-G5 formatter
hazard. G2 (resolver) consumes the new node kinds.
