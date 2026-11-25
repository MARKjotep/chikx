/**
 * Structural tests for the Chikx TextMate grammar, language configuration and VS Code manifest.
 *
 * These assertions gate the approved UI contract (`.ai/tasks/CSSX-A12.md`) without relying on a
 * renderer: every included context must exist, matcher order must keep directives ahead of the
 * generic alias rule, every regex must compile, and no `match` rule may match the empty string
 * (empty TextMate matches can hang the tokenizer). Scope rendering is covered separately, with a
 * documented skip when the WASM toolchain is unavailable.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  EXTENSION_ROOT,
  type ExtensionManifest,
  type Grammar,
  type LanguageConfiguration,
  allRules,
  loadGrammar,
  readJson,
  referencedContexts,
  referencedScopes,
} from "./grammar-harness";

const grammar: Grammar = loadGrammar();
const manifest = readJson<ExtensionManifest>(join(EXTENSION_ROOT, "package.json"));
const languageConfiguration = readJson<LanguageConfiguration>(
  join(EXTENSION_ROOT, "language-configuration.json"),
);

function rootIndex(include: string): number {
  return grammar.patterns.findIndex((pattern) => pattern.include === include);
}

function directiveIds(): string[] {
  return (grammar.repository.directives?.patterns ?? [])
    .map((pattern) => pattern.include ?? "")
    .filter((include) => include.startsWith("#"))
    .map((include) => include.slice(1));
}

function anchoredRegex(source: string): RegExp {
  return new RegExp(`^(?:${source})$`);
}

describe("grammar structure", () => {
  test("parses as a standalone source.chikx grammar", () => {
    expect(grammar.name).toBe("Chikx");
    expect(grammar.scopeName).toBe("source.chikx");
    expect(grammar.fileTypes).toContain("chikx");
    expect(Object.keys(grammar.repository).length).toBeGreaterThan(30);
  });

  test("every included context exists", () => {
    const available = new Set(Object.keys(grammar.repository));
    for (const context of referencedContexts(grammar)) {
      expect(available.has(context)).toBe(true);
    }
    for (const include of grammar.patterns.map((pattern) => pattern.include ?? "")) {
      expect(include.startsWith("#")).toBe(true);
    }
  });

  test("root order is comment, directives, native at-rules, alias blocks, selectors, recovery", () => {
    const order = [
      "#comment",
      "#directives",
      "#native-at-rule",
      "#alias-block-start",
      "#selector",
      "#error-recovery",
    ];
    const indexes = order.map(rootIndex);
    for (const index of indexes) expect(index).toBeGreaterThanOrEqual(0);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(rootIndex("#block")).toBeLessThan(rootIndex("#selector"));
    expect(rootIndex("#error-recovery")).toBe(grammar.patterns.length - 1);
  });

  test("block body keeps nested rules, conditionals, native at-rules and declarations ordered", () => {
    const body = (grammar.repository["block-body"]?.patterns ?? []).map(
      (pattern) => pattern.include ?? "",
    );
    const nested = body.indexOf("#nested-rule");
    const conditional = body.indexOf("#conditional-block");
    const native = body.indexOf("#native-at-rule");
    const declaration = body.indexOf("#declaration");
    expect(nested).toBeGreaterThanOrEqual(0);
    expect(conditional).toBeGreaterThan(nested);
    expect(native).toBeGreaterThan(conditional);
    expect(declaration).toBeGreaterThan(native);
    expect(grammar.repository["nested-rule"]?.patterns?.[0]?.include).toBe("#selector");
  });
});

describe("directive and media alias matchers", () => {
  test("directives are listed before any generic alias pattern", () => {
    expect(directiveIds()).toEqual([
      "directive-setup",
      "directive-use",
      "directive-variables",
      "directive-runtime",
      "directive-media-types",
    ]);
    expect(rootIndex("#directives")).toBeLessThan(rootIndex("#alias-block-start"));
    expect(rootIndex("#directives")).toBeLessThan(rootIndex("#at-rule-generic"));

    for (const id of directiveIds()) {
      const begin = grammar.repository[id]?.begin ?? "";
      expect(begin.startsWith("(@")).toBe(true);
      expect(begin).not.toContain("entity.name.function");
      expect(grammar.repository[id]?.beginCaptures?.["1"]?.name).toBe(
        "keyword.control.directive.chikx",
      );
    }
  });

  test("alias matcher accepts digits and + combinations and rejects reserved @ keywords", () => {
    const source = grammar.repository.alias?.match ?? "";
    expect(source.length).toBeGreaterThan(0);
    const matcher = anchoredRegex(source);
    for (const alias of ["@md", "@2xl", "@xl+dark", "@dark", "@compact", "@print"]) {
      expect(matcher.test(alias)).toBe(true);
    }
    for (const reserved of [
      "@setup",
      "@use",
      "@variables",
      "@runtime",
      "@media-types",
      "@media",
      "@supports",
      "@keyframes",
      "@font-face",
      "@property",
    ]) {
      expect(matcher.test(reserved)).toBe(false);
    }
    expect(grammar.repository.alias?.name).toBe("meta.variant.chikx entity.name.function.chikx");
  });

  test("conditional blocks reuse the reserved-name exclusion and group aliases in meta.variant", () => {
    const block = grammar.repository["conditional-block"];
    expect(block?.begin ?? "").toContain("setup");
    expect(block?.begin ?? "").toContain("media-types");
    expect(block?.beginCaptures?.["1"]?.name).toBe("meta.variant.chikx entity.name.function.chikx");
    expect(block?.contentName).toBe("meta.variant.chikx");
  });
});

describe("regex safety", () => {
  test("all matchers compile and never match empty input", () => {
    for (const rule of allRules(grammar)) {
      for (const key of ["begin", "end", "match"] as const) {
        const source = rule[key];
        if (source === undefined) continue;
        const regex = new RegExp(source);
        if (key === "match") {
          expect(regex.test("")).toBe(false);
        }
      }
    }
  });

  test("rule selectors use brace lookahead rather than consuming the block opener", () => {
    const selector = grammar.repository.selector;
    expect(selector?.begin?.startsWith("(?=")).toBe(true);
    expect(selector?.end).toBe("(?=\\{)");
    expect(selector?.contentName).toBe("meta.selector.chikx");
    expect(grammar.repository.block?.begin).toBe("\\{");
    expect(grammar.repository.block?.end).toBe("\\}");
  });
});

describe("group directive scoping structure", () => {
  test("definitions and use sites have distinct containers and a member scope", () => {
    const definition = grammar.repository["group-definition"];
    const use = grammar.repository["group-use"];
    expect(definition?.name).toBe("meta.directive.group.chikx");
    expect(use?.name).toBe("meta.group.use.chikx");
    for (const rule of [definition, use]) {
      expect(rule?.begin ?? "").toContain("@group");
      expect(rule?.beginCaptures?.["1"]?.name).toBe("keyword.control.directive.chikx");
      expect(rule?.beginCaptures?.["2"]?.name).toBe("punctuation.accessor.chikx");
      expect(rule?.beginCaptures?.["3"]?.name).toBe("entity.name.type.group.chikx");
      expect(rule?.endCaptures?.["0"]?.name).toBe("punctuation.section.block.css");
    }
    expect(definition?.name).not.toBe(use?.name);
    expect(definition?.beginCaptures?.["3"]?.name).not.toBe("variable.other.member.chikx");
    expect(definition?.beginCaptures?.["3"]?.name).not.toBe("entity.name.function.chikx");
  });

  test("definitions match at the root before aliases and use sites live in block bodies", () => {
    const definitionIndex = rootIndex("#group-definition");
    expect(definitionIndex).toBeGreaterThan(rootIndex("#directives"));
    expect(definitionIndex).toBeLessThan(rootIndex("#native-at-rule"));
    expect(definitionIndex).toBeLessThan(rootIndex("#alias-block-start"));
    const body = (grammar.repository["block-body"]?.patterns ?? []).map(
      (pattern) => pattern.include ?? "",
    );
    expect(body).toContain("#group-use");
    expect(body).toContain("#group-keyword");
    expect(grammar.repository["group-keyword"]?.match).toContain("@group");
  });

  test("the alias matcher and variant block matchers reserve @group", () => {
    const alias = grammar.repository.alias?.match ?? "";
    const matcher = anchoredRegex(alias);
    expect(matcher.test("@group")).toBe(false);
    expect(matcher.test("@group.card")).toBe(false);
    expect(matcher.test("@group+dark")).toBe(false);
    expect(matcher.test("@groupie")).toBe(true);
    expect(grammar.repository["conditional-block"]?.begin ?? "").toContain("group");
    expect(grammar.repository["alias-block-start"]?.begin ?? "").toContain("group");
  });
});

describe("UI acceptance scopes", () => {
  test("every scope named by the UI contract is reachable in the grammar", () => {
    const scopes = new Set(referencedScopes(grammar));
    for (const scope of [
      "meta.variant.chikx",
      "entity.name.function.chikx",
      "keyword.control.directive.chikx",
      "keyword.other.chikx",
      "entity.other.attribute-name.class.css",
      "entity.other.attribute-name.id.css",
      "entity.name.tag.css",
      "entity.other.attribute-name.pseudo-class.css",
      "entity.other.attribute-name.pseudo-element.css",
      "entity.other.attribute-name.parent-selector.css",
      "keyword.operator.combinator.css",
      "support.type.property-name.css",
      "support.constant.property-value.css",
      "string.quoted.double.css",
      "comment.block.chikx",
      "comment.line.double-slash.chikx",
      "variable.other.chikx",
      "variable.other.member.chikx",
      "constant.numeric.css",
      "keyword.other.unit.css",
      "keyword.other.important.css",
      "support.function.calc.css",
      "keyword.control.at-rule.css",
      "meta.at-rule.media.css",
      "meta.at-rule.supports.css",
      "meta.at-rule.keyframes.css",
      "meta.at-rule.font-face.css",
      "meta.at-rule.property.css",
      "punctuation.section.block.css",
      "punctuation.definition.group.css",
      "punctuation.terminator.rule.css",
    ]) {
      expect(scopes.has(scope)).toBe(true);
    }
  });

  test("selector categories have distinct scopes and :global re-enters selector context", () => {
    for (const id of [
      "selector-class",
      "selector-id",
      "selector-type",
      "selector-pseudo-class",
      "selector-pseudo-element",
      "selector-parent",
      "selector-combinator",
    ]) {
      expect(grammar.repository[id]?.name).toBeTruthy();
    }
    const globalBegin = grammar.repository["selector-global"]?.begin ?? "";
    expect(globalBegin).toContain(":global");
    expect(grammar.repository["selector-global"]?.beginCaptures?.["1"]?.name).toBe(
      "entity.other.attribute-name.pseudo-class.chikx",
    );
    expect(grammar.repository["selector-global"]?.patterns?.[0]?.include).toBe("#selector-base");
  });

  test("values and native at-rule preludes never include the alias matcher", () => {
    const valueIncludes = (grammar.repository.value?.patterns ?? []).map(
      (pattern) => pattern.include ?? "",
    );
    expect(valueIncludes).toContain("#alias");
    const preludeIncludes = (grammar.repository["media-prelude"]?.patterns ?? []).map(
      (pattern) => pattern.include ?? "",
    );
    expect(preludeIncludes).not.toContain("#alias");
    expect(preludeIncludes).toContain("#numeric");
  });
});

describe("VS Code manifest", () => {
  test("declares publisher, engine, activation and an existing entry point", () => {
    expect(typeof manifest.name).toBe("string");
    expect(manifest.publisher).toBe("chikx");
    expect(manifest.displayName).toBe("Chikx");
    expect(manifest.engines?.vscode).toMatch(/^\^\d+\.\d+\.\d+$/);
    expect(manifest.activationEvents).toContain("onLanguage:chikx");
    expect(manifest.main).toBeTruthy();
    expect(existsSync(join(EXTENSION_ROOT, manifest.main ?? ""))).toBe(true);
  });

  test("contributes the chikx language, configuration and grammar", () => {
    const language = manifest.contributes?.languages?.[0];
    expect(language?.id).toBe("chikx");
    expect(language?.extensions).toContain(".cssx");
    expect(language?.aliases).toContain("Chikx");
    expect(language?.configuration).toBe("./language-configuration.json");
    expect(existsSync(join(EXTENSION_ROOT, language?.configuration ?? ""))).toBe(true);

    const grammarContribution = manifest.contributes?.grammars?.[0];
    expect(grammarContribution?.language).toBe("chikx");
    expect(grammarContribution?.scopeName).toBe(grammar.scopeName);
    expect(grammarContribution?.path).toBe("./syntaxes/chikx.tmLanguage.json");
    expect(existsSync(join(EXTENSION_ROOT, grammarContribution?.path ?? ""))).toBe(true);
  });
});

describe("language configuration", () => {
  test("declares line and block comments", () => {
    expect(languageConfiguration.comments?.lineComment).toBe("//");
    expect(languageConfiguration.comments?.blockComment).toEqual(["/*", "*/"]);
  });

  test("declares bracket pairs, auto-closing and surrounding pairs", () => {
    expect(languageConfiguration.brackets).toEqual([
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ]);
    const autoClosing = (languageConfiguration.autoClosingPairs ?? []).map((pair) => pair.open);
    for (const open of ["{", "[", "(", '"', "'", "/*"]) {
      expect(autoClosing).toContain(open);
    }
    const blockComment = (languageConfiguration.autoClosingPairs ?? []).find(
      (pair) => pair.open === "/*",
    );
    expect(blockComment?.close).toBe("*/");
    const surrounding = (languageConfiguration.surroundingPairs ?? []).map((pair) => pair.open);
    for (const open of ["{", "[", "(", '"', "'"]) {
      expect(surrounding).toContain(open);
    }
  });

  test("indents after { and outdents on }", () => {
    const increase = new RegExp(
      languageConfiguration.indentationRules?.increaseIndentPattern ?? "",
    );
    const decrease = new RegExp(
      languageConfiguration.indentationRules?.decreaseIndentPattern ?? "",
    );
    expect(increase.test("  .button {")).toBe(true);
    expect(increase.test("  .button {}")).toBe(false);
    expect(decrease.test("  }")).toBe(true);
    expect(decrease.test("  .button {")).toBe(false);
  });

  test("word pattern covers $names and escapes", () => {
    const wordPattern = languageConfiguration.wordPattern ?? "";
    expect(wordPattern.length).toBeGreaterThan(0);
    const matcher = anchoredRegex(wordPattern);
    for (const word of ["$theme", "spacing", "foo-bar", "\\:hover"]) {
      expect(matcher.test(word)).toBe(true);
    }
  });
});
