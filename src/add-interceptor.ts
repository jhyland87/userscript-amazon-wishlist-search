import { SELECTORS } from './config';
import { getListItemName } from './dom';
import { recordSelection, unrecordSelection } from './frequencies';
import { log } from './log';
import { isMultiAddEnabled } from './multi-add-state';
import {
  getAsin,
  getCsrfToken,
  getItemTitle,
  getMerchantId,
  getRowTarget,
  getSessionId,
  getVendorId,
} from './page-params';
import { clearRowStatus, getRowStatus, setRowStatus } from './row-status';
import {
  getRowListId,
  isSyntheticRow,
  removeSyntheticRow,
  revealRealRow,
} from './synthetic-rows';
import type { AddParams, ListTarget, RemoveParams } from './types';
import { describeOutcome, toRemoveListType } from './wishlist-api';
import {
  addToList,
  getCachedCsrfToken,
  lookupListItemId,
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
 * The product's ID as lists know it, e.g. `ASIN:B0C6PN5NZ8|ATVPDKIKX0DER`.
 *
 * @returns The ID, or `null` if the ASIN or marketplace can't be read.
 */
const getItemExternalId = (): string | null => {
  const asin = getAsin();
  const merchantId = getMerchantId();
  return asin && merchantId ? `ASIN:${asin}|${merchantId}` : null;
};

/**
 * Whether the page exposes what an undo needs before it looks anything up.
 * The line-item ID isn't on the page; it's read from the list at undo time.
 *
 * @returns `true` when the session and item IDs are readable.
 */
const canUndo = (): boolean => getSessionId() !== null && getItemExternalId() !== null;

/**
 * Gather everything the remove endpoint needs, looking up the line-item ID
 * the product was given on this list.
 *
 * @param target - The list the row points at.
 * @returns The parameters, or `null` if any required value is unreadable.
 */
const collectRemoveParams = async (target: ListTarget): Promise<RemoveParams | null> => {
  const sid = getSessionId();
  const itemExternalId = getItemExternalId();
  if (!sid || !itemExternalId) {
    log.debug('add-interceptor: cannot undo', {
      sid: Boolean(sid),
      itemExternalId: Boolean(itemExternalId),
    });
    return null;
  }
  const itemId = await lookupListItemId(target.listExternalId, itemExternalId);
  if (!itemId) {
    log.debug('add-interceptor: cannot undo, item not found on the list', {
      listExternalId: target.listExternalId,
      itemExternalId,
    });
    return null;
  }
  return {
    sid,
    listExternalId: target.listExternalId,
    itemTitle: getItemTitle() ?? '',
    itemExternalId,
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
  if (isSyntheticRow(li)) {
    void addViaRealRow(li);
    return;
  }
  const anchor = li.querySelector(SELECTORS.listItemLink);
  if (!(anchor instanceof HTMLElement)) return;
  clearRowStatus(li);
  anchor.dataset.nativeAdd = 'true';
  anchor.click();
};

/**
 * Hand a synthetic row's add to Amazon. Amazon has no handlers on our row, so
 * this waits for it to page in the real one and re-dispatches the click there.
 *
 * @param li - The synthetic row.
 * @returns Nothing; resolves once the click is handed over or given up on.
 */
const addViaRealRow = async (li: HTMLElement): Promise<void> => {
  const listId = getRowListId(li);
  if (!listId) return;
  setRowStatus(li, 'pending', 'Waiting for Amazon to load this list…');

  const real = await revealRealRow(listId);
  if (!real) {
    log.warn('add-interceptor: the real row never loaded', { listId });
    if (li.isConnected) {
      setRowStatus(li, 'failed', "Amazon didn't load this list — click to try again");
    }
    return;
  }
  // The observer may already have swapped the synthetic row out; either way
  // only the real row should be left.
  removeSyntheticRow(listId);
  fallbackToAmazon(real);
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

  // Without a session or item ID the check stays inert rather than offering a
  // button that would fail.
  const undoable = canUndo();
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

  setRowStatus(li, 'pending', rowName ? `Removing from ${rowName}…` : 'Removing…');
  const target = getRowTarget(anchor);
  const params = target ? await collectRemoveParams(target) : null;
  if (!params) {
    restore('Undo unavailable — open the list to remove this item');
    return;
  }

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
  // Re-checked here as well as at render time, so a page value that disappears
  // between the two can't produce a request we already know will fail.
  if (!anchor || !canUndo()) return;
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

  const li = anchor.closest<HTMLElement>(SELECTORS.listItem);
  if (!li) return;

  // Amazon has no handlers on a row we built, so every click on one is ours.
  const synthetic = isSyntheticRow(li);
  if (synthetic) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  if (!isMultiAddEnabled()) {
    if (synthetic) void addViaRealRow(li);
    return;
  }

  const state = getRowStatus(li);
  if (state === 'pending' || state === 'added') {
    // Swallow rather than ignore, so a re-click can't leak to Amazon and add a
    // duplicate behind our back.
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const params = collectAddParams(anchor);
  if (!params) {
    if (synthetic) void addViaRealRow(li);
    return;
  }

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
