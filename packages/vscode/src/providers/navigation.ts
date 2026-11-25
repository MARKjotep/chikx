/**
 * Chikx navigation providers: definition, references and single-file rename for
 * `$tokens`. All ranges come from parser AST spans, so strings, comments,
 * selectors (including `:global(...)` classes) and import paths are untouched.
 */

import * as vscode from "vscode";
import { sourceTextOf, toEditorRange, toLocation } from "../adapter.js";
import type { DocumentState } from "../analysis.js";
import {
  type RenamePlan,
  definitionsAt,
  referencesAt,
  renameAt,
  tokenAt,
} from "../intelligence.js";
import type { AnalysisService } from "../service.js";

async function stateOf(
  service: AnalysisService,
  document: vscode.TextDocument,
): Promise<DocumentState> {
  return service.analyzeNow(sourceTextOf(document));
}

/** Go-to-definition for `$tokens`, including imported module members. */
export class ChikxDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly service: AnalysisService) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location[]> {
    const source = sourceTextOf(document);
    const state = await stateOf(this.service, document);
    if (token.isCancellationRequested) return [];
    const targets = definitionsAt(source.text, document.offsetAt(position), {
      analysis: state.analysis,
    });
    return targets.map((target) => toLocation(target, document, state.analysis.file));
  }
}

/** Find-all-references for `$tokens` in the current document. */
export class ChikxReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly service: AnalysisService) {}

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location[]> {
    const source = sourceTextOf(document);
    const state = await stateOf(this.service, document);
    if (token.isCancellationRequested) return [];
    const targets = referencesAt(source.text, document.offsetAt(position), {
      analysis: state.analysis,
    });
    const selected = context.includeDeclaration ? targets : targets.slice(1);
    return selected.map((target) => toLocation(target, document, state.analysis.file));
  }
}

/** Rename for local `$tokens` (namespace members direct the user to the module). */
export class ChikxRenameProvider implements vscode.RenameProvider {
  constructor(private readonly service: AnalysisService) {}

  async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<{ range: vscode.Range; placeholder: string } | undefined> {
    const source = sourceTextOf(document);
    const state = await stateOf(this.service, document);
    if (token.isCancellationRequested) return undefined;
    const found = tokenAt(source.text, document.offsetAt(position), state.analysis);
    if (found === undefined || found.symbol.namespace !== undefined) return undefined;
    return {
      range: toEditorRange(found.symbol.declaration),
      placeholder: found.symbol.name,
    };
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    token: vscode.CancellationToken,
  ): Promise<vscode.WorkspaceEdit> {
    const source = sourceTextOf(document);
    const state = await stateOf(this.service, document);
    if (token.isCancellationRequested) return new vscode.WorkspaceEdit();
    const plan: RenamePlan = renameAt(source.text, document.offsetAt(position), newName, {
      analysis: state.analysis,
    });
    if (!plan.ok) throw new Error(plan.reason);
    const edit = new vscode.WorkspaceEdit();
    for (const change of plan.edits) {
      edit.replace(document.uri, toEditorRange(change.range), change.newText);
    }
    return edit;
  }
}
