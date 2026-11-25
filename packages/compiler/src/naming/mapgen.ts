import type { Diagnostic } from "../types/diagnostics.js";
import { error, warning } from "../types/diagnostics.js";
import type { ClassEntry, ClassMapOptions, ClassMapResult, ClassTable } from "./types.js";

/**
 * JavaScript class-map and TypeScript declaration generation
 * (SPECIFICATION.md §8, masterplan §3.6, ADR-0010).
 *
 * Output contract, fixed here and covered by goldens:
 *
 * - **ESM**, no runtime helper. When `cssImport` is a string, the first line is
 *   `import "<path>";`; the path itself belongs to A10's output planner. `null`
 *   or omitted emits no import, for hosts that load CSS separately.
 * - **Named exports** use the camelCase alias (`card-header` → `cardHeader`) only
 *   when the alias is a valid, non-reserved JavaScript identifier and no other
 *   class claims the same alias. Export order is the class table's
 *   first-appearance order, so output is deterministic.
 * - **Default export** is a plain object whose keys are the original class
 *   names. A class with a usable alias uses the canonical §2 forms: shorthand
 *   when the original name equals its alias (`button`), quoted original plus the
 *   alias when they differ (`"card-header": cardHeader, cardHeader`). A class
 *   without a named export keeps the original key with a literal emitted value;
 *   a valid IdentifierName key is written bare (`fooBar`, `default`) because it
 *   is already the original name spelled safely, and anything else is quoted
 *   (`"foo-bar"`, `"2col"`). `__proto__` is always a computed key. Values are
 *   literal emitted names, so the map is complete.
 * - **Collisions are a hard error (CHIKX4001, ADR-0010).** If `foo-bar` and
 *   `fooBar` both camelCase to `fooBar`, the named exports for **both** are
 *   omitted and the default map keeps only the original keys. Recovery is
 *   explicit, not a silent merge or a partial API.
 * - **Reserved or invalid identifiers** (`default`, `delete`, `2col`) stay
 *   reachable through their original key; their named export is omitted with a
 *   CHIKX4001 **warning** (§8).
 * - **`__proto__` safety:** an original key named `__proto__` is emitted with a
 *   computed key (`["__proto__"]: ...`) in the default object. A computed key is
 *   a normal own data property, so it neither invokes the `Object.prototype`
 *   prototype setter nor changes the object's prototype. Computed keys are
 *   preferred over a null-prototype construct because the emitted module stays a
 *   plain object literal (no helper, no `Object.create`), which keeps the map
 *   compatible with plain `import` consumers.
 * - **Declarations** mirror the JS exactly: literal string types, `readonly`
 *   map properties, the same named exports and the same omission rules, and no
 *   `any`. Global classes never reach either file (§8).
 *
 * Formatting is fixed so generated files are stable and compatible with the
 * repository formatter: a default object whose line fits in 100 columns stays
 * inline with a trailing comma only in the multiline form, and the declaration
 * map type is inline without a trailing property semicolon when it fits, or one
 * `readonly` property per line otherwise. This never changes keys, values or
 * ordering.
 */

/** `true` when `name` can be a bare JavaScript IdentifierName (property key). */
function isValidJsPropertyName(name: string): boolean {
  return /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u.test(name);
}

/** The formatter's fixed line width for generated objects and type literals. */
const LINE_WIDTH = 100;

/** camelCase separators that join a class name into a JS alias. */
function camelCaseAlias(name: string): string {
  const parts = name.split("-").filter((part) => part.length > 0);
  const first = parts[0] ?? "";
  let alias = first;
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    alias += part.charAt(0).toUpperCase() + part.slice(1);
  }
  return alias;
}

/** `true` when `alias` can be declared as a bare JavaScript binding. */
function isValidJsIdentifier(alias: string): boolean {
  return /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u.test(alias);
}

/**
 * Words that cannot be a named export binding (or are unsafe as one under ESM
 * strict mode). Kept explicit so the policy is auditable rather than depending
 * on engine behavior.
 */
const RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/** One exportable class plus its prepared alias decision. */
interface PreparedEntry {
  readonly entry: ClassEntry;
  readonly alias: string;
  /** Alias is a valid non-reserved binding name. */
  readonly aliasValid: boolean;
  /** Another exportable class claims the same alias. */
  readonly collision: boolean;
  /** A named export is emitted for this class. */
  readonly named: boolean;
}

/** Quote a string as a JS/TS double-quoted literal. */
function quote(text: string): string {
  return JSON.stringify(text);
}

/** Original-key expression for the default object / type literal. */
function namedOriginalKey(name: string): string {
  return name === "__proto__" ? '["__proto__"]' : quote(name);
}

/**
 * Key for a class without a named export.
 *
 * The original name is preserved as the property key. A bare identifier is the
 * safest shortest spelling (and the only one the repository formatter accepts
 * for a valid IdentifierName); names that are not valid identifiers are quoted,
 * and `__proto__` is computed.
 */
function quotedOriginalKey(name: string): string {
  if (name === "__proto__") return '["__proto__"]';
  return isValidJsPropertyName(name) ? name : quote(name);
}

