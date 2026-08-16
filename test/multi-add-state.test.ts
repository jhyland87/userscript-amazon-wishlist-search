import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage stub (the test environment is Node, no DOM storage).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => void store.set(key, value),
  removeItem: (key: string): void => void store.delete(key),
  clear: (): void => store.clear(),
};

const STORAGE_KEY = 'wishlist-search:multi-add-enabled';

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  // multi-add-state caches its value at import time, so re-import per test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('multi-add-state', () => {
  it('falls back to the CONFIG.enableMultiAdd default when nothing is stored', async () => {
    const { isMultiAddEnabled } = await import('../src/multi-add-state');
    const { CONFIG } = await import('../src/config');
    expect(isMultiAddEnabled()).toBe(CONFIG.enableMultiAdd);
  });

  it('a stored value supersedes the default', async () => {
    store.set(STORAGE_KEY, 'false');
    const { isMultiAddEnabled } = await import('../src/multi-add-state');
    expect(isMultiAddEnabled()).toBe(false);
  });

  it('setMultiAddEnabled updates the cached value and persists it', async () => {
    const { isMultiAddEnabled, setMultiAddEnabled } = await import(
      '../src/multi-add-state'
    );
    setMultiAddEnabled(false);
    expect(isMultiAddEnabled()).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe('false');

    setMultiAddEnabled(true);
    expect(isMultiAddEnabled()).toBe(true);
    expect(store.get(STORAGE_KEY)).toBe('true');
  });

  it('the console helper toggles and reports state', async () => {
    vi.stubGlobal('window', {});
    const { installMultiAddHelper } = await import('../src/multi-add-state');
    installMultiAddHelper();

    const helper = window.wishlistSearchMultiAdd;
    expect(helper).toBeTypeOf('function');
    expect(helper?.(false)).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe('false');
    // Called with no argument it reports without changing anything.
    expect(helper?.()).toBe(false);
  });
});
