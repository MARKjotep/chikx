/**
 * U4 settings matrix — every contributed `chikx.*` setting, toggled through
 * `workspace.getConfiguration().update` and asserted on the behaviour it claims
 * to control, then restored.
 *
 * The setting list is read from the manifest at run time, so a new setting
 * cannot be added without this module failing the "every setting has a flip"
 * contract. Each flip is asserted in both directions (default → changed →
 * restored) so "the setting did nothing" and "the setting cannot be turned
 * back off" are both red.
 *
 * Writes go to `ConfigurationTarget.Global` because the guest window's workspace
 * folder is the committed `test/fixtures` tree: a workspace-target write would
 * create `test/fixtures/.vscode/settings.json`, which this campaign must not do.
 * Every change is restored in a `finally`.
 */

const vscode = require("vscode");
const host = require("./host.js");

/** Expected manifest defaults; a change here is a deliberate product decision. */
const DEFAULTS = Object.freeze({
  "chikx.compileOnSave": false,
  "chikx.editor.formatOnSave": false,
  "chikx.editor.completePropertyWithSemicolon": true,
  "chikx.previewSplitEditor": true,
});

const ENTRY = '@setup { prefix: "cfg"; }\n.button { color: red; }\n';

async function findExtension() {
  return vscode.extensions.all.find((candidate) => candidate.packageJSON?.name === "chikx");
}

/** `true` when `relative` exists within `timeoutMs`; `false` at the deadline. */
async function appears(workspace, relative, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await workspace.exists(relative)) return true;
    if (Date.now() >= deadline) return false;
    await host.delay(50);
  }
}

/**
 * Prove a file stayed absent for a bounded window: the compile-on-save listener
 * is fire-and-forget, so absence has to be observed over a window longer than
 * the analysis debounce (150 ms) before it means anything.
 */
async function staysAbsent(workspace, relative, windowMs = 1500) {
  return !(await appears(workspace, relative, windowMs));
}

/** Read the effective boolean, through the same configuration object the code uses. */
function setting(key, uri) {
  return vscode.workspace
    .getConfiguration("chikx", uri)
    .get(key.slice("chikx.".length), DEFAULTS[key]);
}

async function update(key, value) {
  await vscode.workspace
    .getConfiguration("chikx")
    .update(key.slice("chikx.".length), value, vscode.ConfigurationTarget.Global);
}

async function restoreAll() {
  for (const [key, value] of Object.entries(DEFAULTS)) await update(key, value);
}

async function completePropertyItems(document, position) {
  return host.completionItems(document, position);
}

