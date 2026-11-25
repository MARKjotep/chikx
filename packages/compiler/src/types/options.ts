/**
 * Options and host contracts for parsing, compiling and planning outputs.
 *
 * All paths crossing this API are workspace-relative or absolute POSIX paths
 * with forward slashes; hosts convert platform separators once at their
 * boundary. The compiler core never reads the filesystem: project operations
 * go through an injected {@link ModuleHost}, and single-source operations are
 * pure functions.
 */

/** Options for `parse`. */
export interface ParseOptions {
  /**
   * Workspace-relative POSIX path recorded as `Span.file` on every node and
   * diagnostic produced for this source. The source text itself is supplied
   * directly to `parse` and is never read from disk.
   */
  readonly file: string;
}

/** Class naming strategies available in v0.1 (ADR-0010). */
export type NamingStrategy = "none" | "prefix";

/** Class naming configuration. */
export interface NamingOptions {
  /** `none` keeps authored class names; `prefix` prepends the effective prefix. */
  readonly strategy: NamingStrategy;
  /**
   * Prefix used by the `prefix` strategy, for example `ui` producing `ui-card`.
   * An empty string leaves names unchanged. Omitted means the file-level
   * `prefix` option or setup key applies.
   */
  readonly prefix?: string;
}

/**
 * Media grouping modes, the only accepted v0.1 values.
 *
 * `safe` (the default) merges only adjacent compatible rules and media
 * contexts without changing declaration order, specificity, layer or scope;
 * `none` emits rules as authored and performs no merging. Global grouping at
 * the bottom is never safe. Future modes such as ordered-media grouping
 * (masterplan §3.3) are deliberately absent from this union and must be
 * rejected as an invalid configuration value with a clear message.
 */
export type MediaGroupingMode = "safe" | "none";

/**
 * Output settings shared by file-level setup, project configuration and CLI
 * overrides (SPECIFICATION.md §9).
 *
 * Defaults: `cssDir`/`mapDir` = the source directory; `cssName` =
 * `<stem>.css`; `mapName` = `<stem>.map.js`; `emitCss`, `emitMap`,
 * `emitTypes` and `importCss` = `true`; `sourceMap` = `false`; `minify` =
 * `false`. `minify` is opt-in only: it compacts generated structural
 * whitespace while preserving authored CSS tokens and declaration order.
 */
export interface OutputOptions {
  /**
   * Directory for the CSS artifact. A file-level directory resolves relative
   * to the source file (never the working directory); a project-level
   * directory resolves relative to the workspace root. A file-level directory
   * is exact, without mirrored subfolders.
   */
  readonly cssDir?: string;
  /**
   * Optional CSS basename, for example `button.css`. Basenames only: no
   * separators or traversal, and the `.css` extension is required.
   */
  readonly cssName?: string;
  /** Directory for the JS class map, resolved like {@link OutputOptions.cssDir}. */
  readonly mapDir?: string;
  /**
   * Optional JS map basename, for example `classes.js`. The declaration file
   * becomes `classes.d.ts`.
   */
  readonly mapName?: string;
  /** Write the stylesheet. Default `true`. */
  readonly emitCss?: boolean;
  /** Write the JS class map. Default `true`. */
  readonly emitMap?: boolean;
  /**
   * Write `.d.ts` beside the JS map. Default `true`; automatically suppressed
   * with a documented warning when map emission is off and types were not
   * explicitly disabled (SPECIFICATION.md §8).
   */
  readonly emitTypes?: boolean;
  /** Write a CSS debugging source map. Default `false`; never written when CSS is disabled. */
  readonly sourceMap?: boolean;
  /**
   * Include a relative CSS side-effect import in the JS map. Default `true`;
   * must be `false` when CSS emission is disabled.
   */
  readonly importCss?: boolean;
  /**
   * Opt-in compact CSS output. Default `false`. Compacts generated structural
   * whitespace only and preserves authored CSS tokens, quoted strings, `calc()`
   * spacing and declaration order.
   */
  readonly minify?: boolean;
}

