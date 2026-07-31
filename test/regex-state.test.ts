import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory localStorage stub (the test environment is Node, no DOM storage).
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => store.get(key) ?? null,
  setItem: (key: string, value: string): void => void store.set(key, value),
  removeItem: (key: string): void => void store.delete(key),
  clear: (): void => store.clear(),
};

const STORAGE_KEY = 'wishlist-search:regex-enabled';

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  // regex-state caches its value at import time, so re-import per test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('regex-state', () => {
  it('falls back to the CONFIG.regexSearches default when nothing is stored', async () => {
    const { isRegexEnabled } = await import('../src/regex-state');
    const { CONFIG } = await import('../src/config');
    const expected =
      CONFIG.regexSearches === true || CONFIG.regexSearches === 'enable';
    expect(isRegexEnabled()).toBe(expected);
  });

  it('a stored value supersedes the default', async () => {
    store.set(STORAGE_KEY, 'true');
    const { isRegexEnabled } = await import('../src/regex-state');
    expect(isRegexEnabled()).toBe(true);
  });

  it('setRegexEnabled updates the cached value and persists it', async () => {
    const { isRegexEnabled, setRegexEnabled } = await import('../src/regex-state');
    setRegexEnabled(true);
    expect(isRegexEnabled()).toBe(true);
    expect(store.get(STORAGE_KEY)).toBe('true');

    setRegexEnabled(false);
    expect(isRegexEnabled()).toBe(false);
    expect(store.get(STORAGE_KEY)).toBe('false');
  });
});
