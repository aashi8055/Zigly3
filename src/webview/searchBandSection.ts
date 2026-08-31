/**
 * The search band, as a real section of the page.
 *
 * This is the app's own section, built into the document alongside the ones
 * ./homeLayout arranges -- the category circles, the banner, the coupon strip.
 * It is not furniture drawn over the page: it is a node in the content, so it
 * scrolls with the content because there is nothing else it could do.
 *
 * It got here the long way, and the wrong turns are worth recording because
 * each one looked reasonable:
 *
 *  1. A native band above the WebView, toggled on a scroll threshold. Read as
 *     snapping into place, because it was either there or gone.
 *  2. The same band, translated by an offset accumulated from scroll deltas
 *     with a direction test and a reveal rate. Followed the finger, but a flick
 *     up mid-page dragged search back over content it did not belong to.
 *  3. The same band again, with the page padded to reserve 64px for it. That
 *     produced the bug that ended the approach: the band was still in native
 *     layout ABOVE the WebView, so the reservation was a second, empty space --
 *     a collapsible bar on top and a 64px hole underneath it.
 *
 * The common fault in all three is that the band was never inside the thing
 * that scrolls. Here it is, and the whole of its scroll behaviour is that it is
 * a div in a document.
 *
 * Behaviour is the one thing this adds to the page, which the rules in
 * ./injectedStyles otherwise reserve for the bridges -- and it is deliberately
 * the minimum: a tap that posts a message. The search screen it opens is the
 * app's own, native, unchanged. Nothing here searches.
 */

/**
 * The band's height. Field plus its padding, matching what the native header
 * lays out.
 *
 * Still exported and still checked against the native constant by
 * header.test.tsx: the native band remains what shows on a page where this
 * injection has not landed, so the two heights may not drift.
 */
export const SEARCH_BAND_H = 64;

/** Marks the section, so it is built once and found again on re-runs. */
export const BAND_ID = 'zigly-search-band';

/** The tag the tap posts. Handled on the screen, which opens native search. */
export const BAND_TAP_TAG = 'search-band-tap';

/**
 * The section's styling.
 *
 * Written to match ../components/NativeHeader's own band exactly -- the pale
 * blue #BFD3EE, the white field, the 1px near-black border, the 8px radius --
 * because on a page where this injection has not landed the native band is
 * what shows, and the two must not be distinguishable.
 *
 * `position: static` is asserted rather than assumed: the theme's own section
 * wrappers sometimes carry position, and a sticky or fixed value inherited
 * from a template would turn this back into the furniture it stopped being.
 * Being ordinary flow content is the entire point.
 */
export const SEARCH_BAND_CSS = `
#${BAND_ID} {
  position: static !important;
  display: block !important;
  box-sizing: border-box !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 10px 14px !important;
  background: #BFD3EE !important;
  border: 0 !important;
}
#${BAND_ID} .zigly-band-field {
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
  height: 44px !important;
  padding: 0 12px !important;
  background: #FFFFFF !important;
  border: 1px solid #1B1B1B !important;
  border-radius: 8px !important;
  /* A button, not an input: the real field is on the native search screen. */
  cursor: pointer !important;
  -webkit-tap-highlight-color: transparent !important;
  text-align: left !important;
  font: inherit !important;
}
#${BAND_ID} .zigly-band-lens {
  flex: 0 0 auto !important;
  width: 13px !important;
  height: 13px !important;
  border: 1.6px solid #5A6472 !important;
  border-radius: 50% !important;
  position: relative !important;
}
#${BAND_ID} .zigly-band-lens::after {
  content: '' !important;
  position: absolute !important;
  right: -5px !important;
  bottom: -1px !important;
  width: 6px !important;
  height: 1.8px !important;
  background: #5A6472 !important;
  transform: rotate(45deg) !important;
}
#${BAND_ID} .zigly-band-text {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  font-family: sans-serif !important;
  font-size: 15px !important;
  color: #8C97A8 !important;
  /* One line, clipped: the phrases differ in length and a wrap mid-cycle
     would make the section's height jump. */
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
}
`;

/**
 * Builds the section and keeps it at the top of the page's content.
 *
 * Idempotent by construction, because it is re-injected many times per page --
 * the RESTYLE_DELAYS schedule, every navigation, and Shopify's own section
 * re-renders. Every run finds the existing node by id and does nothing but
 * re-check its position; only the first run builds anything.
 *
 * @param phrases  The rotating prompts, read off the site's own search box.
 * @param typeMs   The site's measured per-letter cadence.
 */
