/**
 * Extension-host smoke suite (executed inside VS Code by @vscode/test-electron).
 *
 * Plain CommonJS so the extension host can load it without a build step. The
 * orchestrating Bun test in `tests/extension/host.test.ts` decides whether this
 * suite can run; it never fakes a pass when VS Code is unavailable.
 */

const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vscode = require("vscode");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findExtension() {
  const extension = vscode.extensions.all.find(
    (candidate) => candidate.packageJSON && candidate.packageJSON.name === "chikx",
  );
  assert.ok(extension, "Chikx extension is not registered in the development host");
  return extension;
}

async function waitForDiagnostics(uri, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let diagnostics = [];
  while (Date.now() < deadline) {
    diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length > 0) return diagnostics;
    await delay(100);
  }
  return diagnostics;
}

exports.run = async function run() {
  const extension = await findExtension();
  await extension.activate();
  assert.strictEqual(extension.isActive, true, "extension did not activate");

  const manifest = extension.packageJSON;
  assert.strictEqual(manifest.contributes.grammars[0].scopeName, "source.chikx");
  assert.strictEqual(manifest.contributes.grammars[0].language, "chikx");
  assert.ok(
    manifest.contributes.languages.some((language) => language.id === "chikx"),
    "chikx language contribution missing",
  );
  const formatSetting = manifest.contributes.configuration.properties["chikx.editor.formatOnSave"];
  assert.ok(formatSetting, "chikx.editor.formatOnSave setting is not contributed");
  assert.strictEqual(formatSetting.type, "boolean");
  assert.strictEqual(formatSetting.default, false, "formatOnSave must default to off");

  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    "chikx.compileFile",
    "chikx.buildProject",
    "chikx.previewCompiledCss",
    "chikx.openGeneratedCss",
    "chikx.openClassMap",
    "chikx.checkProject",
  ]) {
    assert.ok(commands.includes(command), `missing command ${command}`);
  }

  const fixture = vscode.Uri.file(path.join(__dirname, "fixtures", "broken.cssx"));
  const document = await vscode.workspace.openTextDocument(fixture);
  assert.strictEqual(document.languageId, "chikx");
  await vscode.window.showTextDocument(document);

  const diagnostics = await waitForDiagnostics(fixture, 20000);
  assert.ok(diagnostics.length > 0, "no diagnostics were published for the broken document");
  assert.ok(
    diagnostics.some((diagnostic) => String(diagnostic.code).startsWith("CHIKX")),
    `diagnostics did not carry a CHIKX code: ${JSON.stringify(
      diagnostics.map((diagnostic) => diagnostic.code),
    )}`,
  );
  assert.ok(
    diagnostics.some((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error),
    "expected at least one error diagnostic",
  );

  // Completion smoke check (aliases include @2xl).
  const completionFixture = vscode.Uri.file(path.join(__dirname, "fixtures", "complete.cssx"));
  const completionDocument = await vscode.workspace.openTextDocument(completionFixture);
  await vscode.window.showTextDocument(completionDocument);
  const items = await vscode.commands.executeCommand(
    "vscode.executeCompletionItemProvider",
    completionFixture,
    new vscode.Position(2, 15),
    "@",
  );
  const labels = (items ? items.items : []).map((item) =>
    typeof item.label === "string" ? item.label : item.label.label,
  );
  assert.ok(labels.includes("@2xl"), `completion list missing @2xl: ${labels.length} items`);

  // Command smoke: Compile File writes planned artifacts and Preview stays in memory.
  const created = await fs.mkdtemp(path.join(os.tmpdir(), "chikx-host-"));
  // Resolve /var → /private/var so the planner's symlink containment check
  // sees the source inside its workspace root.
  const temporary = await fs.realpath(created);
  try {
    const sample = path.join(temporary, "sample.cssx");
    await fs.writeFile(sample, '@setup { prefix: "ui"; }\n.button { color: red; }\n', "utf8");
    const sampleDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(sample));
    await vscode.window.showTextDocument(sampleDocument);
    assert.strictEqual(vscode.workspace.isTrusted, true, "test workspace is not trusted");
    await vscode.commands.executeCommand("chikx.compileFile");
    const css = await fs.readFile(path.join(temporary, "sample.css"), "utf8");
    const map = await fs.readFile(path.join(temporary, "sample.map.js"), "utf8");
    assert.ok(css.includes(".ui-button"), "compileFile did not write the prefixed CSS");
    assert.ok(map.includes("ui-button"), "compileFile did not write the class map");

    await vscode.commands.executeCommand("chikx.previewCompiledCss");
    const preview = vscode.window.activeTextEditor;
    assert.ok(preview, "preview command did not open an editor");
    assert.strictEqual(preview.document.uri.scheme, "chikx-preview");
    assert.ok(
      preview.document.getText().includes(".ui-button"),
      "preview document does not contain the compiled CSS",
    );
    assert.strictEqual(
      await fs
        .readFile(path.join(temporary, "sample.css"), "utf8")
        .then((value) => value.includes(".ui-button")),
      true,
    );

    // Formatting: Format Document reaches the registered provider.
    const formatPath = path.join(temporary, "format-manual.cssx");
    await fs.writeFile(formatPath, ".card{color:red}", "utf8");
    const formatDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(formatPath));
    await vscode.window.showTextDocument(formatDocument);
    const formatEdits = await vscode.commands.executeCommand(
      "vscode.executeFormatDocumentProvider",
      formatDocument.uri,
      { tabSize: 2, insertSpaces: true },
    );
    assert.ok(Array.isArray(formatEdits), "Format Document provider returned no edit list");
    assert.ok(formatEdits.length > 0, "Format Document provider returned no edits");
    const applyFormat = new vscode.WorkspaceEdit();
    for (const edit of formatEdits) {
      applyFormat.replace(formatDocument.uri, edit.range, edit.newText);
    }
    assert.strictEqual(await vscode.workspace.applyEdit(applyFormat), true);
    assert.strictEqual(formatDocument.getText(), ".card {\n  color: red;\n}\n");

    // Save path: default off saves untouched, then on formats; parse errors stay put.
    const savePath = path.join(temporary, "format-save.cssx");
    await fs.writeFile(savePath, ".card{color:red}", "utf8");
    const saveDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(savePath));
    const saveEditor = await vscode.window.showTextDocument(saveDocument);
    const chikxConfig = vscode.workspace.getConfiguration("chikx", saveDocument.uri);
    await chikxConfig.update("editor.formatOnSave", false, vscode.ConfigurationTarget.Global);

    await saveEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await saveDocument.save();
    assert.strictEqual(saveDocument.getText(), " .card{color:red}");
    assert.strictEqual(await fs.readFile(savePath, "utf8"), " .card{color:red}");

    await chikxConfig.update("editor.formatOnSave", true, vscode.ConfigurationTarget.Global);
    await saveEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await saveDocument.save();
    assert.strictEqual(saveDocument.getText(), ".card {\n  color: red;\n}\n");
    assert.strictEqual(await fs.readFile(savePath, "utf8"), ".card {\n  color: red;\n}\n");

    const errorPath = path.join(temporary, "format-error.cssx");
    const brokenSource = "@md {\n  .card { padding: 20px; }\n}\n";
    await fs.writeFile(errorPath, brokenSource, "utf8");
    const errorDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(errorPath));
    const errorEditor = await vscode.window.showTextDocument(errorDocument);
    await errorEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), "/* keep */\n"));
    await errorDocument.save();
    const expectedBroken = `/* keep */\n${brokenSource}`;
    assert.strictEqual(errorDocument.getText(), expectedBroken);
    assert.strictEqual(await fs.readFile(errorPath, "utf8"), expectedBroken);
  } finally {
    await vscode.workspace
      .getConfiguration("chikx")
      .update("editor.formatOnSave", false, vscode.ConfigurationTarget.Global);
    await fs.rm(temporary, { recursive: true, force: true });
  }

  console.log(
    `[chikx host] passed: activation, grammar, 6 commands, format-on-save (default off + on + parse error), ${diagnostics.length} diagnostic(s), completion ${labels.length} item(s), compile+preview commands`,
  );
};
