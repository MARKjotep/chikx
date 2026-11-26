/**
 * Chikx navigation providers: definition, references and rename for `$tokens`,
 * `@group.<name>` declarations/use sites and `@keyframes <name>` /
 * `$keyframes.<name>` constructs. All ranges come from parser AST spans, so
 * strings, comments, selectors (including `:global(...)` classes) and import
 * paths are untouched. Group and keyframe renames return edits for every visible
 * module; the other token edits stay single-file.
 */

import * as vscode from "vscode";
import { sourceTextOf, toEditorRange, toLocation } from "../adapter.js";
import type { DocumentState } from "../analysis.js";
import { tokenNameConflict } from "../analysis.js";
import {
  type RenamePlan,
  definitionsAt,
  groupAt,
  keyframeAt,
  referencesAt,
  renameAt,
  tokenAt,
} from "../intelligence.js";
import { normalizePath } from "../paths.js";
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

/** Rename for local `$tokens` and groups; multi-file group edits span modules. */
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
    const offset = document.offsetAt(position);
    const found = tokenAt(source.text, offset, state.analysis);
    if (found !== undefined && found.symbol.namespace === undefined) {
      return {
        range: toEditorRange(found.symbol.declaration),
        placeholder: found.symbol.name,
      };
    }
    const group = groupAt(state.analysis, offset);
    if (group !== undefined) {
      return {
        range: toEditorRange(group.nameRange),
        placeholder: group.name,
      };
    }
    const keyframe = keyframeAt(source.text, offset, state.analysis);
    if (keyframe === undefined) return undefined;
    return {
      range: toEditorRange(keyframe.nameRange),
      placeholder: keyframe.name,
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
    const offset = document.offsetAt(position);
    const plan: RenamePlan = renameAt(source.text, offset, newName, {
      analysis: state.analysis,
    });
    if (!plan.ok) throw new Error(plan.reason);
    // Refuse a token name that already exists before any edit is built
    // (CSSX-U04): an applied duplicate would only surface as CHIKX2001 after
    // the original name is already lost. Group and keyframe renames enforce the
    // same rule inside `renameAt`; `tokenAt` finds nothing for their headers.
    const tokenAtCursor = tokenAt(source.text, offset, state.analysis);
    if (tokenAtCursor !== undefined && tokenAtCursor.symbol.namespace === undefined) {
      const conflict = tokenNameConflict(state.analysis, newName, tokenAtCursor.symbol);
      if (conflict !== undefined) {
        throw new Error(`A token named "$${newName}" already exists in scope.`);
      }
    }
    const edit = new vscode.WorkspaceEdit();
    const currentPath = normalizePath(state.analysis.path);
    for (const change of plan.edits) {
      const target =
        change.file === undefined || normalizePath(change.file) === currentPath
          ? document.uri
          : vscode.Uri.file(change.file);
      edit.replace(target, toEditorRange(change.range), change.newText);
    }
    return edit;
  }
}
