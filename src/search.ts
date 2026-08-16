import { CONFIG } from './config';
import {
  getListItems,
  getListItemName,
  getListItemNameSpan,
  getSearchInput,
} from './dom';
import { setFrequentSearchOverride } from './frequent-section';
import { log } from './log';
import { compileRegex, getRegexpPattern, str2regex } from './regex';
import { isRegexEnabled } from './regex-state';
import {
  hideSearchResultTxt,
  updateSearchResultTxt,
} from './result-count';

/** Show every list item again and clear any search highlighting. */
export const showAllListItems = (): void => {
  // Nothing is being searched for any more, so let the group re-collapse.
  setFrequentSearchOverride(false);
  for (const item of getListItems()) {
    item.style.display = 'block';
    // Restore any highlighted innerHTML on the name span.
    const nameSpan = getListItemNameSpan(item);
    if (nameSpan) nameSpan.innerHTML = nameSpan.innerText;
  }
  const input = getSearchInput();
  if (input) input.value = '';
  hideSearchResultTxt();
};

/**
 * Decide whether/how to build a regex from the user's input, based on the
 * regex-mode toggle. When on, the input is treated as a pattern (a `/…/flags`
 * form is honoured, otherwise the raw text is compiled); when off, the input is
 * matched as a case-insensitive literal.
 */
const resolvePattern = (searchStr: string): RegExp | null => {
  if (isRegexEnabled()) {
    return getRegexpPattern(searchStr) ?? compileRegex(searchStr);
  }
  return str2regex(searchStr);
};

/**
 * Returns the matched substring (used for highlighting) or null if the item
 * doesn't match. With a regex, that's the regex match; otherwise it's the
 * literal search string when present.
 */
const matchName = (
  itemName: string,
  pattern: RegExp | null,
  searchStr: string,
): string | null => {
  if (pattern) {
    const m = itemName.match(pattern);
    return m ? m[0] : null;
  }
  return itemName.includes(searchStr) ? searchStr : null;
};

export const searchList = (searchStr: string): void => {
  const input = getSearchInput();
  if (!input) return;

  // The frequent group holds the original <li> nodes, so it has to be visible
  // for matches inside it to show at all.
  setFrequentSearchOverride(true);

  updateSearchResultTxt('');

  const pattern = resolvePattern(searchStr);
  let resultCount = 0;

  for (const item of getListItems()) {
    const nameSpan = getListItemNameSpan(item);
    if (!nameSpan) continue;

    const itemName = getListItemName(item) ?? '';
    const matched = matchName(itemName, pattern, searchStr);

    if (matched === null) {
      nameSpan.innerHTML = nameSpan.innerText;
      item.style.display = 'none';
      continue;
    }

    resultCount++;

    const overLimit =
      typeof CONFIG.maxSearchResults === 'number' &&
      CONFIG.maxSearchResults < resultCount;

    if (overLimit) {
      item.style.display = 'none';
      continue;
    }

    nameSpan.innerHTML = nameSpan.innerText.replace(
      matched,
      `<strong><u>${matched}</u></strong>`,
    );
    item.style.display = 'block';
  }

  if (resultCount === 0) {
    updateSearchResultTxt(`0 results for <em>${searchStr}</em>`, {
      color: '#00000087',
    });
    input.style.color = '#ff0000';
    return;
  }

  if (
    typeof CONFIG.maxSearchResults === 'number' &&
    CONFIG.maxSearchResults < resultCount
  ) {
    log.debug(
      `A total of ${resultCount} matches found, but only showing the first ${CONFIG.maxSearchResults}`,
    );
  }
  hideSearchResultTxt();
};

// Debounced search trigger fired from the input's keyup event.
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

export const searchTrigger = (searchStr: string): void => {
  if (searchDebounce) clearTimeout(searchDebounce);

  if (!searchStr) {
    showAllListItems();
    return;
  }
  if (searchStr.length <= CONFIG.minSearchInput) return;

  searchDebounce = setTimeout(() => searchList(searchStr), CONFIG.searchDelayMs);
};

/** Reset state on keydown (clears 0-results red color, etc). */
export const resetSearchInput = (elem: HTMLElement): void => {
  hideSearchResultTxt();
  elem.style.color = 'inherit';
};
