import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage stub (the test environment is Node, no DOM storage).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => void store.set(key, value),
  removeItem: (key: string): void => void store.delete(key),
  clear: (): void => store.clear(),
};

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
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frequencies', () => {
  it('removeName deletes only that list name', async () => {
    store.set(FREQ_KEY, JSON.stringify({ A: 3, B: 1 }));
    const { removeName, loadFrequencies } = await import('../src/frequencies');
    removeName('A');
    expect(loadFrequencies()).toEqual({ B: 1 });
  });

  it('disableName persists to the blocklist and is idempotent', async () => {
    const { disableName, loadDisabled } = await import('../src/frequencies');
    disableName('A');
    disableName('A');
    expect(Array.from(loadDisabled())).toEqual(['A']);
    expect(store.get(DISABLED_KEY)).toBe(JSON.stringify(['A']));
  });

  it('getTopFrequentNames excludes disabled names and orders by count', async () => {
    vi.stubGlobal('document', makeDocument(['A', 'B', 'C']));
    store.set(FREQ_KEY, JSON.stringify({ A: 5, B: 3, C: 1 }));
    store.set(DISABLED_KEY, JSON.stringify(['B']));
    const { getTopFrequentNames } = await import('../src/frequencies');
    expect(getTopFrequentNames(5)).toEqual(['A', 'C']);
  });
});
