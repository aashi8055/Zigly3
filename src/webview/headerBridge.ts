/**
 * Scripts that connect the native header to the real website.
 *
 * Nothing here reimplements site behaviour. Each action drives the page's own
 * controls or navigates to a real Zigly URL, so the website stays the engine.
 */

/**
 * The site sets display:none on <header data-hide-header-in-app="true"> when it
 * detects a WebView. That also hides the menu drawer, which lives inside it.
 *
 * We keep the header rendered but invisible: `visibility: hidden` rather than
 * `display: none`, because visibility can be reversed on a descendant while
 * display cannot. The drawer then reveals itself normally, positioned against
 * the viewport, while the site's own header bar stays out of sight behind our
 * native one. Height 0 keeps it from occupying layout space.
 */
export const HEADER_DRAWER_CSS = `
header[data-hide-header-in-app] {
  display: block !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 0 !important;
  overflow: visible !important;
  pointer-events: none !important;
}
/* Reveal the drawer ONLY while it is open. Revealing the whole subtree also
   exposed the site's own hamburger button, which then floated over the page
   beneath our native header.

   The drawer is normally positioned relative to a header that has real height.
   ours is collapsed to zero, so it is pinned to the WebView viewport explicitly
   -- which is the area below our native header, exactly where the reference app
   shows it. Every entry inside it is Zigly's own; only placement is set here. */
header[data-hide-header-in-app] details[open] > .menu-drawer,
header[data-hide-header-in-app] details[open] .menu-drawer,
header[data-hide-header-in-app] details.menu-opening .menu-drawer {
  visibility: visible !important;
  pointer-events: auto !important;
  position: fixed !important;
  top: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  height: auto !important;
  max-height: 100% !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  transform: none !important;
  opacity: 1 !important;
  z-index: 2147483000 !important;
}

/* Its inner scroller must not keep a height derived from the collapsed header. */
header[data-hide-header-in-app] details[open] .menu-drawer__inner-container,
header[data-hide-header-in-app] details[open] .menu-drawer__navigation-container {
  height: auto !important;
  max-height: 100% !important;
  overflow-y: auto !important;
}

/* Dim the page behind the drawer, as the reference app does. */
header[data-hide-header-in-app] details[open] .menu-drawer__overlay,
header[data-hide-header-in-app] details[open] + .menu-drawer__overlay {
  visibility: visible !important;
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0, 0, 0, 0.4) !important;
  z-index: 2147482999 !important;
  pointer-events: auto !important;
}
`;

/**
 * Installed before the page's own scripts run.
 *
 * The site hides its header on DOMContentLoaded, which is late enough that the
 * web header is visible for a moment first -- and with our native header also
 * on screen, that reads as a duplicate header flashing. Hiding it up front
 * removes the flash entirely.
 */
export const EARLY_HEADER_CSS = `
(function () {
  try {
    // Zigly's own supported hook. Their header script reads this first:
    //
    //   BEST CASE: App explicitly injects this flag inside WebView
    //   window.IS_MOBILE_APP = true;
    //
    // Setting it takes the sanctioned path instead of relying on their UA
    // sniffing fallback, and it also covers the announcement bar, which is
    // marked data-hide-in-app by the same mechanism. Set as early as possible
    // so it is already true when their DOMContentLoaded handler runs.
    window.IS_MOBILE_APP = true;
  } catch (e) {}

  try {
    var css = 'header[data-hide-header-in-app]{visibility:hidden!important;'
      + 'height:0!important;min-height:0!important;padding:0!important;'
      + 'margin:0!important;border:0!important;overflow:visible!important;'
      + 'pointer-events:none!important;}';
    var ID = 'zigly-early-header';
    var existing = document.getElementById(ID);
    if (!existing) {
      var el = document.createElement('style');
      el.id = ID;
      el.textContent = css;
      (document.head || document.documentElement).appendChild(el);
    }

    // At document-start <head> may not exist yet, so the tag above can be
    // dropped when the parser builds the real document. Re-add it once the DOM
    // is ready; the id check keeps this from stacking duplicates.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById(ID)) {
          var again = document.createElement('style');
          again.id = ID;
          again.textContent = css;
          (document.head || document.documentElement).appendChild(again);
        }
      }, {once: true});
    }
  } catch (e) {}
})();
true;
`;

