import { CONFIG } from './config';
import { getListItems, getListItemName } from './dom';
import { log } from './log';
import type { FrequencyMap } from './types';

/**
 * Selection frequency tracking.
 *
 * Persisted in localStorage as a { [listName]: count } map. Keyed by list
 * name (rather than list ID) because the name is what's shown to the user
 * and the rare case of a rename simply resets that one list's count.
 */

/**
 * A valid frequency map is a plain object whose every value is a finite,
 * non-negative number. Validating the values (not just "it's an object")
 * keeps the rest of the module honest: callers do arithmetic and numeric
 * sorts on these counts, so a corrupt/legacy entry like `{"Books":"3"}`
 * must not slip through as a `FrequencyMap`.
 */
const isFrequencyMap = (value: unknown): value is FrequencyMap => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (count) => typeof count === 'number' && Number.isFinite(count) && count >= 0,
  );
};

export const loadFrequencies = (): FrequencyMap => {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isFrequencyMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const saveFrequencies = (map: FrequencyMap): void => {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(map));
  } catch (err) {
    log.warn('failed to persist frequencies', err);
  }
};

export const recordSelection = (listName: string): void => {
  if (!listName) return;
  const map = loadFrequencies();
  map[listName] = (map[listName] ?? 0) + 1;
  saveFrequencies(map);
};

/**
 * Returns the top N list names by selection count, descending.
 * Only includes names that currently exist in the popover list.
 */
export const getTopFrequentNames = (n: number): string[] => {
  const map = loadFrequencies();
  const presentNames = new Set(
    getListItems()
      .map((li) => getListItemName(li))
      .filter((name): name is string => Boolean(name)),
  );
  return Object.entries(map)
    .filter(([name, count]) => count > 0 && presentNames.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
};

/** Expose a global helper to clear history when frequent lists are enabled. */
export const installClearHistoryHelper = (): void => {
  if (!CONFIG.enableFrequentLists) return;
  window.clearWishlistHistory = () => localStorage.removeItem(CONFIG.storageKey);
};
