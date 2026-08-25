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

### Added

- `wishlistSearchDebug(true)` now traces the whole search: the pattern the input
  resolved to, how many rows were scanned and how long it took, which lists
  matched, which the result cap held back, and which rows Amazon added after the
  search ran. When nothing matches it prints the first few list names as they
  were read, which is usually enough to see why. `wishlistSearchDebug()`'s
  snapshot also carries the running search's term, pattern and tallies.

### Fixed

- Searching now finds every matching list. Amazon's markup wraps long list
  names across lines, so a name like "3D Printer/Filaments" carried a line
  break where it reads as a space — searching `3d printer` matched only some of
  the lists it should have.
- Lists that Amazon loads into the popover *after* a search has run are now
  filtered too, instead of piling up as unrelated rows underneath the results.
  A search also survives Amazon rebuilding the popover's contents: the term is
  put back and re-applied.
- When more lists match than `maxSearchResults` allows, the notice above the
  list now says so ("Showing 10 of 28 matches") rather than silently dropping
  the rest.
- Highlighting now marks the text the search actually matched, and a list name
  is never re-parsed as HTML on its way back into the row.

## [0.4.1] - 2026-08-21

### Fixed

- Picking a list no longer opens a large empty gap beneath that row in the
  popover.
- The popover now opens with the search box at the top rather than scrolled to
  the bottom edge, so an expanded "Previously selected" group sits one scroll up
  instead of pushing the box out of view.
- The ✕ / toggle / ✓ icons on the right of the popover are inset a little
  further, so an overlay scrollbar no longer paints over them while scrolling.

### Changed

- Expanding the "Previously selected" group now lasts only for that popover
  open. Every open starts collapsed again, instead of an expanded group being
  remembered and filling the popover from then on.

## [0.4.0] - 2026-08-16

### Added

- **Add to several lists without reopening the popover.** Picking a list now adds
  the item in place — the row gets a green **✓** and the popover stays open, so
  you can go straight on to the next list instead of dismissing Amazon's
  confirmation modal and starting over.
- **Undo an add** by hovering its ✓ and clicking the **↩** that replaces it. (If
  the page doesn't expose the ID the removal needs, the ✓ simply stays put with
  no undo arrow.)
- A **⚠** on the row if an add fails, with the reason on hover. Clicking it hands
  the add back to Amazon's own flow, so it always has a way through.
- `wishlistSearchMultiAdd(true|false)` console helper to turn adding-in-place off
  and get Amazon's stock behaviour back (persists across refreshes); call it with
  no argument to read the current state.

### Changed

- The **Previously selected** group is now **collapsible, and starts collapsed** —
  with several remembered lists it used to push the search box out of view before
  you could type. Click the label to expand it; the choice sticks. Searching
  expands it automatically so matches inside it still show.
- The group's controls and the new status icons now sit at the **top** right of a
  row, beside the list name, rather than being centred against the second line.
- Amazon's "active" highlight is cleared when the popover opens, so no list looks
  pre-selected before you've picked one.
- The **Previously selected** group now counts a list only once the add is
  actually confirmed, rather than the moment you click — and undoing an add takes
  its count back off.

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
