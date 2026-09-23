import { GM_addElement } from 'vite-plugin-monkey/dist/client';
import { SELECTORS } from './config';
import { normalizeName } from './name-match';
import type { ElementProps } from './types';

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

export const getSearchWrap = (): HTMLElement | null =>
  getPopover()?.querySelector<HTMLElement>(SELECTORS.searchWrap) ?? null;

export const getResultCount = (): HTMLElement | null =>
  getPopover()?.querySelector<HTMLElement>(SELECTORS.resultCount) ?? null;

/** The list-name `<span>` inside a list `<li>` (used to read/highlight it). */
export const getListItemNameSpan = (item: Element): HTMLElement | null =>
  item.querySelector<HTMLElement>(SELECTORS.listItemName);

/**
 * Read the wishlist name out of a list `<li>`, whitespace-normalized so it
 * reads the way the row renders (see `name-match.ts`).
 */
export const getListItemName = (item: Element): string | null => {
  const text = getListItemNameSpan(item)?.textContent;
  return text == null ? null : normalizeName(text);
};

/**
 * "Open" means the popover exists *and* Amazon has marked it visible.
 * Used for ESC handling and search execution — not for injection.
 */
export const isListOpen = (): boolean => {
  const popover = getPopover();
  return !!popover && popover.getAttribute('aria-hidden') === 'false';
};

/**
 * Create an element, set its properties and listeners, and append children —
 * the one-call replacement for `createElement` + assignments + `appendChild`.
 *
 * Created with `GM_addElement`, which sets the id, class, title and `attrs`.
 * It's given a detached fragment as its parent, since with no parent the
 * manager would append to the live page before the caller positions it.
 *
 * @param tag - The tag to create.
 * @param props - Id, class, text, attributes, styles and listeners to set.
 * @param children - Nodes or strings to append, in order.
 * @returns The new, still-detached element.
 * @example
 * el('span', { className: 'badge', attrs: { role: 'button' } }, 'Hi');
 * // <span class="badge" role="button">Hi</span>
 * @category DOM
 * @group Builders
 * @source src/dom.ts
 */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] => {
  const node = GM_addElement(document.createDocumentFragment(), tag, {
    ...(props.id !== undefined && { id: props.id }),
    ...(props.className !== undefined && { class: props.className }),
    ...(props.title !== undefined && { title: props.title }),
    ...props.attrs,
  });
  // Text, styles and listeners stay plain DOM calls: GM_addElement only takes
  // attributes, and `textContent` support there differs between managers.
  if (props.text !== undefined) node.textContent = props.text;
  if (props.style) Object.assign(node.style, props.style);
  Object.assign(node.dataset, props.dataset);
  for (const [type, listener] of Object.entries(props.on ?? {})) {
    node.addEventListener(type, listener);
  }
  node.append(...children);
  return node;
};
