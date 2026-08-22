/**
 * Keep every banner carousel on the site running, and make the last slide
 * wrap round to the first.
 *
 * The banner is Zigly's own section and its Swiper is Zigly's own instance --
 * nothing here rebuilds it, and not one slide, image or link is touched. What
 * this does is repair three defects in the *configuration* the theme passes to
 * Swiper, using Swiper's own public API on the instance the page already made.
 *
 * All three were read off the live section on 2026-08-22 (Swiper 11.2.4):
 *
 *   new Swiper('... .homepageMainBanner', {
 *     slidesPerView: 1,
 *     autoplay: { delay: 5000, loop: true, stopOnLastSlide: false,
 *                 effect: 'fade' },
 *     pagination: { el: '.swiper-pagination', clickable: true },
 *     ...
 *   })
 *
 * 1. `loop` is nested INSIDE `autoplay`, where Swiper never reads it. So the
 *    carousel does not loop: swipe to the last banner and it is a dead end --
 *    the strip sits there and nothing you do advances it. That is the "banner
 *    stuck" report. Swiper 11's own `rewind` is the documented no-cloning
 *    answer, and it is read at call time, so setting it on the live instance is
 *    enough for the arrows and for autoplay. A manual drag past the end is the
 *    one path `rewind` does not cover, so that is handled explicitly below.
 *
 * 2. Nothing restarts autoplay. A carousel that has stopped -- because Android
 *    throttled its timers while the app was in the background, or because a
 *    transition was interrupted -- has no path back to running. Autoplay is
 *    re-armed whenever the section comes back into view.
 *
 * And because a configuration read cannot prove a carousel is actually moving,
 * there is a watchdog: if a visible banner has not changed slide within twice
 * its own delay, it is nudged. That is what makes this hold whatever the cause
 * of the stall turns out to be on a real device.
 *
 * ONE THING THAT LOOKS LIKE A DEFECT AND IS NOT, so it does not get "fixed"
 * later: `pagination.el` is the document-wide `'.swiper-pagination'` rather
 * than a selector scoped to the section, and this app puts a dozen more
 * elements with that class on the page. Swiper handles it -- `uniqueNavElements`
 * defaults to true, and when a string selector matches more than one node it
 * narrows the match to nodes inside the instance's own element. Verified in the
 * bundle. Re-pointing the dots from here would be pure risk, and Swiper 11's
 * `swiper.pagination` exposes only `el`, `enable` and `disable`, so it could not
 * be done cleanly anyway.
 *
 * Runs on EVERY page, not just the dashboard, because the brief is that a
 * banner must never be stuck wherever one appears -- the pet pages, the
 * collection list and the lifestyle pages all carry one.
 *
 * Transplanted sections are untouched by design: this app deliberately does not
 * run their scripts, so they have no Swiper instance, and `el.swiper` being
 * undefined is exactly the signal to leave them to the native-scroller CSS.
 */

/**
 * Section-id fragments whose carousels count as banners.
 *
 * Matched as fragments because Shopify ids carry a theme-generated suffix. The
 * list is the banner sections the live theme actually renders; anything else
 * with a carousel (product rails, breed circles) is deliberately absent.
 */
const BANNER_SECTIONS = [
  'homepage_banner',
  'custom_single_banner',
  'custom_collection_list_banner',
  'redesign_custom_double_banner',
  'image_banner',
  'about_banner',
];

/** Fallback delay when the theme's own autoplay delay cannot be read. */
const DEFAULT_DELAY_MS = 5000;

/**
 * How often the watchdog looks, and how many delays of stillness it tolerates.
 *
 * Two delays rather than one: a slide change that lands a little late is normal
 * -- Swiper waits for the transition -- and nudging a carousel that was about
 * to move on its own would show as a double advance.
 */
const WATCHDOG_MS = 2500;
const STALL_FACTOR = 2;

