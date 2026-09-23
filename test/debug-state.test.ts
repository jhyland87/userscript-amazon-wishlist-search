import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmStore, resetGm } from './gm-stub';

const STORAGE_KEY = 'wishlist-search:debug';

beforeEach(() => {
  resetGm();
  // debug-state caches its value per module instance, so re-import per test.
  vi.resetModules();
});

const load = async (): Promise<typeof import('../src/debug-state')> => {
  const mod = await import('../src/debug-state');
  await mod.loadDebugState();
  return mod;
};

describe('debug-state', () => {
  it('falls back to the CONFIG.debug default when nothing is stored', async () => {
    const { isDebugEnabled } = await load();
    const { CONFIG } = await import('../src/config');
    expect(isDebugEnabled()).toBe(CONFIG.debug);
  });

  it('a stored value supersedes the default', async () => {
    gmStore.set(STORAGE_KEY, true);
    const { isDebugEnabled } = await load();
    expect(isDebugEnabled()).toBe(true);
  });

  it('ignores a stored value of the wrong type', async () => {
    gmStore.set(STORAGE_KEY, 'true');
    const { isDebugEnabled } = await load();
    const { CONFIG } = await import('../src/config');
    expect(isDebugEnabled()).toBe(CONFIG.debug);
  });

  it('setDebugEnabled updates the cached value and persists it', async () => {
    const { isDebugEnabled, setDebugEnabled } = await load();
    setDebugEnabled(true);
    expect(isDebugEnabled()).toBe(true);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(true));

    setDebugEnabled(false);
    expect(isDebugEnabled()).toBe(false);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(false));
  });

  it('follows a change made in another tab', async () => {
    const { isDebugEnabled } = await load();
    await vi.waitFor(() => {
      emitRemoteChange(STORAGE_KEY, true);
      expect(isDebugEnabled()).toBe(true);
    });
  });
});
