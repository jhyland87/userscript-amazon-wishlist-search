import { SELECTORS } from './config';

/**
 * DOM helpers — always re-resolve against the live popover, since Amazon
 * rebuilds it whenever a product variant is selected.
 */

export const getPopover = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(SELECTORS.popover);

export const getPopoverInner = (): HTMLElement | null =>
  getPopover()?.querySelector<HTMLElement>(SELECTORS.popoverInner) ?? null;

export const getListUl = (): HTMLUListElement | null =>
  getPopover()?.querySelector<HTMLUListElement>(SELECTORS.listUl) ?? null;

export const getListItems = (): HTMLElement[] => {
  const popover = getPopover();
  if (!popover) return [];
  return Array.from(popover.querySelectorAll<HTMLElement>(SELECTORS.listItem));
};

export const getSearchInput = (): HTMLInputElement | null =>
  getPopover()?.querySelector<HTMLInputElement>(SELECTORS.searchInput) ?? null;

export const getResultCount = (): HTMLElement | null =>
  getPopover()?.querySelector<HTMLElement>(SELECTORS.resultCount) ?? null;

/** The list-name `<span>` inside a list `<li>` (used to read/highlight it). */
export const getListItemNameSpan = (item: Element): HTMLElement | null =>
  item.querySelector<HTMLElement>(SELECTORS.listItemName);

/** Read the trimmed wishlist name out of a list `<li>`. */
export const getListItemName = (item: Element): string | null =>
  getListItemNameSpan(item)?.textContent?.trim() ?? null;

/**
 * "Open" means the popover exists *and* Amazon has marked it visible.
 * Used for ESC handling and search execution — not for injection.
 */
export const isListOpen = (): boolean => {
  const popover = getPopover();
  return !!popover && popover.getAttribute('aria-hidden') === 'false';
};
