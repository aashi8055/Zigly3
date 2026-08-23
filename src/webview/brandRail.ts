/**
 * Hand the Top Pet Brands rail back to the browser, so it scrolls by thumb.
 *
 * This is the one dashboard rail whose Swiper is ALIVE. Every other rail in
 * this app is either transplanted (its scripts never run, so `el.swiper` is
 * undefined) or is a banner, which `bannerCarousel.ts` deliberately keeps
 * running. The brand section is neither: `extraSections.ts` *moves* it out of
 * the homepage into the reference order, and moving a node does not touch the
 * Swiper instance attached to it.
 *
 * That is what made the rail unswipeable. Read off the live section on
 * 2026-08-23 (Swiper 11.2.4):
 *
 *   new Swiper('....home-shop-brand-swiper-wrapper....active', {
 *     slidesPerView: 'auto',
 *     spaceBetween: 10,
 *     grid: { rows: 2, fill: 'row' },
 *     speed: 1000,
 *     autoplay: { delay: 2500, disableOnInteraction: false },
 *     loop: false,
 *     ...
 *   })
 *
 * Two things follow from that, and both are felt as "the brands don't scroll
 * properly":
 *
 * 1. Swiper owns the gesture. It binds its own touchstart/touchmove/touchend on
 *    the container, sets `touch-action: pan-y` there (its `swiper-horizontal`
 *    class), and answers a drag by writing a `transform` on the wrapper. The
 *    injected CSS lays this rail out as a native horizontal scroller and pins
 *    `transform: none !important` -- so Swiper computes a translate on every
 *    frame of the drag and none of it ever lands. The finger moves and the rail
 *    does not follow it; what little movement there is comes from whatever part
 *    of the gesture leaks past Swiper's handler into the real scroller. Hence
 *    the stutter.
 *
 * 2. `autoplay` never stops -- `disableOnInteraction: false` means touching the
 *    rail does not even pause it -- so a timer calls `slideNext()` every 2.5s
 *    for as long as the dashboard is open, tugging at a rail the customer is
 *    trying to read.
 *
 * The fix is to destroy the instance rather than reconfigure it. Reconfiguring
 * would mean choosing Swiper's drag physics over the platform's, on the one
 * rail where every neighbour on the dashboard already uses the platform's; the
 * gesture would still be inconsistent with the rest of the page. Destroyed, the
 * scroller the CSS already describes is simply left to work, with the browser's
 * own momentum and rubber-band.
 *
 * `destroy(true, true)` -- the second argument matters. Swiper's grid module
 * positions the second row by writing an inline `margin-top` on those slides,
 * and its drag writes an inline `transform` on the wrapper; cleaning styles
 * removes both at the source instead of leaving the CSS to out-`!important`
 * them. The overrides stay in the stylesheet anyway, because they also cover
 * the window between first paint and this running.
 *
 * WHY THIS CANNOT BE A ONE-SHOT: the section's own tab handler runs
 * `currentSwiper.destroy(true, true)` and then re-initialises a fresh Swiper on
 * the newly active tab, on EVERY Popular/Emerging click. Destroying once at
 * load would last exactly until the first tab tap. So the sweep also runs after
 * a click inside the section -- our listener is on `document`, which in the
 * bubble phase is reached after the theme's own listener on the `li` has
 * already made the new instance.
 *
 * Nothing here touches a card, an image, a link, the order of the brands or the
 * tabs. The tab handler keeps working: it toggles a class, and the class is
 * what the stylesheet reads.
 */

/** Section-id fragment for Top Pet Brands. Fragment, because of the theme suffix. */
const BRAND_SECTION = 'home_shop_by_brand_section';

/**
 * When to sweep after the script lands.
 *
 * The theme initialises inside `DOMContentLoaded`, which has normally fired long
 * before an injected script runs -- but "normally" is not "always" on a cold
 * Android WebView, and `extraSections.ts` may not have moved the section yet
 * either. The ladder covers both without polling for the life of the page.
 */
const SWEEP_DELAYS_MS = [0, 250, 800, 2000, 4000];

export const BRAND_RAIL_SCRIPT = `
(function () {
  if (window.__ziglyBrandRail) { return; }
  window.__ziglyBrandRail = true;

  var SECTION = ${JSON.stringify(BRAND_SECTION)};
  var DELAYS = ${JSON.stringify(SWEEP_DELAYS_MS)};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /** The brand sections on this page, however the theme suffixed their ids. */
  function hosts() {
    return document.querySelectorAll('[id*="' + SECTION + '"]');
  }

  /**
   * Release one carousel element to the browser.
   *
   * Returns true only when a live instance was actually stood down, so the
   * caller can tell "already native" from "nothing found yet".
   */
  function release(el) {
    var sw = el.swiper;
    if (!sw || sw.destroyed) { return false; }
    try {
      // Stopped before destroy rather than relying on it: an autoplay timer
      // that outlives its instance is the one leak here that would keep
      // throwing, once per 2.5s, for the life of the page.
      if (sw.autoplay && sw.autoplay.stop) { sw.autoplay.stop(); }
    } catch (e) {
      warn('brand autoplay would not stop: ' + e);
    }
    try {
      sw.destroy(true, true);
      return true;
    } catch (e) {
      warn('brand swiper would not release: ' + e);
      return false;
    }
  }

  /**
   * Stand down every live Swiper in the brand sections.
   *
   * The mark goes on the section, not the rail, and only once something was
   * genuinely released -- the stylesheet uses it to hide the pagination dots,
   * which are Swiper's control and dead once it is gone. If a release ever
   * fails the dots stay, because then they are the only way to move the rail.
   */
  function sweep() {
    var sections = hosts();
    for (var i = 0; i < sections.length; i++) {
      var rails = sections[i].querySelectorAll('.swiper');
      var released = false;
      for (var r = 0; r < rails.length; r++) {
        if (release(rails[r])) { released = true; }
      }
      if (released) {
        sections[i].setAttribute('data-zigly-brand-native', 'true');
      }
    }
  }

  for (var d = 0; d < DELAYS.length; d++) {
    (function (ms) {
      if (ms === 0) { sweep(); } else { setTimeout(sweep, ms); }
    })(DELAYS[d]);
  }

  /**
   * The Popular / Emerging tabs construct a fresh instance on every tap, so the
   * sweep has to outlive the load. Listened for on document in the bubble
   * phase: by the time the event gets here the theme's own handler on the <li>
   * has run and its replacement instance exists, so this can release it in the
   * same tick and the customer never sees a Swiper-driven frame.
   */
  document.addEventListener('click', function (e) {
    var node = e.target;
    while (node && node !== document) {
      if (node.id && String(node.id).indexOf(SECTION) !== -1) { sweep(); return; }
      node = node.parentNode;
    }
  }, false);
})();
true;
`;
