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
   * Default for verbose debug logging. Overridden at runtime by a value saved
   * from the console via `window.wishlistSearchDebug(true|false)`, which
   * persists across refreshes (see `debug-state.ts`).
   */
  readonly debug: boolean;
}

/** Persisted map of wishlist name -> number of times selected. */
export type FrequencyMap = Record<string, number>;

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
  }
}
