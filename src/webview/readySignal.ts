/**
 * Tell the app when a page is actually ready to show.
 *
 * The reference app holds its splash for a few seconds and then reveals a
 * complete dashboard. Ours revealed the page as soon as it loaded, so the
 * transplanted sections visibly filled in afterwards.
 *
 * The same was true of every inner page, for a subtler reason: a page load
 * finishing is not a page being ready. `injectedJavaScript` runs *at* load end,
 * the sections a listing page shows are rendered by SearchTap after first paint,
 * and the app's cover came off on load end -- so a collection could be revealed
 * as the site's own empty column and fill in afterwards. That is the "it shows
 * the mobile website and then changes" the cover exists to prevent.
 *
 * So this reports readiness per page, and the app pairs it with a hard cap: a
 * missing section delays the reveal briefly rather than trapping the user
 * behind a spinner. Two tags, because the two have different listeners --
 * `dashboard-ready` retires the splash, `page-ready` uncovers a page layer.
 */

import {LISTING_TEST_JS} from './listingPage';

/** Poll interval. Fine-grained: this decides how long a ready page waits. */
const TICK_MS = 150;
/**
 * ~5.4s for the dashboard, which has sections to assemble.
 *
 * This was 66 (~9.9s), and like INNER_TRIES below it was on the wrong side of
 * the deadline it is racing. The splash's own grace period was 2500ms measured
 * from load end, so on any dashboard slower than that the splash came down
 * while this watcher was still counting -- the reveal happened at the one
 * moment nobody had said the dashboard was ready, and what the customer saw was
 * the sections still arriving.
 *
 * So the dashboard now answers first and SPLASH_READY_GRACE_MS (6000) is what
 * it was always meant to be: a failsafe for a signal that never comes. Kept
 * below that with a comfortable margin, because the answer has to travel over
 * the bridge and be acted on.
 */
const HOME_TRIES = 36;
/**
 * ~3.6s for an inner page, and it must stay BELOW the app's own cover cap.
 *
 * The ordering is what matters and it has been wrong in both directions. It was
 * 24 (~3.6s) against a cover cap of 3000ms, which is the wrong way round: the
 * app's cap fired first, so on every slow page the cover came off while this
 * watcher was still counting -- the reveal happened at the one moment nobody had
 * said the page was ready. It was then cut to 16 (~2.4s) to get under that cap.
 *
 * The cap is now PAGE_COVER_CAP_MS = 4200, so 2.4s is no longer buying safety, it
 * is just giving a listing less time than it needs. And what happens at this
 * deadline is not "keep waiting": a styled page reports ready REGARDLESS of
 * whether its grid has arrived (see the interval below). On a collection that
 * meant the cover could come off over the site's own empty column at 2.4s --
 * which is the "it shows the page half-built" this whole watcher exists to
 * prevent.
 *
 * So it goes back to 24, which is what it was designed to be, now that there is
 * room for it: 3.6s answered against a 4.2s cap leaves the same 600ms margin the
 * original arrangement had. Asserted in __tests__/revealBudget.test.ts.
 *
 * Answering is not the same as giving up: reaching this deadline unstyled does
 * NOT report ready (see innerReady). Revealing an unstyled page is the thing
 * the cover exists to prevent, so that case waits for the app's cap instead.
 */
const INNER_TRIES = 24;
/**
 * The hard stop on polling, unstyled or not. ~9s.
 *
 * Only about not leaving an interval running on a page nobody is waiting for:
 * the app revealed this page at its cap seconds ago.
 */
const INNER_MAX_TRIES = 60;
/** How many images are checked for "the top of the page has arrived". */
const IMAGE_SAMPLE = 30;

