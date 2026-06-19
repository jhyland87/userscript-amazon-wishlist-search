import { CONFIG, INJECTED_ATTR, SELECTORS } from './config';
import {
  getListUl,
  getPopover,
  getSearchInput,
  isListOpen,
} from './dom';
import {
  attachSelectionTracker,
  buildFrequentSection,
} from './frequent-section';
import { log } from './log';
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

  const input = buildSearchInput();

  // Build the frequent section first — this moves items out of the main
  // list, so it must happen before we measure anything for alignment.
  const frequentSection = buildFrequentSection();

  listUl.parentNode.insertBefore(input, listUl);
  if (frequentSection) listUl.parentNode.insertBefore(frequentSection, input);
  log.debug('addListSearchInput: input inserted', {
    frequentSection: !!frequentSection,
  });

  // Track clicks on list items so we can build up the frequency map.
  attachSelectionTracker(popover);

  alignToButton(popover);
  requestAnimationFrame(() => {
    alignToButton(popover);
    requestAnimationFrame(() => alignToButton(popover));
  });

  popover.setAttribute(INJECTED_ATTR, 'true');

  createResultCountElement();
  searchFocus();
};
