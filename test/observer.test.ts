// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGm } from './gm-stub';
import { addRows, flush, getPopoverEl, mountPage, visibleNames } from './popover-fixture';

// `searchFocus` both focuses the field and scrolls it to the top of the list,
// so counting its calls is how these tests see "the list jumped to the top".
const searchFocus = vi.fn();
vi.mock('../src/inject', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/inject')>()),
  searchFocus,
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
  // The observer tracks open/closed in module state.
  vi.resetModules();
});

describe('observer', () => {
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
