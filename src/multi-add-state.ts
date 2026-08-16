import { CONFIG, STORAGE_KEYS } from './config';

/**
 * Runtime on/off state for adding items in place.
 *
 * The effective value is, in priority order:
 *   1. a value the user saved from the console (localStorage)
 *   2. the `CONFIG.enableMultiAdd` default
 *
 * Turning this off restores Amazon's stock behaviour exactly — the click is
 * left alone, the confirmation modal opens, and the popover closes. That's the
 * escape hatch if Amazon ever changes the endpoint.
 *
 * Cached in a module variable so the click path doesn't touch localStorage on
 * every row click.
 */
const readStored = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.multiAddEnabled);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

// Stored value supersedes the compiled-in default.
let enabled: boolean = readStored() ?? CONFIG.enableMultiAdd;

/**
 * Whether row clicks are intercepted and added in place.
 *
 * @returns `true` when the feature is on.
 * @example
 * isMultiAddEnabled(); // true
 * @source src/multi-add-state.ts
 */
export const isMultiAddEnabled = (): boolean => enabled;

/**
 * Set and persist the feature flag; survives page refreshes.
 *
 * @param value - `true` to add in place, `false` to defer to Amazon.
 * @returns The new state.
 * @example
 * setMultiAddEnabled(false); // false — Amazon's modal is back
 * @source src/multi-add-state.ts
 */
export const setMultiAddEnabled = (value: boolean): boolean => {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEYS.multiAddEnabled, String(value));
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
  return enabled;
};

/**
 * Expose `window.wishlistSearchMultiAdd(true|false)` — the console switch for
 * this feature. Called with no argument it just reports the current state.
 *
 * Takes effect on the next click; there's no need to reopen the popover,
 * because the interceptor checks the flag per click rather than at attach time.
 *
 * @returns Nothing.
 * @example
 * installMultiAddHelper();
 * window.wishlistSearchMultiAdd(false); // false
 * @source src/multi-add-state.ts
 */
export const installMultiAddHelper = (): void => {
  window.wishlistSearchMultiAdd = (value?: boolean): boolean => {
    if (typeof value === 'boolean') setMultiAddEnabled(value);
    return isMultiAddEnabled();
  };
};
