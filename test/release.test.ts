import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/**
 * Release-integrity check (mirrors unwall's approach). Gated behind an env
 * var because it hits the live GitHub API — run with:
 *
 *   pnpm test:release      (sets CHECK_GITHUB_RELEASE=1)
 *
 * It downloads the asset attached to the latest release, hashes it, and
 * asserts the release notes publish that same SHA-256.
 */
const RELEASE_API_URL =
  'https://api.github.com/repos/jhyland87/userscript-amazon-wishlist-search/releases/latest';
const ASSET_NAME = 'amazon-wishlist-search.user.js';
const ENABLED = process.env.CHECK_GITHUB_RELEASE === '1';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}
interface Release {
  body?: string;
  assets?: ReleaseAsset[];
}

const fetchGitHub = async (url: string): Promise<Response> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'wishlist-search-release-integrity-test',
    },
  });
  expect(response.ok, `Expected ${url} to return HTTP 2xx, got ${response.status}`).toBe(true);
  return response;
};

describe.skipIf(!ENABLED)('latest GitHub release integrity', () => {
  it('publishes the uploaded userscript SHA-256 in the release notes', async () => {
    const release = (await (await fetchGitHub(RELEASE_API_URL)).json()) as Release;

    const asset = release.assets?.find((item) => item.name === ASSET_NAME);
    expect(asset, `Expected latest release to include ${ASSET_NAME}`).toBeTruthy();

    const assetResponse = await fetchGitHub(asset!.browser_download_url);
    const assetBuffer = Buffer.from(await assetResponse.arrayBuffer());
    const assetHash = createHash('sha256').update(assetBuffer).digest('hex');

    const releaseHashes = [...String(release.body ?? '').matchAll(/\b[a-f0-9]{64}\b/gi)].map(
      (match) => match[0].toLowerCase(),
    );

    expect(
      releaseHashes.length,
      'Expected release notes to include a SHA-256 checksum',
    ).toBeGreaterThan(0);
    expect(releaseHashes).toContain(assetHash);
  });
});
