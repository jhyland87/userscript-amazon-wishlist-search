import { describe, expect, it } from 'vitest';
import {
  metaValue,
  parseMetadata,
  readPackageJson,
  readUserscript,
} from './userscript-meta';

const RELEASE_ASSET_URL =
  'https://github.com/jhyland87/userscript-amazon-wishlist-search/releases/latest/download/amazon-wishlist-search.user.js';

const script = readUserscript();
const meta = parseMetadata(script);
const pkg = readPackageJson();

describe('userscript metadata', () => {
  it('has a parseable metadata block', () => {
    expect(meta.size).toBeGreaterThan(0);
    expect(metaValue(meta, 'name')).toBe('Amazon Wishlist Search');
  });

  it('version matches package.json (so managers detect updates)', () => {
    expect(metaValue(meta, 'version')).toBe(pkg.version);
  });

  it('auto-update points at the latest GitHub release asset', () => {
    expect(metaValue(meta, 'updateURL')).toBe(RELEASE_ASSET_URL);
    expect(metaValue(meta, 'downloadURL')).toBe(RELEASE_ASSET_URL);
  });

  it('does not distribute from the raw main branch', () => {
    expect(script).not.toMatch(
      /raw\.githubusercontent\.com\/jhyland87\/userscript-amazon-wishlist-search\/(main|master)\//,
    );
  });

  it('runs without privileged grants', () => {
    expect(metaValue(meta, 'grant')).toBe('none');
  });

  it('targets Amazon product pages via @match rules', () => {
    const matches = meta.get('match') ?? [];
    expect(matches.length).toBe(5);
    for (const rule of matches) {
      expect(rule).toContain('amazon.com');
    }
  });
});
