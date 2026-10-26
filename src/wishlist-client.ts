import { ADD_TO_LIST_PATH, CONFIG, REMOVE_FROM_LIST_PATH } from './config';
import type { AddParams, Outcome, RemoveParams } from './types';
import {
  buildAddBody,
  buildListPagePath,
  buildListViewPath,
  buildRemoveBody,
  classifyAddResponse,
  classifyRemoveResponse,
  extractCsrfToken,
  findListItemId,
  type ResponseInput,
} from './wishlist-api';

/**
 * Network layer for the wishlist endpoints.
 *
 * Three things live here that the rest of the feature shouldn't have to think
 * about: requests are serialized, the anti-CSRF token is cached and rotated,
 * and every request is bounded by a timeout.
 *
 * Like `wishlist-api`, this module never touches `document` — the page token is
 * supplied by a caller-provided reader, which keeps it testable with nothing
 * more than a stubbed `fetch`.
 *
 * @category Wishlist API
 */

/** Reads the anti-CSRF token off the page. Supplied by `page-params.ts`. */
export type PageTokenReader = () => string | null;

/**
 * The freshest token we've seen, harvested from the last response.
 *
 * We bypass Amazon's confirmation modal, which is what would normally install
 * the rotated token back into the page — so without this cache every request
 * after the first would send a stale one.
 */
let cachedToken: string | null = null;

/** Runs a task once every task queued before it has settled. */
type Enqueue = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Create a serialized request queue.
 *
 * Serialized rather than parallel because the token rotates: two requests in
 * flight with the same token race each other, and a burst of identical XHRs is
 * also the shape most likely to trip Amazon's throttling. The cost is invisible
 * because the row's badge flips to pending the instant the click lands.
 *
 * @returns A function that queues a task and resolves with its result.
 * @example
 * const enqueue = createQueue();
 * await enqueue(() => sendRequest()); // waits for any in-flight request first
 * @source src/wishlist-client.ts
 */
const createQueue = (): Enqueue => {
  // Tail of the chain; every task waits on the one before it.
  let tail: Promise<unknown> = Promise.resolve();
  return async <T>(task: () => Promise<T>): Promise<T> => {
    const previous = tail;
    const run = (async (): Promise<T> => {
      try {
        await previous;
      } catch {
        // A failed predecessor must not wedge everything queued behind it.
      }
      return task();
    })();
    tail = run;
    return run;
  };
};

/** Adds and removes. */
const enqueue = createQueue();

/**
 * Pages for the list index. Kept apart from `enqueue` so a background index
 * refresh (~10 pages) can never hold up an add the user just clicked.
 */
const enqueueIndex = createQueue();

/**
 * The token currently cached from the last response.
 *
 * @returns The cached token, or `null` if none has been seen yet.
 * @example
 * getCachedCsrfToken(); // 'hM+ltWh7WT2h…'
 * @source src/wishlist-client.ts
 */
export const getCachedCsrfToken = (): string | null => cachedToken;

/**
 * Replace the cached token. Passing `null` clears it, forcing the next request
 * to re-read from the page.
 *
 * @param token - The token to cache, or `null` to clear.
 * @returns Nothing.
 * @example
 * setCachedCsrfToken(null); // next request reads the page again
 * @source src/wishlist-client.ts
 */
export const setCachedCsrfToken = (token: string | null): void => {
  cachedToken = token;
};

/**
 * Issue one request with a timeout and normalize it into a `ResponseInput`.
 *
 * @param path - Origin-relative endpoint path.
 * @param init - Method, headers and body.
 * @returns The normalized response, or a `network` outcome if it never landed.
 */
