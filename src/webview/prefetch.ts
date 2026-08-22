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
