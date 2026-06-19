import type { WishlistSearchConfig } from './types';

/** User-tunable behaviour. */
export const CONFIG: WishlistSearchConfig = {
  searchDelayMs: 500,
  searchFocusDelayMs: 200,
  maxSearchResults: 10,
  minSearchInput: 0,
  regexSearches: 'delimiters',
  enableFrequentLists: true,
  frequentListsCount: 5,
  storageKey: 'wishlist-search:frequent-lists',
  debug: false,
};

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
  /** Injected: the result-count notice. */
  resultCount: '#wishlist-search-result-count',
} as const;

/** Marker attribute recording which popover we've already injected into. */
export const INJECTED_ATTR = 'data-wishlist-search-injected';
