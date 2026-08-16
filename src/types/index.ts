/**
 * How regex searching is interpreted from the user's input.
 *   - 'delimiters': treat `/pattern/flags` as a regex, plain text otherwise
 *   - 'enable' | true: always treat input as a regex source
 *   - 'disable' | false: never treat input as a regex
 */
export type RegexSearchMode = 'delimiters' | 'enable' | 'disable' | boolean;

/** User-tunable behaviour for the wishlist search feature. */
export interface WishlistSearchConfig {
  /** Debounce delay before running a search after keyup. */
  readonly searchDelayMs: number;
  /** Delay before focusing the input (needs to wait for the popover). */
  readonly searchFocusDelayMs: number;
  /** Max items shown; set to a non-number to disable the cap. */
  readonly maxSearchResults: number | false;
  /** Minimum chars before searching. */
  readonly minSearchInput: number;
  /**
   * Default for regex search mode. Overridden at runtime by the toggle inside
   * the search input (`true`/`'enable'` → on, otherwise off); the choice is
   * saved to localStorage. See `regex-state.ts`.
   */
  readonly regexSearches: RegexSearchMode;
  /** Show a "Previously selected" group at the top of the list. */
  readonly enableFrequentLists: boolean;
  /** Number of frequent lists to show in that group. */
  readonly frequentListsCount: number;
  /**
   * Default collapsed state for that group. Overridden at runtime by clicking
   * the group's label, which persists the choice (see `frequent-state.ts`).
   */
  readonly collapseFrequentLists: boolean;
  /**
   * Default for adding the item in place (popover stays open, row gets a
   * check) instead of letting Amazon's confirmation modal take over.
   * Overridden at runtime by `window.wishlistSearchMultiAdd(true|false)`,
   * which persists across refreshes (see `multi-add-state.ts`).
   */
  readonly enableMultiAdd: boolean;
  /** Abort an add/remove request after this many milliseconds. */
  readonly wishlistRequestTimeoutMs: number;
  /** `vendorId` to send when the page's `wishlistDPState` can't be read. */
  readonly defaultVendorId: string;
  /**
   * Default for verbose debug logging. Overridden at runtime by a value saved
   * from the console via `window.wishlistSearchDebug(true|false)`, which
   * persists across refreshes (see `debug-state.ts`).
   */
  readonly debug: boolean;
}

/** Persisted map of wishlist name -> number of times selected. */
export type FrequencyMap = Record<string, number>;

/**
 * Which list a popover row points at, read from the row's declarative payload.
 *
 * @category Wishlist API
 */
export interface ListTarget {
  /** Amazon's external ID for the list, e.g. `AP4XJQR1ZOMM`. */
  readonly listExternalId: string;
  /** Amazon's list-type discriminator, e.g. `wishlist`. */
  readonly listType: string;
}

/**
 * Everything `/hz/wishlist/additemtolist` needs in its request body.
 *
 * @category Wishlist API
 */
export interface AddParams {
  readonly asin: string;
  readonly vendorId: string;
  readonly listExternalId: string;
  readonly listType: string;
}

/**
 * Everything `/hz/wishlist/removeitem` needs in its request body.
 *
 * `itemId` is nullable because it comes from a page element that isn't always
 * present; when it's missing the undo affordance is hidden rather than offered
 * and left to fail.
 *
 * @category Wishlist API
 */
export interface RemoveParams {
  readonly sid: string;
  readonly listExternalId: string;
  readonly itemTitle: string;
  readonly itemExternalId: string;
  readonly itemId: string | null;
  readonly listType: string;
  readonly sort: string;
  readonly filter: string;
}

/**
 * The result of an add or remove request, classified into cases the UI can act
 * on. Fields are `| null` rather than optional because the project compiles
 * with `exactOptionalPropertyTypes`.
 *
 * @category Wishlist API
 */
export type Outcome =
  | { readonly kind: 'success'; readonly listName: string | null }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'csrf' }
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'unrecognized' }
  | { readonly kind: 'network'; readonly message: string };

/** Visual state of a row's status badge. */
export type RowStatus = 'pending' | 'added' | 'failed';

/** Inline style patch applied to an injected node. */
export type StylePatch = Partial<CSSStyleDeclaration>;

/** Console methods the logger supports. */
export type LogMethod = 'log' | 'warn' | 'error' | 'debug';

/** A prefixing log function — same call signature as `console.log`. */
export type LogFn = (...args: unknown[]) => void;

/** The logger object: one prefixing function per supported console method. */
export type Logger = Record<LogMethod, LogFn>;

declare global {
  interface Window {
    /** Exposed when `enableFrequentLists` is on; clears the frequency map. */
    clearWishlistHistory?: () => void;
    /**
     * Toggle the "Previously selected" feature (persists across refreshes).
     * Pass a boolean to enable/disable; called with no argument it just
     * returns the current state. Mirrors the popover's inline controls.
     */
    wishlistSearchFrequent?: (value?: boolean) => boolean;
    /**
     * Console helper (always installed). Pass a boolean to enable/disable
     * debug logging (persisted across refreshes); returns a selector/state
     * snapshot. Called with no argument it just prints the snapshot.
     */
    wishlistSearchDebug?: (value?: boolean) => Record<string, unknown>;
    /**
     * Toggle adding in place (persists across refreshes). Pass a boolean to
     * enable/disable; called with no argument it just returns the current
     * state. Disabling restores Amazon's own confirmation modal.
     */
    wishlistSearchMultiAdd?: (value?: boolean) => boolean;
    /** Amazon's page-level session ID; read for the remove endpoint. */
    ue_sid?: string;
    /** Amazon's UE globals; `mid` is the marketplace ID. */
    ue?: { mid?: string };
  }
}