/** Options for compiling one source string with `compile`. */
export interface CompileOptions extends ParseOptions, OutputOptions {
  /** Effective file-level class prefix; `naming.prefix` wins when both are set. */
  readonly prefix?: string;
  /** Class naming strategy and prefix. Defaults to strategy `prefix` with an empty prefix. */
  readonly naming?: NamingOptions;
  /**
   * Project-level media alias overrides merged after built-in defaults and
   * before file-level `@media-types`, which remain the source-level override
   * layer (ADR-0006).
   */
  readonly media?: Readonly<Record<string, string>>;
  /**
   * Enable strict validation, including rejection of unknown configuration
   * keys. Default `false`.
   */
  readonly strict?: boolean;
  /** Media grouping mode. Default `safe`. */
  readonly mediaGrouping?: MediaGroupingMode;
  /**
   * Absolute POSIX workspace root used for containment checks. When omitted,
   * `compile` stays filesystem-free and resolves paths relative to `file`.
   */
  readonly workspaceRoot?: string;
}

/** Compiler behaviour settings as they appear in `chikx.config.json` (`compiler`). */
export interface CompilerConfig {
  /** Reject unknown configuration keys and other lenient recoveries. Default `false`. */
  readonly strict?: boolean;
  /** Media grouping mode. Default `safe`. */
  readonly mediaGrouping?: MediaGroupingMode;
}

/**
 * Declarative project configuration read from `chikx.config.json`
 * (SPECIFICATION.md §10).
 *
 * Keys are camelCase in JSON; source `@setup` keys stay kebab-case. The
 * document schema is frozen in P5, so these structural fields mirror §10
 * without adding validation policy.
 */
export interface ProjectConfig {
  /** Glob patterns for project entries. */
  readonly include?: readonly string[];
  /** Glob patterns excluded from project discovery. */
  readonly exclude?: readonly string[];
  /** Project-level output settings, resolved relative to the workspace root. */
  readonly output?: OutputOptions;
  /** Project-level class naming configuration. */
  readonly classes?: NamingOptions;
  /** Project-level media alias overrides. */
  readonly media?: Readonly<Record<string, string>>;
  /** Compiler behaviour settings. */
  readonly compiler?: CompilerConfig;
}

/** Options for compiling several entries through an injected host. */
export interface CompileProjectOptions {
  /**
   * Absolute POSIX workspace root override. Defaults to the nearest ancestor
   * with `chikx.config.json`, else `package.json`, as reported by the host.
   */
  readonly projectRoot?: string;
  /** Explicit configuration file path, relative to `projectRoot`. */
  readonly configFile?: string;
  /** Project-level output settings overriding the configuration file. */
  readonly output?: OutputOptions;
  /** Project-level naming overriding the configuration file. */
  readonly naming?: NamingOptions;
  /** Project-level media aliases overriding the configuration file. */
  readonly media?: Readonly<Record<string, string>>;
  /** Strict validation override. */
  readonly strict?: boolean;
  /** Media grouping override. */
  readonly mediaGrouping?: MediaGroupingMode;
}

/**
 * Effective output settings after merging built-in defaults, project
 * configuration, file `@setup` and explicit CLI overrides.
 *
 * Every setting has a value, but directory fields are still authored strings:
 * `planOutputs` resolves them against the documented base (source file for
 * file-level settings, workspace root for project-level settings) and
 * validates the result before any write.
 */
export interface ResolvedSetup extends Required<OutputOptions> {
  /** Effective class prefix after naming precedence is applied. */
  readonly prefix: string;
}

/** Explicit CLI overrides; partial by design and never flatten multiple outputs silently. */
export type CliOutputOverrides = OutputOptions & {
  /** CLI-level class prefix override. */
  readonly prefix?: string;
};

/**
 * Filesystem and policy operations the compiler needs from its embedding
 * environment.
 *
 * Every method is asynchronous where it may hit the disk, and paths are
 * absolute POSIX paths unless stated otherwise. Implementations own caching,
 * case sensitivity and symlink policy; the compiler never imports `fs`.
 */
export interface ModuleHost {
  /** Read a UTF-8 source file. Rejects when the file is missing or unreadable. */
  readFile(path: string): Promise<string>;
  /** Test whether a path exists and is readable as a file. */
  fileExists(path: string): Promise<boolean>;
  /**
   * Return the canonical real path used as module cache key, resolving
   * symlinks and platform case rules.
   */
  canonicalize(path: string): string;
  /**
   * Resolve an import specifier `to` relative to the importing file `from`,
   * returning an absolute POSIX path. Resolution is lexical here; callers use
   * {@link ModuleHost.canonicalize} to detect symlink escapes.
   */
  resolvePath(from: string, to: string): string;
  /** Absolute POSIX path of the workspace root used for containment checks. */
  workspaceRoot(): string;
}
