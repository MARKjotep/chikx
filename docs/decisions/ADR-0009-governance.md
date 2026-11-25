# ADR-0009: Repository governance for Chikx

## Status

Accepted (2026-11-25, owner instruction)

Related: `.ai/CSSX-MASTERPLAN.md` §10, §14; `.ai/PROGRESS.md`; `.ai/plans/CSSX-PLAN.md`

## Context

The repository inherits `AGENTS.md` and `.ai/agents/AGENTS.md` guidance written for a different
project. Those files mandate `builder/html_builder.ts` builds, `client/` bundling and Tally JSDoc,
and ask that `.ai/` root stay free of files. The Chikx masterplan defines its own process.

## Decision

- `.ai/PROGRESS.md` lives at the `.ai/` root per explicit owner instruction. This overrides the
  older "keep `.ai/` root free of files" guidance in `.ai/agents/AGENTS.md`.
- At most **two concurrent implementation workers**, each with disjoint file ownership, per owner
  instruction.
- `.ai/CSSX-MASTERPLAN.md` is the primary specification for this repository and supersedes the root
  `AGENTS.md` template rules about `builder/html_builder.ts`, `client/` builds and Tally JSDoc.
- Workers use per-task `.ai/tasks/<id>.md` and `.ai/reports/<id>.md` files; the lead independently
  verifies gates and updates progress.

## Consequences

- Project-specific build and documentation rules in the masterplan and `SPECIFICATION.md` win over
  generic template guidance.
- Shared interfaces may not change without lead approval.
- Progress is never marked complete from agent claims alone.
