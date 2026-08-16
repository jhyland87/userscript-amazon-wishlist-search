import { installDebugControls } from './debug';
import { installClearHistoryHelper } from './frequencies';
import { installFrequentHelper } from './frequent-section';
import { log } from './log';
import { installMultiAddHelper } from './multi-add-state';
import { startObserver } from './observer';

/**
 * Amazon Wishlist Search — entry point.
 *
 * Adds a search input (and an optional "Previously selected" group) to the
 * "Add to List" wishlist popover on Amazon product pages, and adds items to
 * lists in place so the popover stays open.
 */
const main = (): void => {
  installDebugControls();
  log.debug('loaded userscript');
  installClearHistoryHelper();
  installFrequentHelper();
  installMultiAddHelper();
  startObserver();
};

main();
