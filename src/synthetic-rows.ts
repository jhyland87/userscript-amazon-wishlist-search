import { SELECTORS } from './config';
import { el, findScrollParent, getListItems, getListUl, getPopover, isListLoading } from './dom';
import { clearRowStatus, getRowStatus, setRowStatus } from './row-status';
import type { IndexedList } from './types';
import { listIdFromAnchorId } from './wishlist-api';

/**
 * Rows for lists that are in the list index but that Amazon hasn't paged into
 * the popover yet.
 *
 * A synthetic row uses the same markup as a real one (anchor id, declarative
 * payload, name span), so `getRowTarget`, highlighting and the status badge
 * all work on it unchanged. Amazon attaches no handlers to it, though, so the
 * add interceptor claims every click on one, and anything Amazon itself has to
 * do goes through the real row (see `revealRealRow`).
 *
 * @category Search
 */

/** Dataset key marking a row we built. */
const SYNTHETIC_KEY = 'wishlistSynthetic';
/** How often to check whether Amazon has paged in the row we're waiting for. */
const REVEAL_POLL_MS = 250;
/** Give up waiting after this long; paging in ~230 lists takes about 8 s. */
const REVEAL_TIMEOUT_MS = 20000;

/**
 * Whether a row is one we built from the index.
 *
 * @param li - A popover row.
 * @returns `true` for a synthetic row.
 * @example
 * isSyntheticRow(li); // false — Amazon rendered this one
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const isSyntheticRow = (li: HTMLElement): boolean => li.dataset[SYNTHETIC_KEY] === 'true';

/**
 * The external ID of the list a row points at, read from its anchor's id.
 *
 * @param li - A popover row.
 * @returns The list's external ID, or `null` for a row with no list anchor.
 * @example
 * getRowListId(li); // 'AP4XJQR1ZOMM'
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const getRowListId = (li: Element): string | null => {
  const anchor = li.querySelector(SELECTORS.listItemLink);
  return anchor ? listIdFromAnchorId(anchor.id) : null;
};

/**
 * Build a row for an indexed list, in the markup Amazon uses for its own.
 *
 * @param list - The indexed list.
 * @returns A detached `<li>`.
 * @example
 * buildSyntheticRow({listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist',
 *   name: 'Tools', privacy: 'Private'});
 * // <li class="a-dropdown-item" data-wishlist-synthetic="true">…</li>
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const buildSyntheticRow = (list: IndexedList): HTMLLIElement => {
  const id = list.listExternalId;
  const details = el(
    'div',
    { className: 'a-fixed-left-grid-col a-col-right', style: { paddingLeft: '4%', float: 'left' } },
    el('span', {
      id: `atwl-list-name-${id}`,
      className: 'a-size-small atwl-hz-dd-list-name a-nowrap',
      text: list.name,
    }),
  );
  if (list.privacy) {
    details.append(
      el('span', {
        id: `atwl-list-privacy-${id}`,
        className:
          'a-size-mini a-color-secondary atwl-hz-popover-secondary atwl-hz-dd-list-privacy',
        text: list.privacy,
      }),
    );
  }
  // An empty left column keeps the name aligned with real rows' images.
  const grid = el(
    'div',
    { className: 'a-fixed-left-grid' },
    el(
      'div',
      { className: 'a-fixed-left-grid-inner', style: { paddingLeft: '30px' } },
      el('div', {
        className: 'a-fixed-left-grid-col a-col-left',
        style: { width: '30px', marginLeft: '-30px', float: 'left' },
      }),
      details,
    ),
  );
  const declarative = el(
    'span',
    {
      className: 'a-declarative',
      attrs: {
        'data-action': 'atwl-dd',
        'data-atwl-dd': JSON.stringify({ listExternalId: id, listType: list.listType }),
      },
    },
    grid,
  );
  const anchor = el(
    'a',
    {
      id: `atwl-link-to-list-${id}`,
      className: 'a-link-normal a-dropdown-link atwl-option',
      attrs: { href: 'javascript:void(0)', role: 'button' },
    },
    declarative,
  );
  return el(
    'li',
    { className: 'a-dropdown-item', dataset: { [SYNTHETIC_KEY]: 'true' } },
    el('span', { className: 'a-list-item' }, anchor),
  );
};

/**
 * Add a synthetic row to the list, ahead of Amazon's spinner row if it has one.
 *
 * @param li - The row to insert.
 * @returns Nothing.
 * @example
 * insertSyntheticRow(buildSyntheticRow(list));
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const insertSyntheticRow = (li: HTMLElement): void => {
  const ul = getListUl();
  if (!ul) return;
  const spinner = ul.querySelector(':scope > .lists-addtolist-scroll-spinner-element');
  ul.insertBefore(li, spinner);
};

/**
 * Every synthetic row in the popover.
 *
 * @returns The rows, in DOM order.
 * @example
 * getSyntheticRows().length; // 3
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const getSyntheticRows = (): HTMLElement[] => getListItems().filter(isSyntheticRow);

/**
 * Remove synthetic rows that carry no add status. Rows mid-add (or added, or
 * failed) stay, so their badge isn't lost.
 *
 * @returns Nothing.
 * @example
 * removeIdleSyntheticRows();
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const removeIdleSyntheticRows = (): void => {
  for (const li of getSyntheticRows()) {
    if (getRowStatus(li) === null) li.remove();
  }
};

/**
 * The real (Amazon-rendered) row for a list, if Amazon has paged it in.
 *
 * @param listId - The list's external ID.
 * @returns The row, or `null`.
 * @example
 * findRealRow('AP4XJQR1ZOMM'); // <li class="a-dropdown-item">…</li>
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const findRealRow = (listId: string): HTMLElement | null =>
  getListItems().find((li) => !isSyntheticRow(li) && getRowListId(li) === listId) ?? null;

/**
 * Replace each synthetic row whose real row has now arrived, carrying its badge
 * over so an add in flight (or done) still shows on the row that remains.
 *
 * @returns How many synthetic rows were replaced.
 * @example
 * reconcileSyntheticRows(); // 1
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const reconcileSyntheticRows = (): number => {
  let replaced = 0;
  for (const synthetic of getSyntheticRows()) {
    const listId = getRowListId(synthetic);
    const real = listId ? findRealRow(listId) : null;
    if (!real) continue;
    const state = getRowStatus(synthetic);
    const badge = synthetic.querySelector<HTMLElement>(`:scope > ${SELECTORS.addStatus}`);
    if (state && !getRowStatus(real)) {
      setRowStatus(real, state, badge?.title ?? '', {
        undoable: badge?.dataset.undo === 'true',
      });
    }
    synthetic.remove();
    replaced++;
  }
  return replaced;
};

/** Bring Amazon's spinner row into view, which is what makes it load the next page. */
const nudgePaging = (): void => {
  const spinner = getPopover()?.querySelector<HTMLElement>(
    '.lists-addtolist-scroll-spinner-element',
  );
  const scroller = spinner ? findScrollParent(spinner) : null;
  if (!spinner || !scroller) return;
  scroller.scrollTop = spinner.offsetTop;
};