const fetchWithTimeout = async (
  path: string,
  init: RequestInit,
): Promise<ResponseInput | Outcome> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    CONFIG.wishlistRequestTimeoutMs,
  );
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      mode: 'cors',
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      redirectedTo: response.redirected ? response.url : null,
      body: text,
    };
  } catch (err) {
    if (controller.signal.aborted) return { kind: 'network', message: 'timed out' };
    const message = err instanceof Error ? err.message : 'unknown error';
    return { kind: 'network', message };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Issue one POST to an add/remove endpoint.
 *
 * @param path - Origin-relative endpoint path.
 * @param body - URL-encoded request body.
 * @param token - Anti-CSRF token for the header.
 * @param accept - The `accept` header this endpoint expects.
 * @returns The normalized response, or a `network` outcome if it never landed.
 */
const send = async (
  path: string,
  body: string,
  token: string,
  accept: string,
): Promise<ResponseInput | Outcome> =>
  fetchWithTimeout(path, {
    method: 'POST',
    headers: {
      accept,
      'anti-csrftoken-a2z': token,
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
    },
    body,
  });

/**
 * Send a request, classify it, and retry once if the token was rejected.
 *
 * The retry exists because we can't tell from the outside whether Amazon's
 * token is single-use. Re-reading the page and trying again once is correct
 * either way, and is hard-capped so a persistent 403 can't loop.
 *
 * @param path - Origin-relative endpoint path.
 * @param body - URL-encoded request body.
 * @param accept - The `accept` header this endpoint expects.
 * @param classify - Endpoint-specific response classifier.
 * @param readPageToken - Reads a fresh token off the page.
 * @returns The classified outcome.
 */
const request = async (
  path: string,
  body: string,
  accept: string,
  classify: (input: ResponseInput) => Outcome,
  readPageToken: PageTokenReader,
): Promise<Outcome> => {
  let token = cachedToken ?? readPageToken();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!token) return { kind: 'csrf' };
    const result = await send(path, body, token, accept);
    if ('kind' in result) return result;

    // Every response carries a rotated token — success or not.
    const fresh = extractCsrfToken(result.body);
    if (fresh) cachedToken = fresh;

    const outcome = classify(result);
    if (outcome.kind !== 'csrf' || attempt === 1) return outcome;

    // Token rejected: drop the cache and try once more with a page-read one.
    cachedToken = null;
    token = readPageToken();
  }
  return { kind: 'csrf' };
};

/**
 * Add the current product to a wishlist.
 *
 * @param params - ASIN, vendor and target list.
 * @param readPageToken - Reads the anti-CSRF token off the page.
 * @returns The classified outcome; `success` carries the list name.
 * @example
 * await addToList({asin: 'B0B7T9Q524', vendorId: 'website.wishlist.detail.add',
 *   listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist'}, getCsrfToken);
 * // {kind: 'success', listName: 'Tools'}
 * @source src/wishlist-client.ts
 */
export const addToList = async (
  params: AddParams,
  readPageToken: PageTokenReader,
): Promise<Outcome> =>
  enqueue(() =>
    request(
      ADD_TO_LIST_PATH,
      buildAddBody(params),
      '*/*',
      classifyAddResponse,
      readPageToken,
    ),
  );

/**
 * Take the current product back off a wishlist.
 *
 * @param params - Session, list and item identifiers plus list-view state.
 * @param readPageToken - Reads the anti-CSRF token off the page.
 * @returns The classified outcome.
 * @example
 * await removeFromList(params, getCsrfToken); // {kind: 'success', listName: null}
 * @source src/wishlist-client.ts
 */
export const removeFromList = async (
  params: RemoveParams,
  readPageToken: PageTokenReader,
): Promise<Outcome> =>
  enqueue(() =>
    request(
      REMOVE_FROM_LIST_PATH,
      buildRemoveBody(params),
      'application/json, text/javascript, */*; q=0.01',
      classifyRemoveResponse,
      readPageToken,
    ),
  );

/**
 * Fetch one page of the "Add to List" popover's lists, for the list index.
 * Needs no anti-CSRF token, and runs on its own queue so it can't delay adds.
 *
 * @param token - The previous page's `paginationToken`, or `''` for the first page.
 * @param renderedSoFar - How many lists the earlier pages held.
 * @returns The raw response (see `readListPage`), or a `network` outcome.
 * @example
 * await fetchListPage('', 0); // {ok: true, status: 200, redirectedTo: null, body: '{"content":…}'}
 * @source src/wishlist-client.ts
 */
export const fetchListPage = async (
  token: string,
  renderedSoFar: number,
): Promise<ResponseInput | Outcome> =>
  enqueueIndex(() =>
    fetchWithTimeout(buildListPagePath(token, renderedSoFar), {
      method: 'GET',
      headers: {
        accept: '*/*',
        'x-requested-with': 'XMLHttpRequest',
      },
    }),
  );

/**
 * Look up the line-item ID a product has on a list, which the remove endpoint
 * needs and the add response doesn't return. Reads the list's own page, newest
 * first, so a just-added item is in the first rows.
 *
 * @param listExternalId - The list the product was added to.
 * @param itemExternalId - The product's `ASIN:<asin>|<marketplace>` ID.
 * @returns The line-item ID, or `null` if the page failed or doesn't list it.
 * @example
 * await lookupListItemId('16N7NU7YLAZSR', 'ASIN:B0C6PN5NZ8|ATVPDKIKX0DER'); // 'I35JPXTAYKYXN0'
 * @source src/wishlist-client.ts
 */
export const lookupListItemId = async (
  listExternalId: string,
  itemExternalId: string,
): Promise<string | null> => {
  const response = await fetchWithTimeout(buildListViewPath(listExternalId), {
    method: 'GET',
    headers: { accept: 'text/html' },
  });
  if ('kind' in response || !response.ok) return null;
  return findListItemId(response.body, itemExternalId);
};
