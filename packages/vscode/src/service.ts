/**
 * Debounced document-analysis cache with stale-version discarding.
 *
 * SPECIFICATION.md §8 requires editor diagnostics to debounce and to discard
 * results for stale document versions. Both behaviours are isolated here with
 * injectable timers so tests can drive them deterministically (no fixed
 * sleeps), and the editor shell only sees the newest version's result.
 */

import type { DocumentState, SourceText } from "./analysis.js";

/** Timer hooks; tests inject a deterministic queue. */
export interface SchedulerOptions {
  readonly delayMs?: number;
  readonly setTimer?: (callback: () => void, milliseconds: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/** Analysis function contract (parse + optional compile). */
export type AnalyzeDocument = (source: SourceText) => Promise<DocumentState>;

const DEFAULT_DELAY_MS = 150;

interface PendingEntry {
  readonly handle: unknown;
  readonly version: number;
  readonly notify: (state: DocumentState) => void;
}

/**
 * Version-guarded analysis service.
 *
 * `schedule` debounces per document; `analyzeNow` serves completion, hover and
 * commands immediately while still refusing to overwrite newer results.
 */
export class AnalysisService {
  private readonly cache = new Map<string, DocumentState>();
  private readonly latestVersion = new Map<string, number>();
  private readonly pending = new Map<string, PendingEntry>();
  private readonly delayMs: number;
  private readonly setTimer: (callback: () => void, milliseconds: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(
    private readonly analyze: AnalyzeDocument,
    options: SchedulerOptions = {},
  ) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.setTimer =
      options.setTimer ?? ((callback, milliseconds) => setTimeout(callback, milliseconds));
    this.clearTimer =
      options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  /** Cached state for this exact document version, if fresh. */
  cached(source: SourceText): DocumentState | undefined {
    const state = this.cache.get(source.path);
    return state !== undefined && state.analysis.version === source.version ? state : undefined;
  }

  /** Analyze immediately (completion/hover/command path) with a version guard. */
  async analyzeNow(source: SourceText): Promise<DocumentState> {
    const cachedState = this.cached(source);
    if (cachedState !== undefined) return cachedState;

    this.latestVersion.set(
      source.path,
      Math.max(source.version, this.latestVersion.get(source.path) ?? source.version),
    );
    const state = await this.analyze(source);

    const current = this.latestVersion.get(source.path) ?? source.version;
    const existing = this.cache.get(source.path);
    if (
      state.analysis.version === current &&
      (existing === undefined || existing.analysis.version <= state.analysis.version)
    ) {
      this.cache.set(source.path, state);
      return state;
    }
    return existing ?? state;
  }

  /**
   * Debounce an analysis for `source`, notifying only when its version is still
   * the newest for that document. A newer schedule cancels the previous timer.
   */
  schedule(source: SourceText, notify: (state: DocumentState) => void): void {
    const existing = this.pending.get(source.path);
    if (existing !== undefined) this.clearTimer(existing.handle);

    this.latestVersion.set(
      source.path,
      Math.max(source.version, this.latestVersion.get(source.path) ?? source.version),
    );

    const handle = this.setTimer(() => {
      this.pending.delete(source.path);
      void this.runScheduled(source, notify);
    }, this.delayMs);
    this.pending.set(source.path, { handle, version: source.version, notify });
  }

  /** Drop a cached entry and any pending debounce for `path`. */
  forget(path: string): void {
    const pending = this.pending.get(path);
    if (pending !== undefined) this.clearTimer(pending.handle);
    this.pending.delete(path);
    this.cache.delete(path);
    this.latestVersion.delete(path);
  }

  private async runScheduled(
    source: SourceText,
    notify: (state: DocumentState) => void,
  ): Promise<void> {
    const state = await this.analyzeNow(source);
    if (state.analysis.version !== (this.latestVersion.get(source.path) ?? source.version)) return;
    notify(state);
  }
}
