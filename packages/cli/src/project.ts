/**
 * Project resolution shared by every command.
 *
 * A project is the workspace root (nearest `chikx.config.json`, else nearest
 * `package.json`, ADR-0007), the configuration found there and the entry list:
 * either one explicit file or the sources matched by the config include globs.
 */

import { stat } from "node:fs/promises";
import type { CliInvocation } from "./args.js";
import { type CliConfig, findWorkspaceRoot, loadConfig } from "./config.js";
import { discoverSources } from "./glob.js";
import { absolutePath, dirnamePosix, isWithin, relativePosix } from "./paths.js";

/** Resolved project inputs for one CLI run. */
export interface ProjectContext {
  /** Absolute POSIX workspace root. */
  readonly root: string;
  /** Loaded configuration, or `null` for a config-less single-file build. */
  readonly config: CliConfig | null;
  /** Non-fatal configuration notes (ignored unknown keys outside strict mode). */
  readonly configWarnings: readonly string[];
  /** Entry sources, workspace-relative POSIX and deterministically sorted. */
  readonly entries: readonly string[];
  /** Whether the run targets one explicit file instead of the whole project. */
  readonly singleEntry: boolean;
}

/** Outcome of {@link prepareProject}. */
export type ProjectContextResult =
  | { readonly ok: true; readonly context: ProjectContext }
  | { readonly ok: false; readonly message: string };

/**
 * Resolve configuration, workspace root and entries for build/check/watch.
 *
 * A missing config is an invocation error for project runs (nothing to include)
 * but is allowed for a single-entry run, where the nearest `package.json`
 * ancestor, else the file's directory, becomes the workspace root.
 */
export async function prepareProject(
  invocation: CliInvocation,
  cwd: string,
): Promise<ProjectContextResult> {
  const fileArgument = invocation.file;
  let fileAbsolute: string | undefined;
  let startDir = cwd;

  if (fileArgument !== undefined) {
    fileAbsolute = absolutePath(cwd, fileArgument);
    if (!(await isFile(fileAbsolute))) {
      return { ok: false, message: `Source file not found: ${fileArgument}` };
    }
    startDir = dirnamePosix(fileAbsolute);
  }

  const loaded = await loadConfig({
    cwd,
    startDir,
    ...(invocation.configPath === undefined ? {} : { explicitPath: invocation.configPath }),
  });
  if (!loaded.ok) return { ok: false, message: loaded.message };

  const config = loaded.config;
  const root = config === null ? await findWorkspaceRoot(startDir) : config.root;

  if (fileAbsolute !== undefined) {
    if (!isWithin(root, fileAbsolute)) {
      return {
        ok: false,
        message: `Source file "${fileArgument ?? fileAbsolute}" is outside the workspace root "${root}". Pass --config for the containing project.`,
      };
    }
    return {
      ok: true,
      context: {
        root,
        config,
        configWarnings: loaded.warnings,
        entries: [relativePosix(root, fileAbsolute)],
        singleEntry: true,
      },
    };
  }

  if (config === null) {
    return {
      ok: false,
      message:
        'No chikx.config.json found. Create one with an "include" glob list, or pass a source file.',
    };
  }
  if (config.include.length === 0) {
    return {
      ok: false,
      message: `"include" in ${config.file} must list at least one glob.`,
    };
  }

  const entries = await discoverSources({
    root,
    include: config.include,
    exclude: config.exclude,
  });

  return {
    ok: true,
    context: {
      root,
      config,
      configWarnings: loaded.warnings,
      entries,
      singleEntry: false,
    },
  };
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
