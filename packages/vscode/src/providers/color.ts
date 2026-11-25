/**
 * Chikx color provider: hex colors authored in declaration values become color
 * swatches, with hex/alpha-preserving presentations on edit.
 */

import * as vscode from "vscode";
import { sourceTextOf, toEditorRange } from "../adapter.js";
import { colorsOf, hexColorToRgba, rgbaToHex } from "../intelligence.js";
import type { AnalysisService } from "../service.js";

/** Color swatches for hex values in declarations. */
export class ChikxColorProvider implements vscode.DocumentColorProvider {
  constructor(private readonly service: AnalysisService) {}

  async provideDocumentColors(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<vscode.ColorInformation[]> {
    const state = await this.service.analyzeNow(sourceTextOf(document));
    if (token.isCancellationRequested) return [];
    const colors: vscode.ColorInformation[] = [];
    for (const occurrence of colorsOf(state.analysis)) {
      const rgba = hexColorToRgba(occurrence.value);
      if (rgba === undefined) continue;
      colors.push(
        new vscode.ColorInformation(
          toEditorRange(occurrence.range),
          new vscode.Color(rgba.red, rgba.green, rgba.blue, rgba.alpha),
        ),
      );
    }
    return colors;
  }

  provideColorPresentations(
    color: vscode.Color,
    context: { readonly document: vscode.TextDocument; readonly range: vscode.Range },
  ): vscode.ColorPresentation[] {
    const presentation = new vscode.ColorPresentation(
      rgbaToHex(color.red, color.green, color.blue, color.alpha),
    );
    presentation.textEdit = new vscode.TextEdit(context.range, presentation.label);
    return [presentation];
  }
}