/**
 * Open the site's own menu drawer by clicking its summary.
 *
 * No longer wired to anything: the hamburger opens the native drawer in
 * ../components/MenuDrawer, which reads the same menu out of the page rather
 * than revealing the page's copy of it. Kept, with the CSS above that placed
 * it, as the way back if the native drawer ever has to be stood down -- one
 * prop on NativeHeader, and the site's own drawer works again.
 */
export const OPEN_MENU = `
(function () {
  try {
    var s = document.querySelector('summary.header__icon--menu')
         || document.querySelector('.menu-drawer-container summary')
         || document.querySelector('header-drawer summary');
    if (s) { s.click(); }
    else if (window.console) { console.warn('[ZiglyWebView] menu summary not found'); }
  } catch (e) {}
})();
true;
`;

/**
 * Open the cart.
 *
 * Kept for reference only: the app now loads ZIGLY_ORIGIN + '/cart' straight
 * into the inner-page view. Injecting a navigation into the dashboard WebView
 * meant it began loading the cart, the routing cancelled it, and the page view
 * loaded it again -- visible as the cart flashing half-drawn, then the
 * dashboard, then the cart.
 */
export const OPEN_CART = `window.location.href = '/cart'; true;`;

/**
 * Report the cart item count from the site's own bubble, so the native badge
 * shows real data rather than a separately tracked number.
 */
export const REPORT_CART_COUNT = `
(function () {
  function count() {
    try {
      var el = document.querySelector('.cart-count-bubble span[aria-hidden="true"]')
            || document.querySelector('.cart-count-bubble span')
            || document.querySelector('#cart-icon-bubble .cart-count-bubble');
      var n = el ? parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10) : 0;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({tag: 'cart-count', n: isNaN(n) ? 0 : n})
        );
      }
    } catch (e) {}
  }
  count();
  setTimeout(count, 1500);
  setTimeout(count, 4000);
  // The cart drawer replaces its own markup on every update; re-read then.
  try {
    var target = document.querySelector('cart-drawer') || document.body;
    var mo = new MutationObserver(function () { count(); });
    mo.observe(target, {childList: true, subtree: true});
  } catch (e) {}
})();
true;
`;

/** Navigate to the site's real search results. */
export const searchScript = (query: string): string =>
  `window.location.href = '/search?q=' + encodeURIComponent(${JSON.stringify(
    query,
  )}); true;`;

/** Navigate to the homepage. */
export const GO_HOME = `window.location.href = '/'; true;`;

/**
 * Read the offer strings out of the site's own announcement bar so the native
 * bar shows real, current promotions. The element is hidden in-app but still
 * present in the DOM, so its text is available.
 */
export const REPORT_ANNOUNCEMENTS = `
(function () {
  function collect() {
    try {
      var host = document.querySelector('[data-hide-in-app]')
              || document.querySelector('.custom-announcement')
              || document.querySelector('.announcement-bar-section');
      if (!host) { return; }

      var nodes = host.querySelectorAll('.announcement-inner, .announcement-bar__message, p, span');
      var seen = {};
      var items = [];
      for (var i = 0; i < nodes.length; i++) {
        var t = squashWs(nodes[i].textContent || '');
        if (t.length < 6 || t.length > 140) { continue; }
        if (seen[t]) { continue; }
        // Skip entries that merely contain a child we already took.
        seen[t] = 1;
        items.push(t);
      }
      if (!items.length) { return; }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({tag: 'announcements', items: items.slice(0, 12)})
        );
      }
    } catch (e) {}
  }

  function squashWs(str) {
    var out = '';
    var prevWs = true;
    for (var k = 0; k < str.length; k++) {
      var c = str.charCodeAt(k);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
      else { out += str.charAt(k); prevWs = false; }
    }
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); }
    return out;
  }

  collect();
  setTimeout(collect, 1500);
})();
true;
`;

/**
 * Open the site's own wishlist page.
 *
 * Not wired to anything: the heart opens the native wishlist screen, which reads
 * the saved handles out of the page's localStorage (see ../webview/
 * wishlistBridge). Kept as the way back if that screen ever has to be stood
 * down. The path is still /pages/swym-wishlist even though Swym is long gone
 * from this store -- the handle is the theme's, not the app's, and the site's own
 * bottom nav links to the raw myshopify host, which the URL policy rewrites
 * back to zigly.com.
 */
export const OPEN_WISHLIST = `window.location.href = '/pages/swym-wishlist'; true;`;
