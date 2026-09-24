// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGm } from './gm-stub';
import { addRows, addSpinner, getRow, mountPage, visibleNames } from './popover-fixture';

const NAMES = ['Books', 'Board Games', 'Tools', 'Garden Tools', 'Gifts'];

type SearchModule = typeof import('../src/search');

/** Mount the page plus the search input the script would have injected. */
const setup = async (names: string[] = NAMES): Promise<SearchModule> => {
  mountPage(names);
  const input = document.createElement('input');
  input.id = 'wishlist-search';
  document.querySelector('#atwl-dd-ul')?.before(input);
  return import('../src/search');
};

const searchInput = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('#wishlist-search');
  if (!input) throw new Error('no search input');
  return input;
};

const resultText = (): string | undefined =>
  document.querySelector('#wishlist-search-result-count')?.innerHTML;

/** Whether the result-count notice is showing at all. */
const resultShown = (): boolean =>
  document.querySelector<HTMLElement>('#wishlist-search-result-count')?.style.display !==
  'none';

beforeEach(() => {
  resetGm();
  // search.ts keeps the running search in module state.
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('searchList', () => {
  it('hides rows that do not match and keeps the ones that do', async () => {
    const { searchList } = await setup();
    searchList('tools');
    expect(visibleNames()).toEqual(['Tools', 'Garden Tools']);
  });

  it('highlights the matched part of each shown name', async () => {
    const { searchList } = await setup();
    searchList('gard');
    const nameSpan = getRow('Garden Tools').querySelector('[id^="atwl-list-name-"]');
    expect(nameSpan?.innerHTML).toBe('<strong><u>Gard</u></strong>en Tools');
    // The text itself is unchanged.
    expect(nameSpan?.textContent).toBe('Garden Tools');
  });

  it('never parses a list name as markup when highlighting it', async () => {
    const name = '<img src=x onerror=alert(1)>';
    const { searchList } = await setup([name, 'Books']);
    searchList('img');
    const nameSpan = getRow(name).querySelector('[id^="atwl-list-name-"]');
    expect(nameSpan?.querySelector('img')).toBeNull();
    expect(nameSpan?.textContent).toBe(name);
  });

  it('caps the rows shown and says how many were held back', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `Wish ${i + 1}`);
    const { searchList } = await setup(many);
    const { CONFIG } = await import('../src/config');
    searchList('wish');
    expect(visibleNames()).toHaveLength(Number(CONFIG.maxSearchResults));
    expect(resultText()).toBe(`Showing ${String(CONFIG.maxSearchResults)} of 12 matches`);
  });

  it('reports zero results with the term escaped, and flags the input', async () => {
    const { searchList } = await setup();
    searchList('<b>');
    expect(visibleNames()).toEqual([]);
    expect(resultText()).toBe('0 results for <em>&lt;b&gt;</em>');
    expect(searchInput().style.color).toBe('#ff0000');
  });

  it('matches the input as a pattern when regex mode is on', async () => {
    const { searchList } = await setup();
    const { setRegexEnabled } = await import('../src/regex-state');
    setRegexEnabled(true);
    searchList('^g');
    expect(visibleNames()).toEqual(['Garden Tools', 'Gifts']);
  });

  it('leaves rows without a list name (Amazon footer rows) untouched', async () => {
    const { searchList } = await setup();
    const footer = document.createElement('li');
    footer.className = 'a-dropdown-item';
    footer.textContent = 'Create a List';
    document.querySelector('#atwl-dd-ul')?.append(footer);
    searchList('zzz');
    expect(footer.style.display).toBe('');
  });
});

describe('refilterListItems', () => {
  it('applies the running search to rows paged in afterwards', async () => {
    const { searchList, refilterListItems } = await setup();
    searchList('tools');
    addRows(['Power Tools', 'Kitchen']);
    refilterListItems();
    expect(visibleNames()).toEqual(['Tools', 'Garden Tools', 'Power Tools']);
  });

  it('does nothing when no search is running', async () => {
    const { refilterListItems } = await setup();
    addRows(['Kitchen']);
    refilterListItems();
    expect(visibleNames()).toEqual([...NAMES, 'Kitchen']);
  });

  it('forgets the search once reset, so a new open is not filtered', async () => {
    const { searchList, refilterListItems, resetSearchState } = await setup();
    searchList('tools');
    resetSearchState();
    const [kitchen] = addRows(['Kitchen']);
    refilterListItems();
    expect(kitchen?.style.display).toBe('');
  });
});

