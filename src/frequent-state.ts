import { CONFIG, STORAGE_KEYS } from './config';

/**
 * Runtime state for the "Previously selected" feature: whether it's shown at
 * all, and whether the group is collapsed.
 *
 * Each flag's effective value is, in priority order:
 *   1. a value the user saved from the popover controls or console (localStorage)
 *   2. the matching `CONFIG` default
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

// Stored values supersede the compiled-in defaults.
let enabled: boolean =
  readStoredFlag(STORAGE_KEYS.frequentEnabled) ?? CONFIG.enableFrequentLists;
let collapsed: boolean =
  readStoredFlag(STORAGE_KEYS.frequentCollapsed) ?? CONFIG.collapseFrequentLists;

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
 * Set and persist the collapsed state; survives page refreshes.
 *
 * @param value - `true` to collapse to the label, `false` to expand.
 * @returns The new state.
 * @example
 * setFrequentCollapsed(false); // false — the group is expanded
 * @source src/frequent-state.ts
 */
export const setFrequentCollapsed = (value: boolean): boolean => {
  collapsed = value;
  writeStoredFlag(STORAGE_KEYS.frequentCollapsed, value);
  return collapsed;
};
