/**
 * Chikx completion provider.
 *
 * The context detection and item construction live in `intelligence.ts`; this
 * adapter only converts pure suggestions to `CompletionItem`s and computes the
 * replacement range. Trigger characters per SPECIFICATION.md §8: `@`, `$`, `.`,
 * `:`, `/`.
 */

import * as vscode from "vscode";
import { listDirectorySync, sourceTextOf, toCompletionKind } from "../adapter.js";
import { completionsAt } from "../intelligence.js";
import type { AnalysisService } from "../service.js";

/** Provides context-aware completion for `.cssx` documents. */
export class ChikxCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly service: AnalysisService) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.CompletionItem[]> {
    const source = sourceTextOf(document);
    const state = await this.service.analyzeNow(source);
    if (token.isCancellationRequested) return [];

    const offset = document.offsetAt(position);
    const result = completionsAt(source.text, offset, {
      analysis: state.analysis,
      ...(state.compiled === undefined ? {} : { classMap: state.compiled.classes }),
      listDirectory: listDirectorySync,
    });
    const start = document.positionAt(result.replaceStart);
    const end = document.positionAt(result.replaceEnd);
    return result.items.map((suggestion) => {
      const item = new vscode.CompletionItem(suggestion.label, toCompletionKind(suggestion.kind));
      item.insertText = suggestion.insertText;
      item.filterText = suggestion.label;
      if (suggestion.detail !== undefined) item.detail = suggestion.detail;
      if (suggestion.documentation !== undefined) {
        item.documentation = new vscode.MarkdownString(suggestion.documentation);
      }
      item.range = new vscode.Range(start, end);
      return item;
    });
  }
}
