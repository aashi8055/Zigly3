/**
 * Place Zigly's Book An Appointment button.
 *
 * The button is the site's own: an `<a class="sticky-appointment-btn">` to the
 * store locator, `position: fixed`, which the theme's mobile media query lifts
 * to `bottom: 9rem`. That offset clears the website's own bottom bar and chat
 * bubble. Neither is in the app -- the bottom navigation is native and outside
 * the WebView -- so 9rem lands the button in the middle of the page instead.
 *
 * Verified against the live site on 2026-08-22, it appears on four pages: the
 * Breed-verse index, every breed's own page, /pages/vet-care-page and
 * /pages/grooming-experience-page. All but the first get the same treatment:
 *
 *   **The index** (/pages/pet-breeds) is a grid of breeds to choose from. There
 *   is no breed to book for yet, so the button is not shown at all.
 *
 *   **Everywhere else** it is the call to action, pinned to the bottom right
 *   where a floating action belongs -- just above the native bottom navigation,
 *   since the WebView's viewport already ends there.
 *
 * Scoped to a body class this script sets rather than applied to the class
 * outright, so a page that starts carrying the button later keeps the site's
 * own placement until someone has looked at it.
 */

/** The Breed-verse index. The same path the Breed-verse tab opens. */
export const BREED_INDEX_PATH = '/pages/pet-breeds';

/** Set where the button is the site's answer to "nothing chosen yet". */
export const APPOINTMENT_HIDE_FLAG = 'zigly-appointment-hidden';

/** Set on every other page that carries it. */
export const APPOINTMENT_PIN_FLAG = 'zigly-appointment-pinned';

export const BREED_PAGE_SCRIPT = `
(function () {
  var INDEX_PATH = '${BREED_INDEX_PATH}';
  var HIDE_FLAG = '${APPOINTMENT_HIDE_FLAG}';
  var PIN_FLAG = '${APPOINTMENT_PIN_FLAG}';

  function mark() {
    var body = document.body;
    if (!body) { return false; }
    // Nothing to place on a page that does not carry the button.
    if (!document.querySelector('.sticky-appointment-btn')) { return true; }

    var path = window.location.pathname;
    var flag = path.indexOf(INDEX_PATH) === 0 ? HIDE_FLAG : PIN_FLAG;
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
      console.warn('[ZiglyWebView] appointment button flag failed: ' + e);
    }
  }
})();
true;
`;

export const BREED_PAGE_CSS = `
/* ------------------------------------------------------------------
   Book An Appointment. See ./breedPage.ts for why this is scoped to a
   body class rather than written against the site's class directly.
   ------------------------------------------------------------------ */

/* The Breed-verse index is a list of breeds to pick from; nothing to book. */
body.${APPOINTMENT_HIDE_FLAG} .sticky-appointment-btn {
  display: none !important;
}

/* Bottom right, just clear of the native bottom navigation below the WebView.
   Only the offsets are set -- the colour, size and label stay Zigly's. */
body.${APPOINTMENT_PIN_FLAG} .sticky-appointment-btn {
  position: fixed !important;
  top: auto !important;
  left: auto !important;
  bottom: 14px !important;
  right: 14px !important;
}
`;
