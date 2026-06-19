import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import monkey from 'vite-plugin-monkey';

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
        icon: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Cpath%20d='M16%2022%20h24%20a3%203%200%200%201%203%203%20l2.4%2024%20a4%204%200%200%201-4%204.4%20H14.6%20a4%204%200%200%201-4-4.4%20L13%2025%20a3%203%200%200%201%203-3%20z'%20fill='%23232f3e'/%3E%3Cpath%20d='M22%2024%20v-4%20a6%206%200%200%201%2012%200%20v4'%20fill='none'%20stroke='%23232f3e'%20stroke-width='3.5'%20stroke-linecap='round'/%3E%3Ccircle%20cx='44'%20cy='42'%20r='11'%20fill='%23fff'%20stroke='%23ff9900'%20stroke-width='4'/%3E%3Cline%20x1='52'%20y1='50'%20x2='60'%20y2='58'%20stroke='%23ff9900'%20stroke-width='5'%20stroke-linecap='round'/%3E%3C/svg%3E",
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
        grant: 'none',
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
