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
 */
const TARGETS = ['/collections', '/pages/pet-breeds'];
/** Enough to cover the first screen of each page; more is mostly waste. */
const IMAGES_PER_PAGE = 8;

export const PREFETCH_SCRIPT = `
(function () {
  if (window.__ziglyPrefetched) { return; }
  window.__ziglyPrefetched = true;

  var TARGETS = ${JSON.stringify(TARGETS)};
  var LIMIT = ${IMAGES_PER_PAGE};

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
