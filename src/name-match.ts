/**
 * List-name text handling.
 *
 * Amazon's popover markup wraps long list names across source lines, so a
 * row's raw text carries newline + indentation runs where the rendered name
 * shows a single space ("3D\n        Printer/Filaments"). Matching against
 * that raw text silently misses anything the user types with a plain space,
 * which is why searches only found part of what they should.
 *
 * @category Search
 */

/**
 * Collapse every whitespace run in a list name to a single space.
 *
 * @param text - Raw text read from a row's name span.
 * @returns The name as it reads on screen.
 * @example
 * normalizeName(' 3D\n    Printer/Filaments '); // '3D Printer/Filaments'
 * @source src/name-match.ts
 * @category Search
 */
export const normalizeName = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

/**
 * Where a search hit sits inside a list name.
 *
 * Offsets rather than the matched text, so highlighting marks the occurrence
 * the pattern actually found instead of the first one that looks like it.
 *
 * @category Search
 */
export interface NameMatch {
  /** Index of the first matched character. */
  readonly start: number;
  /** Index just past the last matched character. */
  readonly end: number;
}

/**
 * Locate a search hit within a normalized list name.
 *
 * @param name - The normalized list name.
 * @param pattern - Compiled pattern, or null when the input isn't usable as one.
 * @param searchStr - The raw search text, used for the case-insensitive
 *   literal fallback when there's no pattern.
 * @returns The hit's offsets, or null when the name doesn't match.
 * @example
 * findNameMatch('Chem/Glassware', /chem/i, 'chem'); // { start: 0, end: 4 }
 * findNameMatch('Tools', /chem/i, 'chem'); // null
 * @source src/name-match.ts
 * @category Search
 */
export const findNameMatch = (
  name: string,
  pattern: RegExp | null,
  searchStr: string,
): NameMatch | null => {
  if (pattern) {
    const match = pattern.exec(name);
    if (!match) return null;
    return { start: match.index, end: match.index + match[0].length };
  }
  const start = name.toLowerCase().indexOf(searchStr.toLowerCase());
  if (start === -1) return null;
  return { start, end: start + searchStr.length };
};
