import { CONFIG } from './config';
import { isDebugEnabled } from './debug-state';
import { getListItems, getListItemName, getListItemNameSpan, getSearchInput } from './dom';
import { setFrequentSearchOverride } from './frequent-section';
import { log } from './log';
import type { NameMatch } from './name-match';
import { findNameMatch, normalizeName } from './name-match';
import { compileRegex, getRegexpPattern, str2regex } from './regex';
import { isRegexEnabled } from './regex-state';
import { hideSearchResultTxt, updateSearchResultTxt } from './result-count';

/**
 * The search currently applied to the popover.
 *
 * Kept as module state (rather than read back off the input) because Amazon
 * keeps loading rows into the dropdown after the search has run — see
 * `refilterListItems`, which needs to know what to apply to them.
 */
interface SearchState {
  readonly term: string;
  readonly pattern: RegExp | null;
  /** Rows that matched, including any held back by `maxSearchResults`. */
  matchCount: number;
  /** Rows actually left visible. */
  shownCount: number;
  /** Rows looked at, including ones with no name to match against. */
  scannedCount: number;
  /** Rows with no name span — Amazon's own footer rows, left untouched. */
  skippedCount: number;
  /**
   * Matching names in row order, so the debug summary can name what matched
   * and what the cap held back. Only filled while debug logging is on.
   */
  readonly matchedNames: string[];
}

/** A fresh tally for a search about to run. */
const newState = (term: string, pattern: RegExp | null): SearchState => ({
  term,
  pattern,
  matchCount: 0,
  shownCount: 0,
  scannedCount: 0,
  skippedCount: 0,
  matchedNames: [],
});

let state: SearchState | null = null;

/**
 * The term each row was last filtered with. A row Amazon appended after the
 * search ran has no entry, which is how `refilterListItems` spots it — and
 * because nothing is written to the DOM, re-checking can't feed the observer
 * that calls it.
 */
const appliedTerm = new WeakMap<HTMLElement, string>();

/** Escape a value that's about to be dropped into the result-count HTML. */
const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );

/** Drop any highlighting, leaving the name as plain (normalized) text. */
const clearHighlight = (nameSpan: HTMLElement, name: string): void => {
  if (nameSpan.textContent !== name) nameSpan.textContent = name;
};

/** Rewrite the name span with the matched span wrapped in `<strong><u>`. */
const applyHighlight = (
  nameSpan: HTMLElement,
  name: string,
  match: NameMatch,
): void => {
  if (match.end <= match.start) {
    clearHighlight(nameSpan, name);
    return;
  }
  const hit = document.createElement('strong');
  const underline = document.createElement('u');
  underline.textContent = name.slice(match.start, match.end);
  hit.appendChild(underline);
  // Built from nodes rather than an innerHTML string: list names are the
  // user's own text and must never be re-parsed as markup.
  nameSpan.textContent = '';
  nameSpan.append(name.slice(0, match.start), hit, name.slice(match.end));
};

/** Show every list item again and clear any search highlighting. */
export const showAllListItems = (): void => {
  // Nothing is being searched for any more, so let the group re-collapse.
  setFrequentSearchOverride(false);
  const items = getListItems();
  log.debug(
    state
      ? `clearing the search for "${state.term}" — restoring ${items.length} row(s)`
      : `restoring ${items.length} row(s)`,
  );
  state = null;
  for (const item of items) {
    item.style.display = 'block';
    const nameSpan = getListItemNameSpan(item);
    if (nameSpan) clearHighlight(nameSpan, normalizeName(nameSpan.textContent ?? ''));
  }

  const input = getSearchInput();
  if (input) {
    input.value = '';
    input.style.color = 'inherit';
  }
  hideSearchResultTxt();
};

/**
 * Decide whether/how to build a regex from the user's input, based on the
 * regex-mode toggle. When on, the input is treated as a pattern (a `/…/flags`
 * form is honoured, otherwise the raw text is compiled); when off, the input is
 * matched as a case-insensitive literal.
 */
const resolvePattern = (searchStr: string): RegExp | null => {
  if (!isRegexEnabled()) {
    const literal = str2regex(searchStr);
    log.debug(`regex mode off — matching literally with ${String(literal)}`);
    return literal;
  }

  const delimited = getRegexpPattern(searchStr);
  if (delimited) {
    log.debug(`regex mode on — read the /…/ form as ${String(delimited)}`);
    return delimited;
  }

  const compiled = compileRegex(searchStr);
  if (compiled) {
    log.debug(`regex mode on — compiled the input as ${String(compiled)}`);
    return compiled;
  }

  // Half-typed expressions land here on every keystroke, which is why it
  // falls back rather than reporting an error.
  log.debug(
    `regex mode on — "${searchStr}" is not a valid pattern yet; falling back to a case-insensitive literal match`,
  );
  return null;
};

