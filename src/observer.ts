import { INJECTED_ATTR } from './config';
import { getPopover, getSearchInput, isListOpen } from './dom';
import { addListSearchInput, searchFocus } from './inject';
import { log } from './log';
import { searchTrigger } from './search';

/**
 * Persistent observer.
 *
 * An earlier version used a one-shot wait that disconnected on first match.
 * When Amazon rebuilt the popover after a variant change, the new popover was
 * ignored. This observer stays alive for the whole page lifetime and reacts
 * to every new popover that appears.
 */

// The observer fires on nearly every DOM mutation, so log only when the
// observed state actually changes — otherwise debug output floods the console.
let lastState = '';
const traceState = (state: string): void => {
  if (state === lastState) return;
  lastState = state;
  log.debug(`state: ${state}`);
};

const tryInject = (): void => {
  // Only inject after the popover is visible. Injecting earlier (while
  // aria-hidden="true") raced with Amazon's measurement pass and caused the
  // popover to be repositioned after open.
  if (!isListOpen()) {
    traceState(getPopover() ? 'popover present but not open (aria-hidden)' : 'no popover yet');
    return;
  }
  const popover = getPopover();
  if (!popover) {
    traceState('isListOpen() true but popover query returned null');
    return;
  }

  if (popover.getAttribute(INJECTED_ATTR) !== 'true') {
    traceState('popover open — injecting search input');
    addListSearchInput();
    return;
  }
  if (!getSearchInput()) {
    // Defensive: the marker is set but the input is gone (Amazon re-rendered
    // the inner content). Clear the marker and re-inject.
    traceState('marker set but input missing — re-injecting');
    popover.removeAttribute(INJECTED_ATTR);
    addListSearchInput();
    return;
  }
  // Already injected and the popover just became visible — focus it.
  traceState('already injected — focusing input');
  searchFocus();
};

/** ESC clears the search without closing the popover. */
const handleEscape = (event: KeyboardEvent): void => {
  if (event.code !== 'Escape') return;
  if (!isListOpen()) return;

  const input = getSearchInput();
  if (!input || input.value.length === 0) return;

  searchTrigger('');
};

/** Start watching the page for wishlist popovers and wire up ESC handling. */
export const startObserver = (): void => {
  document.addEventListener('keydown', handleEscape);

  // Watch for both:
  //   - childList/subtree changes (new popover nodes after a variant swap)
  //   - aria-hidden flipping "true" -> "false" on an existing popover
  //     (Amazon often keeps the popover in the DOM and toggles visibility).
  // This makes a click handler unnecessary — every path that exposes a live
  // popover fires a mutation we observe.
  const observer = new MutationObserver(tryInject);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden'],
  });

  // Initial attempt in case the popover is somehow already present.
  tryInject();
};
