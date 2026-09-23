import { CONFIG, STORAGE_KEYS } from './config';
import { isBoolean, onStoredChange, readStored, writeStored } from './storage';

/**
 * Runtime state for the "Previously selected" feature: whether it's shown at
 * all, and whether the group is collapsed.
 *
 * The two differ in lifetime. `enabled` is a preference — a value saved from the
 * popover controls or console (GM storage) supersedes the `CONFIG` default and
 * survives refreshes. `collapsed` lasts only for one popover open, so it comes
 * from `CONFIG` alone and never reaches storage.
 *
 * Both are cached in module variables so the render path doesn't touch
 * storage on every popover open.
 */
let enabled: boolean = CONFIG.enableFrequentLists;
// Collapsed state is deliberately *not* stored: see `resetFrequentCollapsed`.
let collapsed: boolean = CONFIG.collapseFrequentLists;

// Notified whenever `enabled` changes, locally or from another tab.
const enabledListeners = new Set<(value: boolean) => void>();
const notifyEnabled = (): void => {
  for (const listener of enabledListeners) listener(enabled);
};

/**
 * Load the stored feature flag into the cache and keep it in sync with other
 * tabs.
 *
 * @returns Resolves once the stored value (if any) is cached.
 * @example
 * await loadFrequentState();
 * isFrequentEnabled(); // false, if it was switched off
 * @source src/frequent-state.ts
 */
export const loadFrequentState = async (): Promise<void> => {
  enabled =
    (await readStored(STORAGE_KEYS.frequentEnabled, isBoolean)) ??
    CONFIG.enableFrequentLists;
  onStoredChange(STORAGE_KEYS.frequentEnabled, isBoolean, (value) => {
    enabled = value ?? CONFIG.enableFrequentLists;
    notifyEnabled();
  });
};

export const isFrequentEnabled = (): boolean => enabled;

/** Set and persist the feature flag; survives page refreshes. */
export const setFrequentEnabled = (value: boolean): boolean => {
  enabled = value;
  void writeStored(STORAGE_KEYS.frequentEnabled, value);
  notifyEnabled();
  return enabled;
};

/**
 * Run `listener` whenever the feature flag changes — from this tab's controls,
 * the console, the menu command, or another tab.
 *
 * @param listener - Receives the new state.
 * @returns Nothing.
 * @example
 * onFrequentEnabledChange((on) => log.debug(`frequent lists ${on ? 'on' : 'off'}`));
 * @source src/frequent-state.ts
 */
export const onFrequentEnabledChange = (listener: (value: boolean) => void): void => {
  enabledListeners.add(listener);
};

/**
 * Whether the group is collapsed to just its label.
 *
 * Collapsed by default: with several remembered lists the group is tall enough
 * to push the search box below the fold, which defeats the point of the search
 * box being there.
 *
 * @returns `true` when only the label should show.
 * @example
 * isFrequentCollapsed(); // true
 * @source src/frequent-state.ts
 */
export const isFrequentCollapsed = (): boolean => collapsed;

/**
 * Set the collapsed state for the current popover open.
 *
 * Unlike the feature flag this is not persisted — see `resetFrequentCollapsed`.
 *
 * @param value - `true` to collapse to the label, `false` to expand.
 * @returns The new state.
 * @example
 * setFrequentCollapsed(false); // false — the group is expanded
 * @source src/frequent-state.ts
 */
export const setFrequentCollapsed = (value: boolean): boolean => {
  collapsed = value;
  return collapsed;
};

/**
 * Restore the default collapsed state. Called once per popover open, so an
 * expansion lasts only for the open it was made in.
 *
 * Expanding is a "let me look at the group right now" action rather than a
 * preference — carried over, it would leave the group filling the popover and
 * the search box pushed down on every later open.
 *
 * @returns The restored state — `CONFIG.collapseFrequentLists`.
 * @example
 * resetFrequentCollapsed(); // true — back to just the label
 * @source src/frequent-state.ts
 */
export const resetFrequentCollapsed = (): boolean => {
  collapsed = CONFIG.collapseFrequentLists;
  return collapsed;
};
