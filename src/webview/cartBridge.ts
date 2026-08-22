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
