import { GM, unsafeWindow } from 'vite-plugin-monkey/dist/client';
import { CONFIG, SELECTORS } from './config';
import {
  el,
  getListItems,
  getListItemName,
  getListUl,
  getPopover,
  getSearchWrap,
} from './dom';
import {
  disableName,
  getTopFrequentNames,
  getFrequencyCount,
  onFrequenciesChange,
  recordSelection,
  removeName,
  saveFrequencies,
} from './frequencies';
import {
  isFrequentCollapsed,
  isFrequentEnabled,
  onFrequentEnabledChange,
  resetFrequentCollapsed,
  setFrequentCollapsed,
  setFrequentEnabled,
} from './frequent-state';
import { FREQ_ICONS } from './icons';
import { log } from './log';

/**
 * "Previously selected" section.
 *
 * Moves (not clones) the top-N most-selected list items out of the main
 * dropdown and into a new section at the top of the popover. Because the
 * original <li> elements are reused, all of Amazon's click handlers, IDs,
 * and styling are preserved automatically — no need to forward clicks.
 *
 * The moved items still match the same .a-dropdown-item selector that the
 * search uses, so text-search continues to find them in their new location.
 *
 * Each row and the group label carry low-profile controls (hidden until
 * hover) to manage the group; see `buildControls`.
 */

const FREQ_SECTION_ID = 'wishlist-search-frequent';
const FREQ_LABEL_ID = 'wishlist-search-frequent-label';
const FREQ_DIVIDER_ID = 'wishlist-search-frequent-divider';

/**
 * Set while a search is running. A collapsed group still holds the original
 * `<li>` nodes, so leaving it hidden would make those lists unfindable — the
 * search would silently miss exactly the lists the user reaches for most.
 */
let searchOverride = false;

/** Apply the current collapsed state to the rendered group. */
const applyCollapseState = (): void => {
  const popover = getPopover();
  if (!popover) return;
  const section = popover.querySelector(`#${FREQ_SECTION_ID}`);
  const label = popover.querySelector(`#${FREQ_LABEL_ID}`);
  const collapsed = isFrequentCollapsed() && !searchOverride;

  if (section instanceof HTMLElement) {
    section.style.display = collapsed ? 'none' : '';
  }
  if (label instanceof HTMLElement) {
    label.dataset.collapsed = String(collapsed);
    label.setAttribute('aria-expanded', String(!collapsed));
  }
};

/**
 * Force the group open for the duration of a search, then hand control back to
 * the persisted collapsed state.
 *
 * @param active - `true` while a search term is present.
 * @returns Nothing.
 * @example
 * setFrequentSearchOverride(true); // group is visible so matches can show
 * @source src/frequent-section.ts
 */
export const setFrequentSearchOverride = (active: boolean): void => {
  if (searchOverride === active) return;
  searchOverride = active;
  applyCollapseState();
};

/**
 * Collapse the group back to its label, discarding any expansion from an
 * earlier open. Safe to call before the group has been rendered.
 *
 * @returns Nothing.
 * @example
 * resetFrequentCollapse(); // the next render starts collapsed
 * @source src/frequent-section.ts
 */
export const resetFrequentCollapse = (): void => {
  resetFrequentCollapsed();
  applyCollapseState();
};

export const removeFrequentSection = (): void => {
  const popover = getPopover();
  if (!popover) return;
  popover.querySelector(`#${FREQ_SECTION_ID}`)?.remove();
  popover.querySelector(`#${FREQ_LABEL_ID}`)?.remove();
  popover.querySelector(`#${FREQ_DIVIDER_ID}`)?.remove();
};

/** A single low-profile icon control that swallows the click from Amazon. */
const buildControl = (
  icon: string,
  title: string,
  onClick: () => void,
): HTMLSpanElement =>
  el('span', {
    className: 'wishlist-freq-ctrl',
    title,
    style: { backgroundImage: `url("${icon}")` },
    attrs: { role: 'button', 'aria-label': title },
    on: {
      click: (event) => {
        // Never let the click reach Amazon's list-selection or our tracker.
        event.preventDefault();
        event.stopPropagation();
        onClick();
      },
    },
  });

const buildControls = (...controls: HTMLElement[]): HTMLSpanElement =>
  el('span', { className: 'wishlist-freq-ctrls' }, ...controls);

/**
 * The "Previously selected" header. When `enabled`, it carries a clear (✕) and
 * an on-toggle. When disabled, the same text is shown struck-through/italic with
 * only the off-toggle — kept in the same spot and size so toggling doesn't make
 * the control jump or resize.
 */
