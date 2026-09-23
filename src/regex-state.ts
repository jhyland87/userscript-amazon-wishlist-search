import { CONFIG, STORAGE_KEYS } from './config';
import { isBoolean, onStoredChange, readStored, writeStored } from './storage';

/**
 * Runtime on/off state for regex search mode, toggled from the icon inside the
 * search input. Persisted so it survives page refreshes.
 *
 * The effective value is, in priority order:
 *   1. a value the user toggled (GM storage)
 *   2. the `CONFIG.regexSearches` default (`true`/`'enable'` → on)
 */
const defaultEnabled =
  CONFIG.regexSearches === true || CONFIG.regexSearches === 'enable';

let enabled: boolean = defaultEnabled;

/**
 * Load the stored flag into the cache and keep it in sync with other tabs.
 *
 * @returns Resolves once the stored value (if any) is cached.
 * @example
 * await loadRegexState();
 * isRegexEnabled(); // true, if it was toggled on
 * @source src/regex-state.ts
 */
export const loadRegexState = async (): Promise<void> => {
  enabled =
    (await readStored(STORAGE_KEYS.regexEnabled, isBoolean)) ?? defaultEnabled;
  onStoredChange(STORAGE_KEYS.regexEnabled, isBoolean, (value) => {
    enabled = value ?? defaultEnabled;
  });
};

export const isRegexEnabled = (): boolean => enabled;

/** Set and persist the regex-mode flag; survives page refreshes. */
export const setRegexEnabled = (value: boolean): boolean => {
  enabled = value;
  void writeStored(STORAGE_KEYS.regexEnabled, value);
  return enabled;
};
