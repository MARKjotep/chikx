# CSSX-A01 — Scaffold workspaces and governance (P0)

## Summary

- Scaffold the chikx Bun-workspaces monorepo with strict TypeScript, Biome lint and a `bun run verify` quality gate.
- Write governance docs: SPECIFICATION.md (v0.1 frozen), ten ADRs, `.ai/PROGRESS.md`, `.ai/plans/CSSX-PLAN.md`.
- No compiler logic in this task; `packages/compiler/src/` stays an empty stub owned by the next task.

## Objective

Establish the project structure, conventions and documentation that all later phases build on.
Persist this task as `.ai/tasks/CSSX-A01.md` and the results as `.ai/reports/CSSX-A01.md`.

Owner-locked language decisions (2026-11-25) are normative additions to the masterplan:

1. Bare nested selectors without `&` compile as descendant selectors.
2. `!important` binds per segment; each inline-variant segment is an independent declaration.
3. Conditional blocks are only valid inside rules in v0.1; top-level blocks are a syntax error with
   recovery.

## Allowed files (exclusive ownership)

- Root: `package.json`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `README.md`
- `docs/decisions/`, `docs/grammar/`, `docs/cascade/`, `docs/configuration/`
- `packages/compiler/package.json`, `packages/compiler/tsconfig.json`,
  `packages/compiler/src/index.ts` (empty stub)
- `packages/cli/` stub (`package.json`, `tsconfig.json`, `src/index.ts`, bin)
- `packages/language-service/` stub (`package.json`, `tsconfig.json`, `src/index.ts`)
- `packages/vscode/package.json` (placeholder only, no build)
- `tests/fixtures/`, `tests/compiler/`, `tests/browser/`, `tests/integration/`, `tests/extension/`
  (placeholder `.gitkeep`)
- `examples/basic/`, `examples/responsive/`, `examples/variables/`, `examples/jsx/`,
  `examples/custom-output/` (short README stubs)
- `.ai/PROGRESS.md`, `.ai/plans/CSSX-PLAN.md`, `.ai/tasks/CSSX-A01.md`,
  `.ai/reports/CSSX-A01.md`, `.ai/reports/logs/CSSX-A01.log`
- `git init` if the directory is not a git repository. NEVER commit.

Do not modify `.ai/CSSX-MASTERPLAN.md`, `AGENTS.md`, `opencode.jsonc` or `.ai/agents/`.

## Requirements

1. Root `package.json`: name `chikx`, private, ESM, workspaces `["packages/*"]`, node `>=20`;
   scripts `typecheck`, `lint`, `test`, `verify` (verify = typecheck + lint + test, failing if any
   step fails); devDependencies TypeScript and Biome. Run `bun install`; commit nothing.
2. `tsconfig.base.json`: strict, ES2022, NodeNext/bundler resolution, declaration, skipLibCheck;
   packages extend it.
3. Valid typechecking stubs: `@chikx/compiler` with zero third-party runtime dependencies;
   `@chikx/cli` with `bin: {"chikx": "src/index.ts"}`; `@chikx/language-service`;
   `@chikx/vscode` placeholder manifest only (Phase 6).
4. `biome.json`: minimal lint + format config, line width 100, double quotes, semicolons. Lint
   passes.
5. ADR-0001 through ADR-0010 under `docs/decisions/`, each with Status / Context / Decision /
   Consequences, covering: public naming; descendant bare nesting; per-segment `!important`;
   rule-scoped conditional blocks; raw-slice AST values; media alias merge; workspace root/output
   containment; Bun/Node/Biome tooling and quality gate; governance; class naming and export policy.
6. `SPECIFICATION.md` at repo root: normative v0.1 language specification derived from masterplan
   §1–§6 — vision, canonical example, lexical/grammar rules including EBNF, media conditions,
   cascade contract, variables/modules, selectors/classes, JS/declarations, output configuration,
   project configuration, public API and diagnostic families — with the three locked decisions
   inline. Marked `Status: v0.1 frozen (P0)`. No invented semantics; deferred features listed.
7. `.ai/PROGRESS.md`: starts with `# Chikx Implementation Progress`, one owner-decision date line,
   then exactly one `## Implementation Progress` table (Item / Deliverable / Acceptance condition /
   Status) with the 15 P0–P7 rows; A01 🟡, remaining 🔴.
8. `.ai/plans/CSSX-PLAN.md`: phase table P0–P7 with deliverables, dependencies and exit criteria
   from masterplan §10; task table A01–A15 with owned scopes and dependencies; concurrency note
   (A03 ∥ A04 after A02, A05 ∥ A06 integration, A07 ∥ A08, A09 ∥ A10; max 2 workers, disjoint
   ownership); worker protocol summary.

## Constraints

- Zero third-party runtime dependencies in `@chikx/compiler`; dev tooling only at the workspace
  root.
- Everything runs on Node and Bun eventually; development scripts use Bun.
- Do not commit or push; preserve unrelated files.
- Keep naming exact: `chikx` lowercase in commands/packages, "Chikx" in prose.

## Acceptance criteria

1. `bun install` succeeds and creates a lockfile.
2. `bun run typecheck`, `bun run lint`, `bun test`, `bun run verify` exit 0 (an empty test suite is
   acceptable).
3. Ten ADRs exist with the required sections.
4. `SPECIFICATION.md` covers the required sections and the three locked decisions.
5. Progress and plan tables exist; task and report files are written.
6. The report lists changed/created files, commands with actual results, deviations and blockers.
   A01 stays 🟡 until the lead verifies.

## Validation commands

```sh
bun install
bun run typecheck
bun run lint
bun test
bun run verify
```
