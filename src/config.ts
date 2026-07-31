import type { WishlistSearchConfig } from './types';

/** User-tunable behaviour. */
export const CONFIG: WishlistSearchConfig = {
  // Debounce (ms) before a search runs after a keystroke.
  searchDelayMs: 500,
  // Delay (ms) before focusing the input (waits for the popover to show).
  searchFocusDelayMs: 200,
  // Max results shown at once; set to `false` to remove the cap.
  maxSearchResults: 10,
  // Minimum characters typed before a search runs.
  minSearchInput: 0,
  // Default regex mode; the in-input toggle overrides it (`true`/`'enable'` → on).
  regexSearches: 'delimiters',
  // Show the "Previously selected" group by default; the label toggle overrides it.
  enableFrequentLists: true,
  // Number of lists shown in the "Previously selected" group.
  frequentListsCount: 5,
  // Default verbose debug logging; `wishlistSearchDebug()` overrides it at runtime.
  debug: false,
};

/** Centralized localStorage keys, so every persisted value has one home. */
export const STORAGE_KEYS = {
  /** Map of wishlist name -> selection count. */
  frequencies: 'wishlist-search:frequent-lists',
  /** Names the user blocked from the "Previously selected" group. */
  frequentDisabled: 'wishlist-search:frequent-disabled',
  /** Runtime on/off flag for the "Previously selected" feature. */
  frequentEnabled: 'wishlist-search:frequent-enabled',
  /** Runtime on/off flag for regex search mode. */
  regexEnabled: 'wishlist-search:regex-enabled',
  /** Runtime debug-logging flag. */
  debug: 'wishlist-search:debug',
} as const;

/**
 * Selectors.
 *
 * The wishlist popover is rebuilt by Amazon whenever a variant is selected,
 * so we always re-query rather than caching nodes.
 *
 * We locate the popover via its unique child `#atwl-popover-inner` (not via
 * `aria-hidden="false"`) so injection can happen *before* the popover is
 * shown. Injecting after Amazon has measured and positioned the popover
 * would change its height and trigger repositioning — on narrow viewports
 * that causes the popover to flip to a different anchor point.
 */
export const SELECTORS = {
  /** The popover root — found via its unique inner content. */
  popover:
    'div.a-popover.a-popover-no-header.a-arrow-bottom:has(#atwl-popover-inner)',
  /** Container for the dropdown list. */
  popoverInner: '#atwl-popover-inner',
  /** The <ul> holding wishlist <li> items. */
  listUl: '#atwl-dd-ul',
  /** Each wishlist row. */
  listItem: 'li.a-dropdown-item',
  /** The list-name span inside a row (used to read the wishlist title). */
  listItemName: '[id^="atwl-list-name-"]',
  /** The "Add to List" button — used as the alignment anchor for the popover. */
  addToListBtn: '#add-to-wishlist-button',
  /** Injected: the search input. */
  searchInput: '#wishlist-search',
  /** Injected: the wrapper around the search input (holds the regex toggle). */
  searchWrap: '#wishlist-search-wrap',
  /** Injected: the result-count notice. */
  resultCount: '#wishlist-search-result-count',
} as const;

/** Marker attribute recording which popover we've already injected into. */
export const INJECTED_ATTR = 'data-wishlist-search-injected';
