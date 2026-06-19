import { installDebugControls } from './debug';
import { installClearHistoryHelper } from './frequencies';
import { log } from './log';
import { startObserver } from './observer';

/**
 * Amazon Wishlist Search — entry point.
 *
 * Adds a search input (and an optional "Previously selected" group) to the
 * "Add to List" wishlist popover on Amazon product pages.
 */
const main = (): void => {
  installDebugControls();
  log.debug('loaded userscript');
  installClearHistoryHelper();
  startObserver();
};

main();
