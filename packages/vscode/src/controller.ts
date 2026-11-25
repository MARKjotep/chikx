/**
 * Extension controller: wiring for providers, commands, status bar, output
 * channel and workspace-trust policy.
 *
 * Commands that write follow the compiler's `planOutputs` contract; Preview
 * compiles in memory only and opens a read-only `chikx-preview:` document.
 * Automatic builds are disabled outside a trusted workspace and compile-on-save
 * is off by default (SPECIFICATION.md §8).
 */

import { existsSync, readFileSync } from "node:fs";
import * as vscode from "vscode";
import type { OutputOptions, PlanOutputsResult, ResolvedSetup } from "../../compiler/src/index.js";
import { listDirectoryEntriesSync, readModuleSync, sourceTextOf } from "./adapter.js";
import type { AnalyzeOptions, DocumentState, SourceText } from "./analysis.js";
import { analyzeDocument, analyzeText } from "./analysis.js";
import { discoverProjectEntries } from "./glob.js";
import type { ArtifactContents } from "./output.js";
import {
  artifactContents,
  fileSetup,
  formatProblem,
  planEntryOutputs,
  projectConfigOf,
  writePlannedOutputs,
} from "./output.js";
import { basenamePath, dirnamePath, normalizePath, relativeTo, toPosix } from "./paths.js";
import { ProjectIndex } from "./project.js";
import { ChikxCodeActionProvider } from "./providers/code-actions.js";
import { ChikxColorProvider } from "./providers/color.js";
import { ChikxCompletionProvider } from "./providers/completion.js";
import { ChikxDiagnostics } from "./providers/diagnostics.js";
import { ChikxFormattingProvider, formattingEdits } from "./providers/formatting.js";
import { ChikxHoverProvider } from "./providers/hover.js";
import {
  ChikxDefinitionProvider,
  ChikxReferenceProvider,
  ChikxRenameProvider,
} from "./providers/navigation.js";
import { ChikxSymbolProvider } from "./providers/symbols.js";
import { AnalysisService } from "./service.js";

/** Command identifiers contributed in the manifest. */
export const COMMANDS = Object.freeze({
  compileFile: "chikx.compileFile",
  buildProject: "chikx.buildProject",
  preview: "chikx.previewCompiledCss",
  openCss: "chikx.openGeneratedCss",
  openMap: "chikx.openClassMap",
  checkProject: "chikx.checkProject",
});

const PREVIEW_SCHEME = "chikx-preview";

/** Read-only virtual document for **Preview Compiled CSS**. */
class PreviewContentProvider implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.emitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "";
  }

  set(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this.emitter.fire(uri);
  }

  dispose(): void {
    this.emitter.dispose();
    this.contents.clear();
  }
}

type CompileTarget = "compile" | "preview" | "check";

interface CompileOutcome {
  readonly path: string;
  readonly state: DocumentState;
  readonly plan?: PlanOutputsResult;
  readonly written: readonly string[];
  readonly planProblems: readonly string[];
  readonly ok: boolean;
}

