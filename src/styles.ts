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
    #wishlist-search {
      display: block;
      box-sizing: border-box;
      width: calc(100% - 16px);
      margin: 8px;
      padding: 6px 10px;
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
  `;
  document.head.appendChild(style);
};
