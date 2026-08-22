/**
 * Read the wishlist out of the page, then price it from Shopify.
 *
 * The wishlist is the hardest screen in this app to source, and it is worth
 * being precise about why. Verified on 2026-08-22: /pages/swym-wishlist ships
 * no items in its HTML — the served page carries only the theme's heading and
 * "You haven't saved any products yet." Swym fills it in client-side from its
 * own backend, keyed to a shopper id in the page's storage. So there is no
 * server-side endpoint this app can ask "what is on the wishlist", and Swym's
 * own API would mean building on a key lifted out of Zigly's storefront — the
 * same objection that kept search off SearchTap.
 *
 * What is certain, whatever Swym's markup turns out to be, is that a wishlist
 * links to products. So this reads exactly that and nothing else: the product
 * links inside the wishlist container, in the order they appear. No class name
 * of Swym's is required, no price is scraped, and no rendered money string is
 * parsed.
 *
 * Every figure then comes from `/products/{handle}.js`, which DATA-SOURCES.md
 * verifies and which returns integer paise, the compare-at price, the image and
 * the variant list. That is the difference between reading the site and guessing
 * at it: the page says *which* products, Shopify says everything *about* them.
 *
 * The reply reports which container it read from, so one run on a device
 * confirms the root rather than leaving it assumed.
 */

/** Most wishlists are short; this is a bound, not an expectation. */
export const WISHLIST_LIMIT = 40;

/** Swym renders after first paint, so the page is polled rather than trusted. */
export const WISHLIST_POLL_MS = 500;
export const WISHLIST_TRIES = 24;

export const WISHLIST_SCRIPT = `
(function () {
  if (window.__ziglyWishlist) { return; }
  window.__ziglyWishlist = true;

  var LIMIT = ${WISHLIST_LIMIT};
  var sent = false;

  function send(payload) {
    if (sent) { return; }
    sent = true;
    payload.tag = 'wishlist';
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  /**
   * Where to look. Swym's own container first, then the theme's main content —
   * never the whole document, because the header and footer link to products
   * too and those are not on anyone's wishlist. \`main\` / #MainContent is Dawn's
   * documented wrapper, which the rest of this app already relies on.
   */
  function root() {
    var swym = document.querySelector(
      '[class*="swym-wishlist"], [id*="swym-wishlist"], [class*="swym"]'
    );
    if (swym) { return {node: swym, name: 'swym'}; }
    var main = document.querySelector('main, #MainContent');
    if (main) { return {node: main, name: 'main'}; }
    return {node: null, name: 'none'};
  }

  /** Product handles, in the order the page lists them, deduplicated. */
  function handlesIn(node) {
    var out = [];
    var seen = {};
    var links = node.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var match = /\\/products\\/([^\\/?#]+)/.exec(href);
      if (!match) { continue; }
      var handle = match[1];
      if (seen[handle]) { continue; }
      seen[handle] = true;
      out.push(handle);
    }
    return out;
  }

  /** One documented request per product. Order is preserved by index. */
  function price(handles, rootName) {
    var capped = handles.slice(0, LIMIT);
    var items = new Array(capped.length);
    var pending = capped.length;

    function finish() {
      pending--;
      if (pending > 0) { return; }
      var clean = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i]) { clean.push(items[i]); }
      }
      send({items: clean, root: rootName, found: handles.length});
    }

    capped.forEach(function (handle, index) {
      fetch('/products/' + encodeURIComponent(handle) + '.js', {
        credentials: 'same-origin'
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (p) {
          if (p) {
            var variants = p.variants || [];
            items[index] = {
              handle: handle,
              title: p.title,
              url: '/products/' + handle,
              image: p.featured_image ||
                (p.images && p.images.length ? p.images[0] : null),
              // Integer paise, straight from Shopify. Never a parsed string.
              price: p.price,
              compareAt: p.compare_at_price,
              available: p.available !== false,
              variantCount: variants.length,
              /*
               * Only meaningful when there is exactly one variant. With more,
               * the app opens the product page rather than choosing on the
               * customer's behalf.
               */
              variantId: variants.length === 1 ? variants[0].id : null
            };
          }
          finish();
        })
        .catch(finish);
    });
  }

  var tries = 0;
  function look() {
    var found = root();
    if (!found.node) { return false; }
    var handles = handlesIn(found.node);
    if (handles.length) {
      price(handles, found.name);
      return true;
    }
    return false;
  }

  var timer = setInterval(function () {
    tries++;
    var done = false;
    try { done = look(); } catch (e) { done = false; }
    if (done || tries >= ${WISHLIST_TRIES}) {
      clearInterval(timer);
      // Nothing after the whole window: the wishlist really is empty. Saying so
      // is what lets the app show the empty screen instead of a spinner.
      if (!done) { send({items: [], root: root().name, found: 0}); }
    }
  }, ${WISHLIST_POLL_MS});

  try { if (look()) { clearInterval(timer); } } catch (e) {}
})();
true;
`;
