/**
 * Hover/focus styling needs real CSS (inline styles can't express pseudo-
 * classes), so the stylesheet is injected once on first use.
 */
const STYLE_ID = 'wishlist-search-style';

export const injectStylesheet = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #wishlist-search-wrap {
      position: relative;
      margin: 8px;
    }
    #wishlist-search {
      display: block;
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: 6px 32px 6px 10px;
      font-size: 13px;
      line-height: 19px;
      color: #0f1111;
      background-color: #fff;
      border: 1px solid #d5d9d9;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(15, 17, 17, 0.04) inset;
      outline: none;
      transition: border-color 0.1s ease-in-out, box-shadow 0.1s ease-in-out;
    }
    #wishlist-search::placeholder {
      color: #898d8d;
    }
    #wishlist-search:hover {
      border-color: #adb1b8;
    }
    #wishlist-search:focus {
      border-color: #adb1b8;
    }
    /* Regex-mode toggle, tucked inside the input's right edge. The high
       z-index keeps it above Amazon's positioned popover elements, which
       otherwise paint over it (leaving it visible only mid open/close animation). */
    #wishlist-search-regex {
      z-index: 1000;
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 16px;
      opacity: 0.5;
      cursor: pointer;
      user-select: none;
    }
    #wishlist-search-regex:hover {
      opacity: 1;
    }
    /* Frequent-list controls: hidden until the row/label is hovered. */
    #wishlist-search-frequent li,
    #wishlist-search-frequent-label {
      position: relative;
    }
    .wishlist-freq-ctrls {
      position: absolute;
      top: 0;
      right: 6px;
      bottom: 0;
      display: flex;
      gap: 2px;
      align-items: center;
      opacity: 0;
      transition: opacity 0.1s ease-in-out;
      pointer-events: none;
    }
    #wishlist-search-frequent li:hover .wishlist-freq-ctrls,
    #wishlist-search-frequent-label:hover .wishlist-freq-ctrls {
      opacity: 1;
      pointer-events: auto;
    }
    /* When disabled, the label's off-toggle stays visible (not hover-gated) so
       the feature is discoverable — it just brightens on hover. */
    .wishlist-freq-disabled .wishlist-freq-ctrls {
      opacity: 1;
      pointer-events: auto;
    }
    .wishlist-freq-ctrl {
      /* A generous box around a small icon enlarges the click target, so a
         near-miss can't fall through to Amazon's list link and toggle a
         wishlist. The icon is muted until hovered. */
      width: 20px;
      height: 20px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 14px;
      opacity: 0.55;
      cursor: pointer;
      user-select: none;
    }
    .wishlist-freq-ctrl:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
};
