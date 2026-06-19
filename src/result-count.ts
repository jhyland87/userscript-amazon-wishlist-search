import { getListUl, getResultCount } from './dom';
import type { StylePatch } from './types';

/** Result-count notice element shown above the list. */

export const createResultCountElement = (): void => {
  if (getResultCount()) return;

  const listUl = getListUl();
  if (!listUl?.parentNode) return;

  const node = document.createElement('span');
  node.id = 'wishlist-search-result-count';
  node.className = 'a-size-small atwl-hz-vertical-align-middle';
  Object.assign(node.style, {
    margin: '5px 0',
    fontWeight: '700',
    width: '100%',
    textAlign: 'center',
    display: 'none',
  });

  listUl.parentNode.insertBefore(node, listUl);
};

export const updateSearchResultTxt = (html: string, style?: StylePatch): void => {
  let node = getResultCount();
  if (!node) {
    createResultCountElement();
    node = getResultCount();
    if (!node) return;
  }
  if (style) Object.assign(node.style, style);
  node.style.display = 'inline-block';
  node.innerHTML = html;
};

export const hideSearchResultTxt = (): void => {
  const node = getResultCount();
  if (node) node.style.display = 'none';
};
