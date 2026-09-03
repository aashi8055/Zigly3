/**
 * Read and update the real cart from inside the WebView.
 *
 * The reference app's cart is native -- Zigly's own /cart page contains none of
 * its wording ("Order Details", "Total Payable", "You saved ... on this order"),
 * so their app builds that screen itself.
 *
 * Everything here runs INSIDE the WebView, so every request carries the page's
 * own session cookie. There is one Shopify cart, and these are Shopify's
 * documented cart endpoints -- no separate cart of ours, no second source of
 * truth. Reads use /cart.js; quantity changes use /cart/change.js, which is
 * what the site's own quantity controls call.
 */
export const READ_CART_SCRIPT = `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  fetch('/cart.js', {credentials: 'same-origin', headers: {'Accept': 'application/json'}})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cart) {
      if (!cart) { send({tag: 'cart-data', error: true}); return; }

      var items = [];
      var raw = cart.items || [];
      for (var i = 0; i < raw.length; i++) {
        var it = raw[i];
        items.push({
          key: it.key,
          title: it.product_title || it.title,
          variant: it.variant_title || '',
          quantity: it.quantity,
          image: it.image || null,
          url: it.url || '',
          // Per-unit and per-line, both in the store's minor units.
          price: it.price,
          originalPrice: it.original_price,
          linePrice: it.line_price,
          originalLinePrice: it.original_line_price
        });
      }

      send({
        tag: 'cart-data',
        itemCount: cart.item_count || 0,
        totalPrice: cart.total_price || 0,
        originalTotalPrice: cart.original_total_price || 0,
        totalDiscount: cart.total_discount || 0,
        items: items
      });
    })
    .catch(function () { send({tag: 'cart-data', error: true}); });
})();
true;
`;

/**
 * Change one line's quantity, then report the updated cart.
 *
 * /cart/change.js is the endpoint the theme's own quantity stepper uses, so
 * Shopify recalculates every discount and total. Quantity 0 removes the line.
 */
export const changeQtyScript = (key: string, quantity: number): string => `
(function () {
  fetch('/cart/change.js', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    body: JSON.stringify({id: ${JSON.stringify(key)}, quantity: ${quantity}})
  })
    .then(function () {
      // Re-read rather than adjust locally: Shopify owns the arithmetic.
      ${READ_CART_SCRIPT}
    })
    .catch(function () {
      ${READ_CART_SCRIPT}
    });
})();
true;
`;

/**
 * Add one variant to the bag, then report the new count.
 *
 * /cart/add.js is the endpoint the theme's own Add to Bag button posts to, so
 * the line lands in the same cart with the same discounts applied. Only ever
 * called with a variant id read from `/products/{handle}.js` — never a guess,
 * and never for a product with more than one variant, where choosing on the
 * customer's behalf could add the wrong size.
 */
export const addToCartScript = (
  variantId: number,
  quantity: number = 1,
): string => `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  fetch('/cart/add.js', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    body: JSON.stringify({id: ${JSON.stringify(variantId)}, quantity: ${quantity}})
  })
    .then(function (r) {
      if (!r.ok) { send({tag: 'cart-add-failed'}); return null; }
      // Ask Shopify for the count rather than incrementing ours: the line may
      // have merged with one already in the bag.
      return fetch('/cart.js', {credentials: 'same-origin'})
        .then(function (c) { return c.ok ? c.json() : null; })
        .then(function (cart) {
          send({tag: 'cart-added'});
          if (cart) { send({tag: 'cart-count', n: cart.item_count || 0}); }
        });
    })
    .catch(function () { send({tag: 'cart-add-failed'}); });
})();
true;
`;

/**
 * Check out from wherever the customer already is, the way Buy Now does.
 *
 * Two earlier versions of this were wrong, and both are worth recording.
 *
 * The first sent the customer to ZIGLY_ORIGIN + '/checkout'. That is Shopify's
 * own contact-information step -- a checkout this store does not use, reached
 * by going around the one it does.
 *
 * The second opened the site's /cart page and clicked the first element
 * matching [onclick*="shiprocketCheckoutEvents"] found there. That reached
 * Shiprocket, but by accident: on the cart page the match was a cart-drawer
 * trigger, so the customer got an extra page, then a sidebar, then Shiprocket.
 * Three screens to reach a checkout that Buy Now reaches in none.
 *
 * So this does what ./productActions does: it presses from the page that is
 * already loaded, with no navigation of its own. The native cart is an overlay
 * over a live WebView, so there is always a document here holding the session.
 *
 * Order matters, and it is deliberately most-direct-first:
 *
 *   1. shiprocketCheckoutEvents' own cart method, if the global exposes one.
 *      The PDP control calls shiprocketCheckoutEvents.buyProduct(event), so the
 *      global is the API and a DOM control is only ever a wrapper around it.
 *      Calling it is the closest thing to Buy Now there is -- nothing to find,
 *      nothing to open, no drawer that could appear.
 *   2. A Shiprocket control that is genuinely a checkout control -- matched on
 *      the method its onclick names, never on the bare object name, which is
 *      what let a drawer trigger through last time.
 *   3. Nothing. Report it, and let the caller say so. Explicitly NOT a
 *      fall-through to Shopify's /checkout: that is the bug this file exists to
 *      fix, and silently landing there would hide a broken integration behind a
 *      checkout that charges the customer through the wrong flow.
 *
 * Cart-drawer triggers are excluded outright. Whatever else is uncertain about
 * this page, an element that opens a drawer is not a checkout button, and
 * clicking one is the exact regression this replaces.
 *
 * No regex and no backtick below: a single backslash in this template literal
 * is consumed at compile time, and a backtick would close the literal early.
 */
