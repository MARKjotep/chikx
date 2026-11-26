# @chikx/compiler

The Chikx compiler: lexer, parser, resolver, media lowering, selector lowering, class naming,
CSS/JS/TypeScript emission, source maps and output planning. It is pure TypeScript with no runtime
dependencies and runs on Node.js >= 20 and Bun.

Source files use the `.cssx` extension (ADR-0013). The language ID (`chikx`), CLI command (`chikx`),
configuration file (`chikx.config.json`) and diagnostic codes (`CHIKX####`) keep the Chikx name.

## Install

Published on npm as **0.1.1** (2026-11-26):

```sh
npm install @chikx/compiler
```

## Use

`compile()` is async; await it. It returns artifacts and never writes files.

```ts
import { compile } from "@chikx/compiler";

const result = await compile(source, { sourceFile: "src/button.cssx" });
if (result.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
}
```

Project builds, output planning, the CLI and the VS Code extension are built on the same entry points.

## Documentation

The repository `README.md`, `SPECIFICATION.md`, `docs/grammar.md`, `docs/cascade.md`,
`docs/configuration.md` and `docs/compatibility.md` are the normative references. `CHANGELOG.md`
lists v0.1 behaviour and known gaps.

## License

MIT. See `LICENSE` in this package.
