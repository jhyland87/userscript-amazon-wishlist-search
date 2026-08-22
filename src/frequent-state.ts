import { CONFIG, STORAGE_KEYS } from './config';

/**
 * Runtime state for the "Previously selected" feature: whether it's shown at
 * all, and whether the group is collapsed.
 *
 * The two differ in lifetime. `enabled` is a preference — a value saved from the
 * popover controls or console (localStorage) supersedes the `CONFIG` default and
 * survives refreshes. `collapsed` lasts only for one popover open, so it comes
 * from `CONFIG` alone and never reaches storage.
 *
 * Both are cached in module variables so the render path doesn't touch
 * localStorage on every popover open.
 */
const readStoredFlag = (key: string): boolean | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
};

const writeStoredFlag = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
};

// A stored value supersedes the compiled-in default.
let enabled: boolean =
  readStoredFlag(STORAGE_KEYS.frequentEnabled) ?? CONFIG.enableFrequentLists;
// Collapsed state is deliberately *not* stored: see `resetFrequentCollapsed`.
let collapsed: boolean = CONFIG.collapseFrequentLists;

export const isFrequentEnabled = (): boolean => enabled;

/** Set and persist the feature flag; survives page refreshes. */
export const setFrequentEnabled = (value: boolean): boolean => {
  enabled = value;
  writeStoredFlag(STORAGE_KEYS.frequentEnabled, value);
  return enabled;
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
