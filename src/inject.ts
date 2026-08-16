import { attachAddInterceptor } from './add-interceptor';
import { CONFIG, INJECTED_ATTR, SELECTORS } from './config';
import {
  getListUl,
  getPopover,
  getSearchInput,
  isListOpen,
} from './dom';
import {
  attachSelectionTracker,
  renderFrequentSection,
} from './frequent-section';
import { SEARCH_ICONS } from './icons';
import { log } from './log';
import { isRegexEnabled, setRegexEnabled } from './regex-state';
import { createResultCountElement } from './result-count';
import { resetSearchInput, searchTrigger } from './search';
import { injectStylesheet } from './styles';

/**
 * Focus the input — but only if the popover is actually visible, otherwise
 * the focus either silently fails or lands invisibly on a hidden input.
 */
export const searchFocus = (): void => {
  setTimeout(() => {
    if (isListOpen()) getSearchInput()?.focus();
  }, CONFIG.searchFocusDelayMs);
};

const buildSearchInput = (): HTMLInputElement => {
  const input = document.createElement('input');
  Object.assign(input, {
    id: 'wishlist-search',
    type: 'search',
    placeholder: 'Search lists...',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: false,
  });
  input.addEventListener('keydown', () => resetSearchInput(input));
  input.addEventListener('keyup', () => searchTrigger(input.value));
  return input;
};

/** Reflect the current regex-mode state on the toggle's icon and labels. */
const applyRegexToggleState = (button: HTMLElement): void => {
  const on = isRegexEnabled();
  button.style.backgroundImage = `url("${on ? SEARCH_ICONS.regex : SEARCH_ICONS.text}")`;
  const title = on
    ? 'Regex search on — click for plain text'
    : 'Regex search off — click to enable';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.setAttribute('aria-pressed', String(on));
};

/** A regex on/off toggle that lives inside the search input's right edge. */
const buildRegexToggle = (): HTMLSpanElement => {
  const button = document.createElement('span');
  button.id = 'wishlist-search-regex';
  button.setAttribute('role', 'button');
  applyRegexToggleState(button);
  // Keep the input focused when the toggle is clicked.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setRegexEnabled(!isRegexEnabled());
    applyRegexToggleState(button);
    const input = getSearchInput();
    if (input) {
      searchTrigger(input.value);
      input.focus();
    }
  });
  return button;
};

/** The search input wrapped with its inline regex toggle. */
const buildSearchField = (): HTMLDivElement => {
  const wrap = document.createElement('div');
  wrap.id = 'wishlist-search-wrap';
  wrap.appendChild(buildSearchInput());
  wrap.appendChild(buildRegexToggle());
  return wrap;
};

/**
 * Align the popover's right edge to the "Add to List" button's right edge.
 * The popover is wider than the button, so anchoring on the left would push
 * it off to the right; right-alignment keeps it tucked under the dropdown.
 */
const alignToButton = (popover: HTMLElement): void => {
  const btn = document.querySelector<HTMLElement>(SELECTORS.addToListBtn);
  if (!btn) return;
  const btnRect = btn.getBoundingClientRect();
  const targetLeft = `${Math.round(
    btnRect.right + window.scrollX - popover.offsetWidth,
  )}px`;
  if (popover.style.left !== targetLeft) popover.style.left = targetLeft;
};

/**
 * Drop Amazon's "active" highlight from whichever row is carrying it.
 *
 * Amazon marks a row active as the popover opens, which looks like that list is
 * already selected. Cleared once per open (see `observer.ts`) rather than on
 * every mutation, so keyboard navigation can still highlight rows afterwards.
 */
export const clearActiveListItem = (): void => {
  const popover = getPopover();
  if (!popover) return;
  const active = popover.querySelectorAll(SELECTORS.activeItem);
  if (active.length === 0) return;
  for (const element of active) element.classList.remove('a-active');
  log.debug(`cleared active highlight from ${active.length} row(s)`);
};

export const addListSearchInput = (): void => {
  const popover = getPopover();
  if (!popover) {
    log.debug('addListSearchInput: no popover (selector did not match)');
    return;
  }

  // Already injected for this popover instance.
  if (popover.getAttribute(INJECTED_ATTR) === 'true' && getSearchInput()) {
    log.debug('addListSearchInput: already injected, focusing');
    searchFocus();
    return;
  }

  const listUl = getListUl();
  if (!listUl?.parentNode) {
    log.debug(
      'addListSearchInput: list <ul> (#atwl-dd-ul) or its parent not found — ' +
        'nothing to insert before. Run wishlistSearchDebug() for details.',
    );
    return;
  }

  injectStylesheet();

  const field = buildSearchField();
  listUl.parentNode.insertBefore(field, listUl);

  // Render the frequent group above the field. This moves items out of the
  // main list, so it must happen before we measure anything for alignment.
  renderFrequentSection();
  log.debug('addListSearchInput: input inserted');

  // Track clicks on list items so we can build up the frequency map.
  attachSelectionTracker(popover);

  // Add in place instead of letting Amazon's modal take over. Registered in the
  // capture phase, so when it claims a click the tracker above never sees it —
  // the interceptor records the selection itself once the add is confirmed.
  attachAddInterceptor(popover);

  alignToButton(popover);
  requestAnimationFrame(() => {
    alignToButton(popover);
    requestAnimationFrame(() => alignToButton(popover));
  });

  popover.setAttribute(INJECTED_ATTR, 'true');

  createResultCountElement();
  searchFocus();
};