export const BANNER_CAROUSEL_SCRIPT = `
(function () {
  if (window.__ziglyBannerCarousel) { return; }
  window.__ziglyBannerCarousel = true;

  var SECTIONS = ${JSON.stringify(BANNER_SECTIONS)};
  var DEFAULT_DELAY = ${DEFAULT_DELAY_MS};
  var WATCHDOG_MS = ${WATCHDOG_MS};
  var STALL_FACTOR = ${STALL_FACTOR};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /** Every carousel element inside a banner section, live instance or not. */
  function bannerRoots() {
    var out = [];
    for (var i = 0; i < SECTIONS.length; i++) {
      var hosts = document.querySelectorAll('[id*="' + SECTIONS[i] + '"]');
      for (var h = 0; h < hosts.length; h++) {
        var swipers = hosts[h].querySelectorAll('.swiper');
        for (var s = 0; s < swipers.length; s++) { out.push(swipers[s]); }
      }
    }
    // The main banner also carries its own stable class, which survives a
    // theme re-save that changes the section id.
    var named = document.querySelectorAll('.homepageMainBanner');
    for (var n = 0; n < named.length; n++) { out.push(named[n]); }
    return out;
  }

  function delayOf(sw) {
    var d = sw.params && sw.params.autoplay && sw.params.autoplay.delay;
    return typeof d === 'number' && d > 0 ? d : DEFAULT_DELAY;
  }

  /** Start or resume autoplay, whichever this instance's state calls for. */
  function armAutoplay(sw) {
    if (!sw.autoplay || !sw.params || !sw.params.autoplay) { return; }
    if (!sw.params.autoplay.enabled) { return; }
    try {
      if (sw.autoplay.paused && sw.autoplay.resume) {
        sw.autoplay.resume();
      } else if (!sw.autoplay.running && sw.autoplay.start) {
        sw.autoplay.start();
      }
    } catch (e) {
      /* An autoplay that refuses to start is what the watchdog is for. */
    }
  }

  function stopAutoplay(sw) {
    if (!sw.autoplay || !sw.autoplay.stop) { return; }
    try { sw.autoplay.stop(); } catch (e) {}
  }

  /**
   * Wrap a drag that runs off either end.
   *
   * Deferred to a task of its own on purpose: Swiper emits 'touchEnd' near the
   * top of its own handler and only then decides where to settle, so moving the
   * carousel from inside the event would be overwritten a moment later. By the
   * time this runs Swiper has finished, and isEnd / isBeginning are final.
   */
  function bindDragWrap(sw) {
    sw.on('touchEnd', function () {
      var direction = sw.swipeDirection;
      setTimeout(function () {
        try {
          var last = sw.slides ? sw.slides.length - 1 : 0;
          if (direction === 'next' && sw.isEnd && last > 0) {
            sw.slideTo(0);
          } else if (direction === 'prev' && sw.isBeginning && last > 0) {
            sw.slideTo(last);
          }
        } catch (e) {}
        armAutoplay(sw);
      }, 0);
    });
  }

  /**
   * Autoplay only while the banner is actually in the viewport.
   *
   * On the dashboard the banner is one screen of about twenty, so for almost
   * all of a scroll it is animating something nobody can see -- and it is the
   * thing above every transplanted section, so it is competing with the work
   * that fills them in.
   *
   * It also gets the banner running again on the way back, rather than frozen
   * wherever it was left. Note that this cannot see a WHOLE page being parked
   * off screen: this app moves inner-page layers in the native view tree, which
   * the document's own viewport knows nothing about. Scrolling is what it
   * catches, and scrolling is the common case.
   */
  function bindVisibility(sw, root) {
    if (!window.IntersectionObserver) { armAutoplay(sw); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          try { sw.update(); } catch (e) {}
          armAutoplay(sw);
        } else {
          stopAutoplay(sw);
        }
      }
    }, {rootMargin: '120px 0px'});
    io.observe(root);
  }

  function adopt(root) {
    if (root.getAttribute('data-zigly-banner') === 'true') { return; }

    var sw = root.swiper;
    // No instance means the section's own script never ran -- which for a
    // transplanted section is deliberate. The native-scroller CSS covers those.
    if (!sw || !sw.params) { return; }

    root.setAttribute('data-zigly-banner', 'true');

    try {
      // The theme's own intent, put where Swiper reads it. rewind is checked on
      // every slideNext/slidePrev, so the live instance honours it at once.
      sw.params.rewind = true;
      if (sw.params.autoplay) {
        sw.params.autoplay.stopOnLastSlide = false;
        sw.params.autoplay.disableOnInteraction = false;
      }
    } catch (e) {
      warn('banner params not writable: ' + e);
      return;
    }

    bindDragWrap(sw);

    // Our own reordering moved this section's neighbours, and Swiper caches its
    // geometry, so make it measure again before anything else.
    try { sw.update(); } catch (e) {}

    // Autoplay is the only thing the rest of this watches over, so a carousel
    // without it -- the static single banners -- is finished at the drag wrap.
    if (!sw.params.autoplay || !sw.params.autoplay.enabled) { return; }

    bindVisibility(sw, root);
    watch(sw, root);
  }

  /**
   * Last line of defence: a visible banner that has stopped moving gets nudged.
   *
   * The configuration defects above are the causes we found by reading the
   * site. This catches the ones we did not -- a transition interrupted by the
   * layer being parked, timers throttled while the app was backgrounded -- for
   * which the honest fix is to notice the carousel is still and advance it.
   */
  function watch(sw, root) {
    var lastIndex = sw.activeIndex;
    var lastMove = Date.now();

    sw.on('slideChange', function () {
      lastIndex = sw.activeIndex;
      lastMove = Date.now();
    });

    setInterval(function () {
      try {
        if (sw.destroyed) { return; }
        if (!sw.params || !sw.params.autoplay || !sw.params.autoplay.enabled) { return; }
        if (!sw.slides || sw.slides.length < 2) { return; }
        // A carousel the user cannot see is meant to be still.
        if (!onScreen(root)) { return; }
        // A finger on the strip is not a stall.
        if (sw.animating) { return; }

        if (sw.activeIndex !== lastIndex) {
          lastIndex = sw.activeIndex;
          lastMove = Date.now();
          return;
        }

        if (Date.now() - lastMove < delayOf(sw) * STALL_FACTOR) { return; }

        armAutoplay(sw);
        sw.slideNext();
        lastMove = Date.now();
      } catch (e) {
        /* Never let the watchdog itself become the defect. */
      }
    }, WATCHDOG_MS);
  }

  function onScreen(el) {
    try {
      var r = el.getBoundingClientRect();
      var h = window.innerHeight || document.documentElement.clientHeight;
      return r.bottom > 0 && r.top < h && r.width > 0;
    } catch (e) {
      return true;
    }
  }

  function sweep() {
    var roots = bannerRoots();
    for (var i = 0; i < roots.length; i++) { adopt(roots[i]); }
  }

  /**
   * The theme initialises its carousels inside DOMContentLoaded, which has
   * normally fired by the time this injection lands -- but "normally" is not
   * "always" on Android, and Shopify section re-renders can replace a carousel
   * outright. So sweep a few times, spread out, and stop.
   */
  sweep();
  var attempts = 0;
  var poll = setInterval(function () {
    attempts++;
    sweep();
    if (attempts >= 8) { clearInterval(poll); }
  }, 500);
})();
true;
`;
