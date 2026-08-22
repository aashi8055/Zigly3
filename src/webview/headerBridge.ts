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
 * How long the paint gate may hold the page back on its own.
 *
 * The gate is lifted by the app's own stylesheet the moment that lands, so this
 * is only the failure case: an injection that never ran. Kept under
 * PAGE_COVER_CAP_MS so the app's cover is still over the page when the gate
 * gives up, rather than the customer watching a bare website appear.
 */
export const PAINT_GATE_MAX_MS = 2500;

/** The style node that holds the page back. Removed by the app's own CSS. */
export const PAINT_GATE_ID = 'zigly-paint-gate';

/**
 * Lift the gate.
 *
 * Every script that installs this app's own presentation on a page has to end
 * with this, because that is what the gate was waiting for -- and a gate that
 * is never lifted is not a slow page, it is a blank one. Two callers today:
 * `buildStyleInjection`, for every shop page, and `LOGIN_RESTYLE`, which styles
 * the one screen the mobile stylesheet does not cover.
 *
 * Idempotent, and safe on a page that was never gated at all.
 */
export const LIFT_PAINT_GATE = `
(function () {
  try {
    window.__ziglyGateLifted = true;
    var gate = document.getElementById(${JSON.stringify(PAINT_GATE_ID)});
    if (gate && gate.parentNode) { gate.parentNode.removeChild(gate); }
  } catch (e) {}
})();
`;

/**
 * Installed before the page's own scripts run.
 *
 * Two jobs, both about the same window -- the moment between the document
 * arriving and the app's own CSS being installed on it.
 *
 * The site hides its header on DOMContentLoaded, which is late enough that the
 * web header is visible for a moment first -- and with our native header also
 * on screen, that reads as a duplicate header flashing. Hiding it up front
 * removes the flash entirely.
 *
 * The paint gate is the general case of that same flash. `injectedJavaScript`
 * runs when the document has finished loading, so for a beat before it the page
 * is the mobile *website*: the site's own grid, its own type scale, its own
 * bottom bar -- and then it visibly becomes the app. The gate holds the
 * document invisible until the app's stylesheet is in, and
 * `buildStyleInjection` lifts it as its last act. Nothing about it is a
 * deadline the customer can be stuck behind: it lifts itself after
 * PAINT_GATE_MAX_MS whatever happens.
 *
 * `visibility: hidden`, not `display: none`: layout still runs and images still
 * download behind it, so the gate costs nothing in load time -- it only decides
 * when the result is shown.
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

  // ------------------------------------------------------------- paint gate
  try {
    var p = (window.location.pathname || '').toLowerCase();
    var host = (window.location.hostname || '').toLowerCase();
    /*
     * Never over the money flow. Nothing in this app styles checkout, so
     * nothing would ever lift a gate installed there -- it would hold a payment
     * page invisible for two and a half seconds for no benefit at all.
     */
    var isMoneyFlow =
      p.indexOf('/checkouts/') === 0 ||
      p.indexOf('/checkout') === 0 ||
      p.indexOf('/wallets/') === 0 ||
      p.indexOf('/payments/') === 0 ||
      host.indexOf('gokwik') !== -1 ||
      host.indexOf('shop.app') !== -1 ||
      host.indexOf('razorpay') !== -1 ||
      host.indexOf('payu') !== -1;

    /*
     * Document-start only.
     *
     * This payload is injected again on the native onLoadStart as a backstop,
     * and that one lands in the *outgoing* document -- gating there would blank
     * a page the customer is still looking at, and a cancelled navigation would
     * leave it blank until the gate timed out. readyState is 'loading' only
     * for the document this run belongs to.
     */
    if (!isMoneyFlow && document.readyState === 'loading') {
      var GATE = ${JSON.stringify(PAINT_GATE_ID)};
      // The gate's ground is the app's, not the site's: the gate is what the
      // customer sees during a navigation, so a white one would flash between
      // two warm pages.
      var gateCss = 'html{visibility:hidden!important;background:#FFFAF1!important}';

      var install = function () {
        if (window.__ziglyGateLifted) { return; }
        if (document.getElementById(GATE)) { return; }
        var node = document.createElement('style');
        node.id = GATE;
        node.textContent = gateCss;
        (document.head || document.documentElement).appendChild(node);
      };

      install();

      // Same reason as the header tag above: at document-start there may be no
      // <head> yet, so the node can be dropped when the parser builds the real
      // document. Skipped if the gate has already been lifted by then.
      document.addEventListener('DOMContentLoaded', install, {once: true});

      // The deadline. A page whose injection never ran must still be shown.
      setTimeout(function () {
        ${LIFT_PAINT_GATE}
      }, ${PAINT_GATE_MAX_MS});
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
