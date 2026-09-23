import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmStore, resetGm } from './gm-stub';

const STORAGE_KEY = 'wishlist-search:frequent-enabled';

beforeEach(() => {
  resetGm();
  // frequent-state caches its value per module instance, so re-import per test.
  vi.resetModules();
});

const load = async (): Promise<typeof import('../src/frequent-state')> => {
  const mod = await import('../src/frequent-state');
  await mod.loadFrequentState();
  return mod;
};

describe('frequent-state', () => {
  it('falls back to the CONFIG.enableFrequentLists default when nothing is stored', async () => {
    const { isFrequentEnabled } = await load();
    const { CONFIG } = await import('../src/config');
    expect(isFrequentEnabled()).toBe(CONFIG.enableFrequentLists);
  });

  it('a stored value supersedes the default', async () => {
    gmStore.set(STORAGE_KEY, false);
    const { isFrequentEnabled } = await load();
    expect(isFrequentEnabled()).toBe(false);
  });

  it('setFrequentEnabled updates the cached value and persists it', async () => {
    const { isFrequentEnabled, setFrequentEnabled } = await load();
    setFrequentEnabled(false);
    expect(isFrequentEnabled()).toBe(false);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(false));

    setFrequentEnabled(true);
    expect(isFrequentEnabled()).toBe(true);
    await vi.waitFor(() => expect(gmStore.get(STORAGE_KEY)).toBe(true));
  });

  it('starts collapsed, so a long group cannot hide the search box', async () => {
    const { isFrequentCollapsed } = await load();
    const { CONFIG } = await import('../src/config');
    expect(CONFIG.collapseFrequentLists).toBe(true);
    expect(isFrequentCollapsed()).toBe(true);
  });

  it('setFrequentCollapsed updates the cached value without persisting it', async () => {
    const { isFrequentCollapsed, setFrequentCollapsed } = await load();
    setFrequentCollapsed(false);
    expect(isFrequentCollapsed()).toBe(false);
    // Collapse is per-open, so nothing about it reaches storage.
    expect(gmStore.size).toBe(0);
  });

  it('resetFrequentCollapsed restores the default, so each open starts collapsed', async () => {
    const { isFrequentCollapsed, resetFrequentCollapsed, setFrequentCollapsed } =
      await load();
    setFrequentCollapsed(false);
    expect(resetFrequentCollapsed()).toBe(true);
    expect(isFrequentCollapsed()).toBe(true);
  });

  it('the two flags are stored independently', async () => {
    const { setFrequentCollapsed, isFrequentEnabled } = await load();
    setFrequentCollapsed(false);
    // Collapsing must not read as "the feature was turned off".
    expect(isFrequentEnabled()).toBe(true);
    expect(gmStore.get(STORAGE_KEY)).toBeUndefined();
  });

  it('follows a change made in another tab', async () => {
    const { isFrequentEnabled } = await load();
    await vi.waitFor(() => {
      emitRemoteChange(STORAGE_KEY, false);
      expect(isFrequentEnabled()).toBe(false);
    });
  });
});

describe('onFrequentEnabledChange', () => {
  it('fires for local and cross-tab changes', async () => {
    const { onFrequentEnabledChange, setFrequentEnabled } = await load();
    const seen: boolean[] = [];
    onFrequentEnabledChange((value) => seen.push(value));
    setFrequentEnabled(false);
    await vi.waitFor(() => {
      emitRemoteChange(STORAGE_KEY, true);
      expect(seen).toEqual([false, true]);
    });
  });
});
