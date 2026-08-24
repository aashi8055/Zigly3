/**
 * Homepage section ordering.
 *
 * The reference app shows the pet categories immediately under the search bar,
 * with the banner carousel below them. The live site ships the opposite order.
 * Both sections are the site's own, so this is a reorder, not new content --
 * exactly the "rearrange existing sections" the brief allows, and nothing is
 * fabricated.
 *
 * Section ids carry a Shopify-generated suffix that changes whenever the theme
 * is re-saved, so we match the stable fragment with [id*=...] rather than the
 * full id.
 */
export const HOME_LAYOUT_SCRIPT = `
(function () {
  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  function reorder() {
    if (!isHome()) { return; }

    var banner = document.querySelector('[id*="homepage_banner"]');
    var cats = document.querySelector('[id*="home_category_section"]');
    var coupon = document.querySelector('[id*="coupon_slider"]');

    if (!banner) { warn('homepage banner section not found'); return; }
    if (!banner.parentNode) { return; }

    var moved = false;

    // 1. Category rail sits directly under the search bar, above the banner.
    if (cats) {
      if (banner.previousElementSibling !== cats) {
        banner.parentNode.insertBefore(cats, banner);
        moved = true;
      }
    } else {
      warn('category section not found');
    }

    // 2. Coupon strip sits directly below the banner.
    //    Zigly adds and removes this section from their homepage, so its
    //    absence is normal and must not be treated as an error.
    if (coupon) {
      if (banner.nextElementSibling !== coupon) {
        banner.parentNode.insertBefore(coupon, banner.nextSibling);
        moved = true;
      }
    }

    if (!moved) { return; }

    // The category rail, banner and coupon strip are Swiper carousels; they
    // cache their geometry on init. Moving a node keeps its listeners but not
    // those measurements, so nudge them to recalculate.
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('resize', true, true);
      window.dispatchEvent(ev);
    }
  }

  /**
   * Swap in the category circles the reference app shows.
   *
   * The homepage serves a different set (Dog, Cat, Pharmacy, Treats, Toys,
   * Beds, Clothing) from the one in the reference recording (Dogs, Cats, Small
   * Pets, Pharmacy, Vet Care, Grooming). Both are Zigly's own sections; this
   * takes the one that matches, in place, keeping its position in the layout.
   */
  function swapCategories() {
    if (!isHome()) { return; }
    var current = document.querySelector('[id*="home_category_section"]');
    if (!current || current.getAttribute('data-zigly-swapped') === 'true') { return; }
    current.setAttribute('data-zigly-swapped', 'true');
    /*
     * Readiness, and this is the marker that matters most on the dashboard.
     *
     * The category circles are the first thing under the search bar, and this
     * function REPLACES them with a different set of Zigly's own. The reveal
     * watcher used to pass as soon as the rail it found had images -- which the
     * site's own rail does, immediately -- so the dashboard was shown and then
     * its topmost element visibly swapped. That is the single most conspicuous
     * "it changes after it appears" on the whole screen.
     *
     * Settled on every path out, including the ones that give up: the site's own
     * rail staying put is a FINAL answer, not a pending one. A slot that never
     * settles would hold the reveal to the deadline for nothing.
     */
    current.setAttribute('data-state', 'loading');

    function settle(el) {
      try { el.setAttribute('data-state', 'ready'); } catch (e) {}
    }

    window.__ziglyFetchSection('/', 'home_category_section')
      .then(function (sec) {
        if (!sec) { settle(current); return; }
        // Same section id would collide with the node being replaced.
        var replacement = document.importNode(sec, true);
        replacement.setAttribute('data-zigly-swapped', 'true');
        /*
         * A second marker, and the difference between the two matters.
         *
         * 'swapped' goes on the node we are REPLACING as well, the moment we
         * start, so that a re-run cannot swap twice. If the fetch then fails,
         * that original node keeps the marker -- and keeps its live Swiper,
         * because it is the section the page rendered and its script ran.
         *
         * This one goes only on the copy that has landed, and a copy has no
         * Swiper: markup inserted through the DOM never executes its scripts.
         * That is what the CSS keys the native horizontal scroller off, so it
         * can never be applied to a rail Swiper is already sliding.
         */
        replacement.setAttribute('data-zigly-native-scroll', 'true');
        settle(replacement);
        if (current.parentNode) {
          current.parentNode.replaceChild(replacement, current);
        } else {
          // Never landed, so the node the page is showing is the original one.
          settle(current);
        }
      })
      .catch(function (e) { warn('category swap failed: ' + e); settle(current); });
  }

  try {
    reorder();
    swapCategories();
  } catch (e) {
    warn('home reorder failed: ' + e);
  }
})();
true;
`;
