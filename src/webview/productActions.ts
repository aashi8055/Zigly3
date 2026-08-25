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

/** How long to wait before re-reading the cart to confirm an add landed. */
const VERIFY_DELAY_MS = 500;

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

  readCount(function (before) {
    btn.click();
    setTimeout(function () {
      readCount(function (after) {
        if (after !== null && (before === null || after > before)) {
          send({tag: 'cart-added'});
          send({tag: 'cart-count', n: after});
        } else {
          send({tag: 'product-action-unavailable', action: 'add'});
        }
      });
    }, ${VERIFY_DELAY_MS});
  });
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
