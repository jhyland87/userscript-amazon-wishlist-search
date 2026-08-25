import { SELECTORS } from './config';
import { isDebugEnabled, setDebugEnabled } from './debug-state';
import {
  getListItems,
  getListUl,
  getPopover,
  getPopoverInner,
  getSearchInput,
  isListOpen,
} from './dom';
import { log } from './log';
import { isMultiAddEnabled } from './multi-add-state';
import {
  getAsin,
  getCsrfToken,
  getListItemId,
  getMerchantId,
  getSessionId,
  getVendorId,
} from './page-params';
import { getSearchDebugState } from './search';
import { getCachedCsrfToken } from './wishlist-client';

/**
 * Snapshot of every selector the injection pipeline depends on. Probes both
 * the scoped helpers (which require the `:has()` popover to match) and the
 * raw selectors document-wide, so a structural change on Amazon's side is
 * obvious: e.g. `popoverFound: false` but `popoverInnerCountGlobal: 1` means
 * the `:has(#atwl-popover-inner)` parent selector no longer matches.
 */
export const debugSnapshot = (): Record<string, unknown> => {
  const popover = getPopover();
  return {
    scriptLoaded: true,
    popoverFound: !!popover,
    popoverAriaHidden: popover?.getAttribute('aria-hidden') ?? null,
    isListOpen: isListOpen(),
    popoverInnerFound: !!getPopoverInner(),
    listUlFound: !!getListUl(),
    listItemCount: getListItems().length,
    searchInputPresent: !!getSearchInput(),
    // What the running search (if any) last did — see `search.ts`.
    search: getSearchDebugState(),
    addToListBtnFound: !!document.querySelector(SELECTORS.addToListBtn),
    // Raw, document-wide selector counts (independent of the :has scope).
    popoverCountGlobal: document.querySelectorAll(SELECTORS.popover).length,
    popoverInnerCountGlobal: document.querySelectorAll(SELECTORS.popoverInner).length,
    listUlCountGlobal: document.querySelectorAll(SELECTORS.listUl).length,
    listItemCountGlobal: document.querySelectorAll(SELECTORS.listItem).length,
    // Adding in place depends on several page-level values, any of which can
    // vanish when Amazon reshuffles the product page. `itemIdFound: false` is
    // specifically why a row would show a ✓ with no undo arrow.
    multiAddEnabled: isMultiAddEnabled(),
    csrfTokenFound: !!getCsrfToken(),
    asinFound: !!getAsin(),
    vendorId: getVendorId(),
    sessionIdFound: !!getSessionId(),
    merchantIdFound: !!getMerchantId(),
    itemIdFound: !!getListItemId(),
    cachedCsrfToken: !!getCachedCsrfToken(),
  };
};

/**
 * Expose `window.wishlistSearchDebug()` for console use. It is always
 * installed (regardless of the current debug state) so debug logging can be
 * switched on from the console even when it starts off.
 *
 *   wishlistSearchDebug(true)   enable debug logging (persists across refresh)
 *   wishlistSearchDebug(false)  disable debug logging (persists)
 *   wishlistSearchDebug()       leave the flag as-is; just print a snapshot
 *
 * Every call returns a selector/state snapshot so it doubles as the
 * "what's matching right now?" diagnostic.
 */
export const installDebugControls = (): void => {
  window.wishlistSearchDebug = (value?: boolean): Record<string, unknown> => {
    if (typeof value === 'boolean') {
      setDebugEnabled(value);
      log.log(`debug ${value ? 'enabled' : 'disabled'} — saved, persists across refreshes`);
    }
    log.log(`debug is currently ${isDebugEnabled() ? 'on' : 'off'}`);
    const snapshot = debugSnapshot();
    log.log('selector/state snapshot:', snapshot);
    log.log('selectors in use:', SELECTORS);
    return snapshot;
  };
};