const buildLabel = (enabled: boolean): HTMLDivElement => {
  const label = el('div', {
    id: FREQ_LABEL_ID,
    text: 'Previously selected',
    style: {
      fontSize: '10px',
      color: '#898d8d',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '4px 14px 2px',
      margin: '0',
    },
  });

  if (enabled) {
    // The whole label is the disclosure control, so the hit target is the full
    // width rather than a 10px caret.
    label.prepend(el('span', { className: 'wishlist-freq-chevron' }));
    label.dataset.expandable = 'true';
    label.setAttribute('role', 'button');
    label.title = 'Show or hide previously selected lists';
    label.addEventListener('click', () => {
      setFrequentCollapsed(!isFrequentCollapsed());
      applyCollapseState();
    });
  }

  const toggle = enabled
    ? buildControl(FREQ_ICONS.toggleOn, 'Turn off Previously selected', () => {
        setFrequentEnabled(false);
        refreshFrequentSection();
      })
    : buildControl(FREQ_ICONS.toggleOff, 'Show Previously selected', () => {
        setFrequentEnabled(true);
        refreshFrequentSection();
      });

  if (enabled) {
    label.appendChild(
      buildControls(
        buildControl(FREQ_ICONS.close, 'Clear Previously selected', () => {
          saveFrequencies({});
          refreshFrequentSection();
        }),
        toggle,
      ),
    );
  } else {
    // Disabled: dim + strike through the label, keep the toggle always visible.
    label.classList.add('wishlist-freq-disabled');
    label.style.color = '#b4b8b8';
    label.style.fontStyle = 'italic';
    label.style.textDecoration = 'line-through';
    label.appendChild(buildControls(toggle));
  }
  return label;
};

const buildDivider = (): HTMLHRElement =>
  el('hr', {
    id: FREQ_DIVIDER_ID,
    style: { border: 'none', borderTop: '1px solid #e7e7e7', margin: '4px 0' },
  });

/** Attach the per-row remove/disable controls to a moved list `<li>`. */
const decorateItem = (li: HTMLElement, name: string): void => {
  li.querySelector(':scope > .wishlist-freq-ctrls')?.remove();
  li.appendChild(
    buildControls(
      buildControl(FREQ_ICONS.close, 'Remove from Previously selected', () => {
        removeName(name);
        refreshFrequentSection();
      }),
      buildControl(FREQ_ICONS.block, 'Never show this list here', () => {
        disableName(name);
        refreshFrequentSection();
      }),
    ),
  );
};

/**
 * Build the "Previously selected" section. Returns a fragment to insert
 * (or null if nothing to render).
 */
export const buildFrequentSection = (): DocumentFragment | null => {
  if (!isFrequentEnabled()) return null;

  const listUl = getListUl();
  if (!listUl) return null;

  const topNames = getTopFrequentNames(CONFIG.frequentListsCount);
  if (topNames.length === 0) return null;

  // Map name -> original <li> for quick lookup.
  const nameToOriginal = new Map<string, HTMLElement>();
  for (const li of getListItems()) {
    const name = getListItemName(li);
    if (name && !nameToOriginal.has(name)) nameToOriginal.set(name, li);
  }

  // Container <ul> mirrors the main list's classes so items keep styling.
  const ul = el('ul', { id: FREQ_SECTION_ID, className: listUl.className });

  for (const name of topNames) {
    const original = nameToOriginal.get(name);
    if (!original) continue;
    // Move the original <li> in — this preserves all Amazon handlers.
    decorateItem(original, name);
    ul.appendChild(original);
  }

  if (ul.children.length === 0) return null;

  // Wrap label + list + divider in a fragment for atomic insertion.
  const fragment = document.createDocumentFragment();
  fragment.append(buildLabel(true), ul, buildDivider());
  return fragment;
};

/**
 * Insert a built section (or label) just above the search field, or above the
 * list `<ul>` if the field isn't present yet. Shared by the initial injection
 * and in-place refreshes so placement stays consistent.
 */
export const insertFrequentSection = (node: Node): void => {
  const wrap = getSearchWrap();
  if (wrap?.parentNode) {
    wrap.parentNode.insertBefore(node, wrap);
    return;
  }
  const listUl = getListUl();
  if (listUl?.parentNode) listUl.parentNode.insertBefore(node, listUl);
};

/**
 * Render the group when the feature is enabled, or the struck-through label
 * with its off-toggle when it's disabled. No-op when enabled but nothing
 * qualifies.
 */
export const renderFrequentSection = (): void => {
  const node = isFrequentEnabled() ? buildFrequentSection() : buildLabel(false);
  if (!node) return;
  insertFrequentSection(node);
  applyCollapseState();
};

/**
 * Move every `<li>` currently in the group back into the main list, dropping
 * its injected controls, so the section can be rebuilt from a clean slate.
 */
