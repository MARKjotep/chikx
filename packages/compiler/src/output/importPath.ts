/**
 * CSS side-effect import computation for the generated JS class map.
 *
 * The specifier is computed from the map file's directory to the CSS artifact,
 * always using forward slashes and a `./` prefix when the relative form does
 * not already start with `.`. The returned text is ready to place between
 * double quotes in `import "…";`: backslashes, double quotes, control
 * characters and JavaScript line separators are escaped.
 */

import { dirnamePath, isAbsolutePath, relativePath } from "./paths.js";

/**
 * Compute the import specifier from a JS map file to a CSS file.
 *
 * @param mapPath Absolute POSIX path of the JS map artifact.
 * @param cssPath Absolute POSIX path of the CSS artifact.
 * @returns Escaped JS string-literal content such as `./button.css` or
 *   `../styles/button.css`. If the paths have different roots, the absolute CSS
 *   path is returned because no relative specifier exists; such a plan is
 *   rejected earlier by containment checks.
 */
export function importSpecifierFor(mapPath: string, cssPath: string): string {
  const relative = relativePath(dirnamePath(mapPath), cssPath);
  if (isAbsolutePath(relative)) return escapeJsString(relative);
  let specifier = relative;
  if (relative === ".") specifier = ".";
  else if (relative.startsWith("../") || relative.startsWith("./")) specifier = relative;
  else specifier = `./${relative}`;
  return escapeJsString(specifier);
}

/**
 * Escape text so it can be inserted between double quotes in a JS string
 * literal. Ordinary path characters are unchanged, so a normal specifier such
 * as `../styles/button.css` round-trips byte for byte.
 */
export function escapeJsString(value: string): string {
  let escaped = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    switch (character) {
      case "\\":
        escaped += "\\\\";
        break;
      case '"':
        escaped += '\\"';
        break;
      case "\n":
        escaped += "\\n";
        break;
      case "\r":
        escaped += "\\r";
        break;
      case "\t":
        escaped += "\\t";
        break;
      case "\b":
        escaped += "\\b";
        break;
      case "\f":
        escaped += "\\f";
        break;
      case "\v":
        escaped += "\\v";
        break;
      case "\u2028":
        escaped += "\\u2028";
        break;
      case "\u2029":
        escaped += "\\u2029";
        break;
      default:
        if (code < 0x20) escaped += `\\x${code.toString(16).padStart(2, "0")}`;
        else escaped += character;
        break;
    }
  }
  return escaped;
}
