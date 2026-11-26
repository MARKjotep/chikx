# CSSX-T10 — `clean` trusts manifest provenance and can delete a non-artifact workspace file

**Status:** 🟢 fixed · **Found by:** TT3 (`.ai/reports/CSSX-TT3.md` "Recorded risk") and TT4
(`.ai/reports/CSSX-TT4.md` finding 2) · **Severity:** medium
**Package / API:** `packages/cli` — `manifest.ts` record validation + `commands/clean.ts` deletion policy.

## Summary

- `clean` deletes any **in-workspace** manifest record whose `hash` matches the bytes on disk, regardless
  of whether the compiler ever produced that path. A hand-written or corrupted record
  (`{kind:"css", path:"notes.txt", hash:<sha256 of notes.txt>}`) makes `clean` remove a user file.
- Escaping/absolute paths are rejected (warnings), so the blast radius is the workspace — but any process
  that can edit `.cssx-manifest.json` gets a workspace-file delete primitive.
- The compiler cannot currently tell an artifact from a user file: the record stores only `kind` + path +
  hash. A stronger ownership marker is a *specification* change (recorded as such), not just a bug fix.

## Evidence

| Item | Value |
|---|---|
| Reports | `.ai/reports/CSSX-TT3.md` "Recorded risk (not classified as a defect…)" and `.ai/reports/CSSX-TT4.md` finding 2 |
| Repro (TT4) | write `notes.txt`; manifest record `{kind:"css", path:"notes.txt", source:"src/placeholder.cssx", hash:<sha256 of notes.txt>}`; `chikx clean --json` → `removed:[{path:"notes.txt",reason:"deleted"}], skipped:[]`, file gone |
| Repro (TT3) | `tests/stress/fs/manifest.test.ts:253` — in-workspace tampered record with a matching hash → `clean` deletes the user file (pinned with a comment) |
| Downstream | `tests/stress/cli/clean-manifest.test.ts` — "matching-hash trust" case pins the same behaviour |
| Docs | `docs/known-limitations.md` §3 "Build overwrites configured destinations" row (documents the conservative direction only) |

## Expected vs actual

- **Expected:** `clean` only deletes files the compiler is provably responsible for — e.g. records whose
  path matches the planner's artifact shape **and** whose recorded `source`/`kind`/extension agree —
  and refuses (warns) otherwise.
- **Actual:** a matching hash alone authorises deletion, so a forged record deletes an unrelated file.

## Owned files (fix task)

- `packages/cli/src/manifest.ts` (record validation) and `packages/cli/src/commands/clean.ts` (deletion
  predicate). If a spec change is needed: `SPECIFICATION.md` manifest section + an ADR.
- `tests/stress/fs/manifest.test.ts:253` and `tests/stress/cli/clean-manifest.test.ts` — turn the pins
  into the decided behaviour (refuse + warning, or delete only provable artifacts).
- `docs/known-limitations.md` §3 row — replace with the shipped rule.

## Suggested fix direction

Validate a record before deletion: the path must be inside a planned output directory for the current
config, carry a known artifact extension for its `kind`, and have a `source` that resolves to an existing
`.cssx` inside the workspace. Anything else is released with a warning instead of deleted. Record the
tightened rule in the specification so future writers keep the invariant.

## Acceptance criteria

1. A forged in-workspace record for a non-artifact file (`notes.txt`) no longer deletes it; `clean`
   reports it as skipped with a reason.
2. Genuine artifacts (including hand-edited ones) keep today's behaviour: unmodified owned files are
   deleted, modified ones are kept and reported.
3. The same rule applies under `--dry-run` and `--json` (`would-delete` vs `skipped`), with goldens
   updated deliberately.
4. `docs/known-limitations.md` §3 matches the shipped policy; `bun run verify` green.

## Validation

```sh
bun test tests/stress/cli/clean-manifest.test.ts
bun test tests/stress/fs/manifest.test.ts
bun run verify
```

## Fix record

- `packages/cli/src/manifest.ts`: added `isArtifactRecord()` — a record is artifact-shaped only when its
  path ends with the suffix for its `kind` (`.css`, `.js`, `.d.ts`, `.map`) and its `source` is a
  workspace-relative `.cssx`.
- `packages/cli/src/commands/clean.ts`: records failing the shape test (or with a source that resolves
  outside the workspace) are reported as `skipped` with reason `untrusted`, warned about, and released from
  the manifest without being deleted. Genuine unmodified artifacts are still deleted; modified ones are
  still kept as `modified`. The same predicate applies under `--dry-run` and `--json`.
- `packages/cli/src/commands/build.ts`: obsolete-output pruning applies the same shape check, so a forged
  record cannot be deleted by a build either.
- `tests/stress/fs/manifest.test.ts` and `tests/stress/cli/clean-manifest.test.ts`: pinned cases flipped to
  refusal + skipped/untrusted + released ownership, including the `--dry-run` path.
- `docs/known-limitations.md` §3 "Build overwrites configured destinations" row documents the shipped rule.

Validation:

```sh
bun test tests/stress/fs/manifest.test.ts        # pass
bun test tests/stress/cli/clean-manifest.test.ts # pass
bun test tests/stress/fs/ tests/stress/cli/      # 123 pass
```
