# ADR-0001: Chikx is the only public name

## Status

Accepted (2026-11-25). Amended by [ADR-0013](ADR-0013-cssx-file-extension.md) for the source file
extension only; every other decision below stands.

Related: the 2026-11-24 naming decision; SPECIFICATION.md §1, §12; ADR-0013

## Context

The project was previously referred to as CSSX. The owner renamed it to Chikx, and a stale alternate
name in packages, commands, file extensions or diagnostic codes would fragment the public contract.
The repository directory is named `chiky`, which is incidental.

## Decision

Use Chikx everywhere public:

- packages are scoped `@chikx/*`; the private workspace root package is `chikx`;
- the CLI command is `chikx`;
- source files use the `.cssx` extension (ADR-0013; ADR-0001 originally chose `.chikx`);
- the VS Code language ID is `chikx`;
- diagnostics use the `CHIKX####` family;
- prose uses "Chikx".

The repository directory name `chiky` does not affect any package name, command, extension,
language ID or artifact.

## Consequences

No `cssx` package scope, command or diagnostic alias is shipped. `.cssx` is the source file
extension per ADR-0013; that is a file-name decision, not a second public name. Renames of public
artifacts require a superseding ADR and migration notes.
