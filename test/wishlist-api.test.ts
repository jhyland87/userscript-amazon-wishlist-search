import { describe, expect, it } from 'vitest';

import { readFixture } from './fixtures';
import type { Outcome } from '../src/types';
import {
  buildAddBody,
  buildListPagePath,
  buildListViewPath,
  buildRemoveBody,
  classifyAddResponse,
  classifyRemoveResponse,
  describeOutcome,
  extractAddedListName,
  extractCsrfToken,
  findListItemId,
  listIdFromAnchorId,
  parseListTarget,
  parseProductTitle,
  parseStateField,
  readListPage,
  toRemoveListType,
  type ResponseInput,
} from '../src/wishlist-api';

const addSuccess = readFixture('add-success.html');
const signedOut = readFixture('add-signed-out.html');
const removeSuccess = readFixture('remove-success.json');
const removeError = readFixture('remove-error.json');

/** A 200 response carrying `body`, the common case in these tests. */
const ok = (body: string): ResponseInput => ({
  ok: true,
  status: 200,
  redirectedTo: null,
  body,
});

describe('request bodies', () => {
  it('buildAddBody matches the captured request byte for byte', () => {
    expect(
      buildAddBody({
        asin: 'B0B7T9Q524',
        vendorId: 'website.wishlist.detail.add',
        listExternalId: 'AP4XJQR1ZOMM',
        listType: 'wishlist',
      }),
    ).toBe(
      'asin=B0B7T9Q524&vendorId=website.wishlist.detail.add' +
        '&listExternalId=AP4XJQR1ZOMM&listType=wishlist&isAjax=1',
    );
  });

  it('buildRemoveBody matches the captured request byte for byte', () => {
    expect(
      buildRemoveBody({
        sid: '131-8483265-0913921',
        listExternalId: '1AUZ2Z7JLKX7V',
        itemTitle:
          'Lab Vibrator - Dental Laboratory Equipment Roundness Vibrator ' +
          'Oscillator Shaker 4" Round',
        itemExternalId: 'ASIN:B072JVMBP3|ATVPDKIKX0DER',
        itemId: 'I1R2KHG1Z40Z6C',
        listType: 'WishList',
        sort: 'date-added',
        filter: 'unpurchased',
      }),
    ).toBe(
      'sid=131-8483265-0913921&listExternalId=1AUZ2Z7JLKX7V' +
        '&itemTitle=Lab+Vibrator+-+Dental+Laboratory+Equipment+Roundness' +
        '+Vibrator+Oscillator+Shaker+4%22+Round' +
        '&itemExternalId=ASIN%3AB072JVMBP3%7CATVPDKIKX0DER' +
        '&itemId=I1R2KHG1Z40Z6C&listType=WishList&sort=date-added' +
        '&filter=unpurchased',
    );
  });

  it('buildRemoveBody omits itemId entirely when it is unknown', () => {
    const body = buildRemoveBody({
      sid: 's',
      listExternalId: 'L',
      itemTitle: 'T',
      itemExternalId: 'X',
      itemId: null,
      listType: 'WishList',
      sort: 'date-added',
      filter: 'unpurchased',
    });
    expect(body).not.toContain('itemId');
  });

  // Anything unrecognized passes through rather than being mangled.
  it.for([
    ['wishlist', 'WishList'],
    ['WishList', 'WishList'],
    ['Registry', 'Registry'],
  ])('toRemoveListType(%s) is %s, the casing the remove endpoint expects', ([input, expected]) => {
    expect(toRemoveListType(input)).toBe(expected);
  });
});

