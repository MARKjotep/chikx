/**
 * `@` token scanning.
 *
 * This module deliberately classifies nothing. The frozen `modifier` JSDoc in
 * `types/token.ts` says the tokenizer "never emits this kind on its own: the
 * parser reclassifies `at-keyword` to `modifier` only at top-level value depth
 * (inline variants) or in block-condition position". Alias tables live in
 * configuration, so the lexer only recognises `@` followed by a name and emits
 * `at-keyword` including the `@`. A `@` with no name is a `delim`.
 *
 * Digits may start an alias (`@2xl`) and `-` is a name character, so the scan
 * uses the name grammar rather than the stricter identifier-start rule.
 */

import { escapeEnd, isNameCode } from "./characters.js";
import { nameEnd } from "./names.js";

/**
 * End offset of the `@` token starting at `start`.
 *
 * Returns `start + 1` when no name follows, which the caller emits as a `delim`
 * so round-tripping never loses the character.
 */
export function scanAtKeyword(source: string, start: number): number {
  const nameStart = start + 1;
  const code = source.charCodeAt(nameStart);
  if (!isNameCode(code) && escapeEnd(source, nameStart) <= nameStart) return start + 1;
  return nameEnd(source, nameStart);
}