/** Filter (and highlight) one row against the running search. */
const applyToItem = (active: SearchState, item: HTMLElement): void => {
  active.scannedCount++;

  const nameSpan = getListItemNameSpan(item);
  // No name span means it isn't a wishlist row (the "Create a List" footer),
  // so it's left exactly as Amazon rendered it.
  if (!nameSpan) {
    active.skippedCount++;
    return;
  }

  appliedTerm.set(item, active.term);

  const name = normalizeName(nameSpan.textContent ?? '');
  const match = findNameMatch(name, active.pattern, active.term);

  const overLimit =
    typeof CONFIG.maxSearchResults === 'number' &&
    active.shownCount >= CONFIG.maxSearchResults;

  if (match) {
    active.matchCount++;
    if (isDebugEnabled()) active.matchedNames.push(name);
  }

  if (!match || overLimit) {
    clearHighlight(nameSpan, name);
    item.style.display = 'none';
    return;
  }

  active.shownCount++;
  applyHighlight(nameSpan, name, match);
  item.style.display = 'block';
};

/** How the tallies read after a pass, e.g. "28 matched, 10 shown, 18 capped". */
const describeTallies = (active: SearchState): string =>
  `${active.matchCount} matched, ${active.shownCount} shown, ` +
  `${active.matchCount - active.shownCount} held back by the cap`;

/**
 * Log what a full search pass did. Everything expensive (name lists, a sample
 * of the rows scanned) is built only once the debug flag is on.
 */
const logSearchSummary = (active: SearchState, elapsedMs: number): void => {
  if (!isDebugEnabled()) return;

  const cap =
    typeof CONFIG.maxSearchResults === 'number'
      ? `cap ${CONFIG.maxSearchResults}`
      : 'no cap';
  log.debug(
    `search "${active.term}" with ${String(active.pattern)}: ` +
      `scanned ${active.scannedCount} row(s) (${active.skippedCount} with no name span, ${cap}) ` +
      `in ${elapsedMs.toFixed(1)}ms — ${describeTallies(active)}`,
  );

  if (active.matchCount === 0) {
    // The names are the diagnostic here: a match that "should" have hit is
    // usually a name that doesn't read the way it looks (odd whitespace, a
    // different dash, a non-breaking space).
    log.debug(
      'no matches — first rows scanned:',
      getListItems()
        .slice(0, 8)
        .map((item) => getListItemName(item)),
    );
    return;
  }

  log.debug('shown:', active.matchedNames.slice(0, active.shownCount));
  if (active.matchCount > active.shownCount) {
    log.debug(
      'held back by CONFIG.maxSearchResults:',
      active.matchedNames.slice(active.shownCount),
    );
  }
};

/**
 * Log a pass that only covered rows Amazon added after the search ran — the
 * delta, plus where the running tallies ended up.
 */
const logRefilterSummary = (
  active: SearchState,
  newNames: string[],
  elapsedMs: number,
): void => {
  if (!isDebugEnabled()) return;
  log.debug(
    `extended the search for "${active.term}" to ${newNames.length} new row(s) ` +
      `in ${elapsedMs.toFixed(1)}ms — ${describeTallies(active)} ` +
      `(${active.scannedCount} row(s) scanned in total)`,
  );
  if (newNames.length > 0) log.debug('newly matched:', newNames);
};

/** Update the notice above the list to reflect the current tallies. */
const renderResultCount = (active: SearchState): void => {
  const input = getSearchInput();
  if (!input) return;

  if (active.matchCount === 0) {
    updateSearchResultTxt(`0 results for <em>${escapeHtml(active.term)}</em>`, {
      color: '#00000087',
    });
    input.style.color = '#ff0000';
    return;
  }

  input.style.color = 'inherit';

  if (active.matchCount > active.shownCount) {
    // Silently dropping the rest reads as "the search missed them", so the
    // cap says so instead of hiding.
    updateSearchResultTxt(
      `Showing ${active.shownCount} of ${active.matchCount} matches`,
      { color: '#00000087' },
    );
    return;
  }

  hideSearchResultTxt();
};

