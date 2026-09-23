import { unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { CONFIG, STORAGE_KEYS } from './config';
import { isBoolean, onStoredChange, readStored, writeStored } from './storage';

/**
 * Runtime on/off state for adding items in place.
 *
 * The effective value is, in priority order:
 *   1. a value the user saved from the console (GM storage)
 *   2. the `CONFIG.enableMultiAdd` default
 *
 * Turning this off restores Amazon's stock behaviour exactly — the click is
 * left alone, the confirmation modal opens, and the popover closes. That's the
 * escape hatch if Amazon ever changes the endpoint.
 *
 * Cached in a module variable so the click path doesn't touch storage on
 * every row click.
 */
let enabled: boolean = CONFIG.enableMultiAdd;

/**
 * Load the stored flag into the cache and keep it in sync with other tabs.
 *
 * @returns Resolves once the stored value (if any) is cached.
 * @example
 * await loadMultiAddState();
 * isMultiAddEnabled(); // false, if it was switched off
 * @source src/multi-add-state.ts
 */
export const loadMultiAddState = async (): Promise<void> => {
  enabled =
    (await readStored(STORAGE_KEYS.multiAddEnabled, isBoolean)) ??
    CONFIG.enableMultiAdd;
  onStoredChange(STORAGE_KEYS.multiAddEnabled, isBoolean, (value) => {
    enabled = value ?? CONFIG.enableMultiAdd;
  });
};

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
  void writeStored(STORAGE_KEYS.multiAddEnabled, value);
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
  unsafeWindow.wishlistSearchMultiAdd = (value?: boolean): boolean => {
    if (typeof value === 'boolean') setMultiAddEnabled(value);
    return isMultiAddEnabled();
  };
};