describe('page value parsing', () => {
  it('parseListTarget reads a row payload', () => {
    expect(
      parseListTarget(
        '{"header":"Add to List","listExternalId":"AP4XJQR1ZOMM",' +
          '"listType":"wishlist","isDefaultAlexaList":false}',
      ),
    ).toEqual({ listExternalId: 'AP4XJQR1ZOMM', listType: 'wishlist' });
  });

  it.for([
    undefined,
    '',
    'not json',
    '{}',
    '{"listExternalId":123,"listType":"wishlist"}',
    '{"listExternalId":"","listType":"wishlist"}',
  ])('parseListTarget rejects the malformed payload %j', (raw) => {
    expect(parseListTarget(raw)).toBeNull();
  });

  it.for([
    ['atwl-link-to-list-AP4XJQR1ZOMM', 'AP4XJQR1ZOMM'],
    ['atwl-link-to-list-', null],
    ['wishlist-search', null],
  ] as const)('listIdFromAnchorId(%s) is %s', ([anchorId, expected]) => {
    expect(listIdFromAnchorId(anchorId)).toBe(expected);
  });

  it.for([
    ['{"vendorId":"website.wishlist.detail.add"}', 'website.wishlist.detail.add'],
    ['{"vendorId":""}', null],
    ['{}', null],
    ['broken', null],
  ] as const)('parseStateField reads vendorId out of %s as %s', ([raw, expected]) => {
    expect(parseStateField(raw, 'vendorId')).toBe(expected);
  });

  it.for([
    ['{"lineItemInputs":[{"productTitle":"Lab Vibrator"}]}', 'Lab Vibrator'],
    ['{"lineItemInputs":[]}', null],
    ['{}', null],
  ] as const)('parseProductTitle reads %s as %s', ([raw, expected]) => {
    expect(parseProductTitle(raw)).toBe(expected);
  });
});

describe('response reading', () => {
  it('extractCsrfToken pulls the rotated token, punctuation intact', () => {
    expect(extractCsrfToken(addSuccess)).toBe(
      'hM+ltWh7WT2hXzKKxxmwPVjH20AtX7XPzlZogc74fPB2AAAAAGqBhwZiYzQ1OWJmZC0z' +
        'ZDM2LTRmODEtYTA2Ni1hZmEwNzdiZmRiZjY=',
    );
  });

  it('extractCsrfToken finds the token whatever order the attributes are in', () => {
    expect(
      extractCsrfToken('<input value="abc123" name="anti-csrftoken-a2z">'),
    ).toBe('abc123');
    expect(extractCsrfToken('<div>nothing here</div>')).toBeNull();
  });

  it('extractAddedListName reads the confirmed list name', () => {
    expect(extractAddedListName(addSuccess)).toBe('Tools');
  });

  it('extractAddedListName decodes entities in the name', () => {
    expect(
      extractAddedListName(
        '<a id="huc-list-link"><span>Justin&#039;s &amp; Co</span></a>',
      ),
    ).toBe("Justin's & Co");
  });
});

describe('classifyAddResponse', () => {
  it('recognizes the captured confirmation fragment', () => {
    expect(classifyAddResponse(ok(addSuccess))).toEqual({
      kind: 'success',
      listName: 'Tools',
    });
  });

  it('matches on element IDs, not on localized copy', () => {
    // The same fragment as served on amazon.de. If this ever fails, someone has
    // started matching the English header text.
    const german = addSuccess.replace('1 item added to', '1 Artikel hinzugefügt zu');
    expect(classifyAddResponse(ok(german))).toEqual({
      kind: 'success',
      listName: 'Tools',
    });
  });

  it('detects a sign-in interstitial from the body', () => {
    expect(classifyAddResponse(ok(signedOut))).toEqual({ kind: 'signed-out' });
  });

  it('detects a sign-in redirect from the final URL', () => {
    expect(
      classifyAddResponse({
        ok: true,
        status: 200,
        redirectedTo: 'https://www.amazon.com/ap/signin?openid.return_to=x',
        body: '',
      }),
    ).toEqual({ kind: 'signed-out' });
  });

  it.for([400, 403])('treats %i as a token problem so the client can retry', (status) => {
    expect(
      classifyAddResponse({ ok: false, status, redirectedTo: null, body: '' }),
    ).toEqual({ kind: 'csrf' });
  });

  it('reports other HTTP failures with their status', () => {
    expect(
      classifyAddResponse({ ok: false, status: 503, redirectedTo: null, body: '' }),
    ).toEqual({ kind: 'http', status: 503 });
  });

  it('flags a 200 that carries no confirmation rather than assuming success', () => {
    expect(classifyAddResponse(ok('<div>who knows</div>'))).toEqual({
      kind: 'unrecognized',
    });
  });
});