async function run(t) {
  const extension = await findExtension();
  t.ok(extension, "Chikx extension is not registered in the development host");
  await extension.activate();
  const manifest = extension.packageJSON;

  // ---- Media variant markers carry a contributed magenta default. ----
  // The grammar scopes variants as `keyword.control.media.chikx`; the manifest
  // contributes `#D6409F` through configurationDefaults. The host must surface
  // that default for `editor.tokenColorCustomizations`, otherwise the markers
  // fall back to the theme's keyword colour. A user override still wins.
  const tokenColors = vscode.workspace.getConfiguration("editor").get("tokenColorCustomizations");
  t.ok(
    tokenColors !== undefined && tokenColors !== null && typeof tokenColors === "object",
    `editor.tokenColorCustomizations did not surface the contributed default (got ${JSON.stringify(tokenColors)})`,
  );
  const textMateRules = Array.isArray(tokenColors?.textMateRules) ? tokenColors.textMateRules : [];
  const mediaRule = textMateRules.find(
    (rule) => Array.isArray(rule.scope) && rule.scope.includes("keyword.control.media.chikx"),
  );
  t.ok(
    mediaRule !== undefined,
    `no textMateRule for keyword.control.media.chikx (rules: ${JSON.stringify(textMateRules)})`,
  );
  t.equal(
    mediaRule?.settings?.foreground?.toUpperCase(),
    "#D6409F",
    "the media variant marker default is not magenta",
  );

  // ---- The setting inventory is the manifest's, not this file's. ----
  const section = manifest.contributes.configuration;
  t.ok(section, "the manifest contributes no configuration section");
  t.equal(section.title, "Chikx", "the settings page title");
  const properties = section.properties ?? {};
  const keys = Object.keys(properties).sort();
  t.deepEqual(
    keys,
    Object.keys(DEFAULTS).sort(),
    `the settings matrix enumerates the manifest exactly (manifest: ${keys.join(", ")})`,
  );
  for (const [key, value] of Object.entries(DEFAULTS)) {
    t.equal(properties[key].type, "boolean", `${key} is not contributed as a boolean`);
    t.equal(properties[key].default, value, `${key} default`);
    t.ok(
      typeof properties[key].description === "string" && properties[key].description.length > 0,
      `${key} has no settings-page description`,
    );
  }

  const workspace = await host.createWorkspace("chikx-ui-config-");
  try {
    await restoreAll();
    for (const [key, value] of Object.entries(DEFAULTS)) {
      t.equal(setting(key), value, `${key} does not start at its documented default`);
    }

    // ---- chikx.editor.completePropertyWithSemicolon: snippet ↔ plain text. ----
    const on = await workspace.open("property-on.cssx", ".a {\n  colo\n}\n");
    const onPosition = host.positionOf(on.document, "colo", "colo".length);
    const onColor = host.byLabel(await completePropertyItems(on.document, onPosition)).get("color");
    t.ok(onColor, "the property item is missing with the default (on) setting");
    t.ok(onColor.insertText instanceof vscode.SnippetString, "the default item must be a snippet");
    t.equal(onColor.insertText.value, "color: $0;", "the default snippet body");

    await update("chikx.editor.completePropertyWithSemicolon", false);
    t.equal(setting("chikx.editor.completePropertyWithSemicolon", on.document.uri), false);
    const off = await workspace.open("property-off.cssx", ".a {\n  colo\n}\n");
    const offPosition = host.positionOf(off.document, "colo", "colo".length);
    const offColor = host
      .byLabel(await completePropertyItems(off.document, offPosition))
      .get("color");
    t.ok(offColor, "the property item disappears when the setting is off");
    t.equal(
      offColor.insertText instanceof vscode.SnippetString,
      false,
      "the setting off must insert plain text",
    );
    t.equal(host.insertTextOf(offColor), "color: ", "the setting off inserts only `color: `");

    await update("chikx.editor.completePropertyWithSemicolon", true);
    const restored = await workspace.open("property-restored.cssx", ".a {\n  colo\n}\n");
    const restoredPosition = host.positionOf(restored.document, "colo", "colo".length);
    const restoredColor = host
      .byLabel(await completePropertyItems(restored.document, restoredPosition))
      .get("color");
    t.equal(
      restoredColor.insertText.value,
      "color: $0;",
      "the snippet does not come back when the setting is restored",
    );

    // ---- chikx.editor.formatOnSave: untouched ↔ formatted, both directions. ----
    const formatPath = "format-save.cssx";
    const formatDocument = (await workspace.open(formatPath, ".card{color:red}")).document;
    const formatEditor = await vscode.window.showTextDocument(formatDocument);
    await update("chikx.editor.formatOnSave", false);
    await formatEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await formatDocument.save();
    t.equal(formatDocument.getText(), " .card{color:red}", "formatOnSave off still formatted");

    await update("chikx.editor.formatOnSave", true);
    t.equal(setting("chikx.editor.formatOnSave", formatDocument.uri), true);
    await formatEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await formatDocument.save();
    t.equal(
      formatDocument.getText(),
      ".card {\n  color: red;\n}\n",
      "formatOnSave on did not format the saved document",
    );

    await update("chikx.editor.formatOnSave", false);
    const unformattedPath = "format-save-off.cssx";
    const unformatted = (await workspace.open(unformattedPath, ".card{color:red}")).document;
    const unformattedEditor = await vscode.window.showTextDocument(unformatted);
    await unformattedEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await unformatted.save();
    t.equal(
      unformatted.getText(),
      " .card{color:red}",
      "formatOnSave off on restore formatted the saved document",
    );

    // ---- chikx.compileOnSave: off writes nothing, on writes the artifacts. ----
    const compilePath = "save-entry.cssx";
    const compileDocument = (await workspace.open(compilePath, ENTRY)).document;
    const compileEditor = await vscode.window.showTextDocument(compileDocument);
    await update("chikx.compileOnSave", false);
    t.equal(setting("chikx.compileOnSave", compileDocument.uri), false);
    await compileEditor.edit((builder) => builder.insert(new vscode.Position(0, 0), " "));
    await compileDocument.save();
    t.ok(
      await staysAbsent(workspace, "save-entry.css"),
      "compileOnSave off still wrote an artifact",
    );

    await update("chikx.compileOnSave", true);
    t.equal(setting("chikx.compileOnSave", compileDocument.uri), true);
    await compileEditor.edit((builder) => builder.insert(new vscode.Position(1, 0), " "));
    await compileDocument.save();
    t.ok(await appears(workspace, "save-entry.css"), "compileOnSave on wrote no CSS");
    t.match(
      await workspace.read("save-entry.css"),
      /\.cfg-button\{/,
      "compile-on-save output lacks the compiled rule",
    );
    t.ok(await appears(workspace, "save-entry.map.js"), "compileOnSave on wrote no class map");

    await update("chikx.compileOnSave", false);
    await workspace.write("save-entry.css", "stale");
    await compileEditor.edit((builder) => builder.insert(new vscode.Position(1, 0), " "));
    await compileDocument.save();
    // The save listener is fire-and-forget: wait past the debounce before
    // claiming the artifact was not rewritten.
    await host.delay(1500);
    t.equal(
      await workspace.read("save-entry.css"),
      "stale",
      "compileOnSave off after a build still rewrote the artifact",
    );

    // ---- chikx.previewSplitEditor: beside (2 editors) ↔ replacing (1). ----
    const source = await workspace.open("preview-source.cssx", ENTRY);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.window.showTextDocument(source.document);
    await update("chikx.previewSplitEditor", true);
    await vscode.commands.executeCommand("chikx.previewCompiledCss");
    const beside = vscode.window.visibleTextEditors;
    t.equal(beside.length, 2, "previewSplitEditor on must keep the source editor visible");
    t.equal(
      beside.filter((editor) => editor.document.uri.scheme === "chikx-preview").length,
      1,
      "previewSplitEditor on must open exactly one preview",
    );
    t.equal(
      vscode.window.activeTextEditor?.document.uri.scheme,
      "chikx-preview",
      "the preview must take focus",
    );

    await update("chikx.previewSplitEditor", false);
    t.equal(setting("chikx.previewSplitEditor", source.document.uri), false);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.window.showTextDocument(source.document);
    await vscode.commands.executeCommand("chikx.previewCompiledCss");
    const replaced = vscode.window.visibleTextEditors;
    t.equal(replaced.length, 1, "previewSplitEditor off must replace the source editor");
    t.equal(
      replaced[0]?.document.uri.scheme,
      "chikx-preview",
      "previewSplitEditor off must leave the preview visible",
    );

    await update("chikx.previewSplitEditor", true);
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.window.showTextDocument(source.document);
    await vscode.commands.executeCommand("chikx.previewCompiledCss");
    t.equal(
      vscode.window.visibleTextEditors.length,
      2,
      "previewSplitEditor restored does not split again",
    );

    // ---- Effective settings return to their defaults. ----
    await restoreAll();
    for (const [key, value] of Object.entries(DEFAULTS)) {
      t.equal(setting(key), value, `${key} was not restored to its default`);
      t.equal(
        vscode.workspace.getConfiguration("chikx").inspect(key.slice("chikx.".length)).globalValue,
        value,
        `${key} global override was not restored`,
      );
    }

    return "4 settings toggled on/off/restored + manifest inventory";
  } finally {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await restoreAll();
    await workspace.dispose();
  }
}

module.exports = { run };
