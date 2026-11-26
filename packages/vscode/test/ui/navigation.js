/**
 * Navigation scenarios — definition, references and rename for `$tokens`,
 * namespace members and cross-module groups, all through the public commands.
 *
 * The fixture set is copied into a temp workspace first so the rename cases can
 * apply real `WorkspaceEdit`s without ever dirtying a committed fixture.
 */

const vscode = require("vscode");
const host = require("./host.js");

function lastPositionOf(document, needle, delta) {
  const index = document.getText().lastIndexOf(needle);
  if (index < 0) throw new Error(`document does not contain ${JSON.stringify(needle)}`);
  return document.positionAt(index + delta);
}

function editEntries(edit) {
  return edit.entries().map(([uri, edits]) => ({ uri, edits }));
}

async function run(t) {
  const workspace = await host.createWorkspace("chikx-ui-navigation-");
  try {
    await workspace.write(
      "navigation-theme.cssx",
      await host.readFixture("ui/navigation-theme.cssx"),
    );
    await workspace.write(
      "navigation-groups.cssx",
      await host.readFixture("ui/navigation-groups.cssx"),
    );
    const entryText = await host.readFixture("ui/navigation-entry.cssx");
    const { document } = await workspace.open("navigation-entry.cssx", entryText);

    // Definition: a local token resolves to its declaration.
    const accentUse = host.positionOf(document, "$accent;", 2);
    const definitions = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      document.uri,
      accentUse,
    );
    t.equal(definitions.length, 1, `expected one definition, got ${definitions.length}`);
    t.ok(definitions[0].uri.fsPath.endsWith("navigation-entry.cssx"), "definition is in this file");
    t.deepEqual(
      {
        line: definitions[0].range.start.line,
        start: definitions[0].range.start.character,
        end: definitions[0].range.end.character,
      },
      { line: 6, start: 2, end: 8 },
      "definition points at the `accent` declaration",
    );

    // Definition: an imported member resolves into the other module.
    const member = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      document.uri,
      host.positionOf(document, "$theme.primary", 8),
    );
    t.equal(member.length, 1, "imported member definition missing");
    t.ok(member[0].uri.fsPath.endsWith("navigation-theme.cssx"), "member resolves across modules");

    // References: declaration + two uses, and the declaration-less variant.
    const references = await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      document.uri,
      accentUse,
      { includeDeclaration: true },
    );
    t.equal(references.length, 3, `expected 3 references, got ${references.length}`);
    t.deepEqual(
      references.map((reference) => reference.range.start.line).sort((a, b) => a - b),
      [6, 10, 18],
      "references cover the declaration and both uses",
    );
    // API limit, recorded: `vscode.executeReferenceProvider` takes only
    // (uri, position) — the declaration is always included — so the
    // declaration-less variant is not drivable from the host.
    const withContext = await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      document.uri,
      accentUse,
      { includeDeclaration: false },
    );
    t.equal(
      withContext.length,
      3,
      "the reference command ignores a ReferenceContext and keeps the declaration",
    );

    // prepareRename probes the same range the editor shows as the rename target.
    const prepared = await vscode.commands.executeCommand(
      "vscode.prepareRename",
      document.uri,
      accentUse,
    );
    t.deepEqual(
      {
        placeholder: prepared.placeholder,
        line: prepared.range.start.line,
        start: prepared.range.start.character,
        end: prepared.range.end.character,
      },
      // PINNED BEHAVIOUR (CSSX-U1): the public command reports the caret's
      // reference range with the sigil included (`$accent`) rather than the
      // declaration range the provider returns, so the rename box is prefilled
      // with `$accent`. Recorded as a UX observation, not asserted as intent.
      { placeholder: "$accent", line: 10, start: 9, end: 16 },
      "pinned: prepareRename prefills the caret token including the sigil (CSSX-U1)",
    );

    // Refusal paths (both surface as a thrown provider error).
    await t.rejects(
      vscode.commands.executeCommand(
        "vscode.executeDocumentRenameProvider",
        document.uri,
        accentUse,
        "1bad",
      ),
      /Token names must start with a letter or underscore/,
      "an invalid token name is refused",
    );
    await t.rejects(
      vscode.commands.executeCommand(
        "vscode.executeDocumentRenameProvider",
        document.uri,
        host.positionOf(document, "$theme.primary", 8),
        "core",
      ),
      /Cross-module rename is not supported yet/,
      "a cross-module member rename is refused",
    );

    // A valid rename applies to every reference in the file.
    const renameEdit = await vscode.commands.executeCommand(
      "vscode.executeDocumentRenameProvider",
      document.uri,
      accentUse,
      "accent2",
    );
    const renameFiles = editEntries(renameEdit);
    t.equal(renameFiles.length, 1, "a local token rename touches one file");
    t.equal(renameFiles[0].edits.length, 3, "the rename edits the declaration and both uses");
    t.equal(await vscode.workspace.applyEdit(renameEdit), true, "the rename edit was rejected");
    t.match(document.getText(), /accent2: #2563eb;/, "the declaration was renamed");
    t.equal(
      document.getText().split("$accent2").length - 1,
      2,
      "both token references were renamed",
    );

    // Cross-module group rename: edits in two files, applied as one edit.
    const groups = await workspace.open(
      "navigation-groups.cssx",
      await host.readFixture("ui/navigation-groups.cssx"),
    );
    const groupRename = await vscode.commands.executeCommand(
      "vscode.executeDocumentRenameProvider",
      document.uri,
      lastPositionOf(document, "@group.card-base", 8),
      "card-common",
    );
    const groupFiles = editEntries(groupRename);
    t.equal(groupFiles.length, 2, `the group rename touched ${groupFiles.length} file(s)`);
    t.equal(
      groupFiles.reduce((total, file) => total + file.edits.length, 0),
      3,
      "the group rename covers the definition and both use sites",
    );
    t.equal(await vscode.workspace.applyEdit(groupRename), true, "the group rename was rejected");
    t.equal(
      document.getText().split("@group.card-common").length - 1,
      2,
      "both use sites were renamed",
    );
    t.match(groups.document.getText(), /@group\.card-common \{/, "the definition was renamed");

    // Renaming a token onto an existing name is refused before any edit
    // (CSSX-U04): the name `gap` is already declared, so no WorkspaceEdit is
    // returned and the document is left byte-identical.
    const beforeConflict = document.getText();
    await t.rejects(
      vscode.commands.executeCommand(
        "vscode.executeDocumentRenameProvider",
        document.uri,
        host.positionOf(document, "accent2: #2563eb", 3),
        "gap",
      ),
      /A token named "\$gap" already exists in scope/,
      "a rename onto an existing token name is refused (CSSX-U04)",
    );
    t.equal(
      document.getText(),
      beforeConflict,
      "the refused conflicting rename changed the document (CSSX-U04)",
    );
    t.equal(
      document.getText().split("gap:").length - 1,
      1,
      "the refused rename left one `gap` declaration (CSSX-U04)",
    );

    return "definition/references/rename incl. cross-module group rename and 3 refusal paths";
  } finally {
    await workspace.dispose();
  }
}

module.exports = { run };
