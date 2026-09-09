/**
 * Report WHICH products SearchTap's filters selected, so a native grid can draw
 * them.
 *
 * WHY THIS EXISTS. The listing grid is native and reads its products from the
 * Storefront API, but the filter screen is SearchTap's -- because SearchTap's
 * facets are not Shopify's and cannot be reproduced from them. Verified live
 * 2026-09-09: the site's filter screen offers Pet type / Sub Category / Product
 * Categories / Brands, Shopify's filter set for the same collection offers
 * Availability / Price / Product type / Category, and SearchTap's counts are
 * not even scoped alike -- it reports `dog (112)` on a collection holding 66
 * products. See ./facetBridge, which reads and drives those facets.
 *
 * So applying a filter happens inside the page, and the answer -- the set of
 * products that survived it -- exists only as SearchTap's rendered grid. This
 * reads the HANDLES out of that grid and posts them; the native screen then
 * asks GraphQL for those handles and draws its own cards. The customer sees one
 * consistent grid throughout, and the products in it are the site's answer
 * rather than this app's guess at it.
 *
 * WHY HANDLES AND NOT THE WHOLE CARD. A handle is an identity; a rendered card
 * is markup carrying a price and a stock state. ../native/listing is already
 * the one place a listing card's figures come from, and reading a second copy
 * of them out of SearchTap's DOM would be two sources for the same number --
 * the drift ../webview/productCard was written to end. It is also far less
 * data: 24 handles is a few hundred bytes where 24 cards is tens of kilobytes.
 *
 * ORDER IS PRESERVED, AND THAT MATTERS. SearchTap's grid is in SearchTap's
 * relevance order, which is part of its answer. The handles are reported in
 * document order and ../native/listing re-orders its GraphQL reply to match --
 * a set would have thrown that away and left the app sorting alphabetically by
 * accident.
 *
 * WHAT WAS READ, AND WHEN. Read out of the served collection HTML and
 * `assets/searchtap.js` on 2026-09-09:
 *
 *   .st-product         one SearchTap card. Its own class, present only on the
 *                       grid SearchTap renders after a filter or sort.
 *   #product-grid       the theme's own server-rendered grid, which is what is
 *                       on the page BEFORE SearchTap replaces it.
 *   a[href*="/products/"]  the card's link. The handle is the segment after
 *                       `/products/`, with any query or fragment dropped.
 *
 * Guarded throughout: a selector that disappears reports an empty list, which
 * the native screen treats as "the bridge has nothing to say" and falls back to
 * its own unfiltered query rather than drawing an empty collection.
 */
import {LISTING_TEST_JS} from './listingPage';

/** How often the grid is re-read while a filter is being applied. */
const TICK_MS = 350;

/**
 * How long to keep watching after an apply. ~10s.
 *
 * A MutationObserver is what actually keeps up with SearchTap; this poll only
 * covers the case where the grid is replaced before the observer is attached.
 */
const TRIES = 30;

/**
 * The most handles reported in one message.
 *
 * SearchTap pages its own grid, so what is on the page is one page of results
 * -- in practice a few dozen. 250 is Shopify's own cap on a `handle` query
 * anyway, so a longer list could not be drawn in one request; the cap keeps a
 * runaway grid from posting a megabyte of ids.
 */
const MAX_HANDLES = 250;

export const RESULTS_BRIDGE_SCRIPT = `
(function () {
  if (window.__ziglyResults) { return; }

${LISTING_TEST_JS}
  if (!ziglyIsListing()) { return; }

  window.__ziglyResults = true;

  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  /**
   * The handle out of a product URL.
   *
   * indexOf and slice rather than a regular expression: this file reaches the
   * page through a JavaScript template literal, which eats a lone backslash --
   * so a pattern written here would arrive mangled and match nothing. The same
   * reason ./facetBridge's 'squash' is a character loop. See the memory note
   * on template literals.
   */
  function handleOf(href) {
    if (!href) { return ''; }
    var at = href.indexOf('/products/');
    if (at === -1) { return ''; }
    var rest = href.slice(at + '/products/'.length);
    var cut = rest.length;
    var stops = ['?', '#', '/'];
    for (var i = 0; i < stops.length; i++) {
      var found = rest.indexOf(stops[i]);
      if (found !== -1 && found < cut) { cut = found; }
    }
    return rest.slice(0, cut);
  }

  /**
   * Whether SearchTap has taken the grid over.
   *
   * Before a filter or a sort, the grid on the page is the theme's own
   * server-rendered '#product-grid' and the native screen's GraphQL query
   * already covers it -- reporting those handles would be the app reading the
   * page to learn what it already knew. '.st-product' appears only once
   * SearchTap has replaced it, which is exactly when its answer is worth
   * reading.
   */
  function searchtapGrid() {
    return document.querySelectorAll('.st-product').length > 0;
  }

  /** Every handle in the rendered grid, in document order, deduplicated. */
  function handles() {
    var out = [];
    var seen = {};
    var cards = document.querySelectorAll('.st-product');
    for (var i = 0; i < cards.length && out.length < ${MAX_HANDLES}; i++) {
      var link = cards[i].querySelector('a[href]');
      if (!link) { continue; }
      var handle = handleOf(link.getAttribute('href') || '');
      /*
       * A card links to its product several times over -- the photo, the title
       * and the quick-add all carry the same href -- and 'querySelector' takes
       * the first, so the dedupe is really about a product appearing in two
       * cards (a recommendation rail below the grid, say).
       */
      if (handle && !seen[handle]) {
        seen[handle] = true;
        out.push(handle);
      }
    }
    return out;
  }

  /** Only when the answer changed; this runs off a MutationObserver. */
  var last = '';
  function report() {
    if (!searchtapGrid()) { return; }
    var found;
    try { found = handles(); } catch (e) { return; }
    if (!found.length) { return; }
    var payload = {tag: 'results', handles: found};
    var serialised = JSON.stringify(payload);
    if (serialised === last) { return; }
    last = serialised;
    send(payload);
  }

  /*
   * Watch the whole document rather than the grid element.
   *
   * SearchTap does not fill the theme's grid -- it REPLACES it, so an observer
   * attached to '#product-grid' is watching a node that has been detached and
   * reports nothing ever again. The subtree is large but the callback is
   * cheap and rate-limited by the equality check above.
   */
  var observer = null;
  try {
    observer = new MutationObserver(report);
    observer.observe(document.documentElement, {childList: true, subtree: true});
  } catch (e) {}

  /*
   * And a bounded poll, for the case where SearchTap has already replaced the
   * grid before this script ran -- an observer reports changes, not the state
   * it started in.
   */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    report();
    if (tries >= ${TRIES}) { clearInterval(timer); }
  }, ${TICK_MS});

  report();
})();
true;
`;
