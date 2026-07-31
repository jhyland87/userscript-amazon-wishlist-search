import { CONFIG, SELECTORS } from './config';
import {
  getListItems,
  getListItemName,
  getListUl,
  getPopover,
  getSearchWrap,
} from './dom';
import {
  disableName,
  getTopFrequentNames,
  recordSelection,
  removeName,
  saveFrequencies,
} from './frequencies';
import { isFrequentEnabled, setFrequentEnabled } from './frequent-state';
import { FREQ_ICONS } from './icons';

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
): HTMLSpanElement => {
  const control = document.createElement('span');
  control.className = 'wishlist-freq-ctrl';
  control.style.backgroundImage = `url("${icon}")`;
  control.title = title;
  control.setAttribute('role', 'button');
  control.setAttribute('aria-label', title);
  control.addEventListener('click', (event) => {
    // Never let the click reach Amazon's list-selection or our tracker.
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return control;
};

const buildControls = (...controls: HTMLElement[]): HTMLSpanElement => {
  const container = document.createElement('span');
  container.className = 'wishlist-freq-ctrls';
  for (const control of controls) container.appendChild(control);
  return container;
};

/**
 * The "Previously selected" header. When `enabled`, it carries a clear (✕) and
 * an on-toggle. When disabled, the same text is shown struck-through/italic with
 * only the off-toggle — kept in the same spot and size so toggling doesn't make
 * the control jump or resize.
 */
const buildLabel = (enabled: boolean): HTMLDivElement => {
  const label = document.createElement('div');
  label.id = FREQ_LABEL_ID;
  Object.assign(label.style, {
    fontSize: '10px',
    color: '#898d8d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 14px 2px',
    margin: '0',
  });
  label.textContent = 'Previously selected';

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

const buildDivider = (): HTMLHRElement => {
  const divider = document.createElement('hr');
  divider.id = FREQ_DIVIDER_ID;
  Object.assign(divider.style, {
    border: 'none',
    borderTop: '1px solid #e7e7e7',
    margin: '4px 0',
  });
  return divider;
};

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
  const ul = document.createElement('ul');
  ul.id = FREQ_SECTION_ID;
  ul.className = listUl.className;

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
  fragment.appendChild(buildLabel(true));
  fragment.appendChild(ul);
  fragment.appendChild(buildDivider());
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
  if (node) insertFrequentSection(node);
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
    li.querySelector(':scope > .wishlist-freq-ctrls')?.remove();
    listUl.appendChild(li);
  }
};

/** Rebuild the group in the open popover after a control action. */
export const refreshFrequentSection = (): void => {
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
  window.wishlistSearchFrequent = (value?: boolean): boolean => {
    if (typeof value === 'boolean') {
      setFrequentEnabled(value);
      refreshFrequentSection();
    }
    return isFrequentEnabled();
  };
};

/**
 * Wire up a click handler on the popover that records the selected list
 * name. Uses event delegation so it survives Amazon re-rendering.
 */
export const attachSelectionTracker = (popover: HTMLElement): void => {
  if (popover.dataset.selectionTracked === 'true') return;
  popover.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest('a.a-dropdown-link[id^="atwl-link-to-list-"]');
    if (!link) return;
    const li = link.closest<HTMLElement>(SELECTORS.listItem);
    const name = li ? getListItemName(li) : null;
    if (name) recordSelection(name);
  });
  popover.dataset.selectionTracked = 'true';
};
