// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFixture } from './fixtures';
import { emitRemoteChange, gmStore, resetGm } from './gm-stub';
import { mountPage, seedListIndex } from './popover-fixture';

const INDEX_KEY = 'wishlist-search:list-index';
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_PATH = '/hz/wishlist/addtolist/atlpaginate';

const firstPage = readFixture('atlpaginate-first.json');
const middlePage = readFixture('atlpaginate-middle.json');
const lastPage = readFixture('atlpaginate-last.json');

/** A minimal stand-in for the parts of `Response` the client reads. */
const response = (body: string, init: { ok?: boolean; status?: number } = {}): unknown => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  redirected: false,
  url: '',
  text: async (): Promise<string> => body,
});

/** Answer each page request with the fixture its token points at. */
const servePages = async (url: string): Promise<unknown> => {
  if (url.includes('FIXTURE-TOKEN-2')) return response(lastPage);
  if (url.includes('FIXTURE-TOKEN-1')) return response(middlePage);
  return response(firstPage);
};
const fixturePages = vi.fn(servePages);

const FIXTURE_NAMES = [
  'Books',
  'Tools & Hardware',
  'Alexa Shopping List',
  'Shared Gifts',
  'Public Ideas',
  'Garden',
];

/** Fresh module state per test — the index lives in module variables. */
const loadIndex = async () => {
  vi.resetModules();
  const index = await import('../src/wishlist-index');
  await index.loadListIndex();
  return index;
};

const fetchedUrls = (): unknown[] => fixturePages.mock.calls.map(([url]) => url);

beforeEach(() => {
  resetGm();
  fixturePages.mockReset();
  fixturePages.mockImplementation(servePages);
  vi.stubGlobal('fetch', fixturePages);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseListRows', () => {
  it('reads every list on a recorded page and skips the spinner row', async () => {
    const { parseListRows } = await import('../src/wishlist-index');
    const { content } = JSON.parse(firstPage) as { content: string };

    expect(parseListRows(content)).toEqual([
      {
        list: { listExternalId: 'FIXTURELIST1', listType: 'wishlist', name: 'Books', privacy: 'Private' },
        customerId: 'ACUSTOMER0000',
      },
      {
        list: {
          listExternalId: 'FIXTURELIST2',
          listType: 'wishlist',
          name: 'Tools & Hardware',
          privacy: 'Private',
        },
        customerId: 'ACUSTOMER0000',
      },
      {
        list: {
          listExternalId: 'FIXTURELIST3',
          listType: 'alexa',
          name: 'Alexa Shopping List',
          privacy: 'Private',
        },
        customerId: 'ACUSTOMER0000',
      },
    ]);
  });

  it.for([
    ['middle', middlePage, ['Shared', 'Public']],
    ['last', lastPage, ['Private']],
  ] as const)('reads the privacy label on the %s page', async ([, page, labels]) => {
    const { parseListRows } = await import('../src/wishlist-index');
    const { content } = JSON.parse(page) as { content: string };
    expect(parseListRows(content).map((row) => row.list.privacy)).toEqual(labels);
  });

  it('skips a row whose payload is unreadable', async () => {
    const { parseListRows } = await import('../src/wishlist-index');
    const html =
      '<li class="a-dropdown-item"><a class="a-dropdown-link" id="atwl-link-to-list-X">' +
      '<span class="a-declarative" data-action="atwl-dd" data-atwl-dd="not json">' +
      '<span id="atwl-list-name-X">Broken</span></span></a></li>';
    expect(parseListRows(html)).toEqual([]);
  });
});

