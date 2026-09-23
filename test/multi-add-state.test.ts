import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmStore, resetGm, unsafeWindow } from './gm-stub';

const STORAGE_KEY = 'wishlist-search:multi-add-enabled';

beforeEach(() => {
  resetGm();
  // multi-add-state caches its value per module instance, so re-import per test.
  vi.resetModules();
});

const load = async (): Promise<typeof import('../src/multi-add-state')> => {
  const mod = await import('../src/multi-add-state');
  await mod.loadMultiAddState();
  return mod;
};

describe('multi-add-state', () => {
  it('falls back to the CONFIG.enableMultiAdd default when nothing is stored', async () => {
    const { isMultiAddEnabled } = await load();
    const { CONFIG } = await import('../src/config');
    expect(isMultiAddEnabled()).toBe(CONFIG.enableMultiAdd);
  });

  it('a stored value supersedes the default', async () => {
    gmStore.set(STORAGE_KEY, false);
    const { isMultiAddEnabled } = await load();
    expect(isMultiAddEnabled()).toBe(false);
  });

  it('setMultiAddEnabled updates the cached value and persists it', async () => {
    const { isMultiAddEnabled, setMultiAddEnabled } = await load();
    setMultiAddEnabled(false);
    expect(isMultiAddEnabled()).toBe(false);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(false));

    setMultiAddEnabled(true);
    expect(isMultiAddEnabled()).toBe(true);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(true));
  });

  it('the console helper toggles and reports state', async () => {
    const { installMultiAddHelper } = await load();
    installMultiAddHelper();

    // Installed on the page's window, not the userscript sandbox's.
    const helper = unsafeWindow.wishlistSearchMultiAdd;
    expect(helper).toBeTypeOf('function');
    expect(helper?.(false)).toBe(false);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(false));
    // Called with no argument it reports without changing anything.
    expect(helper?.()).toBe(false);
  });

  it('follows a change made in another tab', async () => {
    const { isMultiAddEnabled } = await load();
    await vi.waitFor(() => {
      emitRemoteChange(STORAGE_KEY, false);
      expect(isMultiAddEnabled()).toBe(false);
    });
  });
});
