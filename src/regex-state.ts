import { CONFIG, STORAGE_KEYS } from './config';

/**
 * Runtime on/off state for regex search mode, toggled from the icon inside the
 * search input. Persisted so it survives page refreshes.
 *
 * The effective value is, in priority order:
 *   1. a value the user toggled (localStorage)
 *   2. the `CONFIG.regexSearches` default (`true`/`'enable'` → on)
 */
const defaultEnabled =
  CONFIG.regexSearches === true || CONFIG.regexSearches === 'enable';

const readStored = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.regexEnabled);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

// Stored value supersedes the compiled-in default.
let enabled: boolean = readStored() ?? defaultEnabled;

export const isRegexEnabled = (): boolean => enabled;

/** Set and persist the regex-mode flag; survives page refreshes. */
export const setRegexEnabled = (value: boolean): boolean => {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEYS.regexEnabled, String(value));
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
  return enabled;
};
