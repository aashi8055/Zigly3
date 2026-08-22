/**
 * Let Top Pets Brands be scrolled by thumb.
 *
 * The section is already styled as a native horizontal scroller -- one brand
 * per card, `overflow-x: auto` on the track, `transform: none` over whatever
 * Swiper wrote (see the Top Pet Brands block in ./injectedStyles.ts). What that
 * could not do is stop Swiper from being *there*.
 *
 * Unlike the category circles, this rail is **moved** rather than copied
 * (./extraSections.ts: `{move: 'home_shop_by_brand_section'}`), and a moved
 * node keeps the Swiper the page already started on it. Verified against the
 * live homepage on 2026-08-22, that instance is created with:
 *
 *   slidesPerView: 'auto', grid: {rows: 2, fill: 'row'}, speed: 1000,
 *   autoplay: {delay: 2500, disableOnInteraction: false}
 *
 * which leaves the rail unusable in two separate ways. Swiper claims the touch
 * stream and calls preventDefault on a horizontal drag, so the browser's own
 * scrolling never starts; and its autoplay drives the rail by transform, which
 * the stylesheet pins at none. The result is a row of brands that neither moves
 * by itself nor moves when pushed.
 *
 * So the instance is stood down rather than the markup changed: autoplay
 * stopped, touch handling given back to the page. The cards, their images,
 * their links and their order stay the section's own.
 *
 * It is deliberately *not* destroyed. The Popular / Emerging tabs run the
 * site's own handler, which calls `currentSwiper.destroy(true, true)` before
 * building a new one for the tab it just opened -- destroying it here first
 * would leave that call working on an instance already torn down. Standing it
 * down leaves the site's sequence intact, and the new instance the tab creates
 * is stood down in turn, on the click that created it.
 */
export const BRAND_RAIL_SCRIPT = `
(function () {
  var SECTION = '[class*="home-brand-section-wrapper"]';
  var RAIL = '[class*="home-shop-brand-swiper-wrapper"]';
  var BOUND = 'data-zigly-brand-bound';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /**
   * Stand one Swiper down.
   *
   * Written against three versions of the same idea because the theme's Swiper
   * version is not ours to pin: \`disable()\` is the modern one, the two flags
   * are what older builds read on every touch. Setting all three is cheap and
   * none of them throws when the property is simply unused.
   */
  function standDown(rail) {
    var sw = rail.swiper;
    if (!sw || sw.destroyed) { return; }
    try {
      if (sw.autoplay && typeof sw.autoplay.stop === 'function') {
        sw.autoplay.stop();
      }
    } catch (e) {}
    try {
      sw.allowTouchMove = false;
      if (sw.params) { sw.params.allowTouchMove = false; }
    } catch (e) {}
    try {
      if (typeof sw.disable === 'function') { sw.disable(); }
    } catch (e) {}
  }

  function standDownAll() {
    var rails = document.querySelectorAll(RAIL);
    for (var i = 0; i < rails.length; i++) { standDown(rails[i]); }
  }

  try {
    var section = document.querySelector(SECTION);
    if (!section) { return; }

    standDownAll();

    // A tab builds a fresh Swiper for the panel it opens. This listener is on
    // the section, so it runs as the click bubbles up out of the tab -- after
    // the site's own handler has finished creating that instance.
    if (!section.getAttribute(BOUND)) {
      section.setAttribute(BOUND, 'true');
      section.addEventListener('click', function () {
        standDownAll();
        // And once more after the current task, for a handler that defers its
        // own initialisation.
        setTimeout(standDownAll, 0);
      });
    }
  } catch (e) {
    warn('brand rail could not be stood down: ' + e);
  }
})();
true;
`;