/** Render one default-object entry as one or more property snippets. */
function defaultEntry(prepared: PreparedEntry): readonly string[] {
  const { entry, alias, named } = prepared;
  if (!named) {
    return [`${quotedOriginalKey(entry.name)}: ${quote(entry.emitted)}`];
  }
  if (entry.name === alias) {
    return entry.name === "__proto__" ? [`["__proto__"]: ${alias}`] : [alias];
  }
  return [`${namedOriginalKey(entry.name)}: ${alias}`, alias];
}

/** Render one readonly map-type property snippet (no trailing semicolon). */
function typeProperties(prepared: PreparedEntry): readonly string[] {
  const { entry, alias, named } = prepared;
  const value = quote(entry.emitted);
  if (!named) {
    return [`readonly ${quotedOriginalKey(entry.name)}: ${value}`];
  }
  if (entry.name === alias) return [`readonly ${entry.name}: ${value}`];
  return [`readonly ${quote(entry.name)}: ${value}`, `readonly ${alias}: ${value}`];
}

/** Prepare export decisions and collect CHIKX4001 diagnostics. */
function prepare(table: ClassTable, diagnostics: Diagnostic[]): readonly PreparedEntry[] {
  const exportable = table.entries.filter((entry) => !entry.global);

  const candidates = exportable.map((entry) => {
    const alias = camelCaseAlias(entry.name);
    const aliasValid = isValidJsIdentifier(alias) && !RESERVED_IDENTIFIERS.has(alias);
    return { entry, alias, aliasValid };
  });

  const groups = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    if (!candidate.aliasValid) continue;
    const group = groups.get(candidate.alias);
    if (group === undefined) {
      groups.set(candidate.alias, [candidate]);
    } else {
      group.push(candidate);
    }
  }

  const prepared: PreparedEntry[] = [];
  const reportedCollisions = new Set<string>();

  for (const candidate of candidates) {
    const group = candidate.aliasValid ? groups.get(candidate.alias) : undefined;
    const collision = group !== undefined && group.length > 1;

    if (!candidate.aliasValid) {
      diagnostics.push(
        warning(
          "CHIKX4001",
          `Class "${candidate.entry.name}" maps to the reserved or invalid JavaScript identifier "${candidate.alias}"; its named export was omitted (SPECIFICATION.md §8) and the original key remains in the default map.`,
          candidate.entry.span,
        ),
      );
    } else if (collision && group !== undefined) {
      const first = group[0];
      if (first !== undefined && first === candidate && !reportedCollisions.has(candidate.alias)) {
        reportedCollisions.add(candidate.alias);
        const names = group.map((member) => `"${member.entry.name}"`).join(", ");
        diagnostics.push(
          error(
            "CHIKX4001",
            `Class exports ${names} all map to the camelCase alias "${candidate.alias}" (SPECIFICATION.md §8, ADR-0010); named exports for these classes were omitted and the default map keeps their original keys.`,
            candidate.entry.span,
          ),
        );
      }
    }

    prepared.push({
      entry: candidate.entry,
      alias: candidate.alias,
      aliasValid: candidate.aliasValid,
      collision,
      named: candidate.aliasValid && !collision,
    });
  }

  return prepared;
}

/**
 * Generate the ESM class map and matching `.d.ts` for one class table.
 *
 * Pure and deterministic: the same table and options always produce
 * byte-identical text. Global classes are excluded, collisions and reserved
 * identifiers follow the documented strict policy, and `__proto__` is emitted
 * with a computed key so a hostile class name cannot poison the object.
 *
 * @param classes Class table produced by `renameClasses`.
 * @param options Optional CSS side-effect import specifier.
 */
export function generateClassMap(
  classes: ClassTable,
  options: ClassMapOptions = {},
): ClassMapResult {
  const diagnostics: Diagnostic[] = [];
  const prepared = prepare(classes, diagnostics);

  const jsLines: string[] = [];
  const importSpecifier = options.cssImport;
  if (typeof importSpecifier === "string") {
    jsLines.push(`import ${quote(importSpecifier)};`);
  }

  const named = prepared.filter((entry) => entry.named);
  for (const entry of named) {
    jsLines.push(`export const ${entry.alias} = ${quote(entry.entry.emitted)};`);
  }

  if (prepared.length === 0) {
    jsLines.push("export default {};");
  } else {
    const properties = prepared.flatMap(defaultEntry);
    const inline = `export default { ${properties.join(", ")} };`;
    if (inline.length <= LINE_WIDTH) {
      jsLines.push(inline);
    } else {
      jsLines.push("export default {");
      for (const property of properties) jsLines.push(`  ${property},`);
      jsLines.push("};");
    }
  }

  const typeLines: string[] = [];
  for (const entry of named) {
    typeLines.push(`export declare const ${entry.alias}: ${quote(entry.entry.emitted)};`);
  }
  if (prepared.length === 0) {
    typeLines.push("declare const map: Record<string, never>;");
  } else {
    const properties = prepared.flatMap(typeProperties);
    const inline = `declare const map: { ${properties.join("; ")} };`;
    if (inline.length <= LINE_WIDTH) {
      typeLines.push(inline);
    } else {
      typeLines.push("declare const map: {");
      for (const property of properties) typeLines.push(`  ${property};`);
      typeLines.push("};");
    }
  }
  typeLines.push("export default map;");

  return {
    js: `${jsLines.join("\n")}\n`,
    types: `${typeLines.join("\n")}\n`,
    diagnostics,
  };
}
