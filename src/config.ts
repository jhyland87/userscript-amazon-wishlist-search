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
  // Start the group collapsed, so a long group can't push the search box out of
  // view. Clicking the label expands it, and that choice persists.
  collapseFrequentLists: true,
  // Add the item in place on click (popover stays open) instead of letting
  // Amazon open its confirmation modal; `wishlistSearchMultiAdd()` overrides it.
  enableMultiAdd: true,
  // Abort an add/remove request after this long, so a hung request can't wedge
  // the serialized queue.
  wishlistRequestTimeoutMs: 10000,
  // Used when the page's `wishlistDPState` script can't be read.
  defaultVendorId: 'website.wishlist.detail.add',
  // Default verbose debug logging; `wishlistSearchDebug()` overrides it at runtime.
  debug: false,
};

/**
 * Amazon's wishlist endpoints.
 *
 * Intentionally origin-relative: the script runs on every Amazon TLD, so
 * hardcoding a host would send `.co.uk` users' requests to `.com`.
 */
export const ADD_TO_LIST_PATH = '/hz/wishlist/additemtolist';
export const REMOVE_FROM_LIST_PATH = '/hz/wishlist/removeitem';

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
  /** Runtime on/off flag for adding in place instead of via Amazon's modal. */
  multiAddEnabled: 'wishlist-search:multi-add-enabled',
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
  /** The clickable anchor inside a row; its id suffix is the list's external ID. */
  listItemLink: 'a.a-dropdown-link[id^="atwl-link-to-list-"]',
  /** The declarative span inside that anchor; carries the list's JSON payload. */
  listItemDeclarative: 'span.a-declarative[data-action="atwl-dd"]',
  /** Injected: the per-row add/undo status badge. */
  addStatus: '.wishlist-add-status',
  /**
   * Amazon's "active" highlight. It lands on whichever row the dropdown
   * considers current when the popover opens, which reads as though that list
   * is already selected — misleading, since nothing has been chosen yet.
   */
  activeItem: '.a-active',
  /** The "Add to List" button — used as the alignment anchor for the popover. */
  addToListBtn: '#add-to-wishlist-button',
  /** Injected: the search input. */
  searchInput: '#wishlist-search',
  /** Injected: the wrapper around the search input (holds the regex toggle). */
  searchWrap: '#wishlist-search-wrap',
  /** Injected: the result-count notice. */
  resultCount: '#wishlist-search-result-count',
} as const;

/**
 * Page-scoped selectors for the values Amazon's add/remove endpoints need.
 *
 * Unlike `SELECTORS` these live on the product page itself, not inside the
 * popover — they're queried from `document`, and every one of them is treated
 * as optional (see `page-params.ts`), because a missing value degrades the
 * feature rather than breaking the page.
 */
export const PAGE_SELECTORS = {
  /** The ASIN of the product being viewed. */
  asin: '#ASIN',
  /** Fallback for the ASIN when the id above isn't present. */
  asinAny: 'input[name="ASIN"]',
  /**
   * The anti-CSRF token the wishlist endpoints check. This is the same element
   * the add response returns a replacement for, which is how the token rotates.
   */
  csrfToken: 'input[id="lists-sp-csrf-form-token"]',
  /** Fallback: the token the Rufus sidebar carries. */
  csrfTokenRufus:
    '#rufusInlineCsrfTokenContainer > input[name="anti-csrftoken-a2z"]',
  /** Last resort: any anti-CSRF input on the page. */
  csrfTokenAny: 'input[name="anti-csrftoken-a2z"]',
  /** JSON blob carrying the `vendorId` the add endpoint expects. */
  wishlistDpState: 'script[type="a-state"][data-a-state*="wishlistDPState"]',
  /** JSON blob carrying the product title the remove endpoint expects. */
  productState: 'script[data-a-state*="turbo-checkout-product-state"]',
  /** Fallback for the product title. */
  productTitle: '#productTitle',
  /** The wishlist line-item ID; without it we can't offer undo. */
  listItemId: '#sourceCustomerOrgListItemID',
} as const;

/** Marker attribute recording which popover we've already injected into. */
export const INJECTED_ATTR = 'data-wishlist-search-injected';
