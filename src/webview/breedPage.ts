/**
 * Place Zigly's Book An Appointment button on the Breed-verse pages.
 *
 * The button is the site's own: an `<a class="sticky-appointment-btn">` to the
 * store locator, `position: fixed`, which the theme's own mobile media query
 * lifts to `bottom: 9rem`. That offset is for the website, where the site's own
 * bottom bar and chat bubble sit underneath it. In the app neither is there --
 * the bottom navigation is native and outside the WebView -- so 9rem lands the
 * button in the middle of the page, over a breed card on the index and over the
 * hero on a breed's own page.
 *
 * Two different fixes, because they are two different screens:
 *
 *   **The index** (/pages/pet-breeds) is a grid of breeds to choose from. There
 *   is no breed to book for yet, so the button is not shown at all.
 *
 *   **A breed's page** keeps it, pinned to the bottom right where a floating
 *   action belongs -- just above the native bottom navigation, since the
 *   WebView's viewport already ends there.
 *
 * Both are scoped to a body class rather than applied to the class outright,
 * because the same button is also on /pages/vet-care-page and
 * /pages/grooming-experience-page. Those screens were not asked about and are
 * left exactly as the site has them.
 *
 * How a breed page is recognised: it carries an `<h1 class="hidden-h1">` -- the
 * theme's visually-hidden page heading, which the vetcare and grooming pages do
 * not have. Verified against the live pages on 2026-08-22. A breed page that
 * ever loses it simply keeps the site's own placement, which is a no-op rather
 * than a broken screen.
 */

/** The Breed-verse index. The same path the Breed-verse tab opens. */
export const BREED_INDEX_PATH = '/pages/pet-breeds';

export const BREED_INDEX_FLAG = 'zigly-breed-index';
export const BREED_PAGE_FLAG = 'zigly-breed-page';

export const BREED_PAGE_SCRIPT = `
(function () {
  var INDEX_PATH = '${BREED_INDEX_PATH}';
  var INDEX_FLAG = '${BREED_INDEX_FLAG}';
  var PAGE_FLAG = '${BREED_PAGE_FLAG}';

  function mark() {
    var body = document.body;
    if (!body) { return false; }
    // The theme's visually-hidden heading, which only the Breed-verse pages
    // carry. Without it this is some other page that happens to show the same
    // button, and none of this applies.
    if (!document.querySelector('h1.hidden-h1')) { return true; }

    var path = window.location.pathname;
    var flag = path.indexOf(INDEX_PATH) === 0 ? INDEX_FLAG : PAGE_FLAG;
    if (body.className.indexOf(flag) === -1) {
      body.className = body.className + ' ' + flag;
    }
    return true;
  }

  try {
    if (!mark()) {
      // Injection can land before <body> exists on a slow first paint.
      document.addEventListener('DOMContentLoaded', mark, {once: true});
    }
  } catch (e) {
    if (window.console && console.warn) {
      console.warn('[ZiglyWebView] breed page flag failed: ' + e);
    }
  }
})();
true;
`;

export const BREED_PAGE_CSS = `
/* ------------------------------------------------------------------
   Book An Appointment, on the Breed-verse pages only.
   See ./breedPage.ts for why this is scoped to a body class.
   ------------------------------------------------------------------ */

/* The index is a list of breeds to pick from; there is nothing to book yet. */
body.${BREED_INDEX_FLAG} .sticky-appointment-btn {
  display: none !important;
}

/* On a breed's own page it is the call to action, so it goes where one goes:
   bottom right, just clear of the native bottom navigation below the WebView.
   Only the offsets are set -- the colour, size and label stay Zigly's. */
body.${BREED_PAGE_FLAG} .sticky-appointment-btn {
  position: fixed !important;
  top: auto !important;
  left: auto !important;
  bottom: 14px !important;
  right: 14px !important;
}
`;
