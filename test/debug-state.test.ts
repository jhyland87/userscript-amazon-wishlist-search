import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage stub (the test environment is Node, no DOM storage).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => void store.set(key, value),
  removeItem: (key: string): void => void store.delete(key),
  clear: (): void => store.clear(),
};

const STORAGE_KEY = 'wishlist-search:debug';

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  // debug-state caches its value at import time, so re-import per test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('debug-state', () => {
  it('falls back to the CONFIG.debug default when nothing is stored', async () => {
    const { isDebugEnabled } = await import('../src/debug-state');
    const { CONFIG } = await import('../src/config');
    expect(isDebugEnabled()).toBe(CONFIG.debug);
  });

  it('a stored value supersedes the default', async () => {
    store.set(STORAGE_KEY, 'true');
    const { isDebugEnabled } = await import('../src/debug-state');
    expect(isDebugEnabled()).toBe(true);
  });

  it('setDebugEnabled updates the cached value and persists it', async () => {
    const { isDebugEnabled, setDebugEnabled } = await import('../src/debug-state');
    setDebugEnabled(true);
    expect(isDebugEnabled()).toBe(true);
    expect(store.get(STORAGE_KEY)).toBe('true');

    setDebugEnabled(false);
    expect(isDebugEnabled()).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe('false');
  });
});
