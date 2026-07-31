/**
 * Inline SVG icons (as `data:` URIs) for the injected UI. Kept as backgrounds
 * rather than text glyphs so they render consistently across fonts/OSes. Each
 * keeps its original two-tone fill, so a CSS `mask` won't recolor them — they're
 * applied via `background-image` and muted with opacity.
 *
 * Grouped by the UI they belong to.
 *
 * @category Icons
 */

/** Controls for the "Previously selected" group's hover affordances. */
export const FREQ_ICONS = {
  /** An ✕ — remove a row, or clear the whole group. */
  close:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij48cGF0aCBkPSJNMTkgNi40MUwxNy41OSA1IDEyIDEwLjU5IDYuNDEgNSA1IDYuNDEgMTAuNTkgMTIgNSAxNy41OSA2LjQxIDE5IDEyIDEzLjQxIDE3LjU5IDE5IDE5IDE3LjU5IDEzLjQxIDEyeiIgZmlsbD0iYmxhY2siLz48L3N2Zz4=',
  /** A trash can with a clock — block a list from ever reappearing here. */
  block:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjQiIHdpZHRoPSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJibGFjayI+CiAgPCEtLSBUcmFzaCBDYW4gLS0+CiAgPHBhdGggZD0iTTE2IDl2MTBIOFY5aDhtLTEuNS02aC01bC0xIDFINXYyaDE0VjRoLTMuNWwtMS0xek0xOCA3SDZ2MTJjMCAxLjEuOSAyIDIgMmg4YzEuMSAwIDItLjkgMi0yVjd6Ii8+CiAgPCEtLSBDbG9jayBPdmVybGF5IChCb3R0b20gUmlnaHQpIC0tPgogIDxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjUiIGZpbGw9IndoaXRlIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogIDxwb2x5bGluZSBwb2ludHM9IjE2LDE0IDE2LDE2IDE3LjUsMTciIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPg==',
  /** A switch in the ON position — shown while the feature is enabled. */
  toggleOn:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij48cmVjdCB4PSIyIiB5PSI1IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSJibGFjayIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iMTIiIHI9IjQiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
  /** A switch in the OFF position — shown while the feature is disabled. */
  toggleOff:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij48cmVjdCB4PSIyIiB5PSI1IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI5IiBjeT0iMTIiIHI9IjQiIGZpbGw9ImJsYWNrIi8+PC9zdmc+',
} as const;

/** The regex-mode toggle that sits inside the search input. */
export const SEARCH_ICONS = {
  /** `(.*)` — regex mode is on; the input is treated as a pattern. */
  regex:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij48dGV4dCB4PSI1MCUiIHk9IjU2JSIgZm9udC1zaXplPSIxMiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJibGFjayIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+KC4qKTwvdGV4dD48L3N2Zz4=',
  /** `Txt` — regex mode is off; the input is matched literally. */
  text:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgaGVpZ2h0PSIyNCIgd2lkdGg9IjI0Ij48dGV4dCB4PSI1MCUiIHk9IjU2JSIgZm9udC1zaXplPSIxMSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJibGFjayIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+VHh0PC90ZXh0Pjwvc3ZnPg==',
} as const;
