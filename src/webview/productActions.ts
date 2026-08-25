/**
 * Drive the site's own Add to Bag / Buy Now controls from the native sticky
 * bar on a product page.
 *
 * The theme's <product-form> already resolves whatever the customer picked --
 * size, quantity, a selling plan -- so this presses its real button rather
 * than re-deriving a variant id and re-implementing /cart/add.js natively.
 * Same technique as ../webview/wishlistBridge's removeFromWishlistScript:
 * find their control, click it, then verify by re-reading the site's own
 * state rather than reporting success from the click alone.
 *
 * Both buttons stay in the DOM -- see injectedStyles.ts's "one Add to Bag,
 * not two" and the rule added beside it for the in-flow button -- only
 * display:none, so click() still reaches their real handlers.
 *
 * No regex and no backtick appears anywhere below: a single backslash inside
 * this template literal is consumed at compile time (see the injected-script
 * notes in ../screens/ZiglyWebViewScreen.tsx), and a backtick would close the
 * literal early and silently drop everything after it.
 */

/**
 * How long to wait before the first re-read of the cart, and then between
 * each retry if that one has not shown the add yet.
 *
 * The tap must never wait on a network round trip -- see below -- but a
 * single check shortly after it does not give the theme's own /cart/add.js
 * request time to land on a slow connection, and the customer would see a
 * "couldn't add" toast moments before the site's own drawer opens and proves
 * it worked. Retrying, rather than lengthening one delay, keeps the common
 * case (a fast network) reporting success quickly while still giving a slow
 * one room before this gives up.
 */
const VERIFY_DELAYS_MS = [500, 1000, 1800, 3000];

export const PRODUCT_ADD_TO_BAG_SCRIPT = `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  function findButton() {
    var scopes = ['.product__buy-buttons-container', '.sticky-bar-container'];
    for (var i = 0; i < scopes.length; i++) {
      var root = document.querySelector(scopes[i]);
      var btn = root ? root.querySelector('.product-form__submit') : null;
      if (btn) { return btn; }
    }
    return document.querySelector('button[name="add"]') ||
      document.querySelector('.product-form__submit');
  }

  function readCount(then) {
    fetch('/cart.js', {credentials: 'same-origin', headers: {'Accept': 'application/json'}})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cart) { then(cart ? (cart.item_count || 0) : null); })
      .catch(function () { then(null); });
  }

  var btn = findButton();
  if (!btn || btn.disabled) {
    send({tag: 'product-action-unavailable', action: 'add'});
    return;
  }

  // The tap itself never waits on a fetch: clicking synchronously, before
  // asking Shopify anything, is what makes this feel as fast as the site's
  // own button. The baseline count is read in parallel, after the click, only
  // to tell a real add apart from one already in progress when the bar was
  // pressed.
  var before = null;
  var haveBefore = false;
  readCount(function (n) {
    before = n;
    haveBefore = true;
  });
  btn.click();

  var delays = ${JSON.stringify(VERIFY_DELAYS_MS)};
  var attempt = 0;

  function check() {
    readCount(function (after) {
      var baseline = haveBefore ? before : null;
      if (after !== null && (baseline === null || after > baseline)) {
        send({tag: 'cart-added'});
        send({tag: 'cart-count', n: after});
        return;
      }
      attempt++;
      if (attempt < delays.length) {
        setTimeout(check, delays[attempt]);
      } else {
        send({tag: 'product-action-unavailable', action: 'add'});
      }
    });
  }
  setTimeout(check, delays[0]);
})();
true;
`;

export const PRODUCT_BUY_NOW_SCRIPT = `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  function enabledPaymentButton(root) {
    if (!root) { return null; }
    var candidates = root.querySelectorAll('.shopify-payment-button__button');
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i].disabled) { return candidates[i]; }
    }
    return null;
  }

  function findButton() {
    var scoped = enabledPaymentButton(document.querySelector('.sticky-bar-container')) ||
      enabledPaymentButton(document.querySelector('.product__buy-buttons-container'));
    if (scoped) { return scoped; }
    return enabledPaymentButton(document);
  }

  var btn = findButton();
  if (btn) {
    btn.click();
  } else {
    send({tag: 'product-action-unavailable', action: 'buy'});
  }
})();
true;
`;