const restoreFrequentItems = (): void => {
  const popover = getPopover();
  const listUl = getListUl();
  if (!popover || !listUl) return;
  const section = popover.querySelector(`#${FREQ_SECTION_ID}`);
  if (!section) return;
  for (const li of Array.from(
    section.querySelectorAll<HTMLElement>(':scope > li'),
  )) {
    // Only the group's own controls are stripped — an add-status badge is
    // deliberately left in place so a ✓ survives the group being rebuilt.
    li.querySelector(':scope > .wishlist-freq-ctrls')?.remove();
    listUl.appendChild(li);
  }
};

/** Rebuild the group in the open popover after a control action. */
export const refreshFrequentSection = (): void => {
  // Nothing to rebuild (e.g. toggled from the menu before the popover exists).
  if (!getPopover()) return;
  restoreFrequentItems();
  removeFrequentSection();
  renderFrequentSection();
};

/**
 * Expose `window.wishlistSearchFrequent(true|false)` — a quiet console
 * fallback for toggling the "Previously selected" feature (the popover's faint
 * `⊕` is the primary way back). Called with no argument it just reports state.
 * Refreshes the group live if a popover is currently open.
 */
export const installFrequentHelper = (): void => {
  unsafeWindow.wishlistSearchFrequent = (value?: boolean): boolean => {
    if (typeof value === 'boolean') {
      setFrequentEnabled(value);
      refreshFrequentSection();
    }
    return isFrequentEnabled();
  };
};

// Fixed ids, so re-registering updates an entry instead of adding another.
const FREQ_MENU_ID = 'wishlist-search-toggle-frequent';
const CLEAR_MENU_ID = 'wishlist-search-clear-frequent';

// The clear entry's current caption, or undefined while it's not in the menu.
let clearCaption: string | undefined;

/**
 * (Re)register the toggle with a caption reflecting the current state, and
 * show the clear entry — with how many lists it would clear — only while the
 * group is on and has history.
 */
const syncFrequentMenu = async (): Promise<void> => {
  const enabled = isFrequentEnabled();
  try {
    await GM.registerMenuCommand(
      `${enabled ? '✓' : '✗'} Show "Previously selected" lists`,
      () => {
        setFrequentEnabled(!isFrequentEnabled());
        refreshFrequentSection();
      },
      { id: FREQ_MENU_ID, autoClose: true },
    );

    const count = getFrequencyCount();
    const caption =
      enabled && count > 0 ? `Clear "Previously selected" lists (${count})` : undefined;
    if (caption === clearCaption) return;
    clearCaption = caption;
    if (caption) {
      // Same id, so a new count updates the entry in place.
      await GM.registerMenuCommand(
        caption,
        () => {
          saveFrequencies({});
          refreshFrequentSection();
        },
        { id: CLEAR_MENU_ID, autoClose: true },
      );
    } else {
      GM.unregisterMenuCommand(CLEAR_MENU_ID);
    }
  } catch (err) {
    log.warn('failed to update the "Previously selected" menu commands', err);
  }
};

/**
 * Add userscript-manager menu commands for the "Previously selected" feature:
 * a toggle whose ✓/✗ tracks the current state, and a clear entry shown only
 * while the group is on and has history. Both follow changes made from the
 * popover controls, the console, or another tab.
 *
 * @returns Nothing.
 * @example
 * installFrequentMenu();
 * // Tampermonkey menu: ✓ Show "Previously selected" lists
 * //                    Clear "Previously selected" lists
 * @source src/frequent-section.ts
 */
export const installFrequentMenu = (): void => {
  void syncFrequentMenu();
  onFrequentEnabledChange(() => void syncFrequentMenu());
  onFrequenciesChange(() => void syncFrequentMenu());
};

/**
 * Wire up a click handler on the popover that records the selected list
 * name. Uses event delegation so it survives Amazon re-rendering.
 *
 * This is the bubble-phase path, used when the item is added by Amazon itself.
 * When `add-interceptor.ts` claims a click in the capture phase this handler
 * never runs, and the interceptor records the selection instead — only once the
 * add is actually confirmed. The two are mutually exclusive, so there's no risk
 * of double-counting and no guard needed here.
 */
export const attachSelectionTracker = (popover: HTMLElement): void => {
  if (popover.dataset.selectionTracked === 'true') return;
  popover.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest(SELECTORS.listItemLink);
    if (!link) return;
    const li = link.closest<HTMLElement>(SELECTORS.listItem);
    const name = li ? getListItemName(li) : null;
    if (name) recordSelection(name);
  });
  popover.dataset.selectionTracked = 'true';
};
