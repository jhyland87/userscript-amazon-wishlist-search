import { CONFIG, PAGE_SELECTORS, SELECTORS } from './config';
import type { ListTarget } from './types';
import {
  listIdFromAnchorId,
  parseListTarget,
  parseProductTitle,
  parseStateField,
} from './wishlist-api';

/**
 * Readers for the values Amazon's wishlist endpoints need, scraped from the
 * product page.
 *
 * Every reader returns `null` rather than throwing when its element is missing.
 * That's deliberate: Amazon reshuffles product-page markup constantly, and a
 * missing value should downgrade the feature (fall back to Amazon's own modal,
 * or hide the undo affordance) rather than break the popover.
 *
 * @category Wishlist API
 */

/**
 * Read a trimmed, non-empty value from an `<input>` matched by a selector.
 *
 * @param selector - CSS selector for the input.
 * @returns The value, or `null` if the element is absent, not an input, or blank.
 */
const readInputValue = (selector: string): string | null => {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLInputElement)) return null;
  const value = element.value.trim();
  return value === '' ? null : value;
};

/**
 * Read the text content of the first element matching a selector.
 *
 * @param selector - CSS selector for the element.
 * @returns The trimmed text, or `null` if absent or blank.
 */
const readText = (selector: string): string | null => {
  const text = document.querySelector(selector)?.textContent?.trim();
  return text ? text : null;
};

/**
 * The ASIN of the product being viewed.
 *
 * @returns The ASIN, or `null` if the page doesn't expose one.
 * @example
 * getAsin(); // 'B0B7T9Q524'
 * @source src/page-params.ts
 */
export const getAsin = (): string | null =>
  readInputValue(PAGE_SELECTORS.asin) ?? readInputValue(PAGE_SELECTORS.asinAny);

/**
 * The anti-CSRF token the wishlist endpoints require.
 *
 * @returns The token, or `null` if the page carries none.
 * @example
 * getCsrfToken(); // 'hKdFt7/M7VBQinyhYTcPykX3989hanw133p59e6ubrSmAAAAAG…'
 * @source src/page-params.ts
 */
export const getCsrfToken = (): string | null =>
  readInputValue(PAGE_SELECTORS.csrfToken) ??
  readInputValue(PAGE_SELECTORS.csrfTokenRufus) ??
  readInputValue(PAGE_SELECTORS.csrfTokenAny);

/**
 * The vendor ID the add endpoint attributes the request to.
 *
 * Unlike the other readers this never returns `null` — the script only runs on
 * product pages, so falling back to the known constant is far better than
 * abandoning the add because one state blob got renamed.
 *
 * @returns The page's vendor ID, or `CONFIG.defaultVendorId`.
 * @example
 * getVendorId(); // 'website.wishlist.detail.add'
 * @source src/page-params.ts
 */
export const getVendorId = (): string =>
  parseStateField(readText(PAGE_SELECTORS.wishlistDpState), 'vendorId') ??
  CONFIG.defaultVendorId;

/**
 * Amazon's page-level session ID, required by the remove endpoint.
 *
 * @returns The session ID, or `null` if the global isn't set.
 * @example
 * getSessionId(); // '131-8483265-0913921'
 * @source src/page-params.ts
 */
export const getSessionId = (): string | null => window.ue_sid ?? null;

/**
 * The marketplace ID, which forms the second half of an item's external ID.
 *
 * @returns The marketplace ID, or `null` if the global isn't set.
 * @example
 * getMerchantId(); // 'ATVPDKIKX0DER'
 * @source src/page-params.ts
 */
export const getMerchantId = (): string | null => window.ue?.mid ?? null;

/**
 * The product title the remove endpoint echoes back in its confirmation.
 *
 * @returns The title, or `null` if neither source is readable.
 * @example
 * getItemTitle(); // 'Lab Vibrator - Dental Laboratory Equipment…'
 * @source src/page-params.ts
 */
export const getItemTitle = (): string | null =>
  parseProductTitle(readText(PAGE_SELECTORS.productState)) ??
  readText(PAGE_SELECTORS.productTitle);

/**
 * The wishlist line-item ID for the current product.
 *
 * This is the one parameter with no fallback, and the remove endpoint is built
 * around it — so when it's missing we hide the undo affordance rather than
 * offer a button we know will fail.
 *
 * @returns The item ID, or `null` if the page doesn't expose one.
 * @example
 * getListItemId(); // 'I1R2KHG1Z40Z6C'
 * @source src/page-params.ts
 */
export const getListItemId = (): string | null =>
  readInputValue(PAGE_SELECTORS.listItemId);

/**
 * Which list a popover row points at.
 *
 * Prefers the row's declarative JSON payload, which carries the list type as
 * well; falls back to the anchor's id, which encodes the same external ID.
 *
 * @param anchor - The row's `atwl-link-to-list-*` anchor.
 * @returns The list target, or `null` if neither source is readable.
 * @example
 * getRowTarget(anchor); // {listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist'}
 * @source src/page-params.ts
 */
export const getRowTarget = (anchor: Element): ListTarget | null => {
  const declarative = anchor.querySelector(SELECTORS.listItemDeclarative);
  if (declarative instanceof HTMLElement) {
    const target = parseListTarget(declarative.dataset.atwlDd);
    if (target) return target;
  }
  const listExternalId = listIdFromAnchorId(anchor.id);
  return listExternalId ? { listExternalId, listType: 'wishlist' } : null;
};
