// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGm } from './gm-stub';
import {
  addRows,
  flush,
  getPopoverEl,
  mountPage,
  seedListIndex,
  visibleNames,
} from './popover-fixture';

// `searchFocus` both focuses the field and scrolls it to the top of the list,
// so counting its calls is how these tests see "the list jumped to the top".
const searchFocus = vi.fn();
vi.mock('../src/inject', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/inject')>()),
  searchFocus,
}));

// Opening the popover refreshes the list index; keep that off the network.
const refreshListIndexIfStale = vi.fn(async () => false);
vi.mock('../src/wishlist-index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/wishlist-index')>()),
  refreshListIndexIfStale,
}));

const setOpen = async (open: boolean): Promise<void> => {
  getPopoverEl().setAttribute('aria-hidden', String(!open));
  await flush();
};

const searchInput = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('#wishlist-search');

/** Mount a closed popover, start the observer, then open it. */
const startAndOpen = async (): Promise<void> => {
  mountPage(['Books', 'Tools', 'Garden Tools'], { open: false });
  const { startObserver } = await import('../src/observer');
  startObserver();
  await setOpen(true);
  await vi.waitFor(() => expect(searchInput()).not.toBeNull());
};

beforeEach(() => {
  resetGm();
  searchFocus.mockClear();
  refreshListIndexIfStale.mockReset();
  refreshListIndexIfStale.mockResolvedValue(false);
  // The observer tracks open/closed in module state.
  vi.resetModules();
});

describe('observer', () => {
  it('refreshes the list index each time the popover opens', async () => {
    await startAndOpen();
    expect(refreshListIndexIfStale).toHaveBeenCalledTimes(1);
    addRows(['Kitchen']);
    await flush();
    expect(refreshListIndexIfStale).toHaveBeenCalledTimes(1);
    await setOpen(false);
    await setOpen(true);
    expect(refreshListIndexIfStale).toHaveBeenCalledTimes(2);
  });

  it('re-runs a search once a refreshed index can answer it', async () => {
    let finish: (refreshed: boolean) => void = () => {};
    refreshListIndexIfStale.mockReturnValue(new Promise((done) => (finish = done)));
    await startAndOpen();
    const { searchList } = await import('../src/search');
    searchList('gps');
    expect(visibleNames()).toEqual([]);

    seedListIndex(['Books', 'Tools', 'Garden Tools', 'GPS Tracker']);
    const { loadListIndex } = await import('../src/wishlist-index');
    await loadListIndex();
    finish(true);

    await vi.waitFor(() => expect(visibleNames()).toEqual(['GPS Tracker']));
  });

  it('injects the search field when the popover opens', async () => {
    await startAndOpen();
    expect(document.querySelector('#wishlist-search-wrap')).not.toBeNull();
  });

  it('does not inject while the popover is hidden', async () => {
    mountPage(['Books'], { open: false });
    const { startObserver } = await import('../src/observer');
    startObserver();
    addRows(['Tools']);
    await flush();
    expect(searchInput()).toBeNull();
  });

  it('refocuses the field once each time the popover is reopened', async () => {
    await startAndOpen();
    await setOpen(false);
    await setOpen(true);
    expect(searchFocus).toHaveBeenCalledTimes(1);
  });

  it('does not jump back to the top when Amazon pages in more lists', async () => {
    await startAndOpen();
    await setOpen(false);
    await setOpen(true);
    searchFocus.mockClear();

    addRows(['Kitchen', 'Office']);
    await flush();
    addRows(['Garage']);
    await flush();
    expect(searchFocus).not.toHaveBeenCalled();
  });

  it('extends a running search to lists paged in while open', async () => {
    await startAndOpen();
    const { searchList } = await import('../src/search');
    searchList('tools');
    addRows(['Power Tools', 'Kitchen']);
    await flush();
    expect(visibleNames()).toEqual(['Tools', 'Garden Tools', 'Power Tools']);
  });

  it('drops the previous search when the popover is reopened', async () => {
    await startAndOpen();
    const { searchList } = await import('../src/search');
    searchList('tools');
    await setOpen(false);
    await setOpen(true);
    const [kitchen] = addRows(['Kitchen']);
    await flush();
    expect(kitchen?.style.display).toBe('');
  });

  it('re-injects the field if Amazon re-renders it away', async () => {
    await startAndOpen();
    document.querySelector('#wishlist-search-wrap')?.remove();
    await flush();
    await vi.waitFor(() => expect(searchInput()).not.toBeNull());
  });
});
