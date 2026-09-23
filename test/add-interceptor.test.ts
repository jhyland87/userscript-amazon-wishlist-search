// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddParams, Outcome, RemoveParams } from '../src/types';
import { gmStore, resetGm, unsafeWindow } from './gm-stub';
import { getAnchor, getPopoverEl, getRow, listIdFor, mountPage } from './popover-fixture';
import type { PageOptions } from './popover-fixture';

// The network layer is replaced; these tests cover what the click handler
// decides and how the row reflects it.
const addToList = vi.fn<(params: AddParams) => Promise<Outcome>>();
const removeFromList = vi.fn<(params: RemoveParams) => Promise<Outcome>>();
vi.mock('../src/wishlist-client', () => ({
  addToList,
  removeFromList,
  getCachedCsrfToken: () => null,
}));

const FREQ_KEY = 'wishlist-search:frequent-lists';
const MULTI_ADD_KEY = 'wishlist-search:multi-add-enabled';

/**
 * Mount the page, load stored state, and attach the interceptor. `amazonClicks`
 * records clicks that reach Amazon's own (bubble-phase) handler.
 */
const setup = async (options: PageOptions = {}): Promise<{ amazonClicks: string[] }> => {
  mountPage(['Books', 'Tools'], options);
  unsafeWindow.ue_sid = '131-0000000-0000000';
  unsafeWindow.ue = { mid: 'ATVPDKIKX0DER' };

  const [state, frequencies] = await Promise.all([
    import('../src/multi-add-state'),
    import('../src/frequencies'),
  ]);
  await Promise.all([state.loadMultiAddState(), frequencies.loadFrequencyState()]);

  const amazonClicks: string[] = [];
  getPopoverEl().addEventListener('click', (event) => {
    if (event.target instanceof Element) {
      amazonClicks.push(event.target.closest('a')?.id ?? '');
    }
  });
  const { attachAddInterceptor } = await import('../src/add-interceptor');
  attachAddInterceptor(getPopoverEl());
  return { amazonClicks };
};

const badgeOf = (name: string): HTMLElement | null =>
  getRow(name).querySelector<HTMLElement>('.wishlist-add-status');

const rowState = (name: string): string | undefined => getRow(name).dataset.wishlistAdd;

beforeEach(() => {
  resetGm();
  addToList.mockReset();
  removeFromList.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('adding in place', () => {
  it('claims the click and adds to the clicked list', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    const { amazonClicks } = await setup();
    const { CONFIG } = await import('../src/config');

    getAnchor('Tools').click();

    expect(amazonClicks).toEqual([]);
    expect(addToList).toHaveBeenCalledWith(
      {
        asin: 'B0TESTASIN',
        vendorId: CONFIG.defaultVendorId,
        listExternalId: listIdFor('Tools'),
        listType: 'wishlist',
      },
      expect.any(Function),
    );
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));
    expect(badgeOf('Tools')?.dataset.undo).toBe('true');
  });

  it('counts the list as selected only once the add succeeds', async () => {
    let resolve: (outcome: Outcome) => void = () => {};
    addToList.mockReturnValue(new Promise((done) => (resolve = done)));
    await setup();

    getAnchor('Tools').click();
    expect(rowState('Tools')).toBe('pending');
    const { loadFrequencies } = await import('../src/frequencies');
    expect(loadFrequencies()).toEqual({});

    resolve({ kind: 'success', listName: 'Tools' });
    await vi.waitFor(() => expect(loadFrequencies()).toEqual({ Tools: 1 }));
  });

  it('marks the row failed and records nothing when the add fails', async () => {
    addToList.mockResolvedValue({ kind: 'http', status: 500 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup();

    getAnchor('Tools').click();

    await vi.waitFor(() => expect(rowState('Tools')).toBe('failed'));
    const { loadFrequencies } = await import('../src/frequencies');
    expect(loadFrequencies()).toEqual({});
  });

  it('swallows a second click on a row already added, without re-adding', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    const { amazonClicks } = await setup();
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));

    getAnchor('Tools').click();
    expect(addToList).toHaveBeenCalledTimes(1);
    expect(amazonClicks).toEqual([]);
  });

  it('offers no undo when the page has no line-item ID', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    await setup({ listItemId: null });
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));
    expect(badgeOf('Tools')?.dataset.undo).toBeUndefined();
  });
});

describe('handing off to Amazon', () => {
  it('leaves the click alone when adding in place is turned off', async () => {
    gmStore.set(MULTI_ADD_KEY, false);
    const { amazonClicks } = await setup();
    getAnchor('Tools').click();
    expect(addToList).not.toHaveBeenCalled();
    expect(amazonClicks).toEqual([getAnchor('Tools').id]);
  });

  it('leaves the click alone when the page has no CSRF token', async () => {
    const { amazonClicks } = await setup({ csrfToken: null });
    getAnchor('Tools').click();
    expect(addToList).not.toHaveBeenCalled();
    expect(amazonClicks).toEqual([getAnchor('Tools').id]);
  });

  it('leaves the click alone when the page has no ASIN', async () => {
    const { amazonClicks } = await setup({ asin: null });
    getAnchor('Tools').click();
    expect(addToList).not.toHaveBeenCalled();
    expect(amazonClicks).toEqual([getAnchor('Tools').id]);
  });

  it('retries a failed add through Amazon when its badge is clicked', async () => {
    addToList.mockResolvedValue({ kind: 'network', message: 'offline' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { amazonClicks } = await setup();
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('failed'));

    badgeOf('Tools')?.click();

    // Exactly one click reaches Amazon, the badge is cleared, and we don't
    // try the request ourselves again.
    expect(amazonClicks).toEqual([getAnchor('Tools').id]);
    expect(rowState('Tools')).toBeUndefined();
    expect(addToList).toHaveBeenCalledTimes(1);
  });
});

describe('undo', () => {
  it('removes the item from the list and takes back the selection count', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    removeFromList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    await setup();
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));

    badgeOf('Tools')?.click();

    await vi.waitFor(() => expect(rowState('Tools')).toBeUndefined());
    expect(removeFromList).toHaveBeenCalledWith(
      expect.objectContaining({
        sid: '131-0000000-0000000',
        listExternalId: listIdFor('Tools'),
        itemExternalId: 'ASIN:B0TESTASIN|ATVPDKIKX0DER',
        itemId: 'ITEM123',
        itemTitle: 'Test Product',
      }),
      expect.any(Function),
    );
    const { loadFrequencies } = await import('../src/frequencies');
    expect(loadFrequencies()).toEqual({});
    await vi.waitFor(() => expect(gmStore.get(FREQ_KEY)).toEqual({}));
  });

  it('keeps the row added, so it can be retried, when the undo fails', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    removeFromList.mockResolvedValue({ kind: 'http', status: 500 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup();
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));

    badgeOf('Tools')?.click();

    await vi.waitFor(() => expect(badgeOf('Tools')?.title).toMatch(/Undo failed/));
    expect(rowState('Tools')).toBe('added');
  });
});
