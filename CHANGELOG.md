# Changelog

All notable changes to Amazon Wishlist Search are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released section below is what appears on the GitHub release page — the
release workflow extracts the section matching the tag being built (see
`tools/extractChangelog.js`). Write entries for users: describe what changed for
someone using the script, one line per change, grouped under **Added** /
**Changed** / **Fixed** / **Removed**.

## [Unreleased]

## [0.3.0] - 2026-07-31

### Added

- Manage the **Previously selected** group right from the popover — the controls
  stay hidden until you hover:
  - Hover a list in the group: an **✕** removes just that list, and a **trash**
    icon also blocks it from ever reappearing there.
  - Hover the **Previously selected** label: an **✕** clears the whole group, and
    a **toggle** turns the feature off. While it's off, the label stays (struck
    through) with just the toggle — click it to turn the group back on.
- `wishlistSearchFrequent(true|false)` console helper to toggle the group
  (persists across refreshes); call it with no argument to read the current
  state.
- A **regex toggle** inside the search box's right edge — click it to switch
  between plain-text (**`Txt`**) and regular-expression (**`(.*)`**) matching.
  The choice persists across refreshes.

### Changed

- Regex search is now controlled by that toggle instead of being auto-detected
  from `/pattern/` delimiters in your input.

## [0.2.1] - 2026-06-19

### Changed

- The search box now appears on every Amazon regional domain (e.g. `.co.uk`,
  `.de`, `.ca`, `.co.jp`), not just `amazon.com`.

## [0.2.0] - 2026-06-19

### Added

- Initial release: adds a **Search lists…** box to Amazon's "Add to List"
  wishlist popover, with live filtering, a result count, optional regex search,
  and an optional **Previously selected** group of your most-used lists.
