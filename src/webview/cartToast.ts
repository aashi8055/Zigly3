/**
 * Match the reference app's add-to-cart feedback.
 *
 * The site opens its full cart drawer whenever something is added. The
 * reference app instead shows a small "Added to cart" toast and leaves you
 * where you were -- that text appears nowhere in the site's HTML, so it is
 * theirs, not the website's.
 *
 * The website still does all the work: the product's own form posts to Shopify
 * and the cart updates as normal. This only suppresses the drawer that pops up
 * afterwards, and tells the app to show a toast instead.
 *
 * Deliberately narrow: the drawer is closed only if it opens shortly after an
 * add-to-cart click. Tapping the cart icon still opens it normally.
 */
export const CART_TOAST_SCRIPT = `
(function () {
  if (window.__ziglyCartToast) { return; }
  window.__ziglyCartToast = true;

  /** How long after an add a drawer opening is treated as its consequence. */
  var WINDOW_MS = 4000;
  var lastAdd = 0;

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isAddControl(el) {
    while (el && el !== document.body) {
      if (el.matches && (
        el.matches('.quick-add__submit') ||
        el.matches('[name="add"]') ||
        el.matches('.mobile-card-atc') ||
        el.matches('.product-form__submit') ||
        el.matches('.st-collection-atc')
      )) { return true; }
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('click', function (e) {
    if (isAddControl(e.target)) { lastAdd = Date.now(); }
  }, true);

  function closeDrawer(drawer) {
    try {
      if (typeof drawer.close === 'function') { drawer.close(); return; }
    } catch (err) {}
    // Fall back to the drawer's own close button, so its cleanup still runs.
    var btn = drawer.querySelector('.drawer__close, [id*="CartDrawer-Close"]');
    if (btn) { btn.click(); return; }
    var overlay = document.getElementById('CartDrawer-Overlay');
    if (overlay) { overlay.click(); }
  }

  function isOpen(drawer) {
    var cls = ' ' + (drawer.className || '') + ' ';
    return cls.indexOf(' active ') !== -1 || cls.indexOf(' animate ') !== -1;
  }

  function watch() {
    var drawer = document.querySelector('cart-drawer');
    if (!drawer) { return false; }

    var mo = new MutationObserver(function () {
      if (!isOpen(drawer)) { return; }
      if (Date.now() - lastAdd > WINDOW_MS) { return; }  // user opened it

      closeDrawer(drawer);
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({tag: 'cart-added'}));
        }
      } catch (err) {}
    });

    mo.observe(drawer, {attributes: true, attributeFilter: ['class']});
    return true;
  }

  try {
    if (!watch()) {
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (watch() || tries > 10) { clearInterval(timer); }
      }, 400);
    }
  } catch (e) {
    warn('cart toast setup failed: ' + e);
  }
})();
true;
`;
