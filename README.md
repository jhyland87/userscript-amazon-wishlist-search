# Amazon Wishlist Search

A userscript that adds a search box to Amazon's **Add to List** wishlist popover,
so you can filter long wishlist menus by typing. Optionally keeps a
"Previously selected" group of your most-used lists at the top.

This is the TypeScript source. Builds compile `src/` into a single
`*.user.js` file that Tampermonkey / Violentmonkey / Greasemonkey installs.

## Install (users)

Install a userscript manager (Tampermonkey, Violentmonkey, or Greasemonkey),
then open:

https://github.com/jhyland87/userscript-amazon-wishlist-search/releases/latest/download/amazon-wishlist-search.user.js

The manager will offer to install it. After that it **auto-updates**: the
script's `@updateURL`/`@downloadURL` point at that always-latest release link,
so your manager picks up new releases automatically. The raw `main` branch is
for development and may contain unreleased changes.

## Requirements

- Node.js 18+ (built/tested on Node 22)
- [pnpm](https://pnpm.io/) (pinned via the `packageManager` field — run
  `corepack enable` and pnpm will use the right version automatically)
- A userscript manager (Tampermonkey, Violentmonkey, or Greasemonkey)

## Setup

```bash
pnpm install
```

## Build

```bash
pnpm build
```

This typechecks (`tsc --noEmit`) and then bundles with
[vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey), emitting:

```
dist/amazon-wishlist-search.user.js
```

For local testing, point your userscript manager at that file (drag it in, or
open it directly). The userscript metadata block (`@name`, `@include`,
`@grant`, …) is generated from the `userscript` section of
[`vite.config.ts`](./vite.config.ts) — edit it there, not by hand.

## Develop

```bash
pnpm dev
```

Starts Vite's dev server. vite-plugin-monkey serves an auto-installing
development userscript with hot-reload, so saving a `.ts` file updates the
running script in the browser. Use `pnpm typecheck` to typecheck without
building.

The dev server runs over **HTTPS** (via `vite-plugin-mkcert`). This is required
because HTTPS sites like Amazon block the injected dev script as mixed content
if it's served over HTTP. mkcert installs a locally-trusted CA on first run
(it may prompt for your password once), so the dev entry loads with no
certificate warning. Production builds are unaffected — mkcert only applies to
`pnpm dev`.

If `pnpm dev` still shows nothing on the page, you're likely looking at the
dev *loader* failing to reach the server. The reliable path is always to
`pnpm build` and install `dist/amazon-wishlist-search.user.js` directly — that
file is fully self-contained (no dev server) and behaves like any normal
userscript.

## Test

```bash
pnpm test
```

Uses [Vitest](https://vitest.dev/). `pnpm test` builds first (via the `pretest`
hook), then runs the suite in [`test/`](./test):

- `metadata.test.ts` — asserts on the built `dist/*.user.js`: that `@version`
  matches `package.json`, that `@updateURL`/`@downloadURL` point at the latest
  release asset (and not the raw `main` branch), `@grant none`, and the
  `@include` rules. This guards the auto-update wiring.
- `release.test.ts` — a release-integrity check (mirrors
  [unwall](https://github.com/kelesmert/unwall)): downloads the asset from the
  latest GitHub release, hashes it, and asserts the release notes publish that
  SHA-256. It is **skipped** unless run via `pnpm test:release`
  (`CHECK_GITHUB_RELEASE=1`).

## Release & auto-update

Auto-update works through GitHub Releases: managers poll the `@updateURL`
permalink and update when `@version` increases. The userscript version comes
from `package.json` (vite-plugin-monkey reads it there), so there's a single
source of truth. To cut a release:

1. Bump the version and create the tag in one step:

   ```bash
   pnpm version patch   # or minor / major — updates package.json and tags vX.Y.Z
   git push --follow-tags
   ```

2. The [`release` workflow](./.github/workflows/release.yml) runs on the tag:
   it builds, runs tests, verifies the tag matches `@version`, computes the
   asset's SHA-256, and publishes a GitHub Release with
   `amazon-wishlist-search.user.js` attached and the checksum in the notes.

Because the asset is attached at the stable
`releases/latest/download/amazon-wishlist-search.user.js` URL, every installed
user is updated automatically. `dist/` is not committed — releases are built by
CI.

## Project structure

```
src/
  main.ts             Entry point — wires everything up
  config.ts           CONFIG values and DOM SELECTORS
  dom.ts              Live-popover DOM helpers
  regex.ts            Regex parsing / escaping helpers
  frequencies.ts      localStorage selection-frequency tracking
  frequent-section.ts "Previously selected" group
  result-count.ts     "N results" notice element
  search.ts           Search + debounce + highlight logic
  styles.ts           Injected stylesheet for the input
  inject.ts           Builds and inserts the search UI
  observer.ts         MutationObserver + ESC handling
  log.ts              Prefixed console logger
  types/index.ts      Shared interfaces and types
test/
  metadata.test.ts    Asserts built userscript metadata / auto-update wiring
  release.test.ts     Release SHA-256 integrity check (opt-in)
.github/workflows/    CI (test) and release automation
```

## Configuration

Behaviour is controlled by `CONFIG` in [`src/config.ts`](./src/config.ts):
debounce delay, max results shown, regex mode, the frequent-lists group, and
the localStorage key. When the frequent-lists group is enabled, a
`window.clearWishlistHistory()` helper is exposed in the console to reset it.

### Debug logging

`CONFIG.debug` is the compile-time default, but you can toggle debug logging at
runtime from the browser console — the choice is saved to localStorage and
persists across refreshes (overriding the default):

```js
wishlistSearchDebug(true)   // enable verbose logging
wishlistSearchDebug(false)  // disable it
wishlistSearchDebug()       // print a selector/state snapshot (flag unchanged)
```

Every call also returns a snapshot of which selectors are currently matching,
useful for diagnosing why the input might not appear.