/**
 * Wait for Amazon to page a list's real row into the popover, scrolling its
 * spinner into view to keep the pages coming.
 *
 * @param listId - The list's external ID.
 * @returns The real row, or `null` if every page loaded (or the wait timed
 *   out) without it.
 * @example
 * await revealRealRow('AP4XJQR1ZOMM'); // <li class="a-dropdown-item">…</li>
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const revealRealRow = async (listId: string): Promise<HTMLElement | null> => {
  const deadline = Date.now() + REVEAL_TIMEOUT_MS;
  for (;;) {
    const real = findRealRow(listId);
    if (real) return real;
    if (!isListLoading() || Date.now() >= deadline) return null;
    nudgePaging();
    await new Promise((resolve) => setTimeout(resolve, REVEAL_POLL_MS));
  }
};

/**
 * Drop a list's synthetic row, badge and all — used once its real row has
 * taken over.
 *
 * @param listId - The list's external ID.
 * @returns Nothing.
 * @example
 * removeSyntheticRow('AP4XJQR1ZOMM');
 * @category Search
 * @group Synthetic Rows
 * @source src/synthetic-rows.ts
 */
export const removeSyntheticRow = (listId: string): void => {
  for (const li of getSyntheticRows()) {
    if (getRowListId(li) !== listId) continue;
    clearRowStatus(li);
    li.remove();
  }
};
