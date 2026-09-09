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
 * `.st-product` IS NOT A CARD, AND THAT WAS THIS FILE'S FIRST BUG.
 *
 * The first version asked for `.st-product` and then for a link INSIDE each
 * match. It reported nothing, ever, and the filter appeared to do nothing at
 * all. Two separate reasons, both already recorded in this codebase:
 *
 *   1. ./productCard's long comment on the same mistake: SearchTap's parts are
 *      FLAT SIBLINGS, not a nest. `st-product`, `st-product-name`,
 *      `st-product-price` and `st-product-details` share a prefix and nothing
 *      else -- there is no card root that its parts sit inside. So
 *      `querySelector('a[href]')` within a `.st-product` finds nothing,
 *      because the link is beside it rather than in it.
 *   2. The only two `class="st-product"` in `assets/searchtap.js` are the
 *      autocomplete LOADING SKELETON -- `<a>` elements with no href at all.
 *      So even the guard that was supposed to mean "SearchTap has taken the
 *      grid over" was reading a placeholder.
 *
 * WHAT IS READ NOW. The product LINK is the anchor, not a card wrapper. Every
 * `a[href*="/products/"]` in the grid region is read and the handles
 * deduplicated -- which is what the reported set actually is, and it needs no
 * opinion about which element is a card or how the parts nest. Read out of
 * `assets/searchtap.js` and the served collection HTML on 2026-09-09, and
 * corrected against the device on 2026-09-10:
 *
 *   .st-product-wrap    the real SearchTap card container -- `.old-price` and
 *                       `.new-price` are its descendants, and `st-w-1/2` is
 *                       what makes the grid two columns.
 *   .st-product-media   that card's image box; it holds an `<a>`.
 *   #product-grid       the theme's own server-rendered grid, which is what is
 *                       on the page BEFORE SearchTap replaces it.
 *   .st-atc / .st-review  SearchTap's own add button and rating chip, used
 *                       only as evidence that its grid is the one rendered.
 *
 * Guarded throughout: a selector that disappears reports nothing, which the
 * native screen treats as "the bridge has nothing to say" -- it keeps its own
 * unfiltered query rather than drawing an empty collection.
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
   * The element SearchTap's results live in, or null when it has not rendered.
   *
   * SearchTap REPLACES the theme's grid rather than filling it, so this is
   * looked up fresh on every read -- a node found once is a node that has
   * since been detached.
   *
   * BOTH SCOPES ARE SEARCHTAP'S OWN, and that is a requirement rather than a
   * preference. '.st-collection-content' was tried here and removed: it is a
   * wrapper in the THEME's own searchtap-collection-template.liquid and the
   * theme's own '#product-grid' sits inside it, so scoping to it would report
   * the server-rendered grid's handles as though a filter had selected them --
   * the exact confusion this bridge exists to avoid. Only elements SearchTap
   * itself creates can stand for "SearchTap answered".
   *
   * Scoped rather than document-wide so a recommendation rail further down the
   * page cannot add its products to a filter's result set.
   */
  function resultsRoot() {
    var scopes = ['.st-product-wrapper', '.st-results'];
    for (var i = 0; i < scopes.length; i++) {
      var found = document.querySelector(scopes[i]);
      /*
       * A scope that holds no product link is SearchTap's empty shell -- it
       * mounts its containers before it has results -- so it is not an answer
       * and the next candidate is tried.
       */
      if (found && found.querySelector('a[href*="/products/"]')) {
        return found;
      }
    }
    return null;
  }

  /**
   * Whether what is rendered is SEARCHTAP's grid rather than the theme's.
   *
   * The distinction is the whole point of the bridge, and a class the two
   * share cannot make it. These four are SearchTap's own and appear on no
   * theme card: its card container, its image box, its add control and its
   * rating chip.
   */
  function searchtapGrid() {
    var root = resultsRoot();
    if (!root) { return false; }
    return !!(
      root.querySelector('.st-product-wrap') ||
      root.querySelector('.st-product-media') ||
      root.querySelector('.st-atc') ||
      root.querySelector('.st-review')
    );
  }

  /**
   * Every product handle in the rendered grid, in document order.
   *
   * THE LINKS ARE THE ANCHOR, not a card wrapper -- see the note at the top of
   * this file on why asking for a link inside '.st-product' found nothing. A
   * card links to its product several times over (the photo, the title and the
   * quick-add all carry the same href), so the dedupe is doing real work here
   * rather than guarding an edge case: without it a grid of 24 products would
   * report 70-odd handles.
   */
  function handles() {
    var root = resultsRoot();
    if (!root) { return []; }
    var out = [];
    var seen = {};
    var links = root.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length && out.length < ${MAX_HANDLES}; i++) {
      var handle = handleOf(links[i].getAttribute('href') || '');
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
