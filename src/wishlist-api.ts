import type {
  AddParams,
  ListTarget,
  Outcome,
  RemoveParams,
} from './types';

/**
 * The wire protocol for Amazon's add/remove wishlist endpoints: request bodies
 * in, classified outcomes out.
 *
 * Deliberately free of any DOM access — every function here takes and returns
 * plain values, which is what makes the protocol unit-testable in the project's
 * Node test environment (there is no jsdom). Anything that needs `document`
 * lives in `page-params.ts`.
 *
 * Responses are matched on **element IDs, never on copy**. "1 item added to" is
 * localized and this script runs on every Amazon TLD, so matching the text
 * would silently break outside `.com`.
 *
 * @category Wishlist API
 */

/** Marks a successful add — the confirmation fragment's outer container. */
const ADD_SUCCESS_MARKER = 'id="huc-atwl-inner"';

/** Signals Amazon bounced us to a login page instead of doing the work. */
const SIGN_IN_MARKERS = ['id="ap_email"', 'name="appActionToken"'];

const CSRF_INPUT_PATTERN = /<input\b[^>]*\bname="anti-csrftoken-a2z"[^>]*>/i;
const VALUE_ATTR_PATTERN = /\bvalue="([^"]*)"/i;
const LIST_LINK_PATTERN =
  /<a\b[^>]*\bid="huc-list-link"[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i;
const ANCHOR_ID_PREFIX = 'atwl-link-to-list-';

/** Raw response data, in the shape `wishlist-client` can always produce. */
export interface ResponseInput {
  /** Whether the HTTP status was 2xx. */
  readonly ok: boolean;
  /** The HTTP status code. */
  readonly status: number;
  /** The final URL when the request was redirected, else `null`. */
  readonly redirectedTo: string | null;
  /** The response body as text. */
  readonly body: string;
}

/**
 * Decode the handful of HTML entities Amazon emits inside list names.
 *
 * @param text - Raw text taken from an HTML fragment.
 * @returns The text with entities resolved.
 */
const decodeEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * Build the form body for `POST /hz/wishlist/additemtolist`.
 *
 * @param params - The ASIN, vendor and target list.
 * @returns A URL-encoded body string, keys in the order Amazon sends them.
 * @example
 * buildAddBody({asin: 'B0B7T9Q524', vendorId: 'website.wishlist.detail.add',
 *   listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist'})
 * // 'asin=B0B7T9Q524&vendorId=website.wishlist.detail.add&listExternalId=AP4XJQR1ZOMM&listType=wishlist&isAjax=1'
 * @source src/wishlist-api.ts
 */
export const buildAddBody = (params: AddParams): string =>
  new URLSearchParams({
    asin: params.asin,
    vendorId: params.vendorId,
    listExternalId: params.listExternalId,
    listType: params.listType,
    isAjax: '1',
  }).toString();

/**
 * Build the form body for `POST /hz/wishlist/removeitem`.
 *
 * `itemId` is omitted entirely when unknown rather than sent empty, so the
 * request is at least well-formed if Amazon can resolve the item without it.
 *
 * @param params - Session, list and item identifiers plus the list-view state.
 * @returns A URL-encoded body string, keys in the order Amazon sends them.
 * @example
 * buildRemoveBody({sid: '131-8483265', listExternalId: '1AUZ2Z7JLKX7V',
 *   itemTitle: 'Lab Vibrator', itemExternalId: 'ASIN:B072JVMBP3|ATVPDKIKX0DER',
 *   itemId: 'I1R2KHG1Z40Z6C', listType: 'WishList', sort: 'date-added',
 *   filter: 'unpurchased'})
 * // 'sid=131-8483265&listExternalId=1AUZ2Z7JLKX7V&itemTitle=Lab+Vibrator&…'
 * @source src/wishlist-api.ts
 */
export const buildRemoveBody = (params: RemoveParams): string => {
  const body = new URLSearchParams({
    sid: params.sid,
    listExternalId: params.listExternalId,
    itemTitle: params.itemTitle,
    itemExternalId: params.itemExternalId,
  });
  if (params.itemId) body.append('itemId', params.itemId);
  body.append('listType', params.listType);
  body.append('sort', params.sort);
  body.append('filter', params.filter);
  return body.toString();
};

/**
 * Translate a list type from the add endpoint's casing to the remove
 * endpoint's. The two disagree — the row's payload says `wishlist`, but
 * `removeitem` expects `WishList` — and anything else is passed through.
 *
 * @param listType - The list type as it appears in the row's payload.
 * @returns The list type in the casing `removeitem` expects.
 * @example
 * toRemoveListType('wishlist'); // 'WishList'
 * @source src/wishlist-api.ts
 */
export const toRemoveListType = (listType: string): string =>
  listType.toLowerCase() === 'wishlist' ? 'WishList' : listType;

/**
 * Parse a row's `data-atwl-dd` payload into the list it points at.
 *
 * Validates the shape rather than trusting `JSON.parse`, so a markup change
 * degrades to "no interception" instead of sending a malformed request.
 *
 * @param raw - The raw attribute value, or nullish if the attribute is absent.
 * @returns The list target, or `null` if it can't be read.
 * @example
 * parseListTarget('{"listExternalId":"AP4XJQR1ZOMM","listType":"wishlist"}');
 * // {listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist'}
 * @source src/wishlist-api.ts
 */
export const parseListTarget = (
  raw: string | null | undefined,
): ListTarget | null => {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  if (!('listExternalId' in parsed) || !('listType' in parsed)) return null;
  const { listExternalId, listType } = parsed;
  if (typeof listExternalId !== 'string' || listExternalId === '') return null;
  if (typeof listType !== 'string' || listType === '') return null;
  return { listExternalId, listType };
};

/**
 * Recover a list's external ID from its anchor element's id.
 *
 * The fallback for when `data-atwl-dd` can't be parsed — the id encodes the
 * same value, just without the list type.
 *
 * @param anchorId - The anchor's `id` attribute.
 * @returns The external ID, or `null` if the id isn't in the expected form.
 * @example
 * listIdFromAnchorId('atwl-link-to-list-AP4XJQR1ZOMM'); // 'AP4XJQR1ZOMM'
 * @source src/wishlist-api.ts
 */
export const listIdFromAnchorId = (anchorId: string): string | null => {
  if (!anchorId.startsWith(ANCHOR_ID_PREFIX)) return null;
  const id = anchorId.slice(ANCHOR_ID_PREFIX.length);
  return id === '' ? null : id;
};

/**
 * Read a named string field out of one of Amazon's `a-state` JSON blobs.
 *
 * @param raw - The script element's text content.
 * @param key - The field to pull out.
 * @returns The field's value, or `null` if absent or not a non-empty string.
 * @example
 * parseStateField('{"vendorId":"website.wishlist.detail.add"}', 'vendorId');
 * // 'website.wishlist.detail.add'
 * @source src/wishlist-api.ts
 */
export const parseStateField = (
  raw: string | null | undefined,
  key: string,
): string | null => {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  if (!(key in parsed)) return null;
  const value: unknown = Reflect.get(parsed, key);
  return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * Pull the product title out of the turbo-checkout state blob.
 *
 * @param raw - The script element's text content.
 * @returns The first line item's product title, or `null`.
 * @example
 * parseProductTitle('{"lineItemInputs":[{"productTitle":"Lab Vibrator"}]}');
 * // 'Lab Vibrator'
 * @source src/wishlist-api.ts
 */
export const parseProductTitle = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  if (!('lineItemInputs' in parsed)) return null;
  const { lineItemInputs } = parsed;
  if (!Array.isArray(lineItemInputs) || lineItemInputs.length === 0) return null;
  const first: unknown = lineItemInputs[0];
  if (typeof first !== 'object' || first === null) return null;
  if (!('productTitle' in first)) return null;
  const title: unknown = Reflect.get(first, 'productTitle');
  return typeof title === 'string' && title !== '' ? title : null;
};

/**
 * Extract the rotated anti-CSRF token Amazon returns with each response.
 *
 * We skip the modal that would normally install the new token, so harvesting
 * it here is the only way the next request gets a fresh one.
 *
 * @param html - The response body.
 * @returns The token, or `null` if the response carries none.
 * @example
 * extractCsrfToken('<input name="anti-csrftoken-a2z" value="hM+l==">'); // 'hM+l=='
 * @source src/wishlist-api.ts
 */
export const extractCsrfToken = (html: string): string | null => {
  const input = CSRF_INPUT_PATTERN.exec(html);
  if (!input) return null;
  const value = VALUE_ATTR_PATTERN.exec(input[0]);
  return value?.[1] ? value[1] : null;
};

/**
 * Read the list name out of an add-confirmation fragment, for the badge's
 * tooltip and the frequency record.
 *
 * @param html - The response body.
 * @returns The list name, or `null` if the fragment doesn't carry one.
 * @example
 * extractAddedListName('<a id="huc-list-link"><span>Tools</span></a>'); // 'Tools'
 * @source src/wishlist-api.ts
 */
export const extractAddedListName = (html: string): string | null => {
  const match = LIST_LINK_PATTERN.exec(html);
  if (!match?.[1]) return null;
  const name = decodeEntities(match[1]).trim();
  return name === '' ? null : name;
};

/**
 * Classify the failures both endpoints share, before either looks at its own
 * body format.
 *
 * @param input - The raw response.
 * @returns A failure outcome, or `null` when the response looks usable.
 */
const classifyTransport = (input: ResponseInput): Outcome | null => {
  const redirectedToSignIn =
    input.redirectedTo !== null && input.redirectedTo.includes('/ap/signin');
  const bodyIsSignIn = SIGN_IN_MARKERS.some((marker) =>
    input.body.includes(marker),
  );
  if (redirectedToSignIn || bodyIsSignIn) return { kind: 'signed-out' };
  if (input.ok) return null;
  // Amazon answers a stale or missing token with 400/403 rather than a body we
  // can read, so treat those as "token problem" and let the client retry once.
  if (input.status === 400 || input.status === 403) return { kind: 'csrf' };
  return { kind: 'http', status: input.status };
};

/**
 * Classify a response from `/hz/wishlist/additemtolist`.
 *
 * @param input - The raw response.
 * @returns The outcome; `success` carries the list name when readable.
 * @example
 * classifyAddResponse({ok: true, status: 200, redirectedTo: null,
 *   body: '<div id="huc-atwl-inner">…<a id="huc-list-link"><span>Tools</span></a>'});
 * // {kind: 'success', listName: 'Tools'}
 * @source src/wishlist-api.ts
 */
export const classifyAddResponse = (input: ResponseInput): Outcome => {
  const transport = classifyTransport(input);
  if (transport) return transport;
  if (!input.body.includes(ADD_SUCCESS_MARKER)) return { kind: 'unrecognized' };
  return { kind: 'success', listName: extractAddedListName(input.body) };
};

/**
 * Classify a response from `/hz/wishlist/removeitem`, which answers with JSON
 * rather than an HTML fragment.
 *
 * @param input - The raw response.
 * @returns The outcome; `success` carries the list name when Amazon sends one.
 * @example
 * classifyRemoveResponse({ok: true, status: 200, redirectedTo: null,
 *   body: '{"hasError":false,"alertType":"success","listName":null}'});
 * // {kind: 'success', listName: null}
 * @source src/wishlist-api.ts
 */
export const classifyRemoveResponse = (input: ResponseInput): Outcome => {
  const transport = classifyTransport(input);
  if (transport) return transport;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    return { kind: 'unrecognized' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { kind: 'unrecognized' };
  }
  const hasError: unknown = Reflect.get(parsed, 'hasError');
  const alertType: unknown = Reflect.get(parsed, 'alertType');
  if (hasError !== false || alertType !== 'success') {
    return { kind: 'unrecognized' };
  }
  const listName: unknown = Reflect.get(parsed, 'listName');
  return {
    kind: 'success',
    listName: typeof listName === 'string' && listName !== '' ? listName : null,
  };
};

/**
 * A short, user-facing explanation of an outcome, used as the failed badge's
 * tooltip.
 *
 * @param outcome - The classified outcome.
 * @returns A one-line description.
 * @example
 * describeOutcome({kind: 'http', status: 503});
 * // 'Amazon returned an error (503) — click to add via Amazon instead'
 * @source src/wishlist-api.ts
 */
export const describeOutcome = (outcome: Outcome): string => {
  const retry = ' — click to add via Amazon instead';
  switch (outcome.kind) {
    case 'success':
      return outcome.listName ? `Added to ${outcome.listName}` : 'Added';
    case 'signed-out':
      return `You appear to be signed out${retry}`;
    case 'csrf':
      return `Amazon rejected the security token${retry}`;
    case 'http':
      return `Amazon returned an error (${outcome.status})${retry}`;
    case 'network':
      return `Request failed: ${outcome.message}${retry}`;
    case 'unrecognized':
      return `Amazon's response wasn't understood${retry}`;
    default:
      return `Add failed${retry}`;
  }
};