describe('searchTrigger', () => {
  it('debounces typing into a single search', async () => {
    vi.useFakeTimers();
    const { searchTrigger } = await setup();
    const { CONFIG } = await import('../src/config');
    searchTrigger('t');
    searchTrigger('to');
    searchTrigger('too');
    expect(visibleNames()).toEqual(NAMES);
    vi.advanceTimersByTime(CONFIG.searchDelayMs);
    expect(visibleNames()).toEqual(['Tools', 'Garden Tools']);
  });

  it('an empty term shows every row and clears the input', async () => {
    const { searchList, searchTrigger } = await setup();
    searchList('tools');
    searchInput().value = 'tools';
    searchTrigger('');
    expect(visibleNames()).toEqual(NAMES);
    expect(searchInput().value).toBe('');
    // Highlighting is removed too.
    expect(getRow('Tools').querySelector('strong')).toBeNull();
  });
});

describe('while Amazon is still loading lists', () => {
  const POLL_MS = 250;

  it('says it is searching instead of reporting no results', async () => {
    vi.useFakeTimers();
    const { searchList } = await setup();
    addSpinner();
    searchList('gps');
    expect(resultText()).toBe('Searching for <em>gps</em>…');
    expect(searchInput().style.color).not.toBe('#ff0000');
  });

  it('shows the match once the list it is on loads in', async () => {
    vi.useFakeTimers();
    const { searchList, refilterListItems } = await setup();
    const spinner = addSpinner();
    searchList('gps');

    addRows(['GPS Tracker']);
    spinner.remove();
    refilterListItems();

    expect(visibleNames()).toEqual(['GPS Tracker']);
    expect(resultShown()).toBe(false);
    expect(searchInput().style.color).toBe('inherit');
  });

  it('reports no results only after loading finishes', async () => {
    vi.useFakeTimers();
    const { searchList } = await setup();
    const spinner = addSpinner();
    searchList('gps');

    vi.advanceTimersByTime(POLL_MS * 3);
    expect(resultText()).toBe('Searching for <em>gps</em>…');

    // Amazon hides the spinner rather than removing it; no DOM event fires.
    spinner.style.display = 'none';
    vi.advanceTimersByTime(POLL_MS);
    expect(resultText()).toBe('0 results for <em>gps</em>');
    expect(searchInput().style.color).toBe('#ff0000');
  });

  it('stops waiting on a spinner that never clears', async () => {
    vi.useFakeTimers();
    const { searchList } = await setup();
    addSpinner();
    searchList('gps');
    vi.advanceTimersByTime(10000 + POLL_MS);
    expect(resultText()).toBe('0 results for <em>gps</em>');
  });

  it('leaves the spinner row itself alone', async () => {
    vi.useFakeTimers();
    const { searchList } = await setup();
    const spinner = addSpinner();
    searchList('gps');
    expect(spinner.style.display).toBe('');
  });

  it('keeps searching across pages until the last one arrives', async () => {
    vi.useFakeTimers();
    const { searchList, refilterListItems } = await setup();
    let spinner = addSpinner();
    searchList('gps');

    // A page with no match: Amazon swaps in its rows plus a new spinner.
    spinner.remove();
    addRows(['Kitchen', 'Office']);
    spinner = addSpinner();
    refilterListItems();
    vi.advanceTimersByTime(POLL_MS);
    expect(resultText()).toBe('Searching for <em>gps</em>…');

    // The last page has no spinner.
    spinner.remove();
    addRows(['Garage']);
    refilterListItems();
    expect(resultText()).toBe('0 results for <em>gps</em>');
  });

  it('a new search replaces the one that was waiting', async () => {
    vi.useFakeTimers();
    const { searchList } = await setup();
    const spinner = addSpinner();
    searchList('gps');
    searchList('tools');
    spinner.remove();
    vi.advanceTimersByTime(POLL_MS);
    expect(visibleNames()).toEqual(['Tools', 'Garden Tools']);
    // All matches fit, so the notice is hidden rather than left on "gps".
    expect(resultShown()).toBe(false);
  });
});
