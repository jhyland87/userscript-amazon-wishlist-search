import { CONFIG, STORAGE_KEYS } from './config';
import { getListItems, getListItemName } from './dom';
import { log } from './log';
import { normalizeName } from './name-match';
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

/**
 * Names recorded before list names were whitespace-normalized still carry the
 * newline runs Amazon's markup left in them, and would no longer match any row
 * in the popover. Folding them on read keeps those counts alive.
 */
const normalizeKeys = (map: FrequencyMap): FrequencyMap => {
  const folded: FrequencyMap = {};
  for (const [name, count] of Object.entries(map)) {
    const key = normalizeName(name);
    folded[key] = (folded[key] ?? 0) + count;
  }
  return folded;
};

export const loadFrequencies = (): FrequencyMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.frequencies);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isFrequencyMap(parsed) ? normalizeKeys(parsed) : {};
  } catch {
    return {};
  }
};

export const saveFrequencies = (map: FrequencyMap): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.frequencies, JSON.stringify(map));
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
 * Undo one `recordSelection`, dropping the entry once it reaches zero.
 *
 * Used when an add is taken back, so a list the user immediately undid doesn't
 * keep climbing the "Previously selected" group.
 */
export const unrecordSelection = (listName: string): void => {
  if (!listName) return;
  const map = loadFrequencies();
  const count = map[listName];
  if (count === undefined) return;
  if (count <= 1) delete map[listName];
  else map[listName] = count - 1;
  saveFrequencies(map);
};

/** Remove a single list's frequency entry (drops it from the group). */
export const removeName = (listName: string): void => {
  if (!listName) return;
  const map = loadFrequencies();
  if (!(listName in map)) return;
  delete map[listName];
  saveFrequencies(map);
};

/**
 * Disabled-name blocklist.
 *
 * Names the user has opted out of the "Previously selected" group entirely.
 * Persisted as a JSON array of names, separate from the frequency map so that
 * clearing history doesn't lose the blocklist and vice-versa.
 */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const loadDisabled = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.frequentDisabled);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(isStringArray(parsed) ? parsed.map(normalizeName) : []);
  } catch {
    return new Set();
  }
};

export const saveDisabled = (names: Set<string>): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.frequentDisabled,
      JSON.stringify(Array.from(names)),
    );
  } catch (err) {
    log.warn('failed to persist disabled list', err);
  }
};

/** Block a list name so it never reappears in the "Previously selected" group. */
export const disableName = (listName: string): void => {
  if (!listName) return;
  const disabled = loadDisabled();
  if (disabled.has(listName)) return;
  disabled.add(listName);
  saveDisabled(disabled);
};

/**
 * Returns the top N list names by selection count, descending.
 * Only includes names that currently exist in the popover list.
 */
export const getTopFrequentNames = (n: number): string[] => {
  const map = loadFrequencies();
  const disabled = loadDisabled();
  const presentNames = new Set(
    getListItems()
      .map((li) => getListItemName(li))
      .filter((name): name is string => Boolean(name)),
  );
  return Object.entries(map)
    .filter(
      ([name, count]) =>
        count > 0 && presentNames.has(name) && !disabled.has(name),
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
};

/** Expose a global helper to clear history when frequent lists are enabled. */
export const installClearHistoryHelper = (): void => {
  if (!CONFIG.enableFrequentLists) return;
  window.clearWishlistHistory = () =>
    localStorage.removeItem(STORAGE_KEYS.frequencies);
};
