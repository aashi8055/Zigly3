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

/** Poll interval. Fine-grained: this decides how long a ready page waits. */
const TICK_MS = 150;
/** ~10s for the dashboard, which has sections to assemble. */
const HOME_TRIES = 66;
/**
 * ~2.4s for an inner page, and it must stay BELOW the app's own cover cap.
 *
 * This was 24 (~3.6s), which was longer than PAGE_COVER_CAP_MS -- and that one
 * ordering was the whole of the "it shows the website for a moment" bug. The
 * app's cap fired first, so on every page that was not ready inside three
 * seconds the cover came off while this watcher was still counting: the reveal
 * happened at the one moment nobody had said the page was ready.
 *
 * Now the page always answers first and the cap is what it is meant to be -- a
 * failsafe for a page whose script never ran at all.
 *
 * Answering is not the same as giving up: reaching this deadline unstyled does
 * NOT report ready (see innerReady). Revealing an unstyled page is the thing
 * the cover exists to prevent, so that case waits for the app's cap instead.
 */
const INNER_TRIES = 16;
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

  function path() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p;
  }

  function isHome() {
    var p = path();
    return p === '' || p === '/' || p === '/index';
  }

  /** A SearchTap grid: rendered after first paint, so worth waiting for. */
  function isListing() {
    var p = path();
    return p.indexOf('/collections/') === 0 || p.indexOf('/search') === 0;
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
  function homeReady() {
    var banner = document.querySelector('[id*="homepage_banner"]');
    var cats = document.querySelector('[id*="home_category_section"]');
    if (!banner || !cats) { return false; }

    // The category rail must actually have its tiles, not just its container.
    if (!cats.querySelector('img')) { return false; }

    // The first breed rail is the first transplant the user sees.
    var breeds = document.getElementById('zigly-breed-dogs');
    if (breeds && breeds.getAttribute('data-state') !== 'ready') { return false; }

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
