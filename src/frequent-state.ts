import { CONFIG, STORAGE_KEYS } from './config';

/**
 * Runtime on/off state for the "Previously selected" feature.
 *
 * The effective value is, in priority order:
 *   1. a value the user saved from the popover controls or console (localStorage)
 *   2. the `CONFIG.enableFrequentLists` default
 *
 * Cached in a module variable so the render path doesn't touch localStorage on
 * every popover open.
 */
const readStored = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.frequentEnabled);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

// Stored value supersedes the compiled-in default.
let enabled: boolean = readStored() ?? CONFIG.enableFrequentLists;

export const isFrequentEnabled = (): boolean => enabled;

/** Set and persist the feature flag; survives page refreshes. */
export const setFrequentEnabled = (value: boolean): boolean => {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEYS.frequentEnabled, String(value));
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
  return enabled;
};
