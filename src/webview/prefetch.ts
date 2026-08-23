/**
 * Warm the next pages while the user is on the dashboard.
 *
 * Prefetching the HTML alone would achieve little: Zigly's pages carry no
 * cache-control header and Cloudflare reports them DYNAMIC, so a navigation
 * refetches the document regardless. What does cache is the imagery on
 * cdn.shopify.com, and images are what make a page feel slow.
 *
 * So each destination is fetched once, its first few images pulled into the
 * WebView's cache, and nothing is stored by us. Navigation then paints from
 * cache instead of the network.
 *
 * Runs only after the dashboard is ready, and only when the app says the
 * connection is unmetered -- this trades data for speed, which is not a trade
 * to make silently on mobile data.
 *
 * The category circles are warmed too, and they are the reason this matters
 * most: they are the first thing under the search bar, so they are the first
 * thing tapped, and every one of them is a fresh ~1-2 MB Zigly page. Warming
 * covers the images; the app's own cover over the layer (see
 * ZiglyWebViewScreen) covers whatever load is left, so the customer never
 * watches a website assemble itself.
 */
/**
 * The two tab destinations, warmed on every run.
 *
 * The category circles are NOT listed here. Their destinations are read off the
 * rail itself at runtime -- see `categoryTargets` below -- because they are
 * Zigly's choice and change with the section: the six circles the dashboard
 * shows point at /pages/zigly-cat, three collections and two service pages
 * today, and writing that list down here would freeze it.
 */
const TARGETS = ['/collections', '/pages/pet-breeds'];
/** Enough to cover the first screen of each page; more is mostly waste. */
const IMAGES_PER_PAGE = 8;
/**
 * A ceiling on how many pages this will warm in total.
 *
 * Six circles plus two tabs is eight pages of HTML and up to sixty-four images.
 * That is a real amount of data, which is why the whole script only runs on an
 * unmetered connection -- and why there is a cap at all, in case a future
 * section ships twenty circles.
 */
const MAX_TARGETS = 10;

export const PREFETCH_SCRIPT = `
(function () {
  if (window.__ziglyPrefetched) { return; }
  window.__ziglyPrefetched = true;

  var LIMIT = ${IMAGES_PER_PAGE};
  var MAX = ${MAX_TARGETS};

  /**
   * Where the category circles actually go.
   *
   * Read from the rail rather than written down, so warming follows whatever
   * Zigly put in the section. Same-origin paths only: a circle pointing at
   * another host is not ours to fetch, and the URL policy would not render it
   * in a layer either.
   */
  function categoryTargets() {
    var out = [];
    try {
      var rail = document.querySelector('[id*="home_category_section"]');
      if (!rail) { return out; }
      var links = rail.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        // The resolved property, so a relative href and an absolute one on our
        // own host both come out comparable.
        var href = links[i].href || '';
        if (!href) { continue; }
        if (href.indexOf(window.location.origin + '/') !== 0) { continue; }
        var path = href.slice(window.location.origin.length);
        // Never warm the page we are already on.
        if (path === '/' || path === window.location.pathname) { continue; }
        if (out.indexOf(path) === -1) { out.push(path); }
      }
    } catch (e) {}
    return out;
  }

  var TARGETS = ${JSON.stringify(TARGETS)}
    .concat(categoryTargets())
    .slice(0, MAX);

  function warm(url) {
    // Fire and forget: a failure here must never surface to the user.
    return fetch(url, {credentials: 'same-origin'}).catch(function () {});
  }

  function imagesFrom(html) {
    var out = [];
    var doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return out;
    }
    var imgs = doc.querySelectorAll('img[src]');
    for (var i = 0; i < imgs.length && out.length < LIMIT; i++) {
      var src = imgs[i].getAttribute('src') || '';
      if (src.indexOf('cdn.shopify.com') === -1 && src.indexOf('/cdn/shop/') === -1) {
        continue;
      }
      out.push(src.indexOf('//') === 0 ? 'https:' + src : src);
    }
    return out;
  }

  /** One page at a time, so this never competes with what the user is doing. */
  function next(i) {
    if (i >= TARGETS.length) { return; }
    fetch(TARGETS[i], {credentials: 'same-origin'})
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) { return; }
        var urls = imagesFrom(html);
        var chain = Promise.resolve();
        urls.forEach(function (u) {
          chain = chain.then(function () { return warm(u); });
        });
        return chain;
      })
      .catch(function () {})
      .then(function () { next(i + 1); });
  }

  // Let the dashboard settle first; it is still finishing its own images.
  setTimeout(function () { next(0); }, 2500);
})();
true;
`;

