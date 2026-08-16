import type { RowStatus } from './types';

/**
 * The per-row status badge shown in the "Add to List" popover.
 *
 * One badge per `<li>`, reflecting where that list's add request got to. The
 * styling (including the ✓→↩ hover swap) lives in `styles.ts`; this module only
 * owns the element and its attributes.
 *
 * The state is mirrored onto `li.dataset.wishlistAdd` so the click interceptor
 * can read a row's state without reaching into the badge, and so a rebuilt
 * popover starts clean automatically — the dataset dies with the node.
 */

const STATUS_CLASS = 'wishlist-add-status';
const CTRLS_CLASS = 'wishlist-freq-ctrls';

/** Options controlling how a badge behaves once the add has landed. */
export interface RowStatusOptions {
  /** Whether the ✓ should offer an undo. Requires a resolvable item ID. */
  readonly undoable: boolean;
}

/**
 * Find (or create) a row's badge.
 *
 * Inserted *before* the frequent-group controls when those exist, because the
 * stylesheet uses a sibling selector to shift them clear of the badge.
 *
 * @param li - The popover row.
 * @returns The row's badge element.
 */
const ensureBadge = (li: HTMLElement): HTMLSpanElement => {
  const existing = li.querySelector(`:scope > .${STATUS_CLASS}`);
  if (existing instanceof HTMLSpanElement) return existing;

  const badge = document.createElement('span');
  badge.className = STATUS_CLASS;
  const controls = li.querySelector(`:scope > .${CTRLS_CLASS}`);
  li.insertBefore(badge, controls);
  return badge;
};

/**
 * Set a row's badge state.
 *
 * @param li - The popover row.
 * @param state - Which state to show.
 * @param title - Tooltip and accessible label for the badge.
 * @param options - Whether an added row should offer undo.
 * @returns Nothing.
 * @example
 * setRowStatus(li, 'added', 'Added to Tools', {undoable: true});
 * @source src/row-status.ts
 */
export const setRowStatus = (
  li: HTMLElement,
  state: RowStatus,
  title: string,
  options: RowStatusOptions = { undoable: false },
): void => {
  const badge = ensureBadge(li);
  const undoable = state === 'added' && options.undoable;
  const interactive = undoable || state === 'failed';

  badge.dataset.state = state;
  if (undoable) {
    badge.dataset.undo = 'true';
  } else {
    delete badge.dataset.undo;
  }
  badge.title = title;
  badge.setAttribute('role', interactive ? 'button' : 'img');
  badge.setAttribute('aria-label', title);
  li.dataset.wishlistAdd = state;
};

/**
 * Read a row's current badge state.
 *
 * @param li - The popover row.
 * @returns The state, or `null` if the row has no badge.
 * @example
 * getRowStatus(li); // 'added'
 * @source src/row-status.ts
 */
export const getRowStatus = (li: HTMLElement): RowStatus | null => {
  const state = li.dataset.wishlistAdd;
  if (state === 'pending' || state === 'added' || state === 'failed') {
    return state;
  }
  return null;
};

/**
 * Remove a row's badge, returning it to its untouched state.
 *
 * @param li - The popover row.
 * @returns Nothing.
 * @example
 * clearRowStatus(li); // the row is clickable again, with no badge
 * @source src/row-status.ts
 */
export const clearRowStatus = (li: HTMLElement): void => {
  li.querySelector(`:scope > .${STATUS_CLASS}`)?.remove();
  delete li.dataset.wishlistAdd;
};
