// Builds a minimal Amazon product page + "Add to List" popover for DOM tests
// (run under happy-dom). The markup mirrors only what `SELECTORS` and
// `PAGE_SELECTORS` in src/config.ts look for.

export interface PageOptions {
  /** Whether the popover is visible (`aria-hidden="false"`). */
  open?: boolean;
  /** Page inputs to include; each defaults to present. */
  asin?: string | null;
  csrfToken?: string | null;
  listItemId?: string | null;
}

/** The list id a fixture row gets: its name, stripped to letters and digits. */
export const listIdFor = (name: string): string =>
  `L${name.replace(/[^a-z0-9]/gi, '')}`;

/**
 * Build one wishlist row. The name goes in via `textContent`, so a test can
 * use a name that looks like markup.
 */
export const makeRow = (name: string): HTMLLIElement => {
  const id = listIdFor(name);
  const li = document.createElement('li');
  li.className = 'a-dropdown-item';
  const anchor = document.createElement('a');
  anchor.className = 'a-dropdown-link';
  anchor.id = `atwl-link-to-list-${id}`;
  const declarative = document.createElement('span');
  declarative.className = 'a-declarative';
  declarative.dataset.action = 'atwl-dd';
  declarative.dataset.atwlDd = JSON.stringify({ listExternalId: id, listType: 'wishlist' });
  const nameSpan = document.createElement('span');
  nameSpan.id = `atwl-list-name-${id}`;
  nameSpan.textContent = name;
  declarative.append(nameSpan);
  anchor.append(declarative);
  li.append(anchor);
  return li;
};

const input = (id: string, value: string | null | undefined): string =>
  value == null ? '' : `<input id="${id}" value="${value}">`;

/**
 * Replace the document body with a product page holding a popover whose list
 * contains `names`.
 */
export const mountPage = (names: string[], options: PageOptions = {}): void => {
  const { open = true, asin = 'B0TESTASIN', csrfToken = 'token-1', listItemId = 'ITEM123' } =
    options;
  // A fresh <body> detaches any MutationObserver an earlier test started.
  document.body.replaceWith(document.createElement('body'));
  document.body.innerHTML = `
    ${input('ASIN', asin)}
    ${input('lists-sp-csrf-form-token', csrfToken)}
    ${input('sourceCustomerOrgListItemID', listItemId)}
    <span id="productTitle">Test Product</span>
    <button id="add-to-wishlist-button">Add to List</button>
    <div class="a-popover a-popover-no-header a-arrow-bottom" aria-hidden="${!open}">
      <div id="atwl-popover-inner"><ul id="atwl-dd-ul"></ul></div>
    </div>`;
  addRows(names);
};

/** Append rows to the list, the way Amazon pages more lists in. */
export const addRows = (names: string[]): HTMLLIElement[] => {
  const ul = getUl();
  const rows = names.map(makeRow);
  ul.append(...rows);
  return rows;
};

/**
 * Append the spinner row Amazon ends each page of lists with while more are
 * still to come (markup from a captured `atlaapi` response).
 */
export const addSpinner = (): HTMLLIElement => {
  const li = document.createElement('li');
  li.className = 'lists-addtolist-scroll-spinner-element';
  li.innerHTML =
    '<span class="a-list-item"><div id="lists-addtolist-scroll-spinner" ' +
    'class="a-spinner-wrapper"><span class="a-spinner a-spinner-medium"></span></div></span>';
  getUl().append(li);
  return li;
};

export const getUl = (): HTMLUListElement => {
  const ul = document.querySelector<HTMLUListElement>('#atwl-dd-ul');
  if (!ul) throw new Error('fixture: no list <ul> mounted');
  return ul;
};

export const getPopoverEl = (): HTMLElement => {
  const popover = document.querySelector<HTMLElement>('.a-popover');
  if (!popover) throw new Error('fixture: no popover mounted');
  return popover;
};

/** The row whose list name is exactly `name`. */
export const getRow = (name: string): HTMLLIElement => {
  const row = document
    .querySelector(`#atwl-list-name-${listIdFor(name)}`)
    ?.closest<HTMLLIElement>('li');
  if (!row) throw new Error(`fixture: no row named ${name}`);
  return row;
};

export const getAnchor = (name: string): HTMLAnchorElement => {
  const anchor = getRow(name).querySelector<HTMLAnchorElement>('a.a-dropdown-link');
  if (!anchor) throw new Error(`fixture: row ${name} has no anchor`);
  return anchor;
};

/** Names of the rows currently shown (not `display: none`), in order. */
export const visibleNames = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('#atwl-dd-ul > li.a-dropdown-item'))
    .filter((li) => li.style.display !== 'none')
    .map((li) => li.querySelector('[id^="atwl-list-name-"]')?.textContent ?? '');

/** Let MutationObserver callbacks and queued microtasks run. */
export const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
