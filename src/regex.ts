/** Escape a string so it can be embedded literally in a RegExp. */
export const escapeRegExp = (text: string): string =>
  text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

/**
 * If `searchPatternStr` looks like `/pattern/flags` (or with one of the
 * alternate delimiters), return a RegExp built from it; otherwise return null.
 */
export const getRegexpPattern = (searchPatternStr: string): RegExp | null => {
  if (!searchPatternStr) return null;

  const flags = ['i'];
  const delimiters = ['\\/', '%', '@', '~', '#'];
  const delimClass = `[${delimiters.join('')}]`;
  const flagClass = `[${flags.join('')}]`;
  const re = new RegExp(
    `^(?<delim1>${delimClass})(?<pattern>.*)(?<delim2>${delimClass})(?<flags>${flagClass}*)?$`,
  );

  const match = searchPatternStr.match(re);
  if (!match?.groups) return null;

  const { pattern, flags: parsedFlags } = match.groups;
  if (pattern === undefined) return null;

  try {
    return parsedFlags
      ? new RegExp(pattern, parsedFlags)
      : new RegExp(pattern);
  } catch {
    return null;
  }
};

/** Safely convert a plain search string into a case-insensitive RegExp. */
export const str2regex = (searchStr: string): RegExp | null => {
  if (!searchStr) return null;
  try {
    return new RegExp(escapeRegExp(searchStr), 'i');
  } catch {
    return null;
  }
};
