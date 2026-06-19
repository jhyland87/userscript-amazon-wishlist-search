import { CONFIG, SELECTORS } from './config';
import { getListItems, getListItemName, getListUl, getPopover } from './dom';
import { getTopFrequentNames, recordSelection } from './frequencies';

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

const buildLabel = (): HTMLDivElement => {
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

/**
 * Build the "Previously selected" section. Returns a fragment to insert
 * (or null if nothing to render).
 */
export const buildFrequentSection = (): DocumentFragment | null => {
  if (!CONFIG.enableFrequentLists) return null;

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
    ul.appendChild(original);
  }

  if (ul.children.length === 0) return null;

  // Wrap label + list + divider in a fragment for atomic insertion.
  const fragment = document.createDocumentFragment();
  fragment.appendChild(buildLabel());
  fragment.appendChild(ul);
  fragment.appendChild(buildDivider());
  return fragment;
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