export const CART_CHECKOUT_SCRIPT = `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  /**
   * Method names to try on the Shiprocket global, most cart-specific first.
   * buyProduct is last: it is the PDP's method and may assume a product form,
   * but a checkout that opens is better than none if it is all that is there.
   */
  var METHODS = [
    'checkoutCart',
    'cartCheckout',
    'buyCart',
    'openCheckout',
    'checkout',
    'buyProduct'
  ];

  /**
   * The method an onclick calls, lowercased, without the object it hangs off.
   *
   * This distinction is the whole filter, and getting it wrong is what made
   * the drawer test useless: the object is called shiprocketCheckoutEvents, so
   * the substring 'checkout' is present in EVERY control's onclick, including
   * openCartDrawer's. Tested against the whole attribute, "does this name
   * checkout?" is always yes. Only the part after the dot says what will run.
   */
  function methodName(el) {
    var onclick = el.getAttribute('onclick') || '';
    var at = onclick.indexOf('shiprocketCheckoutEvents.');
    if (at === -1) { return ''; }
    var rest = onclick.slice(at + 'shiprocketCheckoutEvents.'.length);
    var end = rest.indexOf('(');
    return (end === -1 ? rest : rest.slice(0, end)).trim().toLowerCase();
  }

  /**
   * An element that OPENS the cart drawer is never a checkout control.
   *
   * Judged on the onclick alone, deliberately. An earlier version also tested
   * className and id, and that was too broad in the one place it mattered: the
   * store's real checkout button can sit inside the cart drawer and carry a
   * drawer-ish class, so testing the class rejected the very control this is
   * looking for. What an element DOES is in its handler; what it sits inside is
   * not evidence about it.
   */
  function isDrawerTrigger(el) {
    var method = methodName(el);
    if (!method) { return false; }
    return method.indexOf('drawer') !== -1 ||
      method.indexOf('opencart') !== -1 ||
      method.indexOf('togglecart') !== -1 ||
      method.indexOf('minicart') !== -1;
  }

  function callGlobal() {
    var api = window.shiprocketCheckoutEvents;
    if (!api) { return null; }
    for (var i = 0; i < METHODS.length; i++) {
      var name = METHODS[i];
      if (typeof api[name] === 'function') {
        try {
          // No event to forward: this is not a DOM handler being replayed.
          api[name]();
          return name;
        } catch (err) {
          // Try the next candidate rather than giving up: a method that
          // throws on a missing argument is not proof the others will.
        }
      }
    }
    return null;
  }

  /**
   * The store's own Shiprocket control, best first.
   *
   * Two passes rather than one filter. The previous version required the
   * onclick to name 'checkout' or 'buy' AND survive the class test, and
   * between them those rejected everything -- which is how a button that had
   * been working started reporting itself unavailable. So: prefer a control
   * that names a checkout method, but rather than give up, fall back to any
   * Shiprocket control that is not a drawer toggle.
   */
  function findControl() {
    var all = document.querySelectorAll('[onclick*="shiprocketCheckoutEvents"]');
    var fallback = null;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isDrawerTrigger(el)) { continue; }
      // The METHOD, not the attribute: see methodName above for why testing
      // the attribute for 'checkout' matches every Shiprocket control there is.
      var method = methodName(el);
      if (method.indexOf('checkout') !== -1 || method.indexOf('buy') !== -1) {
        return el;
      }
      if (!fallback) { fallback = el; }
    }
    return fallback;
  }

  /**
   * Shiprocket's own UI, once it is actually on screen.
   *
   * This is the difference between "the flow has been asked to start" and
   * "there is something to look at", and the gap between them is about a
   * second -- the signed, cart-scoped session Shiprocket opens is a network
   * round trip, not a local render. Reporting the first as though it were the
   * second is what made the dashboard flash: the native cart came off on the
   * call, so for that second the customer was looking at the page the cart had
   * been covering.
   *
   * Matched on what Shiprocket actually mounts, widest net first, and every
   * candidate is size-checked -- their embed leaves a zero-height container in
   * the document from page load, so mere presence proves nothing. A thing has
   * appeared when it occupies most of the viewport, which a checkout does and
   * a stray wrapper does not.
   */
  var CHECKOUT_SELECTORS = [
    'iframe[src*="shiprocket"]',
    'iframe[src*="fastrr"]',
    'iframe[id*="fastrr"]',
    'iframe[id*="shiprocket"]',
    '[class*="fastrr"] iframe',
    '[id*="fastrr-checkout"]',
    '[class*="shiprocket-checkout"]',
    '[id*="shiprocket-checkout"]'
  ];

  function checkoutVisible() {
    var vh = window.innerHeight || 0;
    var vw = window.innerWidth || 0;
    if (!vh || !vw) { return false; }
    for (var i = 0; i < CHECKOUT_SELECTORS.length; i++) {
      /*
       * Per selector, and never fatal. One selector that the engine will not
       * parse, or one node with no box to measure, must not take the whole
       * check down with it -- the failure mode of that is reporting the
       * checkout unavailable when it is opening perfectly well, which is
       * exactly the class of bug this file's history is made of.
       */
      try {
        var nodes = document.querySelectorAll(CHECKOUT_SELECTORS[i]);
        for (var j = 0; j < nodes.length; j++) {
          if (typeof nodes[j].getBoundingClientRect !== 'function') { continue; }
          var box = nodes[j].getBoundingClientRect();
          // Most of the viewport, not merely non-zero: see above for the
          // zero-height container this is here to reject.
          if (box.height > vh * 0.5 && box.width > vw * 0.5) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * How long to wait for that paint before reporting anyway.
   *
   * The cap is not optional. If Shiprocket's embed ever changes what it
   * mounts, none of the selectors above match and the customer would otherwise
   * be held behind the native cart indefinitely, staring at a Checkout button
   * that appears to have done nothing. On that path the app falls back to
   * exactly the old behaviour, flash included, which is the right way to be
   * wrong. The app's own release (CHECKOUT_HOLD_CAP_MS in
   * ../screens/ZiglyWebViewScreen) sits just past this, so this always gets to
   * answer first.
   */
  var PAINT_WAIT_MS = 4000;

  /**
   * Report once: when Shiprocket has painted, or when waiting longer would
   * cost the customer more than the flash does.
   */
  function reportWhenVisible(via) {
    /**
     * The clock, or nothing.
     *
     * A page without Date is not one this ships to, but a wait whose start
     * time silently reads 0 would report back the instant it began -- and a
     * wait with no deadline at all would never end. So the absence is
     * answered explicitly, below, rather than arithmetically.
     */
    var now = function () {
      // Only Date.now is asked about. Testing Date itself for 'function' was
      // too tight: what this needs is the clock, not the constructor.
      try {
        return typeof Date.now === 'function' ? Date.now() : null;
      } catch (e) {
        return null;
      }
    };
    var started = now();
    var done = false;

    function finish(painted) {
      if (done) { return; }
      done = true;
      send({tag: 'cart-checkout-started', via: via, painted: !!painted});
    }

    function poll() {
      if (done) { return; }
      if (checkoutVisible()) { finish(true); return; }
      var t = now();
      // No clock means no wait: report and let the app uncover, rather than
      // polling forever with nothing able to stop it.
      if (t === null || started === null) { finish(false); return; }
      if (t - started > PAINT_WAIT_MS) { finish(false); return; }
      /*
       * rAF rather than a fixed interval: the frame Shiprocket paints on is
       * the frame this wants to answer on, and anything coarser adds its own
       * delay on top of the one being removed. If it is not there to schedule
       * with, report now -- the checkout HAS been started, and the only thing
       * this wait ever buys is a tidier hand-off.
       */
      if (typeof window.requestAnimationFrame !== 'function') {
        finish(false);
        return;
      }
      window.requestAnimationFrame(poll);
    }

    poll();
  }

  try {
    var called = callGlobal();
    if (called) {
      reportWhenVisible(called);
      return;
    }

    var btn = findControl();
    if (btn) {
      btn.click();
      reportWhenVisible('control');
      return;
    }

    /*
     * Nothing to press. Report what IS here rather than only that it failed:
     * this script has been wrong twice about what the page contains, and a
     * bare failure gives nobody anything to go on. Reads only -- no state is
     * touched on the way out.
     */
    var seen = document.querySelectorAll('[onclick*="shiprocketCheckoutEvents"]');
    var sample = [];
    for (var j = 0; j < seen.length && j < 4; j++) {
      sample.push({
        onclick: (seen[j].getAttribute('onclick') || '').slice(0, 120),
        cls: String(seen[j].className || '').slice(0, 80),
        rejected: isDrawerTrigger(seen[j])
      });
    }
    /*
     * Nothing to press. Report what IS here, not merely that it failed: this
     * script has been wrong more than once about what a page contains, and a
     * bare "unavailable" gives nobody anything to go on. Reads only -- no
     * state is touched on the way out.
     */
    send({
      tag: 'cart-checkout-unavailable',
      path: location.pathname,
      hasGlobal: typeof window.shiprocketCheckoutEvents,
      methods: window.shiprocketCheckoutEvents
        ? Object.keys(window.shiprocketCheckoutEvents).slice(0, 30)
        : [],
      controls: seen.length,
      sample: sample
    });
  } catch (e) {
    send({tag: 'cart-checkout-unavailable', error: String(e).slice(0, 200)});
  }
})();
true;
`;
