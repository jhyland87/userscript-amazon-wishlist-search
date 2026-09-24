import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import monkey from 'vite-plugin-monkey';

// The @icon, from assets/icon.svg (also shown in the README). It carries a
// light and a dark version plus a prefers-color-scheme query that picks one.
// Comments and indentation are stripped to keep the data URI short.
const ICON_SVG = readFileSync(new URL('./assets/icon.svg', import.meta.url), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s+/g, ' ')
  .trim();

// https://github.com/lisonge/vite-plugin-monkey
export default defineConfig(({ command }) => ({
  plugins: [
    // Serve the dev server over HTTPS with a locally-trusted certificate.
    // Without HTTPS, `pnpm dev` injects the entry script over http://, which
    // HTTPS sites (Amazon) block as mixed content. mkcert installs a local CA
    // (one-time, may prompt for your password on first run) so the cert is
    // trusted automatically — no manual "accept self-signed cert" step.
    // Only needed in `vite serve` (dev), not for builds.
    ...(command === 'serve' ? [mkcert()] : []),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Amazon Wishlist Search',
        namespace: 'https://github.com/jhyland87/userscript-amazon-wishlist-search',
        // `version` is intentionally omitted: vite-plugin-monkey falls back to
        // the "version" field in package.json, making it the single source of
        // truth. Bump with `pnpm version patch|minor|major` (which also tags).
        description:
          "Adds a text input field to the top of the wishlist popover to add a search feature",
        author: 'Justin Hyland',
        icon: `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`,
        // TLD-agnostic @include rules mirroring the original @match coverage,
        // so the script works on amazon.com, .co.uk, .de, .ca, etc. (@match
        // cannot wildcard the TLD; regex @include can). Passing RegExp values
        // makes vite-plugin-monkey emit `// @include /…/` lines.
        include: [
          /^https:\/\/([a-z0-9-]+\.)?amazon\.[a-z.]+\/.+\/dp\//,
          /^https:\/\/([a-z0-9-]+\.)?amazon\.[a-z.]+\/dp\//,
          /^https:\/\/([a-z0-9-]+\.)?amazon\.[a-z.]+\/gp\/product\//,
          /^https:\/\/([a-z0-9-]+\.)?amazon\.[a-z.]+\/.+\/gp\//,
          /^https:\/\/([a-z0-9-]+\.)?amazon\.[a-z.]+\/gp\//,
        ],
        // Listed explicitly rather than left to autoGrant, which doesn't
        // reliably detect `GM.x` member access. `unsafeWindow` exposes the
        // console helpers and reads Amazon's page globals from the sandbox.
        grant: [
          'GM.addStyle',
          'GM.getValue',
          'GM.setValue',
          'GM.unregisterMenuCommand',
          'GM.deleteValue',
          'GM.listValues',
          'GM.registerMenuCommand',
          'GM.addValueChangeListener',
          'GM_addElement',
          'unsafeWindow',
        ],
        homepage: 'https://github.com/jhyland87/userscript-amazon-wishlist-search',
        updateURL: 'https://github.com/jhyland87/userscript-amazon-wishlist-search/releases/latest/download/amazon-wishlist-search.user.js',
        downloadURL: 'https://github.com/jhyland87/userscript-amazon-wishlist-search/releases/latest/download/amazon-wishlist-search.user.js',
        supportURL: 'https://github.com/jhyland87/userscript-amazon-wishlist-search/issues'
      },
      build: {
        // Emit a plain, readable .user.js (Tampermonkey installs this file).
        fileName: 'amazon-wishlist-search.user.js',
      },
    }),
  ],
  build: {
    // Userscripts are easier to inspect/diff unminified.
    minify: false,
  },
}));
