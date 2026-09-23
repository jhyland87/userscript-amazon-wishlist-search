import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmStore, resetGm } from './gm-stub';

const STORAGE_KEY = 'wishlist-search:regex-enabled';

beforeEach(() => {
  resetGm();
  // regex-state caches its value per module instance, so re-import per test.
  vi.resetModules();
});

const load = async (): Promise<typeof import('../src/regex-state')> => {
  const mod = await import('../src/regex-state');
  await mod.loadRegexState();
  return mod;
};

describe('regex-state', () => {
  it('falls back to the CONFIG.regexSearches default when nothing is stored', async () => {
    const { isRegexEnabled } = await load();
    const { CONFIG } = await import('../src/config');
    const expected =
      CONFIG.regexSearches === true || CONFIG.regexSearches === 'enable';
    expect(isRegexEnabled()).toBe(expected);
  });

  it('a stored value supersedes the default', async () => {
    gmStore.set(STORAGE_KEY, true);
    const { isRegexEnabled } = await load();
    expect(isRegexEnabled()).toBe(true);
  });

  it('setRegexEnabled updates the cached value and persists it', async () => {
    const { isRegexEnabled, setRegexEnabled } = await load();
    setRegexEnabled(true);
    expect(isRegexEnabled()).toBe(true);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(true));

    setRegexEnabled(false);
    expect(isRegexEnabled()).toBe(false);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(false));
  });

  it('follows a change made in another tab', async () => {
    const { isRegexEnabled } = await load();
    await vi.waitFor(() => {
      emitRemoteChange(STORAGE_KEY, true);
      expect(isRegexEnabled()).toBe(true);
    });
  });
});