export const buildSearchBandScript = (
  phrases: string[],
  typeMs: number,
): string => `
(function () {
  var PHRASES = ${JSON.stringify(phrases)};
  var TYPE_MS = ${JSON.stringify(typeMs)};
  var HOLD_MS = 1000;
  var ERASE_MS = 50;

  try {
    /*
     * Where the band belongs: first child of the page's main content.
     *
     * Not body's first child -- the theme puts its own markup there, and the
     * app draws its announcement bar and header natively above the WebView.
     * #MainContent is Dawn's content landmark and is present on every template
     * this app shows; the fallbacks are for a template that renames it.
     */
    var host =
      document.querySelector('#MainContent') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]');
    if (!host) { return; }

    var band = document.getElementById(${JSON.stringify(BAND_ID)});

    if (!band) {
      band = document.createElement('div');
      band.id = ${JSON.stringify(BAND_ID)};
      /*
       * A real button, so the platform gives the tap target, the focus ring
       * and the role for free. The label is static and describes the control;
       * the typed prompt inside is marked decorative, because a screen reader
       * reading a half-typed phrase letter by letter is noise.
       */
      var field = document.createElement('button');
      field.type = 'button';
      field.className = 'zigly-band-field';
      field.setAttribute('aria-label', 'Search Zigly');

      var lens = document.createElement('span');
      lens.className = 'zigly-band-lens';
      lens.setAttribute('aria-hidden', 'true');

      var text = document.createElement('span');
      text.className = 'zigly-band-text';
      text.setAttribute('aria-hidden', 'true');

      field.appendChild(lens);
      field.appendChild(text);
      band.appendChild(field);

      /*
       * The one behaviour: hand the tap to the app.
       *
       * preventDefault because this sits inside the theme's markup and a
       * button inside a form would otherwise submit it. The native search
       * screen owns everything past this point -- suggestions, submission,
       * history.
       */
      field.addEventListener('click', function (ev) {
        try {
          ev.preventDefault();
          ev.stopPropagation();
          if (!window.ReactNativeWebView) { return; }
          window.ReactNativeWebView.postMessage(
            JSON.stringify({tag: ${JSON.stringify(BAND_TAP_TAG)}})
          );
        } catch (e) {}
      });
    }

    /*
     * Position, re-checked on every run rather than only at build time.
     *
     * Shopify re-renders sections by replacing subtree innerHTML, and
     * ./homeLayout moves the dashboard's own sections around after this has
     * run. Either can leave the band somewhere other than first. Comparing
     * before moving keeps the common case a no-op, which matters because a
     * pointless insertBefore during a scroll is a relayout.
     */
    if (host.firstChild !== band) {
      host.insertBefore(band, host.firstChild);
    }

    /*
     * The typewriter.
     *
     * One timeout, re-armed per frame rather than an interval at a fixed rate:
     * erasing runs at twice the speed of typing and the hold is ten times
     * slower again, so a single interval would either be wrong or would wake
     * up twenty times for every frame it draws. Mirrors
     * ../search/placeholders.ts, which is the native band's version of the
     * same cycle.
     *
     * The running state is stored on the element so a re-run adopts the cycle
     * already going instead of starting a second one -- two timers writing one
     * node is a visible stutter, and this script runs seven times on a normal
     * page load.
     */
    var node = band.querySelector('.zigly-band-text');
    if (!node) { return; }

    if (band.__ziglyTyping) {
      // Already cycling. Refresh the phrases in place, in case the reader has
      // since reported the site's own, then leave the timer alone.
      band.__ziglyPhrases = PHRASES;
      return;
    }
    if (!PHRASES.length) { return; }

    band.__ziglyTyping = true;
    band.__ziglyPhrases = PHRASES;

    var phrase = 0;
    var chars = 0;
    var erasing = false;

    function tick() {
      var list = band.__ziglyPhrases || PHRASES;
      if (!list.length) { return; }
      if (phrase >= list.length) { phrase = 0; }

      var full = String(list[phrase] || '');
      node.textContent = full.slice(0, chars);

      var delay;
      if (!erasing) {
        if (chars < full.length) {
          chars++;
          delay = TYPE_MS;
        } else {
          erasing = true;
          delay = HOLD_MS;
        }
      } else {
        if (chars > 0) {
          chars--;
          delay = ERASE_MS;
        } else {
          erasing = false;
          phrase = (phrase + 1) % list.length;
          delay = TYPE_MS;
        }
      }

      band.__ziglyTimer = setTimeout(tick, delay);
    }

    tick();
  } catch (e) {}
})();
true;
`;

/**
 * Removes the section.
 *
 * For the pages that do not carry it -- a product page, the cart, the account
 * screens, the content pages. Those are mostly separate documents in this
 * app's layer stack, so in practice this rarely has anything to do; it exists
 * for the case where one document's url changes kind under it (a search result
 * navigating to a product) without a fresh load.
 *
 * Clears the timer before detaching, or the cycle would go on writing into a
 * node no longer in the document for as long as the page lived.
 */
export const removeSearchBandScript = (): string => `
(function () {
  try {
    var band = document.getElementById(${JSON.stringify(BAND_ID)});
    if (!band) { return; }
    if (band.__ziglyTimer) { clearTimeout(band.__ziglyTimer); }
    band.__ziglyTyping = false;
    if (band.parentNode) { band.parentNode.removeChild(band); }
  } catch (e) {}
})();
true;
`;
