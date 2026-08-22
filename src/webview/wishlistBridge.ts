/**
 * Read the wishlist from where Zigly actually keeps it, then price it from
 * Shopify.
 *
 * THIS FILE USED TO BE ABOUT SWYM, AND SWYM IS GONE. It is worth writing down
 * what changed, because the old approach was slow and empty for a reason that
 * no longer exists.
 *
 * Verified on 2026-08-22, on the dashboard, a product page and
 * /pages/swym-wishlist alike: there is no Swym snippet on this store, and none
 * of the four app embeds the pages load is Swym's (they are Judge.me,
 * Selleasy, PageFly and SimplyOTP). The theme still carries Swym's markup --
 * the `swym-add-to-wishlist` buttons, `#swym-wishlist-render-container`, a
 * `window.SwymCallbacks` array nothing ever drains -- but nothing implements it.
 *
 * What implements it now is Zigly's own `assets/wishlist.js`, loaded on every
 * page. It is short and it is unambiguous:
 *
 *   STORAGE_KEY     = 'zigly_wishlist_handles'   // comma-separated, localStorage
 *   BUTTON_SELECTOR = '.swym-button.swym-add-to-wishlist[data-product-handle]'
 *   document.addEventListener('click', handleClick)   // delegated, one listener
 *   window.ziglyWishlist = { getWishlist, syncAllButtons }
 *
 * and, when a customer is signed in, each toggle is mirrored to Zigly's own API
 * and the local list is merged into the server's on first load after login.
 *
 * So the wishlist is a list of product handles in the page's own localStorage,
 * with a public accessor for reading it and a delegated click handler for
 * changing it. That changes this file in three ways:
 *
 *   1. THE READ IS INSTANT. The old bridge mounted an off-screen WebView on
 *      /pages/swym-wishlist -- an ~850 KB page -- purely so Swym would run, then
 *      polled the DOM for up to twelve seconds waiting for markup that was never
 *      coming, and finally scraped product links out of whatever it found. Now
 *      it asks for the list and gets it in the same tick, from the dashboard
 *      WebView that is already loaded. Same origin, same storage, no page load,
 *      no polling.
 *
 *   2. THE READ IS EXACT. Scraping links out of a container meant guessing which
 *      links were saved products and which were the theme's own; the reply even
 *      carried a `root` field so a device run could confirm which container it
 *      had guessed at. There is nothing to guess now.
 *
 *   3. THE WRITE IS THEIRS, PRESSED RATHER THAN REIMPLEMENTED. See the removal
 *      script below.
 *
 * Every figure still comes from `/products/{handle}.js` -- integer paise, the
 * compare-at price, the image, the variant list. That is unchanged and is the
 * whole point: their storage says *which* products, Shopify says everything
 * *about* them. No price is scraped and no rendered money string is parsed.
 */

/** Most wishlists are short; this is a bound, not an expectation. */
export const WISHLIST_LIMIT = 40;

/**
 * Read the saved handles and price them.
 *
 * Deliberately NOT idempotent, and deliberately not guarded against running
 * twice: it is injected every time the screen opens, because the shopper may
 * have saved something from a product page since the last read.
 *
 * Runs in the dashboard WebView. localStorage is per-origin, so the list it sees
 * is the same one the site's own pages see -- there is no second copy and
 * nothing to keep in step.
 */
export const WISHLIST_SCRIPT = `
(function () {
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
   * The saved handles, in the order Zigly stores them.
   *
   * Their own accessor first: window.ziglyWishlist.getWishlist() is the
   * documented surface of assets/wishlist.js and it already trims and drops
   * blanks. Reading the key directly is the fallback for the case where their
   * script has not run yet -- the value is the same string either way, so the
   * fallback cannot disagree with them, only be earlier.
   */
  function handles() {
    try {
      if (window.ziglyWishlist && window.ziglyWishlist.getWishlist) {
        var theirs = window.ziglyWishlist.getWishlist();
        if (Object.prototype.toString.call(theirs) === '[object Array]') {
          return theirs;
        }
      }
    } catch (e) {}

    try {
      var raw = window.localStorage.getItem('zigly_wishlist_handles') || '';
      var parts = raw.split(',');
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var trimmed = trim(parts[i]);
        if (trimmed) { out.push(trimmed); }
      }
      return out;
    } catch (e) {
      // A WebView with storage disabled is not an empty wishlist, but it is
      // indistinguishable from one from here, and saying "empty" is the only
      // answer that lets the screen finish.
      return [];
    }
  }

  /** Trim without a regex: escapes inside this template literal get eaten. */
  function trim(str) {
    var a = 0;
    var b = str.length;
    function ws(c) { return c === 32 || c === 9 || c === 10 || c === 13; }
    while (a < b && ws(str.charCodeAt(a))) { a++; }
    while (b > a && ws(str.charCodeAt(b - 1))) { b--; }
    return str.slice(a, b);
  }

  /** One documented request per product. Order is preserved by index. */
  function price(saved) {
    var capped = saved.slice(0, LIMIT);
    if (!capped.length) {
      send({items: [], root: 'storage', found: saved.length});
      return;
    }

    var items = new Array(capped.length);
    var pending = capped.length;

    function finish() {
      pending--;
      if (pending > 0) { return; }
      var clean = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i]) { clean.push(items[i]); }
      }
      send({items: clean, root: 'storage', found: saved.length});
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

  try {
    price(handles());
  } catch (e) {
    send({items: [], root: 'error', found: 0});
  }
})();
true;
`;

