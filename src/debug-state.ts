import { CONFIG } from './config';

/**
 * Runtime debug state.
 *
 * The effective value is, in priority order:
 *   1. a value previously saved from the console (localStorage)
 *   2. the `CONFIG.debug` default
 *
 * The value is cached in a module variable so the logger (a hot path that
 * runs on every DOM mutation) never touches localStorage per call.
 */
const STORAGE_KEY = 'wishlist-search:debug';

const readStored = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

// Stored value supersedes the compiled-in default.
let enabled: boolean = readStored() ?? CONFIG.debug;

export const isDebugEnabled = (): boolean => enabled;

/** Set and persist the debug flag; survives page refreshes. */
export const setDebugEnabled = (value: boolean): boolean => {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
  return enabled;
};