export const searchList = (searchStr: string): void => {
  if (!getSearchInput()) {
    log.debug(`searchList("${searchStr}"): no search input in the popover — nothing to filter`);
    return;
  }

  log.debug(`running search for "${searchStr}"`);

  // The frequent group holds the original <li> nodes, so it has to be visible
  // for matches inside it to show at all.
  setFrequentSearchOverride(true);

  const active = newState(searchStr, resolvePattern(searchStr));
  state = active;

  const startedAt = performance.now();
  for (const item of getListItems()) applyToItem(active, item);
  logSearchSummary(active, performance.now() - startedAt);

  renderResultCount(active);
};

/**
 * Apply the running search to rows that have appeared since it last ran.
 *
 * Amazon pages more lists into the open dropdown, and those rows arrive
 * unfiltered — which is why non-matching lists used to pile up underneath the
 * results. A wholesale re-render (nothing left that we've filtered) restarts
 * the search instead, so the tallies don't count vanished rows.
 *
 * @returns Nothing.
 * @example
 * refilterListItems(); // no-op unless a search is running and rows are new
 * @source src/search.ts
 * @category Search
 */
export const refilterListItems = (): void => {
  const active = state;
  if (!active) return;

  const items = getListItems();
  const fresh = items.filter((item) => appliedTerm.get(item) !== active.term);
  if (fresh.length === 0) return;

  log.debug(
    `${fresh.length} row(s) appeared since the search for "${active.term}" ran (${items.length} row(s) in the popover now)`,
  );
  if (isDebugEnabled()) {
    log.debug('new rows:', fresh.map((item) => getListItemName(item)));
  }

  if (fresh.length === items.length) {
    log.debug('every row is new — the list was re-rendered, so the search restarts');
    searchList(active.term);
    return;
  }

  const matchedBefore = active.matchedNames.length;
  const startedAt = performance.now();
  for (const item of fresh) applyToItem(active, item);
  logRefilterSummary(
    active,
    active.matchedNames.slice(matchedBefore),
    performance.now() - startedAt,
  );

  renderResultCount(active);
};

/**
 * Re-apply the running search after Amazon has rebuilt the popover's contents,
 * restoring the term into the freshly injected input.
 *
 * @returns Nothing.
 * @example
 * restoreActiveSearch(); // no-op when nothing is being searched for
 * @source src/search.ts
 * @category Search
 */
export const restoreActiveSearch = (): void => {
  const term = state?.term;
  if (!term) return;
  const input = getSearchInput();
  if (!input) {
    log.debug(`restoreActiveSearch: the search input is gone — "${term}" not restored`);
    return;
  }
  input.value = term;
  log.debug(`restoring search "${term}" into the re-injected input`);
  searchList(term);
};

/**
 * What the running search is doing right now, for `wishlistSearchDebug()`.
 *
 * @returns The current term, the pattern it resolved to, and the tallies —
 *   all null/zero when no search is running.
 * @example
 * getSearchDebugState(); // { term: 'chem', pattern: '/chem/i', matchCount: 28, shownCount: 10 }
 * @source src/search.ts
 * @category Search
 */
export const getSearchDebugState = (): Record<string, unknown> => ({
  term: state?.term ?? null,
  pattern: state ? String(state.pattern) : null,
  scannedCount: state?.scannedCount ?? 0,
  matchCount: state?.matchCount ?? 0,
  shownCount: state?.shownCount ?? 0,
  maxSearchResults: CONFIG.maxSearchResults,
  regexEnabled: isRegexEnabled(),
});

/**
 * Forget the running search. Called when the popover opens, so a new open
 * starts clean rather than re-applying the last term to a fresh list.
 *
 * @returns Nothing.
 * @example
 * resetSearchState();
 * @source src/search.ts
 * @category Search
 */
export const resetSearchState = (): void => {
  if (state) log.debug(`popover opened — dropping the previous search ("${state.term}")`);
  state = null;
};

// Debounced search trigger fired from the input's keyup event.
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

export const searchTrigger = (searchStr: string): void => {
  if (searchDebounce) clearTimeout(searchDebounce);

  if (!searchStr) {
    showAllListItems();
    return;
  }
  if (searchStr.length <= CONFIG.minSearchInput) {
    log.debug(
      `"${searchStr}" is ${searchStr.length} character(s) — waiting for more than CONFIG.minSearchInput (${CONFIG.minSearchInput})`,
    );
    return;
  }

  log.debug(`queued search for "${searchStr}" in ${CONFIG.searchDelayMs}ms`);
  searchDebounce = setTimeout(() => searchList(searchStr), CONFIG.searchDelayMs);
};

/** Reset state on keydown (clears 0-results red color, etc). */
export const resetSearchInput = (elem: HTMLElement): void => {
  hideSearchResultTxt();
  elem.style.color = 'inherit';
};
