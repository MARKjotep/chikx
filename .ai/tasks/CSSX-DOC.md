# CSSX-DOC — Chikx framework handover reference

## Summary

- Write `.ai/framework/chikx/FRAMEWORK.md`: the single complete handover reference for the chikx language, compiler pipeline, diagnostics, invariants, gates and bug-fixing protocol.
- Add a discovery pointer in `.ai/agents/AGENTS.md` so every agent session finds it first.
- Everything factual cross-checked against the actual code; no invented behavior.

## Objective

Persist institutional knowledge so another LLM can fix bugs without archaeology. Persist this task as `.ai/tasks/CSSX-DOC.md` and results as `.ai/reports/CSSX-DOC.md`.

## Allowed files

- `.ai/framework/chikx/FRAMEWORK.md` (new)
- `.ai/agents/AGENTS.md` (append a short pointer section ONLY)
- `.ai/tasks/CSSX-DOC.md`, `.ai/reports/CSSX-DOC.md`, `.ai/reports/logs/CSSX-DOC.log`

Protected (read-only): `.ai/CSSX-MASTERPLAN.md`, root `AGENTS.md`, `opencode.jsonc`, `packages/**`, `tests/**`, `docs/**`, `.ai/PROGRESS.md`, `README.md`.

## Requirements

1. `FRAMEWORK.md` contains all 11 mandatory sections: identity; repository map; compile pipeline; frozen contracts; language semantics digest; diagnostics registry with producers; invariants; quality gates and commands; bug-fix protocol; documentation index; current state.
2. Every function name, path, default, diagnostic code and behavior cited must exist in the repository. The code wins over the prompt; note disagreements in the report.
3. Dense LLM-oriented writing: tables and lists over prose, 250–400 lines, explicit rules, no marketing.
4. `.ai/agents/AGENTS.md` gains a 2–3 line "Start here" pointer.
5. `bun run verify` stays green (Biome ignores `.ai`, so the doc needs no lint pass).

## Constraints

- Do not edit protected files, do not weaken tests, do not regenerate goldens.
- Do not flip `.ai/PROGRESS.md` statuses; the lead verifies.
- No framework dependency or upstream repository changes.

## Acceptance criteria

1. `.ai/framework/chikx/FRAMEWORK.md` exists with all 11 sections and verified facts.
2. `.ai/agents/AGENTS.md` has the pointer.
3. `bun run verify` exits 0.
4. Report lists every prompt-vs-code correction found.

## Validation commands

```sh
bun run verify
```

## Verification notes (filled while executing)

- `bun test`: 612 pass / 0 fail, 37 files.
- Browser gate recorded at 75 passed (25 tests × Chromium/Firefox/WebKit, `docs/cascade.md` §5).
- 48 `input.cssx` golden fixtures across 12 groups, plus `tests/fixtures/cli` project fixtures and
  7 `tests/fixtures/modules/merge` goldens (`entry.cssx`).
- `git log` reports no commits on `master`; the working tree is entirely untracked.