describe('classifyRemoveResponse', () => {
  it('recognizes the captured success payload', () => {
    expect(classifyRemoveResponse(ok(removeSuccess))).toEqual({
      kind: 'success',
      listName: null,
    });
  });

  it('keeps the list name when Amazon sends one', () => {
    expect(
      classifyRemoveResponse(
        ok('{"hasError":false,"alertType":"success","listName":"Tools"}'),
      ),
    ).toEqual({ kind: 'success', listName: 'Tools' });
  });

  it('rejects an error payload', () => {
    expect(classifyRemoveResponse(ok(removeError))).toEqual({
      kind: 'unrecognized',
    });
  });

  it('rejects a body that is not JSON at all', () => {
    expect(classifyRemoveResponse(ok('<html>oops</html>'))).toEqual({
      kind: 'unrecognized',
    });
  });
});

describe('describeOutcome', () => {
  it('names the list on success', () => {
    expect(describeOutcome({ kind: 'success', listName: 'Tools' })).toBe(
      'Added to Tools',
    );
  });

  it.for([
    { kind: 'signed-out' },
    { kind: 'csrf' },
    { kind: 'http', status: 503 },
    { kind: 'network', message: 'timed out' },
    { kind: 'unrecognized' },
  ] satisfies Outcome[])('offers the Amazon fallback for a $kind failure', (outcome) => {
    expect(describeOutcome(outcome)).toContain('click to add via Amazon');
  });
});

describe('list pages', () => {
  it('asks for the first page with no parameters', () => {
    expect(buildListPagePath('', 0)).toBe('/hz/wishlist/addtolist/atlpaginate');
  });

  it('sends what Amazon sends for later pages, with the token encoded', () => {
    expect(buildListPagePath('ESHV2_a+b=', 25)).toBe(
      '/hz/wishlist/addtolist/atlpaginate?paginationToken=ESHV2_a%2Bb%3D&listsRenderedSoFar=25&isMobile=false',
    );
  });

  it.for([
    ['atlpaginate-first.json', 'FIXTURE-TOKEN-1'],
    ['atlpaginate-middle.json', 'FIXTURE-TOKEN-2'],
    ['atlpaginate-last.json', ''],
  ])('reads the rows and next token from %s', ([fixture, token]) => {
    const page = readListPage(ok(readFixture(fixture)));
    expect(page?.nextToken).toBe(token);
    expect(page?.content).toContain('atwl-link-to-list-FIXTURELIST');
  });

  it.for([
    ['Amazon flags an error', ok('{"content":"","paginationToken":"","hasError":true}')],
    ['the body is not JSON', ok('<html></html>')],
    ['content is missing', ok('{"paginationToken":"","hasError":false}')],
    ['the request failed', { ok: false, status: 500, redirectedTo: null, body: '{}' }],
    ['it was bounced to sign-in', { ...ok('{}'), redirectedTo: 'https://www.amazon.com/ap/signin' }],
  ] satisfies Array<[string, ResponseInput]>)('returns null when %s', ([, input]) => {
    expect(readListPage(input)).toBeNull();
  });
});

describe('list item lookup', () => {
  const listView = readFixture('list-view.html');

  it('reads a list newest first', () => {
    expect(buildListViewPath('16N7NU7YLAZSR')).toBe('/hz/wishlist/ls/16N7NU7YLAZSR?sort=date-added');
  });

  it.for([
    ['the newest item', 'ASIN:B0FIXTURE1|ATVPDKIKX0DER', 'I1NEWESTITEM00'],
    ['an older item', 'ASIN:B0FIXTURE2|ATVPDKIKX0DER', 'I2OLDERITEM000'],
    ['the same ASIN from another marketplace', 'ASIN:B0FIXTURE3|ATVPDKIKX0DER', 'I3OTHERMKT0000'],
    ['a product not on the list', 'ASIN:B0NOTLISTED|ATVPDKIKX0DER', null],
  ] as const)('finds the line-item ID of %s', ([, itemExternalId, expected]) => {
    expect(findListItemId(listView, itemExternalId)).toBe(expected);
  });

  it('prefers the exact marketplace over a same-ASIN row listed first', () => {
    const otherFirst = listView.replace('ASIN:B0FIXTURE2|ATVPDKIKX0DER', 'ASIN:B0FIXTURE1|A1OTHERMARKET');
    expect(findListItemId(otherFirst, 'ASIN:B0FIXTURE1|ATVPDKIKX0DER')).toBe('I1NEWESTITEM00');
  });

  it('returns null for a page with no item rows', () => {
    expect(findListItemId('<html>sign in</html>', 'ASIN:B0FIXTURE1|ATVPDKIKX0DER')).toBeNull();
  });
});
