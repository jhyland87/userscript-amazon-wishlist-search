import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmStore, resetGm, unsafeWindow } from './gm-stub';

const FREQ_KEY = 'wishlist-search:frequent-lists';
const DISABLED_KEY = 'wishlist-search:frequent-disabled';

// Minimal `document` stub covering only what the DOM helpers touch: a popover
// whose list items each expose a name span via querySelector().
const makeDocument = (names: string[]): unknown => ({
  querySelector: (): unknown => ({
    querySelectorAll: (): unknown[] =>
      names.map((name) => ({ querySelector: () => ({ textContent: name }) })),
  }),
});

beforeEach(() => {
  resetGm();
  // frequencies caches the stored values per module instance, so re-import.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = async (): Promise<typeof import('../src/frequencies')> => {
  const mod = await import('../src/frequencies');
  await mod.loadFrequencyState();
  return mod;
};

describe('frequencies', () => {
  it('removeName deletes only that list name', async () => {
    gmStore.set(FREQ_KEY, { A: 3, B: 1 });
    const { removeName, loadFrequencies } = await load();
    removeName('A');
    expect(loadFrequencies()).toEqual({ B: 1 });
    await vi.waitFor(() => expect(gmStore.get(FREQ_KEY)).toEqual({ B: 1 }));
  });

  it('disableName persists to the blocklist and is idempotent', async () => {
    const { disableName, loadDisabled } = await load();
    disableName('A');
    disableName('A');
    expect(Array.from(loadDisabled())).toEqual(['A']);
    await vi.waitFor(() => expect(gmStore.get(DISABLED_KEY)).toEqual(['A']));
  });

  it('getTopFrequentNames excludes disabled names and orders by count', async () => {
    vi.stubGlobal('document', makeDocument(['A', 'B', 'C']));
    gmStore.set(FREQ_KEY, { A: 5, B: 3, C: 1 });
    gmStore.set(DISABLED_KEY, ['B']);
    const { getTopFrequentNames } = await load();
    expect(getTopFrequentNames(5)).toEqual(['A', 'C']);
  });

  it('ignores a corrupt stored map', async () => {
    gmStore.set(FREQ_KEY, { Books: '3' });
    const { loadFrequencies } = await load();
    expect(loadFrequencies()).toEqual({});
  });

  it('picks up counts recorded in another tab', async () => {
    const { recordSelection, loadFrequencies } = await load();
    await vi.waitFor(() => {
      emitRemoteChange(FREQ_KEY, { A: 4 });
      expect(loadFrequencies()).toEqual({ A: 4 });
    });
    // A local write builds on the other tab's counts rather than clobbering them.
    recordSelection('A');
    expect(loadFrequencies()).toEqual({ A: 5 });
  });

  it('clearWishlistHistory empties the cache and storage', async () => {
    gmStore.set(FREQ_KEY, { A: 2 });
    const { installClearHistoryHelper, loadFrequencies } = await load();
    installClearHistoryHelper();
    unsafeWindow.clearWishlistHistory?.();
    expect(loadFrequencies()).toEqual({});
    await vi.waitFor(() => expect(gmStore.has(FREQ_KEY)).toBe(false));
  });
});
