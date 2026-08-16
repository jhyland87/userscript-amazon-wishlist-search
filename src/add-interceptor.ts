import { SELECTORS } from './config';
import { getListItemName } from './dom';
import { recordSelection, unrecordSelection } from './frequencies';
import { log } from './log';
import { isMultiAddEnabled } from './multi-add-state';
import {
  getAsin,
  getCsrfToken,
  getItemTitle,
  getListItemId,
  getMerchantId,
  getRowTarget,
  getSessionId,
  getVendorId,
} from './page-params';
import { clearRowStatus, getRowStatus, setRowStatus } from './row-status';
import type { AddParams, ListTarget, RemoveParams } from './types';
import { describeOutcome, toRemoveListType } from './wishlist-api';
import {
  addToList,
  getCachedCsrfToken,
  removeFromList,
} from './wishlist-client';

/**
 * Adding to several lists without the popover closing.
 *
 * Amazon wires each row's anchor to forward its click to an inner declarative
 * span, which opens a confirmation modal and closes the popover:
 *
 * ```js
 * b.addEventListener('click', function (b) {
 *   b = b.currentTarget.querySelector('span[data-action="atwl-dd"]');
 *   null !== b && b.click();
 * });
 * ```
 *
 * Both that listener and the declarative framework's document-level handler are
 * bubble-phase, so a **capture-phase** listener on the popover sees the click
 * first. Stopping propagation there means the anchor's listener never runs, the
 * inner span is never clicked, and the modal never opens — leaving us free to
 * issue the request ourselves and keep the popover open.
 *
 * Every path that can't complete the request returns *without* stopping the
 * event, so Amazon's own behaviour still finishes the job.
 */

/**
 * List-view state the remove endpoint expects. These describe a wishlist page
 * we're not on, so they're sent as the values Amazon's own page sends.
 */
const REMOVE_SORT = 'date-added';
const REMOVE_FILTER = 'unpurchased';

/**
 * Gather everything the add endpoint needs.
 *
 * @param anchor - The clicked row's anchor.
 * @returns The parameters, or `null` if any required value is unreadable.
 */
const collectAddParams = (anchor: Element): AddParams | null => {
  const asin = getAsin();
  const target = getRowTarget(anchor);
  const missing: string[] = [];
  if (!asin) missing.push('asin');
  // A token rotated in by an earlier response counts — the page's own input
  // isn't the only source.
  if (!getCsrfToken() && !getCachedCsrfToken()) missing.push('csrfToken');
  if (!target) missing.push('listTarget');
  if (!asin || !target || missing.length > 0) {
    log.debug('add-interceptor: falling back to Amazon, missing', missing);
    return null;
  }
  return {
    asin,
    vendorId: getVendorId(),
    listExternalId: target.listExternalId,
    listType: target.listType,
  };
};

/**
 * Gather everything the remove endpoint needs.
 *
 * @param target - The list the row points at.
 * @returns The parameters, or `null` if any required value is unreadable.
 */
const collectRemoveParams = (target: ListTarget): RemoveParams | null => {
  const sid = getSessionId();
  const asin = getAsin();
  const merchantId = getMerchantId();
  const itemId = getListItemId();
  if (!sid || !asin || !merchantId || !itemId) {
    log.debug('add-interceptor: cannot undo', {
      sid: Boolean(sid),
      asin: Boolean(asin),
      merchantId: Boolean(merchantId),
      itemId: Boolean(itemId),
    });
    return null;
  }
  return {
    sid,
    listExternalId: target.listExternalId,
    itemTitle: getItemTitle() ?? '',
    itemExternalId: `ASIN:${asin}|${merchantId}`,
    itemId,
    listType: toRemoveListType(target.listType),
    sort: REMOVE_SORT,
    filter: REMOVE_FILTER,
  };
};

/**
 * Hand the click back to Amazon by re-dispatching it with a passthrough marker
 * the interceptor honours, so the modal opens exactly as it normally would.
 *
 * @param li - The popover row.
 * @returns Nothing.
 */
const fallbackToAmazon = (li: HTMLElement): void => {
  const anchor = li.querySelector(SELECTORS.listItemLink);
  if (!(anchor instanceof HTMLElement)) return;
  clearRowStatus(li);
  anchor.dataset.nativeAdd = 'true';
  anchor.click();
};

/**
 * Add the product to one list and reflect the result on the row.
 *
 * @param li - The popover row.
 * @param anchor - The row's anchor.
 * @param params - The add parameters.
 * @returns Nothing; resolves once the badge has settled.
 */
