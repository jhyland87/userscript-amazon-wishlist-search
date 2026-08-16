import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFixture } from './fixtures';
import type { AddParams, RemoveParams } from '../src/types';

const addSuccess = readFixture('add-success.html');
const removeSuccess = readFixture('remove-success.json');

const ADD_PARAMS: AddParams = {
  asin: 'B0B7T9Q524',
  vendorId: 'website.wishlist.detail.add',
  listExternalId: 'AP4XJQR1ZOMM',
  listType: 'wishlist',
};

const REMOVE_PARAMS: RemoveParams = {
  sid: '131-8483265-0913921',
  listExternalId: '1AUZ2Z7JLKX7V',
  itemTitle: 'Lab Vibrator',
  itemExternalId: 'ASIN:B072JVMBP3|ATVPDKIKX0DER',
  itemId: 'I1R2KHG1Z40Z6C',
  listType: 'WishList',
  sort: 'date-added',
  filter: 'unpurchased',
};

/** A minimal stand-in for the parts of `Response` the client reads. */
const response = (
  body: string,
  init: { ok?: boolean; status?: number; redirected?: boolean } = {},
): unknown => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  redirected: init.redirected ?? false,
  url: 'https://www.amazon.com/hz/wishlist/additemtolist',
  text: async (): Promise<string> => body,
});

/** The token the page is pretending to expose. */
const readPageToken = (): string | null => 'page-token';

/** Fresh module state per test — the client caches the token in a module var. */
const loadClient = async () => {
  vi.resetModules();
  return import('../src/wishlist-client');
};

/** Grab the init object the stub was called with on a given call. */
const initOf = (fetchMock: ReturnType<typeof vi.fn>, call: number): RequestInit => {
  const args: unknown[] = fetchMock.mock.calls[call] ?? [];
  const init: unknown = args[1];
  if (typeof init !== 'object' || init === null) throw new Error('no init');
  return init as RequestInit;
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('addToList', () => {
  it('posts to an origin-relative path so every Amazon TLD works', async () => {
    const fetchMock = vi.fn(async (_url: string) => response(addSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    await addToList(ADD_PARAMS, readPageToken);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/hz/wishlist/additemtolist');
  });

  it('sends the headers and body Amazon expects', async () => {
    const fetchMock = vi.fn(async () => response(addSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    await addToList(ADD_PARAMS, readPageToken);
    const init = initOf(fetchMock, 0);

    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({
      'anti-csrftoken-a2z': 'page-token',
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
    });
    expect(init.body).toContain('asin=B0B7T9Q524');
  });

  it('returns the classified outcome', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(addSuccess)));
    const { addToList } = await loadClient();

    expect(await addToList(ADD_PARAMS, readPageToken)).toEqual({
      kind: 'success',
      listName: 'Tools',
    });
  });

  it('uses the token rotated in by the previous response', async () => {
    const fetchMock = vi.fn(async () => response(addSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    await addToList(ADD_PARAMS, readPageToken);
    await addToList(ADD_PARAMS, readPageToken);

    // The fixture carries a fresh token; the second request must use it rather
    // than the stale one the page still holds.
    const first = initOf(fetchMock, 0).headers;
    const second = initOf(fetchMock, 1).headers;
    expect(first).toMatchObject({ 'anti-csrftoken-a2z': 'page-token' });
    expect(second).toMatchObject({
      'anti-csrftoken-a2z': expect.stringContaining('hM+ltWh7WT2h'),
    });
  });

  it('retries exactly once when the token is rejected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response('', { ok: false, status: 403 }))
      .mockResolvedValueOnce(response(addSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    expect(await addToList(ADD_PARAMS, readPageToken)).toEqual({
      kind: 'success',
      listName: 'Tools',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the single retry rather than looping', async () => {
    const fetchMock = vi.fn(async () => response('', { ok: false, status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    expect(await addToList(ADD_PARAMS, readPageToken)).toEqual({ kind: 'csrf' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never fetches when no token can be found', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    expect(await addToList(ADD_PARAMS, () => null)).toEqual({ kind: 'csrf' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns a rejected fetch into a network outcome instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection reset');
      }),
    );
    const { addToList } = await loadClient();

    expect(await addToList(ADD_PARAMS, readPageToken)).toEqual({
      kind: 'network',
      message: 'connection reset',
    });
  });
});

describe('removeFromList', () => {
  it('posts to the remove endpoint and reads its JSON', async () => {
    const fetchMock = vi.fn(async (_url: string) => response(removeSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { removeFromList } = await loadClient();

    const outcome = await removeFromList(REMOVE_PARAMS, readPageToken);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/hz/wishlist/removeitem');
    expect(outcome).toEqual({ kind: 'success', listName: null });
  });
});

describe('serialization', () => {
  it('does not start a request until the previous one settles', async () => {
    const gate = { release: (): void => undefined };
    const blocked = new Promise<void>((resolve) => {
      gate.release = resolve;
    });

    let started = 0;
    const fetchMock = vi.fn(async () => {
      started += 1;
      if (started === 1) await blocked;
      return response(addSuccess);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    const first = addToList(ADD_PARAMS, readPageToken);
    const second = addToList(ADD_PARAMS, readPageToken);
    // Flush generously: if the queue were parallel the second request would
    // have started many microtasks ago.
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    expect(started).toBe(1);

    gate.release();
    await Promise.all([first, second]);
    expect(started).toBe(2);
  });

  it('a failed request does not wedge the ones queued behind it', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(response(addSuccess));
    vi.stubGlobal('fetch', fetchMock);
    const { addToList } = await loadClient();

    const [first, second] = await Promise.all([
      addToList(ADD_PARAMS, readPageToken),
      addToList(ADD_PARAMS, readPageToken),
    ]);

    expect(first).toEqual({ kind: 'network', message: 'boom' });
    expect(second).toEqual({ kind: 'success', listName: 'Tools' });
  });
});
