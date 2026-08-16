import { describe, expect, it } from 'vitest';

import { readFixture } from './fixtures';
import {
  buildAddBody,
  buildRemoveBody,
  classifyAddResponse,
  classifyRemoveResponse,
  describeOutcome,
  extractAddedListName,
  extractCsrfToken,
  listIdFromAnchorId,
  parseListTarget,
  parseProductTitle,
  parseStateField,
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

  it('toRemoveListType fixes the casing the remove endpoint expects', () => {
    expect(toRemoveListType('wishlist')).toBe('WishList');
    expect(toRemoveListType('WishList')).toBe('WishList');
    // Anything unrecognized passes through rather than being mangled.
    expect(toRemoveListType('Registry')).toBe('Registry');
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

  it('parseListTarget rejects anything malformed', () => {
    expect(parseListTarget(undefined)).toBeNull();
    expect(parseListTarget('')).toBeNull();
    expect(parseListTarget('not json')).toBeNull();
    expect(parseListTarget('{}')).toBeNull();
    expect(parseListTarget('{"listExternalId":123,"listType":"wishlist"}')).toBeNull();
    expect(parseListTarget('{"listExternalId":"","listType":"wishlist"}')).toBeNull();
  });

  it('listIdFromAnchorId recovers the list ID from an anchor', () => {
    expect(listIdFromAnchorId('atwl-link-to-list-AP4XJQR1ZOMM')).toBe('AP4XJQR1ZOMM');
    expect(listIdFromAnchorId('atwl-link-to-list-')).toBeNull();
    expect(listIdFromAnchorId('wishlist-search')).toBeNull();
  });

  it('parseStateField reads the vendor ID out of an a-state blob', () => {
    expect(
      parseStateField('{"vendorId":"website.wishlist.detail.add"}', 'vendorId'),
    ).toBe('website.wishlist.detail.add');
    expect(parseStateField('{"vendorId":""}', 'vendorId')).toBeNull();
    expect(parseStateField('{}', 'vendorId')).toBeNull();
    expect(parseStateField('broken', 'vendorId')).toBeNull();
  });

  it('parseProductTitle reads the turbo-checkout product state', () => {
    expect(
      parseProductTitle('{"lineItemInputs":[{"productTitle":"Lab Vibrator"}]}'),
    ).toBe('Lab Vibrator');
    expect(parseProductTitle('{"lineItemInputs":[]}')).toBeNull();
    expect(parseProductTitle('{}')).toBeNull();
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

  it('treats 400 and 403 as a token problem so the client can retry', () => {
    expect(
      classifyAddResponse({ ok: false, status: 403, redirectedTo: null, body: '' }),
    ).toEqual({ kind: 'csrf' });
    expect(
      classifyAddResponse({ ok: false, status: 400, redirectedTo: null, body: '' }),
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

  it('offers the Amazon fallback on every failure', () => {
    const failures = [
      { kind: 'signed-out' },
      { kind: 'csrf' },
      { kind: 'http', status: 503 },
      { kind: 'network', message: 'timed out' },
      { kind: 'unrecognized' },
    ] as const;
    for (const outcome of failures) {
      expect(describeOutcome(outcome)).toContain('click to add via Amazon');
    }
  });
});