/**
 * Warm what the customer is most likely to open *from the page they are on*.
 *
 * The script above runs on the dashboard and warms the tabs and the category
 * circles. This one runs on an inner page and warms the destinations on it: the
 * products in a collection grid, the products in a search result, the
 * collections on a breed page.
 *
 * Only the images, and that is the whole design. Zigly's pages carry no
 * cache-control and Cloudflare reports them DYNAMIC, so prefetching the HTML of
 * a product page buys nothing -- the tap refetches it regardless. What caches is
 * cdn.shopify.com, and a product page opens on a full-width gallery image: pull
 * that one file and the tap paints from cache instead of the network, which is
 * most of what "the page took a moment" actually is.
 *
 * The first image of each destination is already in the grid the customer is
 * looking at, at grid size. A product page asks for the same file at a larger
 * width, which is a different URL and a different cache entry -- so the warm is
 * the wider size, not the one already loaded.
 *
 * Bounded hard, one request at a time, and only ever run on an unmetered
 * connection (the caller decides; see ZiglyWebViewScreen). Runs after the page
 * has reported itself ready, so it cannot compete with the load the customer is
 * waiting on.
 */
/** How many destinations on this page are worth warming. */
const PAGE_TARGETS = 6;
/** The width a product page asks its gallery for on a phone. */
const GALLERY_WIDTH = 720;

export const PAGE_PREFETCH_SCRIPT = `
(function () {
  if (window.__ziglyPageWarmed) { return; }
  window.__ziglyPageWarmed = true;

  var MAX = ${PAGE_TARGETS};
  var WIDTH = ${GALLERY_WIDTH};

  /**
   * The first few product images on this page, at gallery width.
   *
   * Read off the cards themselves rather than from a list of handles: the
   * shape of a Zigly grid is Zigly's, and an <img> inside a link to /products/
   * is true of the theme's grid, of SearchTap's grid and of the rails this app
   * transplants -- all three, with no per-template knowledge.
   */
  function targets() {
    var out = [];
    var links;
    try {
      links = document.querySelectorAll('a[href*="/products/"]');
    } catch (e) {
      return out;
    }
    for (var i = 0; i < links.length && out.length < MAX; i++) {
      var img = links[i].querySelector ? links[i].querySelector('img') : null;
      if (!img) { continue; }
      var src = img.getAttribute('src') || '';
      if (!src) { continue; }
      if (src.indexOf('/cdn/shop/') === -1 && src.indexOf('cdn.shopify.com') === -1) {
        continue;
      }
      if (src.indexOf('//') === 0) { src = 'https:' + src; }
      // Shopify sizes an image with a width parameter; asking for the gallery
      // width is asking for the file the product page will ask for.
      var at = src.indexOf('width=');
      var url = at === -1
        ? src + (src.indexOf('?') === -1 ? '?' : '&') + 'width=' + WIDTH
        : src.slice(0, at) + 'width=' + WIDTH;
      if (out.indexOf(url) === -1) { out.push(url); }
    }
    return out;
  }

  /** One at a time, fire and forget: a failure here is never the user's. */
  function next(i, urls) {
    if (i >= urls.length) { return; }
    fetch(urls[i], {credentials: 'same-origin'})
      .catch(function () {})
      .then(function () { next(i + 1, urls); });
  }

  // A breath after the page settles: it is still decoding its own imagery.
  setTimeout(function () {
    try { next(0, targets()); } catch (e) {}
  }, 1200);
})();
true;
`;
