import { CONFIG, SELECTORS, STORAGE_KEYS } from './config';
import { getListItems } from './dom';
import { log } from './log';
import { normalizeName } from './name-match';
import { onStoredChange, readStored, writeStored } from './storage';
import type { IndexedList, ListIndexEntry } from './types';
import { parseListTarget, parseStateField, readListPage } from './wishlist-api';
import { fetchListPage } from './wishlist-client';

/**
 * An index of every list the account has, so a search can match lists Amazon
 * hasn't paged into the popover yet.
 *
 * Amazon loads the popover 25 lists at a time; with a couple of hundred lists
 * that's ten round trips before a search can be sure of its answer. The index
 * fetches the same pages once in the background, caches them in GM storage per
 * host (each TLD is a separate account), and is refetched when it's older than
 * `CONFIG.listIndexTtlMs`.
 *
 * @category Wishlist API
 */

/** Stop following tokens after this many pages, so a looping token can't run forever. */
const MAX_PAGES = 100;

/** Stored shape: one entry per Amazon host. */
type ListIndexStore = Record<string, ListIndexEntry>;

/** A parsed row, plus the account it belongs to. */
interface ParsedListRow {
  readonly list: IndexedList;
  readonly customerId: string | null;
}

/** The index for this host, if one has been loaded or fetched. */
let entry: ListIndexEntry | null = null;
/** Set when Amazon shows a list the index doesn't have; cleared by a refresh. */
let stale = false;
/** The refresh in progress, so concurrent opens share one fetch. */
let inFlight: Promise<boolean> | null = null;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isIndexedList = (value: unknown): value is IndexedList =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'listExternalId') === 'string' &&
  typeof Reflect.get(value, 'listType') === 'string' &&
  typeof Reflect.get(value, 'name') === 'string' &&
  isNullableString(Reflect.get(value, 'privacy'));

const isListIndexEntry = (value: unknown): value is ListIndexEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const lists: unknown = Reflect.get(value, 'lists');
  return (
    typeof Reflect.get(value, 'fetchedAt') === 'number' &&
    isNullableString(Reflect.get(value, 'customerId')) &&
    Array.isArray(lists) &&
    lists.every(isIndexedList)
  );
};

const isListIndexStore = (value: unknown): value is ListIndexStore =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(isListIndexEntry);

/** The key this host's index is stored under. */
const currentHost = (): string => location.host;

/**
 * Parse the rows out of one page's HTML.
 *
 * Reads the same markup the popover's own rows carry, so the index and the
 * live rows agree on ids, types and names. Rows with no readable payload or
 * name (the spinner row) are skipped.
 *
 * @param html - A page's `content`: a run of `<li>` rows.
 * @returns The lists on the page, in order, each with its account ID.
 * @example
 * parseListRows(page.content);
 * // [{list: {listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist', name: 'Tools',
 * //   privacy: 'Private'}, customerId: 'A1B2C3D4E5'}, …]
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const parseListRows = (html: string): ParsedListRow[] => {
  const doc = new DOMParser().parseFromString(`<ul>${html}</ul>`, 'text/html');
  const rows: ParsedListRow[] = [];
  for (const li of doc.querySelectorAll(SELECTORS.listItem)) {
    const raw = li
      .querySelector(`${SELECTORS.listItemLink} ${SELECTORS.listItemDeclarative}`)
      ?.getAttribute('data-atwl-dd');
    const target = parseListTarget(raw);
    if (!target) continue;
    const name = normalizeName(li.querySelector(SELECTORS.listItemName)?.textContent ?? '');
    if (name === '') continue;
    const privacy = li.querySelector(SELECTORS.listItemPrivacy)?.textContent?.trim();
    rows.push({
      list: { ...target, name, privacy: privacy ? privacy : null },
      customerId: parseStateField(raw, 'customerId'),
    });
  }
  return rows;
};

/**
 * Fetch every page, following tokens until Amazon sends an empty one.
 *
 * @returns The new index, or `null` if any page failed.
 */
const fetchAllLists = async (): Promise<ListIndexEntry | null> => {
  const lists: IndexedList[] = [];
  let customerId: string | null = null;
  let token = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchListPage(token, lists.length);
    if ('kind' in response) {
      log.warn(`list index: page ${page + 1} failed`, response);
      return null;
    }
    const parsed = readListPage(response);
    if (!parsed) {
      log.warn(`list index: page ${page + 1} was not readable (HTTP ${response.status})`);
      return null;
    }
    for (const row of parseListRows(parsed.content)) {
      lists.push(row.list);
      customerId ??= row.customerId;
    }
    if (parsed.nextToken === '') {
      return { fetchedAt: Date.now(), customerId, lists };
    }
    token = parsed.nextToken;
  }
  log.warn(`list index: gave up after ${MAX_PAGES} pages`);
  return null;
};

