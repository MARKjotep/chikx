# CSSX-TERMINOLOGY — variables vs runtime terminology note

## Summary

- Owner question (2026-11-26): the names look inverted against casual CSS vocabulary — Chikx
  `@variables` is build-time substitution, while `@runtime` is what CSS calls a "CSS variable" /
  custom property.
- Decision for 0.1.0: keep both block names (no grammar, SPECIFICATION, compiler or editor change)
  and add one explicit terminology note so readers are not misled. Alias or rename is deferred to
  v0.2 on evidence; this task only records and explains.
- Docs-only, two files plus this task and its report.

## Objective

1. `docs/usage.md`: at the §2.3/§2.4 boundary, a compact note with a four-column table (block,
   resolved when, emitted as, referenced in Chikx as), the promotion paragraph with a short
   `$primary` before/after example showing both emitted CSS shapes, the ADR-0016 rationale, and a
   blunt sentence about the naming.
2. `README.md`: one cross-reference sentence in the Documentation list.
3. Short provenance here and in `.ai/reports/CSSX-TERMINOLOGY.md`.

## Allowed files

`docs/usage.md`, `README.md`, `.ai/tasks/CSSX-TERMINOLOGY.md`, `.ai/reports/CSSX-TERMINOLOGY.md`.
No CHANGELOG (docs-only), no plan or board edits.

## Constraints

- Do not overclaim: native `var(--anything)` stays valid CSS; runtime tokens are emitted per
  consuming entrypoint; duplicate runtime names resolve in merge order (ADR-0016).
- Keep the guide's concise, direct voice. Do not restructure the README.
- Preserve the uncommitted working tree; no git commands.

## Acceptance criteria

1. The note exists at the §2.3/§2.4 boundary with the table, promotion paragraph and example,
   rationale and naming-honesty sentence.
2. `README.md` gains at most one cross-reference sentence.
3. No other files changed; no code, grammar or specification changes.
4. `bun run lint` green.