const runAdd = async (
  li: HTMLElement,
  anchor: Element,
  params: AddParams,
): Promise<void> => {
  const rowName = getListItemName(li);
  setRowStatus(li, 'pending', rowName ? `Adding to ${rowName}…` : 'Adding…');

  const outcome = await addToList(params, getCsrfToken);
  if (outcome.kind !== 'success') {
    log.warn('add-interceptor: add failed', outcome);
    setRowStatus(li, 'failed', describeOutcome(outcome));
    return;
  }

  const name = outcome.listName ?? rowName;
  if (name) recordSelection(name);

  // Undo needs a line-item ID; without one the check stays inert rather than
  // offering a button that would fail.
  const undoable = getListItemId() !== null;
  const added = name ? `Added to ${name}` : 'Added';
  setRowStatus(li, 'added', undoable ? `${added} — click to undo` : added, {
    undoable,
  });
  log.debug('add-interceptor: added', { name, undoable, anchorId: anchor.id });
};

/**
 * Take the product back off a list and clear the row's badge.
 *
 * @param li - The popover row.
 * @param anchor - The row's anchor.
 * @returns Nothing; resolves once the badge has settled.
 */
const runUndo = async (li: HTMLElement, anchor: Element): Promise<void> => {
  const rowName = getListItemName(li);
  const restore = (title: string): void => {
    // The item is still on the list, so the check remains accurate — only the
    // tooltip changes, and clicking again retries.
    setRowStatus(li, 'added', title, { undoable: true });
  };

  const target = getRowTarget(anchor);
  const params = target ? collectRemoveParams(target) : null;
  if (!params) {
    restore('Undo unavailable — open the list to remove this item');
    return;
  }

  setRowStatus(li, 'pending', rowName ? `Removing from ${rowName}…` : 'Removing…');
  const outcome = await removeFromList(params, getCsrfToken);
  if (outcome.kind !== 'success') {
    log.warn('add-interceptor: undo failed', outcome);
    restore('Undo failed — click to try again');
    return;
  }

  const name = outcome.listName ?? rowName;
  if (name) unrecordSelection(name);
  clearRowStatus(li);
  log.debug('add-interceptor: undone', { name });
};

/**
 * Handle a click on a row's status badge: undo an add, or retry a failed one
 * through Amazon. Always swallows the click so it can't reach the row beneath.
 *
 * @param event - The click event.
 * @param badge - The badge that was clicked.
 * @returns Nothing.
 */
const handleBadgeClick = (event: Event, badge: Element): void => {
  event.preventDefault();
  event.stopImmediatePropagation();

  const li = badge.closest<HTMLElement>(SELECTORS.listItem);
  if (!li) return;

  const state = getRowStatus(li);
  if (state === 'failed') {
    fallbackToAmazon(li);
    return;
  }
  if (state !== 'added') return;

  const anchor = li.querySelector(SELECTORS.listItemLink);
  // Re-checked here as well as at render time, so an item ID that disappears
  // between the two can't produce a request we already know will fail.
  if (!anchor || getListItemId() === null) return;
  void runUndo(li, anchor);
};

/**
 * The capture-phase click handler. Ordered as a series of early returns so the
 * happy path stays at the base indentation.
 *
 * @param event - The click event.
 * @returns Nothing.
 */
const handleClick = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const badge = target.closest(SELECTORS.addStatus);
  if (badge) {
    handleBadgeClick(event, badge);
    return;
  }

  // The frequent-group controls sit outside the anchor and rely on bubble-phase
  // stopPropagation of their own. `closest` below already misses them, but the
  // guard is explicit so a markup change can't turn "remove" into "add".
  if (target.closest('.wishlist-freq-ctrl')) return;

  const anchor = target.closest(SELECTORS.listItemLink);
  if (!anchor) return;

  if (anchor instanceof HTMLElement && anchor.dataset.nativeAdd) {
    // Our own re-dispatch — let it through to Amazon exactly once.
    delete anchor.dataset.nativeAdd;
    return;
  }

  if (!isMultiAddEnabled()) return;

  const li = anchor.closest<HTMLElement>(SELECTORS.listItem);
  if (!li) return;

  const state = getRowStatus(li);
  if (state === 'pending' || state === 'added') {
    // Swallow rather than ignore, so a re-click can't leak to Amazon and add a
    // duplicate behind our back.
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const params = collectAddParams(anchor);
  if (!params) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  void runAdd(li, anchor, params);
};

/**
 * Intercept row clicks within a popover so items are added in place.
 *
 * Registered in the capture phase and guarded by a dataset marker, exactly like
 * `attachSelectionTracker` — the marker dies with the node, so Amazon rebuilding
 * the popover (on a variant change, say) re-attaches cleanly.
 *
 * The root is a parameter rather than hardcoded so the listener can be moved to
 * `document` in one line if Amazon ever registers a capture handler of its own.
 *
 * @param root - The popover element to delegate from.
 * @returns Nothing.
 * @example
 * attachAddInterceptor(popover); // rows now add in place
 * @source src/add-interceptor.ts
 */
export const attachAddInterceptor = (root: HTMLElement): void => {
  if (root.dataset.addIntercepted === 'true') return;
  root.addEventListener('click', handleClick, true);
  root.dataset.addIntercepted = 'true';
};
