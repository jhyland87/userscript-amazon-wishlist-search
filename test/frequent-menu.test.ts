import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitRemoteChange, gmMenu, gmStore, resetGm } from './gm-stub';

const MENU_ID = 'wishlist-search-toggle-frequent';
const CLEAR_ID = 'wishlist-search-clear-frequent';
const FREQ_KEY = 'wishlist-search:frequent-lists';

beforeEach(() => {
  resetGm();
  vi.resetModules();
  // No popover on the page: refreshing the group is a no-op.
  vi.stubGlobal('document', { querySelector: () => null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = async (): Promise<{
  section: typeof import('../src/frequent-section');
  state: typeof import('../src/frequent-state');
  frequencies: typeof import('../src/frequencies');
}> => {
  const state = await import('../src/frequent-state');
  await state.loadFrequentState();
  const frequencies = await import('../src/frequencies');
  await frequencies.loadFrequencyState();
  const section = await import('../src/frequent-section');
  return { section, state, frequencies };
};

describe('"Previously selected" menu command', () => {
  it('registers one entry reflecting the current state', async () => {
    const { section } = await load();
    section.installFrequentMenu();
    await vi.waitFor(() => expect(gmMenu.get(MENU_ID)?.caption).toMatch(/^✓/));
    expect(gmMenu.size).toBe(1);
  });

  it('toggles the feature and updates its caption in place', async () => {
    const { section, state } = await load();
    section.installFrequentMenu();
    await vi.waitFor(() => expect(gmMenu.has(MENU_ID)).toBe(true));

    gmMenu.get(MENU_ID)?.onClick();
    expect(state.isFrequentEnabled()).toBe(false);
    await vi.waitFor(() => expect(gmMenu.get(MENU_ID)?.caption).toMatch(/^✗/));
    expect(gmMenu.size).toBe(1);
  });

  it('follows changes made elsewhere, e.g. the popover controls', async () => {
    const { section, state } = await load();
    section.installFrequentMenu();
    state.setFrequentEnabled(false);
    await vi.waitFor(() => expect(gmMenu.get(MENU_ID)?.caption).toMatch(/^✗/));
  });

  it('offers no clear entry while there is no history', async () => {
    const { section } = await load();
    section.installFrequentMenu();
    await vi.waitFor(() => expect(gmMenu.has(MENU_ID)).toBe(true));
    expect(gmMenu.has(CLEAR_ID)).toBe(false);
  });

  it('offers the clear entry once there is history, and clearing removes it', async () => {
    const { section, frequencies } = await load();
    section.installFrequentMenu();
    frequencies.recordSelection('Books');
    await vi.waitFor(() =>
      expect(gmMenu.get(CLEAR_ID)?.caption).toBe('Clear "Previously selected" lists (1)'),
    );
    // A second list updates the count in place; picking one again doesn't.
    frequencies.recordSelection('Tools');
    frequencies.recordSelection('Books');
    await vi.waitFor(() =>
      expect(gmMenu.get(CLEAR_ID)?.caption).toBe('Clear "Previously selected" lists (2)'),
    );
    expect(gmMenu.size).toBe(2);

    gmMenu.get(CLEAR_ID)?.onClick();
    expect(frequencies.loadFrequencies()).toEqual({});
    await vi.waitFor(() => expect(gmMenu.has(CLEAR_ID)).toBe(false));
    await vi.waitFor(() => expect(gmStore.get(FREQ_KEY)).toEqual({}));
  });

  it('hides the clear entry while the group is off', async () => {
    gmStore.set(FREQ_KEY, { Books: 2 });
    const { section, state } = await load();
    section.installFrequentMenu();
    await vi.waitFor(() => expect(gmMenu.has(CLEAR_ID)).toBe(true));

    state.setFrequentEnabled(false);
    await vi.waitFor(() => expect(gmMenu.has(CLEAR_ID)).toBe(false));
    state.setFrequentEnabled(true);
    await vi.waitFor(() => expect(gmMenu.has(CLEAR_ID)).toBe(true));
  });

  it('follows history recorded in another tab', async () => {
    const { section } = await load();
    section.installFrequentMenu();
    await vi.waitFor(() => {
      emitRemoteChange(FREQ_KEY, { Tools: 1 });
      expect(gmMenu.has(CLEAR_ID)).toBe(true);
    });
  });
});