describe('refreshListIndex', () => {
  it('follows the pagination tokens until Amazon sends an empty one', async () => {
    const index = await loadIndex();

    expect(await index.refreshListIndex()).toBe(true);

    expect(fetchedUrls()).toEqual([
      PAGE_PATH,
      `${PAGE_PATH}?paginationToken=FIXTURE-TOKEN-1&listsRenderedSoFar=3&isMobile=false`,
      `${PAGE_PATH}?paginationToken=FIXTURE-TOKEN-2&listsRenderedSoFar=5&isMobile=false`,
    ]);
    expect(index.getIndexedLists().map((list) => list.name)).toEqual(FIXTURE_NAMES);
    expect(index.isListIndexFresh()).toBe(true);
  });

  it('caches the index in GM storage under the current host', async () => {
    const index = await loadIndex();
    await index.refreshListIndex();

    const stored = gmStore.get(INDEX_KEY) as Record<string, { customerId: string; lists: unknown[] }>;
    expect(stored[location.host]?.customerId).toBe('ACUSTOMER0000');
    expect(stored[location.host]?.lists).toHaveLength(FIXTURE_NAMES.length);

    // A fresh page load reads it back without fetching.
    fixturePages.mockClear();
    const reloaded = await loadIndex();
    expect(reloaded.getIndexedLists()).toHaveLength(FIXTURE_NAMES.length);
    expect(fixturePages).not.toHaveBeenCalled();
  });

  it('shares one fetch between concurrent refreshes', async () => {
    const index = await loadIndex();
    await Promise.all([index.refreshListIndex(), index.refreshListIndex()]);
    expect(fixturePages).toHaveBeenCalledTimes(3);
  });

  it('gives up on a token that never ends', async () => {
    fixturePages.mockImplementation(async () => response(middlePage));
    const index = await loadIndex();

    expect(await index.refreshListIndex()).toBe(false);
    expect(fixturePages).toHaveBeenCalledTimes(100);
    expect(index.getIndexedLists()).toEqual([]);
  });

  it.for([
    ['Amazon flags an error', async () => response('{"content":"","hasError":true}')],
    ['the body is not JSON', async () => response('<html>sign in</html>')],
    ['the request fails', async () => response('', { ok: false, status: 503 })],
    [
      'the network is down',
      async () => {
        throw new Error('offline');
      },
    ],
  ] as const)('keeps the previous index when %s', async ([, failure]) => {
    seedListIndex(['Old List'], { fetchedAt: Date.now() - 2 * DAY_MS });
    const index = await loadIndex();
    fixturePages.mockImplementationOnce(async () => response(firstPage));
    fixturePages.mockImplementationOnce(failure);

    expect(await index.refreshListIndex()).toBe(false);

    expect(index.getIndexedLists().map((list) => list.name)).toEqual(['Old List']);
    expect(index.isListIndexFresh()).toBe(false);
  });
});

describe('freshness', () => {
  it.for([
    ['an hour', 60 * 60 * 1000, true],
    ['just over a day', DAY_MS + 1, false],
  ] as const)('an index fetched %s ago is fresh: %s', async ([, age, fresh]) => {
    seedListIndex(['Books'], { fetchedAt: Date.now() - age });
    const index = await loadIndex();
    expect(index.isListIndexFresh()).toBe(fresh);
    // An expired index still feeds search results.
    expect(index.getIndexedLists()).toHaveLength(1);
  });

  it('only refetches when the index is not fresh', async () => {
    seedListIndex(['Books']);
    const index = await loadIndex();
    expect(await index.refreshListIndexIfStale()).toBe(false);
    expect(fixturePages).not.toHaveBeenCalled();

    index.markListIndexStale();
    expect(index.isListIndexFresh()).toBe(false);
    expect(await index.refreshListIndexIfStale()).toBe(true);
    expect(index.isListIndexFresh()).toBe(true);
  });

  it('ignores an index that belongs to a different account', async () => {
    seedListIndex(['Books'], { customerId: 'AOTHERACCOUNT' });
    mountPage(['Tools']);
    document
      .querySelector('[data-action="atwl-dd"]')
      ?.setAttribute(
        'data-atwl-dd',
        JSON.stringify({ listExternalId: 'LTools', listType: 'wishlist', customerId: 'ACUSTOMER0000' }),
      );
    const index = await loadIndex();

    expect(index.getIndexedLists()).toEqual([]);
    expect(index.isListIndexFresh()).toBe(false);
  });

  it('picks up an index another tab fetched', async () => {
    const index = await loadIndex();
    emitRemoteChange(INDEX_KEY, {
      [location.host]: { fetchedAt: Date.now(), customerId: null, lists: [] },
    });
    expect(index.isListIndexFresh()).toBe(true);
  });
});
