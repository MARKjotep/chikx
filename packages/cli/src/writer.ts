/**
 * Per-file atomic output writes.
 *
 * Each artifact is written to a temporary file in its destination directory and
 * renamed into place, so a crash or failure leaves the previous artifact intact.
 * This is per-file atomicity, never cross-file transactionality (SPECIFICATION.md
 * §9.2). Missing destination directories are created.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

let temporaryCounter = 0;

/** SHA-256 content hash in a stable, comparable form. */
export function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/** Hash of an existing file, or `null` when it does not exist or cannot be read. */
export async function hashFile(path: string): Promise<string | null> {
  try {
    const data = await readFile(path);
    return `sha256:${createHash("sha256").update(data).digest("hex")}`;
  } catch {
    return null;
  }
}

/**
 * Write `content` atomically and return its content hash.
 *
 * The temporary file lives in the destination directory so the final rename
 * stays on one filesystem. A failure removes the temporary file and rethrows,
 * leaving any previous artifact untouched.
 */
export async function atomicWrite(path: string, content: string): Promise<string> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });

  temporaryCounter += 1;
  const temporary = join(
    directory,
    `.${basename(path)}.${process.pid}.${temporaryCounter}.cssx-tmp`,
  );

  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }

  return hashContent(content);
}

/** Remove a file if it exists. */
export async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true });
}