/** Registers every Chikx editor integration for one extension host session. */
export class ChikxController {
  private readonly output: vscode.OutputChannel;
  private readonly status: vscode.StatusBarItem;
  private readonly index = new ProjectIndex();
  private readonly service: AnalysisService;
  private readonly diagnostics: ChikxDiagnostics;
  private readonly preview = new PreviewContentProvider();
  private readonly disposables: vscode.Disposable[] = [];
  private hasSuccessfulBuild = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel("Chikx");
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.name = "Chikx";
    this.status.command = COMMANDS.buildProject;
    this.service = new AnalysisService((source) => this.analyzeSource(source));
    this.diagnostics = new ChikxDiagnostics(this.service, (message) => this.log(message));
  }

  /** Wire providers, commands and events. */
  activate(): void {
    this.setStatus("idle", "Chikx language support is active. Click to build the project.");
    this.status.show();

    this.disposables.push(
      this.output,
      this.status,
      this.diagnostics,
      this.preview,
      vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, this.preview),
      vscode.languages.registerCompletionItemProvider(
        { language: "chikx" },
        new ChikxCompletionProvider(this.service),
        "@",
        "$",
        ".",
        ":",
        "/",
        "&",
        "(",
        "#",
      ),
      vscode.languages.registerHoverProvider(
        { language: "chikx" },
        new ChikxHoverProvider(this.service),
      ),
      vscode.languages.registerDefinitionProvider(
        { language: "chikx" },
        new ChikxDefinitionProvider(this.service),
      ),
      vscode.languages.registerReferenceProvider(
        { language: "chikx" },
        new ChikxReferenceProvider(this.service),
      ),
      vscode.languages.registerRenameProvider(
        { language: "chikx" },
        new ChikxRenameProvider(this.service),
      ),
      vscode.languages.registerColorProvider(
        { language: "chikx" },
        new ChikxColorProvider(this.service),
      ),
      vscode.languages.registerDocumentSymbolProvider(
        { language: "chikx" },
        new ChikxSymbolProvider(this.service),
      ),
      vscode.languages.registerDocumentFormattingEditProvider(
        { language: "chikx" },
        new ChikxFormattingProvider(),
      ),
      vscode.languages.registerCodeActionsProvider(
        { language: "chikx" },
        new ChikxCodeActionProvider(this.service),
        ChikxCodeActionProvider.metadata,
      ),
      vscode.commands.registerCommand(COMMANDS.compileFile, () =>
        this.withActiveDocument((doc) => this.compileFile(doc)),
      ),
      vscode.commands.registerCommand(COMMANDS.buildProject, () => this.buildProject(false)),
      vscode.commands.registerCommand(COMMANDS.preview, () =>
        this.withActiveDocument((doc) => this.previewCss(doc)),
      ),
      vscode.commands.registerCommand(COMMANDS.openCss, () =>
        this.withActiveDocument((doc) => this.openGenerated(doc, "css")),
      ),
      vscode.commands.registerCommand(COMMANDS.openMap, () =>
        this.withActiveDocument((doc) => this.openGenerated(doc, "js")),
      ),
      vscode.commands.registerCommand(COMMANDS.checkProject, () => this.buildProject(true)),
      vscode.workspace.onDidOpenTextDocument((document) => this.onDocumentOpened(document)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === "chikx" && event.document.uri.scheme === "file") {
          this.diagnostics.schedule(event.document);
        }
      }),
      vscode.workspace.onDidSaveTextDocument((document) => void this.onDocumentSaved(document)),
      vscode.workspace.onWillSaveTextDocument((event) => this.onWillSaveTextDocument(event)),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.diagnostics.clear(document.uri);
        this.service.forget(toPosix(document.uri.fsPath));
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.index.invalidate()),
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        this.log("Workspace trust granted; automatic builds are available.");
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("chikx")) {
          this.log("Chikx settings changed.");
        }
      }),
    );
    this.context.subscriptions.push(...this.disposables);

    for (const document of vscode.workspace.textDocuments) this.onDocumentOpened(document);
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }

  private onDocumentOpened(document: vscode.TextDocument): void {
    if (document.languageId !== "chikx" || document.uri.scheme !== "file") return;
    this.diagnostics.schedule(document);
  }

  /**
   * Optional Chikx format-on-save (`chikx.editor.formatOnSave`, default off).
   *
   * Returns the same whole-document edit the formatting provider offers, so
   * manual formatting, `editor.formatOnSave` and this listener agree. The edit
   * is requested only for manual and after-delay saves; focus-out saves are
   * left alone. Parse errors produce no edit, and formatting is idempotent, so
   * enabling both this setting and global `editor.formatOnSave` cannot insert a
   * missing semicolon twice (a `CHIKX1002` declaration is not rewritten at all).
   */
  private onWillSaveTextDocument(event: vscode.TextDocumentWillSaveEvent): void {
    const document = event.document;
    if (document.languageId !== "chikx" || document.uri.scheme !== "file") return;
    const enabled = vscode.workspace
      .getConfiguration("chikx", document.uri)
      .get<boolean>("editor.formatOnSave", false);
    if (!enabled) return;
    if (event.reason === vscode.TextDocumentSaveReason.FocusOut) return;
    event.waitUntil(Promise.resolve(formattingEdits(document)));
  }

  private async onDocumentSaved(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== "chikx" || document.uri.scheme !== "file") return;
    await this.diagnostics.refresh(document);
    if (basenamePath(toPosix(document.uri.fsPath)) === "chikx.config.json") {
      this.index.invalidate();
      for (const open of vscode.workspace.textDocuments) {
        if (open.languageId === "chikx") this.diagnostics.schedule(open);
      }
      return;
    }
    const configuration = vscode.workspace.getConfiguration("chikx", document.uri);
    const compileOnSave = configuration.get<boolean>("compileOnSave", false);
    if (!compileOnSave) return;
    if (!vscode.workspace.isTrusted) {
      this.log("Restricted Mode: skipping compile-on-save.");
      return;
    }
    const outcome = await this.compilePath(document.uri.fsPath, "compile");
    this.reportOutcome(outcome, true);
  }

  private async withActiveDocument(
    action: (document: vscode.TextDocument) => Promise<void>,
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const document = editor?.document;
    if (document === undefined || document.languageId !== "chikx") {
      void vscode.window.showInformationMessage("Open a Chikx (.cssx) document first.");
      return;
    }
    try {
      await action(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Command failed: ${message}`);
      void vscode.window.showErrorMessage(`Chikx: ${message}`);
      this.setStatus("error", message);
    }
  }

  private analyzeOptionsFor(uri: vscode.Uri): AnalyzeOptions {
    const config = this.index.configFor(uri);
    return {
      ...(config?.media === undefined ? {} : { media: config.media }),
      ...(config?.classes?.prefix === undefined ? {} : { prefix: config.classes.prefix }),
      ...(config?.classes?.strategy === undefined
        ? {}
        : { namingStrategy: config.classes.strategy }),
      workspaceRoot: this.index.rootFor(uri),
      readModule: readModuleSync,
      compile: true,
    };
  }

  private async analyzeSource(source: SourceText): Promise<DocumentState> {
    const options = this.analyzeOptionsFor(vscode.Uri.file(source.path));
    const state = await analyzeDocument(source, options);
    this.flushConfigWarnings();
    return state;
  }

  private sourceFor(path: string): SourceText {
    const normalized = normalizePath(path);
    const open = vscode.workspace.textDocuments.find(
      (document) => normalizePath(toPosix(document.uri.fsPath)) === normalized,
    );
    if (open !== undefined && open.languageId === "chikx") return sourceTextOf(open);
    return { text: readFileSync(normalized, "utf8"), path: normalized, version: 0 };
  }

  /**
   * Compile one document in memory, plan its outputs, and optionally write them.
   * The exact planned destinations are handed back to the compiler as API-level
   * output overrides so the generated CSS import specifier matches the files
   * actually written.
   */
  private async compilePath(path: string, target: CompileTarget): Promise<CompileOutcome> {
    const normalized = normalizePath(path);
    const uri = vscode.Uri.file(normalized);
    const source = this.sourceFor(normalized);
    const options = this.analyzeOptionsFor(uri);
    const workspaceRoot = options.workspaceRoot ?? dirnamePath(normalized);
    const parsed = analyzeText(source, options);
    const setup = fileSetup(parsed.file, parsed.settings, parsed.prefix);
    const config = this.index.configFor(uri);
    const projectConfig = config === undefined ? undefined : projectConfigOf(config);
    const plan = planEntryOutputs({
      sourceFile: parsed.file,
      workspaceRoot,
      setup,
      ...(projectConfig === undefined ? {} : { projectConfig }),
    });
    const planHasErrors = plan.diagnostics.some((diagnostic) => diagnostic.severity === "error");
    const apiOutput: OutputOptions = planHasErrors
      ? {}
      : this.apiOutputFromPlan(plan, workspaceRoot, setup);
    const output: OutputOptions =
      target === "preview" ? { ...apiOutput, emitCss: true } : apiOutput;
    const state = await analyzeDocument(source, { ...options, output });

    const planProblems = plan.diagnostics.map(
      (diagnostic) =>
        `${parsed.file}:${diagnostic.span.start} ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`,
    );
    const problems = state.analysis.problems;
    const ok =
      !planHasErrors &&
      !problems.some((problem) => problem.severity === "error" && problem.file === parsed.file);
    const written: string[] = [];

    if (target === "compile" && ok && state.compiled !== undefined) {
      if (!vscode.workspace.isTrusted) {
        throw new Error(
          "Restricted Mode: writing generated files is disabled. Trust this workspace to compile.",
        );
      }
      const contents: ArtifactContents = artifactContents(state.compiled);
      written.push(...(await writePlannedOutputs(plan, contents)));
    }

    return { path: parsed.file, state, plan, written, planProblems, ok };
  }

  private apiOutputFromPlan(
    plan: PlanOutputsResult,
    workspaceRoot: string,
    setup: ResolvedSetup,
  ): OutputOptions {
    const output: { -readonly [Key in keyof OutputOptions]: OutputOptions[Key] } = {
      emitCss: setup.emitCss,
      emitMap: setup.emitMap,
      emitTypes: setup.emitTypes,
      sourceMap: setup.sourceMap,
      importCss: setup.importCss,
      minify: setup.minify,
    };
    for (const artifact of plan.plan.outputs) {
      if (artifact.kind === "css") {
        output.cssDir = relativeTo(workspaceRoot, dirnamePath(artifact.absolutePath));
        output.cssName = basenamePath(artifact.absolutePath);
      }
      if (artifact.kind === "js") {
        output.mapDir = relativeTo(workspaceRoot, dirnamePath(artifact.absolutePath));
        output.mapName = basenamePath(artifact.absolutePath);
      }
    }
    return output;
  }

  private async compileFile(document: vscode.TextDocument): Promise<void> {
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage(
        "Chikx: this workspace is in Restricted Mode, so writing generated files is disabled. Trust the workspace to compile.",
      );
      return;
    }
    const outcome = await this.compilePath(document.uri.fsPath, "compile");
    this.publishOutcome(outcome);
    this.reportOutcome(outcome, false);
  }

  private async previewCss(document: vscode.TextDocument): Promise<void> {
    const outcome = await this.compilePath(document.uri.fsPath, "preview");
    this.publishOutcome(outcome);
    const css = outcome.state.compiled?.css;
    if (css === undefined) {
      void vscode.window.showWarningMessage(
        "Chikx: no CSS was produced for this document; check the diagnostics.",
      );
      return;
    }
    const name = `${basenamePath(toPosix(document.uri.fsPath))}`;
    const uri = vscode.Uri.parse(`${PREVIEW_SCHEME}:${encodeURIComponent(name)}`);
    this.preview.set(uri, css);
    const previewDocument = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(previewDocument, "css");
    const split = vscode.workspace
      .getConfiguration("chikx", document.uri)
      .get<boolean>("previewSplitEditor", true);
    await vscode.window.showTextDocument(previewDocument, {
      preview: true,
      preserveFocus: false,
      ...(split ? { viewColumn: vscode.ViewColumn.Beside } : {}),
    });
    this.log(`Previewed compiled CSS for ${document.uri.fsPath} (in memory, nothing written).`);
    this.reportProblems(outcome);
  }

  private async openGenerated(document: vscode.TextDocument, kind: "css" | "js"): Promise<void> {
    const outcome = await this.compilePath(document.uri.fsPath, "check");
    const artifact = outcome.plan?.plan.outputs.find((output) => output.kind === kind);
    if (artifact === undefined) {
      void vscode.window.showInformationMessage(
        `Chikx: this document has no planned ${kind === "css" ? "CSS" : "class map"} output (@setup disables it).`,
      );
      return;
    }
    if (!existsSync(artifact.absolutePath)) {
      void vscode.window.showInformationMessage(
        `Chikx: ${artifact.workspacePath} has not been generated yet. Run "Chikx: Compile File" first.`,
      );
      return;
    }
    const generated = await vscode.workspace.openTextDocument(
      vscode.Uri.file(artifact.absolutePath),
    );
    await vscode.window.showTextDocument(generated, { preview: true });
  }

  private async buildProject(checkOnly: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (editor === undefined && folder === undefined) {
      void vscode.window.showInformationMessage(
        "Chikx: open a workspace folder to build a project.",
      );
      return;
    }
    if (!checkOnly && !vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage(
        "Chikx: this workspace is in Restricted Mode, so builds that write files are disabled. Trust the workspace to build.",
      );
      return;
    }
    try {
      const config =
        editor !== undefined
          ? this.index.configFor(editor.document.uri)
          : this.index.configAtRoot(folder?.uri.fsPath ?? "");
      const root =
        config?.root ??
        (editor !== undefined
          ? this.index.rootFor(editor.document.uri)
          : toPosix(folder?.uri.fsPath ?? ""));
      const entries = discoverProjectEntries(
        root,
        config?.include ?? [],
        config?.exclude ?? [],
        listDirectoryEntriesSync,
      );
      this.flushConfigWarnings();
      if (entries.length === 0) {
        this.log(`No .cssx entries discovered under ${root}.`);
        void vscode.window.showInformationMessage("Chikx: no .cssx files found in this project.");
        return;
      }
      this.log(
        `${checkOnly ? "Checking" : "Building"} ${entries.length} entr${entries.length === 1 ? "y" : "ies"} under ${root}.`,
      );
      let failures = 0;
      for (const entry of entries) {
        const outcome = await this.compilePath(entry, checkOnly ? "check" : "compile");
        this.publishOutcome(outcome);
        this.reportOutcome(outcome, true);
        if (!outcome.ok) failures += 1;
      }
      const summary = `${entries.length - failures}/${entries.length} ${
        entries.length - failures === 1 ? "entry" : "entries"
      } clean`;
      this.log(`${checkOnly ? "Check" : "Build"} complete: ${summary}.`);
      if (failures === 0) {
        this.hasSuccessfulBuild = true;
        this.setStatus("success", `${checkOnly ? "Check" : "Build"} succeeded: ${summary}.`);
        void vscode.window.setStatusBarMessage(`Chikx: ${summary}`, 4000);
      } else {
        this.setStatus(
          this.hasSuccessfulBuild ? "stale" : "error",
          `${failures} entr${failures === 1 ? "y" : "ies"} failed.`,
        );
        void vscode.window.showErrorMessage(
          `Chikx: ${failures} entr${failures === 1 ? "y" : "ies"} failed. See the Chikx output channel.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log(`Project ${checkOnly ? "check" : "build"} failed: ${message}`);
      this.setStatus("error", message);
      void vscode.window.showErrorMessage(`Chikx: ${message}`);
    }
  }

  private publishOutcome(outcome: CompileOutcome): void {
    this.diagnostics.publish(vscode.Uri.file(outcome.path), outcome.state);
  }

  private reportOutcome(outcome: CompileOutcome, quiet: boolean): void {
    this.reportProblems(outcome);
    for (const path of outcome.written) this.log(`wrote ${path}`);
    if (outcome.written.length > 0) {
      this.hasSuccessfulBuild = true;
      this.setStatus(
        "success",
        `Compiled ${outcome.path} → ${outcome.written.length} artifact(s).`,
      );
      if (!quiet) {
        void vscode.window.setStatusBarMessage(
          `Chikx: wrote ${outcome.written.length} artifact(s) for ${basenamePath(outcome.path)}`,
          4000,
        );
      }
      return;
    }
    if (!outcome.ok) {
      this.setStatus(
        this.hasSuccessfulBuild ? "stale" : "error",
        `Compilation failed for ${outcome.path}; previous outputs (if any) are unchanged.`,
      );
      if (!quiet) {
        void vscode.window.showErrorMessage(
          `Chikx: ${outcome.path} has errors. See the Problems panel and the Chikx output channel.`,
        );
      }
    }
  }

  private reportProblems(outcome: CompileOutcome): void {
    for (const problem of outcome.state.analysis.problems) {
      this.log(formatProblem(problem.file, problem));
    }
    for (const problem of outcome.planProblems) this.log(problem);
    if (outcome.state.compiled?.error !== undefined) {
      this.log(`${outcome.path}: compile failed: ${outcome.state.compiled.error}`);
    }
  }

  private flushConfigWarnings(): void {
    for (const warning of this.index.takeWarnings()) this.log(warning);
  }

  private setStatus(kind: "idle" | "success" | "error" | "stale", tooltip: string): void {
    switch (kind) {
      case "success":
        this.status.text = "$(check) Chikx";
        break;
      case "error":
        this.status.text = "$(error) Chikx";
        break;
      case "stale":
        this.status.text = "$(warning) Chikx (stale)";
        break;
      default:
        this.status.text = "$(symbol-color) Chikx";
        break;
    }
    this.status.tooltip = tooltip;
  }

  private log(message: string): void {
    this.output.appendLine(`[${new Date().toISOString()}] ${message}`);
  }
}