export const READY_SIGNAL_SCRIPT = `
(function () {
  if (window.__ziglyReadyWatch) { return; }
  window.__ziglyReadyWatch = true;
${LISTING_TEST_JS}

  function path() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p;
  }

  function isHome() {
    var p = path();
    return p === '' || p === '/' || p === '/index';
  }

  /**
   * A SearchTap grid: rendered after first paint, so worth waiting for.
   *
   * The same test the rest of the app makes, compiled from the same list -- see
   * LISTING_PATHS in ../constants/appConstants.
   */
  function isListing() {
    return ziglyIsListing();
  }

  function send(tag) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({tag: tag}));
      }
    } catch (e) {}
  }

  /**
   * Above-the-fold only. Waiting on the whole page would hold the reveal for
   * sections the user cannot see yet, which is slower than the site itself.
   */
  /**
   * A slot the app reserved has finished, one way or the other.
   *
   * Absent is not pending: every one of these sections is one Zigly can add or
   * remove, so a slot that is not on the page is not something to wait for. Only
   * a slot that exists and has not settled counts against readiness.
   */
  function settled(el) {
    return !el || el.getAttribute('data-state') === 'ready';
  }

  function homeReady() {
    var banner = document.querySelector('[id*="homepage_banner"]');
    var cats = document.querySelector('[id*="home_category_section"]');
    if (!banner || !cats) { return false; }

    // The category rail must actually have its tiles, not just its container.
    if (!cats.querySelector('img')) { return false; }

    /*
     * ...and it must be the rail the app is going to keep.
     *
     * The image test above passes on the site's own rail the moment it renders,
     * but ../webview/homeLayout replaces that rail with a different set of
     * Zigly's circles. Passing here on the outgoing node revealed the dashboard
     * and then swapped its topmost element in full view. This is the check that
     * closes that gap; homeLayout settles the attribute on every path, including
     * the ones where the site's own rail is what stays.
     */
    if (!settled(cats)) { return false; }

    // The first breed rail is the first transplant the user sees.
    var breeds = document.getElementById('zigly-breed-dogs');
    if (breeds && breeds.getAttribute('data-state') !== 'ready') { return false; }

    /*
     * The coupon strip, which sits directly below the banner.
     *
     * The only eagerly-loaded transplant (see ../webview/extraSections), so it
     * is the only one of that set that lands inside the first screen. Its slot is
     * reserved with no height, so it arriving after the reveal pushed everything
     * below it down -- a shift the customer reads as the page still building.
     */
    if (!settled(document.getElementById('zigly-x-coupon'))) { return false; }

    return true;
  }

  /**
   * The imagery the customer will be looking at.
   *
   * Not every image on the page -- a Zigly page carries dozens below the fold
   * and they land over several seconds. Only the ones inside the first screen
   * and a half, which is what a reveal actually exposes. An image with no
   * layout yet (zero height) is not counted against readiness: it is either
   * lazy and off screen, or the browser has not got to it, and neither is
   * something to wait on.
   */
  function topImagesIn() {
    var limit = window.innerHeight * 1.5;
    var imgs = document.querySelectorAll('img');
    var checked = 0;
    for (var i = 0; i < imgs.length && checked < ${IMAGE_SAMPLE}; i++) {
      var img = imgs[i];
      var box;
      try { box = img.getBoundingClientRect(); } catch (e) { continue; }
      if (box.height < 24 || box.width < 24) { continue; }
      if (box.top > limit) { continue; }
      checked++;
      if (!img.complete) { return false; }
    }
    return true;
  }

  function innerReady() {
    // The app's own stylesheet is what turns the mobile website into this app's
    // page. Until it is installed there is nothing worth revealing -- this is
    // the check that closes the gap the cover used to leave.
    if (!document.getElementById('zigly-app-styles')) { return false; }
    if (document.readyState !== 'complete') { return false; }

    if (isListing()) {
      /*
       * A listing page that has loaded is usually still an empty column:
       * SearchTap renders its own controls after first paint. Any one of these
       * means the grid has arrived -- SearchTap's controls, or a product card
       * from the theme's own server-rendered grid.
       */
      var grid = document.querySelector(
        'initial-search-sort, initial-search-filters, .card-wrapper'
      );
      if (!grid) { return false; }
    }

    return topImagesIn();
  }

  /**
   * The app's stylesheet is installed. Nothing is worth revealing before it:
   * the whole difference between this app and the mobile website is in it.
   */
  function styled() {
    return !!document.getElementById('zigly-app-styles');
  }

  var home = isHome();
  var ready = home ? homeReady : innerReady;
  var tag = home ? 'dashboard-ready' : 'page-ready';
  var cap = home ? ${HOME_TRIES} : ${INNER_TRIES};
  var stop = home ? ${HOME_TRIES} : ${INNER_MAX_TRIES};

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var done = false;
    try { done = ready(); } catch (e) { done = true; }
    /*
     * Past the deadline, report anyway -- a missing section must delay the
     * reveal, never trap the user -- but never while the page is still
     * unstyled. An unstyled page IS the mobile website, and handing the app
     * permission to show it is the one thing this signal must not do; the app's
     * own cap covers that case instead, so nobody waits for ever either way.
     */
    if (done || (tries > cap && styled()) || tries > stop) {
      clearInterval(timer);
      send(tag);
    }
  }, ${TICK_MS});

  try {
    if (ready()) { clearInterval(timer); send(tag); }
  } catch (e) {}
})();
true;
`;
