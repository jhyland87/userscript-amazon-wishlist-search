// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddParams, Outcome, RemoveParams } from '../src/types';
import { gmStore, resetGm, unsafeWindow } from './gm-stub';
import {
  addRows,
  addSpinner,
  getAnchor,
  getPopoverEl,
  getRow,
  listIdFor,
  mountPage,
  syntheticRows,
} from './popover-fixture';
import type { PageOptions } from './popover-fixture';

// The network layer is replaced; these tests cover what the click handler
// decides and how the row reflects it.
const addToList = vi.fn<(params: AddParams) => Promise<Outcome>>();
const removeFromList = vi.fn<(params: RemoveParams) => Promise<Outcome>>();
const lookupListItemId =
  vi.fn<(listExternalId: string, itemExternalId: string) => Promise<string | null>>();
vi.mock('../src/wishlist-client', () => ({
  addToList,
  removeFromList,
  lookupListItemId,
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
  lookupListItemId.mockReset();
  lookupListItemId.mockResolvedValue('ITEM123');
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

  it('offers no undo when the page has no session ID', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    await setup();
    delete unsafeWindow.ue_sid;
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

  it.for([
    ['CSRF token', { csrfToken: null }],
    ['ASIN', { asin: null }],
  ] satisfies Array<[string, PageOptions]>)(
    'leaves the click alone when the page has no %s',
    async ([, options]) => {
      const { amazonClicks } = await setup(options);
      getAnchor('Tools').click();
      expect(addToList).not.toHaveBeenCalled();
      expect(amazonClicks).toEqual([getAnchor('Tools').id]);
    },
  );

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
    // The line-item ID is looked up on the list the item was added to.
    expect(lookupListItemId).toHaveBeenCalledWith(
      listIdFor('Tools'),
      'ASIN:B0TESTASIN|ATVPDKIKX0DER',
    );
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

  it('keeps the row added when the item cannot be found on the list', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Tools' });
    lookupListItemId.mockResolvedValue(null);
    await setup();
    getAnchor('Tools').click();
    await vi.waitFor(() => expect(rowState('Tools')).toBe('added'));

    badgeOf('Tools')?.click();

    await vi.waitFor(() => expect(badgeOf('Tools')?.title).toMatch(/Undo unavailable/));
    expect(rowState('Tools')).toBe('added');
    expect(removeFromList).not.toHaveBeenCalled();
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

describe('rows built from the list index', () => {
  /** Add a synthetic row for `name`, as a search would. */
  const addSynthetic = async (name: string, listType = 'wishlist'): Promise<HTMLElement> => {
    const { buildSyntheticRow, insertSyntheticRow } = await import('../src/synthetic-rows');
    const row = buildSyntheticRow({ listExternalId: listIdFor(name), listType, name, privacy: null });
    insertSyntheticRow(row);
    return row;
  };

  const anchorOf = (row: HTMLElement): HTMLAnchorElement => {
    const anchor = row.querySelector<HTMLAnchorElement>('a.a-dropdown-link');
    if (!anchor) throw new Error('synthetic row has no anchor');
    return anchor;
  };

  it('adds to the indexed list through the same path as a real row', async () => {
    addToList.mockResolvedValue({ kind: 'success', listName: 'Alexa List' });
    const { amazonClicks } = await setup();
    const row = await addSynthetic('Alexa List', 'alexa');

    anchorOf(row).click();

    expect(amazonClicks).toEqual([]);
    expect(addToList).toHaveBeenCalledWith(
      expect.objectContaining({ listExternalId: listIdFor('Alexa List'), listType: 'alexa' }),
      expect.any(Function),
    );
    await vi.waitFor(() => expect(row.dataset.wishlistAdd).toBe('added'));
  });

  it('retries a failed add through the real row once Amazon pages it in', async () => {
    addToList.mockResolvedValue({ kind: 'network', message: 'offline' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { amazonClicks } = await setup();
    const row = await addSynthetic('GPS Tracker');
    anchorOf(row).click();
    await vi.waitFor(() => expect(row.dataset.wishlistAdd).toBe('failed'));
    const spinner = addSpinner();

    row.querySelector<HTMLElement>('.wishlist-add-status')?.click();
    expect(row.dataset.wishlistAdd).toBe('pending');
    spinner.remove();
    addRows(['GPS Tracker']);

    await vi.waitFor(() => expect(amazonClicks).toEqual([getAnchor('GPS Tracker').id]));
    expect(syntheticRows()).toEqual([]);
    expect(getRow('GPS Tracker').dataset.wishlistAdd).toBeUndefined();
    expect(addToList).toHaveBeenCalledTimes(1);
  });

  it('stays failed when every page loads without the list', async () => {
    addToList.mockResolvedValue({ kind: 'network', message: 'offline' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { amazonClicks } = await setup();
    const row = await addSynthetic('Deleted List');
    anchorOf(row).click();
    await vi.waitFor(() => expect(row.dataset.wishlistAdd).toBe('failed'));

    row.querySelector<HTMLElement>('.wishlist-add-status')?.click();

    await vi.waitFor(() =>
      expect(row.querySelector('.wishlist-add-status')?.getAttribute('title')).toMatch(
        /didn't load this list/,
      ),
    );
    expect(row.dataset.wishlistAdd).toBe('failed');
    expect(amazonClicks).toEqual([]);
  });

  it('hands the click to the real row when adding in place is off', async () => {
    gmStore.set(MULTI_ADD_KEY, false);
    const { amazonClicks } = await setup();
    const row = await addSynthetic('Books');

    anchorOf(row).click();

    // `Books` is already in the popover, so the real row is clicked at once.
    await vi.waitFor(() => expect(amazonClicks).toEqual([getAnchor('Books').id]));
    expect(addToList).not.toHaveBeenCalled();
  });
});
