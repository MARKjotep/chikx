/**
 * Chikx hover provider: resolved token values, media condition expressions and
 * generated class names. Standard CSS property documentation is deferred until
 * the css-languageservice projection lands (A13 report).
 */

import * as vscode from "vscode";
import { sourceTextOf, toEditorRange } from "../adapter.js";
import { hoverAt } from "../intelligence.js";
import type { AnalysisService } from "../service.js";

/** Hover for `$tokens`, `@aliases` and selector classes. */
export class ChikxHoverProvider implements vscode.HoverProvider {
  constructor(private readonly service: AnalysisService) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    const source = sourceTextOf(document);
    const state = await this.service.analyzeNow(source);
    if (token.isCancellationRequested) return undefined;
    const hover = hoverAt(source.text, document.offsetAt(position), {
      analysis: state.analysis,
      ...(state.compiled === undefined ? {} : { classMap: state.compiled.classes }),
    });
    if (hover === undefined) return undefined;
    return new vscode.Hover(new vscode.MarkdownString(hover.markdown), toEditorRange(hover.range));
  }
}