/**
 * Un-save one product, by pressing Zigly's own control.
 *
 * Their `assets/wishlist.js` binds ONE click listener, on `document`, and looks
 * for `.swym-button.swym-add-to-wishlist[data-product-handle]` in the event's
 * ancestry. Everything else follows from that one handler: it toggles the
 * handle in localStorage, re-syncs every button on the page, updates the header
 * counters, publishes the theme's own `wishlistUpdate` event, and -- for a
 * signed-in customer -- posts the change to Zigly's wishlist API.
 *
 * So the write is done by dispatching a click at a button carrying this handle.
 * Not by writing their storage key: a direct write would toggle the list and
 * skip the counters, the event and, for anyone signed in, the server. The
 * customer's wishlist would then be right on this device and wrong everywhere
 * else, which is worse than not removing it at all.
 *
 * A real button is used when the page has one -- the dashboard is full of
 * product cards. When it does not, a button is created with the one attribute
 * their selector requires, clicked, and removed. It has to be in the document
 * for the event to reach `document`, so it is appended and taken away again
 * rather than clicked while detached.
 *
 * The result is still verified. After the click the list is re-read and the
 * reply says whether the handle actually left it. A removal that silently
 * failed would leave the app showing a wishlist that is not the customer's.
 */
export const removeFromWishlistScript = (handle: string): string => `
(function () {
  var handle = ${JSON.stringify(handle)};
  var SELECTOR = '.swym-button.swym-add-to-wishlist[data-product-handle]';
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

  /** Trim without a regex, as above. */
  function trim(str) {
    var a = 0;
    var b = str.length;
    function ws(c) { return c === 32 || c === 9 || c === 10 || c === 13; }
    while (a < b && ws(str.charCodeAt(a))) { a++; }
    while (b > a && ws(str.charCodeAt(b - 1))) { b--; }
    return str.slice(a, b);
  }

  function saved() {
    try {
      if (window.ziglyWishlist && window.ziglyWishlist.getWishlist) {
        var theirs = window.ziglyWishlist.getWishlist();
        if (Object.prototype.toString.call(theirs) === '[object Array]') {
          return theirs;
        }
      }
      var raw = window.localStorage.getItem('zigly_wishlist_handles') || '';
      var parts = raw.split(',');
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var t = trim(parts[i]);
        if (t) { out.push(t); }
      }
      return out;
    } catch (e) {
      return null;
    }
  }

  function has(list) {
    if (!list) { return null; }
    for (var i = 0; i < list.length; i++) {
      if (list[i] === handle) { return true; }
    }
    return false;
  }

  try {
    var before = saved();
    if (has(before) === false) {
      // Already gone -- nothing to undo, and the tile is already off screen.
      send(true, 'already removed');
      return;
    }

    // Their own control for this product, if the page happens to show it.
    var button = null;
    var candidates = document.querySelectorAll(SELECTOR);
    for (var c = 0; c < candidates.length; c++) {
      if (candidates[c].getAttribute('data-product-handle') === handle) {
        button = candidates[c];
        break;
      }
    }

    // Otherwise the smallest thing their delegated listener will accept.
    var temporary = null;
    if (!button) {
      temporary = document.createElement('div');
      temporary.className = 'swym-button swym-add-to-wishlist';
      temporary.setAttribute('data-product-handle', handle);
      temporary.setAttribute('aria-hidden', 'true');
      temporary.style.position = 'fixed';
      temporary.style.left = '-9999px';
      temporary.style.top = '0';
      temporary.style.width = '1px';
      temporary.style.height = '1px';
      temporary.style.opacity = '0';
      temporary.style.pointerEvents = 'none';
      document.body.appendChild(temporary);
      button = temporary;
    }

    // Their handler reads event.target.closest(SELECTOR), so the event has to
    // bubble to document. A plain click() does that.
    button.click();

    function cleanUp() {
      if (temporary && temporary.parentNode) {
        temporary.parentNode.removeChild(temporary);
      }
    }

    /**
     * Verify. Their toggle is synchronous, but the signed-in server sync is not,
     * and a frame's grace costs nothing against a tap the user has already seen
     * take effect.
     */
    setTimeout(function () {
      var after = saved();
      cleanUp();
      if (after === null) {
        send(false, 'storage unreadable');
      } else if (has(after)) {
        send(false, 'still saved after pressing the control');
      } else {
        send(true, '');
      }
    }, 60);
  } catch (e) {
    send(false, 'threw: ' + e);
  }
})();
true;
`;
