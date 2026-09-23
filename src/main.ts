import { installDebugControls } from './debug';
import { loadDebugState } from './debug-state';
import { installClearHistoryHelper, loadFrequencyState } from './frequencies';
import { installFrequentHelper, installFrequentMenu } from './frequent-section';
import { loadFrequentState } from './frequent-state';
import { log } from './log';
import { installMultiAddHelper, loadMultiAddState } from './multi-add-state';
import { startObserver } from './observer';
import { loadRegexState } from './regex-state';
import { migrateLegacyStorage } from './storage';

/**
 * Amazon Wishlist Search — entry point.
 *
 * Adds a search input (and an optional "Previously selected" group) to the
 * "Add to List" wishlist popover on Amazon product pages, and adds items to
 * lists in place so the popover stays open.
 *
 * Stored settings are loaded before the observer starts, so the first popover
 * already reflects them.
 */
const main = async (): Promise<void> => {
  await migrateLegacyStorage();
  await Promise.all([
    loadDebugState(),
    loadRegexState(),
    loadFrequentState(),
    loadMultiAddState(),
    loadFrequencyState(),
  ]);
  installDebugControls();
  log.debug('loaded userscript');
  installClearHistoryHelper();
  installFrequentHelper();
  installFrequentMenu();
  installMultiAddHelper();
  startObserver();
};

void main();
