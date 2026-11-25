/**
 * `chikx clean` — remove compiler-owned outputs.
 *
 * Only files recorded in `.cssx-manifest.json` whose current SHA-256 hash still
 * matches the manifest are deleted. Files modified since generation are kept and
 * reported; missing files are dropped from the manifest. `--dry-run` reports the
 * same decision without touching the disk.
 */

import type { CliInvocation } from "../args.js";
import { findWorkspaceRoot, loadConfig } from "../config.js";
import { type ManifestRecord, readManifest, writeManifest } from "../manifest.js";
import { isWithin, joinPosix } from "../paths.js";
import { invocationFailure, toJson, writeErrorLine, writeLine } from "../report.js";
import { hashFile, removeFile } from "../writer.js";

/** One file handled by `clean`. */
interface CleanItem {
  /** Workspace-relative POSIX path of the generated file. */
  readonly path: string;
  /** `deleted`, `would-delete`, `missing` or `modified`. */
  readonly reason: string;
}

/** Machine-readable clean report. */
interface CleanReport {
  readonly command: "clean";
  readonly success: boolean;
  readonly exitCode: number;
  readonly dryRun: boolean;
  readonly workspaceRoot: string;
  readonly configFile: string | null;
  readonly removed: readonly CleanItem[];
  readonly skipped: readonly CleanItem[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/** Run `chikx clean`. */
export async function runClean(invocation: CliInvocation, cwd: string): Promise<number> {
  const loaded = await loadConfig({
    cwd,
    startDir: cwd,
    ...(invocation.configPath === undefined ? {} : { explicitPath: invocation.configPath }),
  });
  if (!loaded.ok) return invocationFailure(invocation.command, loaded.message, invocation.json);

  const config = loaded.config;
  const root = config === null ? await findWorkspaceRoot(cwd) : config.root;
  const warnings = [...loaded.warnings];
  const errors: string[] = [];
  const removed: CleanItem[] = [];
  const skipped: CleanItem[] = [];

  const manifestResult = await readManifest(root);
  warnings.push(...manifestResult.warnings);

  const remaining: ManifestRecord[] = [];
  for (const record of manifestResult.manifest.files) {
    const absolute = joinPosix(root, record.path);
    if (!isWithin(root, absolute) || record.path.startsWith("/")) {
      warnings.push(`Ignoring manifest path outside the workspace: ${record.path}`);
      continue;
    }

    const currentHash = await hashFile(absolute);
    if (currentHash === null) {
      skipped.push({ path: record.path, reason: "missing" });
      continue;
    }
    if (currentHash !== record.hash) {
      skipped.push({ path: record.path, reason: "modified" });
      warnings.push(`Kept ${record.path}: modified since generation; ownership released.`);
      continue;
    }
    if (invocation.dryRun) {
      removed.push({ path: record.path, reason: "would-delete" });
      continue;
    }
    try {
      await removeFile(absolute);
      removed.push({ path: record.path, reason: "deleted" });
    } catch (error) {
      errors.push(`Could not delete ${record.path}: ${describeError(error)}`);
      remaining.push(record);
    }
  }

  if (!invocation.dryRun) {
    // Records whose deletion failed stay owned so a retry can finish the job.
    try {
      await writeManifest(root, { version: 1, files: remaining });
    } catch (error) {
      errors.push(`Could not update .cssx-manifest.json: ${describeError(error)}`);
    }
  }

  const failed = errors.length > 0;
  const report: CleanReport = {
    command: "clean",
    success: !failed,
    exitCode: failed ? 1 : 0,
    dryRun: invocation.dryRun,
    workspaceRoot: root,
    configFile: config?.file ?? null,
    removed,
    skipped,
    warnings,
    errors,
  };

  if (invocation.json) {
    writeLine(toJson(report).trimEnd());
  } else {
    for (const item of removed) {
      writeLine(invocation.dryRun ? `would remove ${item.path}` : `removed ${item.path}`);
    }
    for (const item of skipped) writeLine(`skipped ${item.path} (${item.reason})`);
    for (const warning of warnings) writeErrorLine(`chikx: warning: ${warning}`);
    for (const error of errors) writeErrorLine(`chikx: error: ${error}`);
    const verb = invocation.dryRun ? "removable" : "removed";
    writeLine(
      `chikx clean: ${removed.length} file${removed.length === 1 ? "" : "s"} ${verb}, ` +
        `${skipped.length} skipped`,
    );
  }

  return failed ? 1 : 0;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
