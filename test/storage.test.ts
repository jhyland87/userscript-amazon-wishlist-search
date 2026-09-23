import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gmStore, resetGm } from './gm-stub';

// In-memory localStorage stub standing in for values saved by older versions.
const legacy = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string): string | null => legacy.get(key) ?? null,
  setItem: (key: string, value: string): void => void legacy.set(key, value),
  removeItem: (key: string): void => void legacy.delete(key),
};

beforeEach(() => {
  resetGm();
  legacy.clear();
  vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('migrateLegacyStorage', () => {
  it('moves flags and JSON values into GM storage as typed values', async () => {
    legacy.set('wishlist-search:debug', 'true');
    legacy.set('wishlist-search:frequent-lists', JSON.stringify({ Books: 3 }));
    legacy.set('wishlist-search:frequent-disabled', JSON.stringify(['Gifts']));
    const { migrateLegacyStorage } = await import('../src/storage');
    await migrateLegacyStorage();

    expect(gmStore.get('wishlist-search:debug')).toBe(true);
    expect(gmStore.get('wishlist-search:frequent-lists')).toEqual({ Books: 3 });
    expect(gmStore.get('wishlist-search:frequent-disabled')).toEqual(['Gifts']);
    expect(legacy.size).toBe(0);
  });

  it('does not overwrite a value already in GM storage', async () => {
    gmStore.set('wishlist-search:regex-enabled', false);
    legacy.set('wishlist-search:regex-enabled', 'true');
    const { migrateLegacyStorage } = await import('../src/storage');
    await migrateLegacyStorage();

    expect(gmStore.get('wishlist-search:regex-enabled')).toBe(false);
    expect(legacy.has('wishlist-search:regex-enabled')).toBe(false);
  });

  it('leaves an unparseable value in place and still migrates the rest', async () => {
    legacy.set('wishlist-search:frequent-lists', '{not json');
    legacy.set('wishlist-search:multi-add-enabled', 'false');
    // The skip is logged as a warning; capture it instead of printing it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { migrateLegacyStorage } = await import('../src/storage');
    await migrateLegacyStorage();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipping unreadable legacy value for wishlist-search:frequent-lists'),
      expect.any(SyntaxError),
    );

    expect(legacy.get('wishlist-search:frequent-lists')).toBe('{not json');
    expect(gmStore.has('wishlist-search:frequent-lists')).toBe(false);
    expect(gmStore.get('wishlist-search:multi-add-enabled')).toBe(false);
  });

  it('ignores keys that are not the script’s own', async () => {
    legacy.set('some-amazon-key', 'true');
    const { migrateLegacyStorage } = await import('../src/storage');
    await migrateLegacyStorage();

    expect(legacy.get('some-amazon-key')).toBe('true');
    expect(gmStore.size).toBe(0);
  });
});
