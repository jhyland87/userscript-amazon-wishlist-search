import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage stub (the test environment is Node, no DOM storage).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => void store.set(key, value),
  removeItem: (key: string): void => void store.delete(key),
  clear: (): void => store.clear(),
};

const STORAGE_KEY = 'wishlist-search:frequent-enabled';

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  // frequent-state caches its value at import time, so re-import per test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frequent-state', () => {
  it('falls back to the CONFIG.enableFrequentLists default when nothing is stored', async () => {
    const { isFrequentEnabled } = await import('../src/frequent-state');
    const { CONFIG } = await import('../src/config');
    expect(isFrequentEnabled()).toBe(CONFIG.enableFrequentLists);
  });

  it('a stored value supersedes the default', async () => {
    store.set(STORAGE_KEY, 'false');
    const { isFrequentEnabled } = await import('../src/frequent-state');
    expect(isFrequentEnabled()).toBe(false);
  });

  it('setFrequentEnabled updates the cached value and persists it', async () => {
    const { isFrequentEnabled, setFrequentEnabled } = await import('../src/frequent-state');
    setFrequentEnabled(false);
    expect(isFrequentEnabled()).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe('false');

    setFrequentEnabled(true);
    expect(isFrequentEnabled()).toBe(true);
    expect(store.get(STORAGE_KEY)).toBe('true');
  });
});
