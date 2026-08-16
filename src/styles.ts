import { FREQ_ICONS, STATUS_ICONS } from './icons';

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
    /* The group's label doubles as its expand/collapse control. */
    #wishlist-search-frequent-label[data-expandable="true"] {
      cursor: pointer;
      user-select: none;
    }
    .wishlist-freq-chevron {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 4px;
      vertical-align: -1px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 10px;
      background-image: url("${FREQ_ICONS.chevron}");
      transition: transform 0.12s ease-in-out;
    }
    #wishlist-search-frequent-label[data-collapsed="false"] .wishlist-freq-chevron {
      transform: rotate(90deg);
    }
    /* Frequent-list controls: hidden until the row/label is hovered. */
    #wishlist-search-frequent li,
    #wishlist-search-frequent-label {
      position: relative;
    }
    /* Pinned to the top rather than vertically centred: a row is two lines
       (name over privacy), so centring drags the icons down toward the
       second line instead of sitting beside the name. */
    .wishlist-freq-ctrls {
      position: absolute;
      top: 2px;
      right: 6px;
      display: flex;
      gap: 2px;
      align-items: flex-start;
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
    /* Rows in the main list need a positioning context for the status badge —
       the block above only gives one to rows in the frequent group. */
    #atwl-dd-ul li.a-dropdown-item {
      position: relative;
    }
    /* Per-row add status. Unlike the frequent controls this is persistent
       state, not a hover affordance, so it's always visible. */
    .wishlist-add-status {
      position: absolute;
      /* 3px, not 2px, so this 18px badge centres against the 20px controls
         beside it — see .wishlist-freq-ctrls above. */
      top: 3px;
      right: 6px;
      width: 18px;
      height: 18px;
      background-repeat: no-repeat;
      background-position: center;
      background-size: 14px;
      pointer-events: none;
    }
    .wishlist-add-status[data-state="pending"] {
      box-sizing: border-box;
      border: 2px solid #d5d9d9;
      border-top-color: #898d8d;
      border-radius: 50%;
      animation: wishlist-add-spin 0.7s linear infinite;
    }
    .wishlist-add-status[data-state="added"] {
      background-image: url("${STATUS_ICONS.added}");
    }
    /* The undo affordance appears only when we actually have the item ID the
       remove endpoint needs — otherwise the check is inert. */
    .wishlist-add-status[data-state="added"][data-undo="true"] {
      pointer-events: auto;
      cursor: pointer;
    }
    .wishlist-add-status[data-state="added"][data-undo="true"]:hover {
      background-image: url("${STATUS_ICONS.undo}");
    }
    .wishlist-add-status[data-state="failed"] {
      background-image: url("${STATUS_ICONS.failed}");
      pointer-events: auto;
      cursor: pointer;
    }
    @keyframes wishlist-add-spin {
      to { transform: rotate(360deg); }
    }
    /* Keep long list names clear of the badge, and shift the frequent-group
       controls left so the two never overlap. The sibling selector works
       because the badge is always inserted before the controls. */
    li.a-dropdown-item:has(.wishlist-add-status) .a-list-item {
      padding-right: 26px;
    }
    .wishlist-add-status ~ .wishlist-freq-ctrls {
      right: 30px;
    }
  `;
  document.head.appendChild(style);
};
