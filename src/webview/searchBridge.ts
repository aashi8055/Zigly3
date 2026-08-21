/**
 * Search suggestions, read the way the rest of this app reads Shopify.
 *
 * Why the fetch happens inside the WebView rather than from React Native: the
 * same reason the cart does (see cartBridge.ts). The request then carries the
 * page's own origin, session cookies and user agent, so it is indistinguishable
 * from one the website makes -- no Cloudflare challenge, no second session, and
 * nothing for us to configure.
 *
 * Why not SearchTap: zigly.com's own search is SearchTap, and its client config
 * carries a search-only token. Building on a token lifted out of their APK
 * would mean depending on a credential that can be rotated without notice, on a
 * collection id that changes when the index is rebuilt, and on our traffic
 * landing on their quota and in their search analytics -- and it would mean
 * reimplementing their ranking, their baseline filter, sixteen facets and five
 * sort orders, then keeping all of it in step with whatever they change.
 *
 * `/search/suggest.json` is Shopify's own predictive search: same origin, no
 * key, and one call returns products, query completions and collections
 * together. Verified live (see DATA-SOURCES.md). The authoritative results page
 * is still the site's `/search?q=`, which is SearchTap-rendered and therefore
 * carries their real ranking, facets and sort for free.
 *
 * If Zigly ever grants SearchTap account access, only this file changes.
 */

/** Rows per resource. Shopify caps this at 10. */
export const SUGGEST_LIMIT = 6;

/** Below this, suggestions are noise; the screen shows recents instead. */
export const MIN_QUERY_LENGTH = 2;

/** Long enough that a fast typist makes one request, not eight. */
export const SUGGEST_DEBOUNCE_MS = 300;

/**
 * How long to wait for the page to answer before giving up on a request.
 *
 * Not a network timeout -- the reply can also be lost outright, if the
 * injection lands before the dashboard has a document to run it in. Without
 * this the spinner would keep spinning on a request that is never coming.
 */
export const SUGGEST_TIMEOUT_MS = 6000;

/**
 * Fetch suggestions for `query` and post them back.
 *
 * `token` is echoed in the reply so the app can discard the answer to a
 * keystroke the user has already typed past -- responses do not necessarily
 * arrive in the order they were asked for.
 */
export const suggestScript = (query: string, token: number): string => `
(function () {
  var q = ${JSON.stringify(query)};
  var token = ${JSON.stringify(token)};

  function send(payload) {
    payload.tag = 'search-suggest';
    payload.token = token;
    payload.q = q;
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {
      /* No bridge means nothing is listening; there is nothing to recover. */
    }
  }

  /**
   * 'last' rather than 'hide' for out-of-stock: it is what the storefront
   * itself does, and hiding them would make the app's catalogue look smaller
   * than the site's. Unpublished products never appear here at all, which is
   * Shopify's equivalent of the reference app's isActive filter.
   */
  var url = '/search/suggest.json'
    + '?q=' + encodeURIComponent(q)
    + '&resources[type]=product,query,collection'
    + '&resources[limit]=' + ${SUGGEST_LIMIT}
    + '&resources[options][unavailable_products]=last'
    + '&resources[options][fields]=title,product_type,variants.title,vendor';

  fetch(url, {credentials: 'same-origin'})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (json) {
      var results = json && json.resources && json.resources.results;
      if (!results) { send({error: true}); return; }

      var products = [];
      var raw = results.products || [];
      for (var i = 0; i < raw.length; i++) {
        var p = raw[i];
        products.push({
          id: p.id,
          title: p.title,
          url: p.url,
          // 'image' is the suggest payload's own thumbnail; featured_image is
          // the fallback, and on some rows it is an object of nulls.
          image: p.image || (p.featured_image && p.featured_image.url) || null,
          vendor: p.vendor || '',
          available: p.available !== false,
          // Decimal strings here, not the integer paise the AJAX API returns.
          price: p.price,
          compareAt: p.compare_at_price_min || null
        });
      }

      var queries = [];
      var rawQueries = results.queries || [];
      for (var j = 0; j < rawQueries.length; j++) {
        // styled_text carries <mark> markup for the matched span. Dropped: the
        // native rows are not rendering HTML.
        queries.push({text: rawQueries[j].text, url: rawQueries[j].url});
      }

      var collections = [];
      var rawCollections = results.collections || [];
      for (var k = 0; k < rawCollections.length; k++) {
        collections.push({
          title: rawCollections[k].title,
          url: rawCollections[k].url
        });
      }

      send({products: products, queries: queries, collections: collections});
    })
    .catch(function () { send({error: true}); });
})();
true;
`;
