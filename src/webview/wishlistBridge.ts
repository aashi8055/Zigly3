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

/**
 * Remove one product from the wishlist, by driving the site's own control.
 *
 * There is no endpoint to call: the write belongs to Swym, and this app has no
 * Swym credential. What the page does have is the remove control Swym renders
 * next to each saved item — so this finds that control and clicks it, which
 * performs the real write with the site's own session and its own shopper id.
 * The same principle as the sort and filter bar: relocate or press Zigly's
 * controls, never reimplement what is behind them.
 *
 * Two things keep this honest rather than hopeful:
 *
 *   - the control is found structurally, from the tile that links to this
 *     product, and by fragment on the attributes a remove control carries.
 *     Nothing is hardcoded to one release of Swym's markup.
 *   - the result is *verified*. After the click it re-reads the product links
 *     and reports whether the handle actually left the list. A removal that
 *     silently failed would leave the app showing a wishlist that is not the
 *     customer's, which is worse than saying so.
 */
export const removeFromWishlistScript = (handle: string): string => `
(function () {
  var handle = ${JSON.stringify(handle)};
  var MARK = '/products/';
  var sent = false;

  function send(ok, reason) {
    if (sent) { return; }
    sent = true;
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          tag: 'wishlist-removed',
          handle: handle,
          ok: ok,
          reason: reason || ''
        }));
      }
    } catch (e) {}
  }

  function root() {
    var swym = document.querySelector(
      '[class*="swym-wishlist"], [id*="swym-wishlist"], [class*="swym"]'
    );
    if (swym) { return swym; }
    return document.querySelector('main, #MainContent') || document;
  }

  /** Every link in the container that points at this product. */
  function linksFor(node) {
    var out = [];
    var links = node.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length; i++) {
      // Split rather than a regex: a backslash inside a template literal is
      // eaten before the page ever sees it, which is exactly how this shipped
      // broken once -- /\/products\// arrived as //products//.
      var href = links[i].getAttribute('href') || '';
      var at = href.indexOf(MARK);
      if (at === -1) { continue; }
      var seg = href.slice(at + MARK.length).split('/')[0];
      seg = seg.split('?')[0].split('#')[0];
      if (seg === handle) { out.push(links[i]); }
    }
    return out;
  }

  /**
   * The remove control for that product: searched from the link outwards, so
   * it is always the one belonging to this tile and never a neighbour's.
   * Six levels is deep enough for a card and shallow enough not to reach the
   * grid, whose own controls belong to other items.
   */
  var REMOVE = [
    '[class*="swym"][class*="delete"]',
    '[class*="swym"][class*="remove"]',
    '[class*="wishlist"][class*="remove"]',
    '[class*="remove-from"]',
    '[aria-label*="emove"]',
    '[title*="emove"]',
    '[data-action*="remove"]'
  ].join(', ');

  function controlFor(link) {
    var node = link.parentElement;
    for (var depth = 0; node && depth < 6; depth++) {
      var found = node.querySelector(REMOVE);
      if (found) { return found; }
      node = node.parentElement;
    }
    return null;
  }

  function stillListed() {
    return linksFor(root()).length > 0;
  }

  var container = root();
  var links = linksFor(container);
  if (!links.length) {
    // Already gone -- most likely removed on the product page. Nothing to do,
    // and the app is right to have dropped the tile.
    send(true, 'already-absent');
    return;
  }

  var control = controlFor(links[0]);
  if (!control) {
    send(false, 'no-control');
    return;
  }

  /**
   * Some Swym configurations confirm before removing. This page is parked off
   * screen, so a native dialog would appear over the app with no context; and
   * the customer has already asked for the removal by tapping the heart.
   * Stubbed for the click only, then put back -- deliberately narrow, and never
   * touching fetch, storage or cookies.
   */
  var realConfirm = window.confirm;
  window.confirm = function () { return true; };
  try {
    control.click();
  } catch (e) {
    window.confirm = realConfirm;
    send(false, 'click-failed');
    return;
  }
  setTimeout(function () { window.confirm = realConfirm; }, 0);

  // Verify. Swym re-renders the list after its own request completes, so this
  // waits for the tile to actually leave rather than trusting the click.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var gone = false;
    try { gone = !stillListed(); } catch (e) { gone = false; }
    if (gone) {
      clearInterval(timer);
      send(true, '');
    } else if (tries >= 16) {
      clearInterval(timer);
      send(false, 'still-listed');
    }
  }, 250);
})();
true;
`;
