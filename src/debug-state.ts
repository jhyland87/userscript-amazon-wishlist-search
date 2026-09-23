import { CONFIG, STORAGE_KEYS } from './config';
import { isBoolean, onStoredChange, readStored, writeStored } from './storage';

/**
 * Runtime debug state.
 *
 * The effective value is, in priority order:
 *   1. a value previously saved from the console (GM storage)
 *   2. the `CONFIG.debug` default
 *
 * The value is cached in a module variable so the logger (a hot path that
 * runs on every DOM mutation) never touches storage per call.
 */
let enabled: boolean = CONFIG.debug;

/**
 * Load the stored flag into the cache and keep it in sync with other tabs.
 * Called once at startup, before anything logs at debug level.
 *
 * @returns Resolves once the stored value (if any) is cached.
 * @example
 * await loadDebugState();
 * isDebugEnabled(); // true, if it was saved as on
 * @source src/debug-state.ts
 */
export const loadDebugState = async (): Promise<void> => {
  enabled = (await readStored(STORAGE_KEYS.debug, isBoolean)) ?? CONFIG.debug;
  onStoredChange(STORAGE_KEYS.debug, isBoolean, (value) => {
    enabled = value ?? CONFIG.debug;
  });
};

export const isDebugEnabled = (): boolean => enabled;

/** Set and persist the debug flag; survives page refreshes. */
export const setDebugEnabled = (value: boolean): boolean => {
  enabled = value;
  void writeStored(STORAGE_KEYS.debug, value);
  return enabled;
};