/**
 * The account the open popover belongs to, read from its first real row.
 * `null` when no row carries one (no popover, or nothing loaded yet).
 */
const getPopoverCustomerId = (): string | null => {
  for (const li of getListItems()) {
    const raw = li
      .querySelector(SELECTORS.listItemDeclarative)
      ?.getAttribute('data-atwl-dd');
    const customerId = parseStateField(raw, 'customerId');
    if (customerId) return customerId;
  }
  return null;
};

/** The cached index, unless it belongs to a different account than the popover. */
const usableEntry = (): ListIndexEntry | null => {
  if (!entry) return null;
  const popoverCustomer = getPopoverCustomerId();
  if (popoverCustomer && entry.customerId && popoverCustomer !== entry.customerId) {
    return null;
  }
  return entry;
};

/**
 * Load this host's cached index from GM storage, and keep it in sync with
 * refreshes made in other tabs.
 *
 * @returns Resolves once the cache has been read.
 * @example
 * await loadListIndex();
 * getIndexedLists().length; // 231
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const loadListIndex = async (): Promise<void> => {
  const store = await readStored(STORAGE_KEYS.listIndex, isListIndexStore);
  entry = store?.[currentHost()] ?? null;
  onStoredChange(STORAGE_KEYS.listIndex, isListIndexStore, (value) => {
    entry = value?.[currentHost()] ?? null;
    stale = false;
  });
};

/**
 * Every indexed list, in popover order. Includes an expired index, since
 * lists rarely change; check `isListIndexFresh` before treating it as complete.
 *
 * @returns The lists, or an empty array when there is no usable index.
 * @example
 * getIndexedLists(); // [{listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist', name: 'Tools', privacy: 'Private'}, …]
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const getIndexedLists = (): readonly IndexedList[] => usableEntry()?.lists ?? [];

/**
 * Whether the index can be trusted to hold every list: it exists, belongs to
 * this account, is younger than `CONFIG.listIndexTtlMs`, and nothing has turned
 * up since that it's missing.
 *
 * @returns `true` when a search can report its answer without waiting on Amazon.
 * @example
 * isListIndexFresh(); // true
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const isListIndexFresh = (): boolean => {
  const current = usableEntry();
  if (!current || stale) return false;
  return Date.now() - current.fetchedAt < CONFIG.listIndexTtlMs;
};

/**
 * Flag the index as incomplete (Amazon showed a list it doesn't have), so the
 * next popover open refetches it.
 *
 * @returns Nothing.
 * @example
 * markListIndexStale(); // isListIndexFresh() is now false
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const markListIndexStale = (): void => {
  if (!stale) log.debug('list index: Amazon showed a list the index lacks — marked stale');
  stale = true;
};

/**
 * Refetch the whole index and cache it. Concurrent calls share one fetch. On
 * failure the previous index is kept as it was.
 *
 * @returns `true` if the index was replaced.
 * @example
 * await refreshListIndex(); // true — 231 lists over 10 pages
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const refreshListIndex = async (): Promise<boolean> => {
  if (inFlight) return inFlight;
  const run = async (): Promise<boolean> => {
    const startedAt = performance.now();
    const fetched = await fetchAllLists();
    if (!fetched) return false;
    entry = fetched;
    stale = false;
    log.debug(
      `list index: fetched ${fetched.lists.length} list(s) in ${Math.round(performance.now() - startedAt)}ms`,
    );
    const store = (await readStored(STORAGE_KEYS.listIndex, isListIndexStore)) ?? {};
    await writeStored(STORAGE_KEYS.listIndex, { ...store, [currentHost()]: fetched });
    return true;
  };
  inFlight = run();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/**
 * Refresh the index unless it's still fresh. Called each time the popover opens.
 *
 * @returns `true` if the index was replaced.
 * @example
 * await refreshListIndexIfStale(); // false — fetched an hour ago
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const refreshListIndexIfStale = async (): Promise<boolean> => {
  if (isListIndexFresh()) return false;
  return refreshListIndex();
};

/**
 * The index's state, for `wishlistSearchDebug()`.
 *
 * @returns Size, age and freshness of the index.
 * @example
 * getListIndexDebugState(); // {lists: 231, ageMs: 3600000, fresh: true, stale: false, refreshing: false}
 * @category Wishlist API
 * @group List Index
 * @source src/wishlist-index.ts
 */
export const getListIndexDebugState = (): Record<string, unknown> => ({
  lists: entry?.lists.length ?? 0,
  ageMs: entry ? Date.now() - entry.fetchedAt : null,
  usable: usableEntry() !== null,
  fresh: isListIndexFresh(),
  stale,
  refreshing: inFlight !== null,
});
