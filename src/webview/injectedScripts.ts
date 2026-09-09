/**
 * JavaScript injected into the page.
 *
 * Hard rules, from the project brief:
 *   - presentation only; never touch cart, auth, pricing or checkout logic
 *   - never patch fetch / XMLHttpRequest / storage / cookies
 *   - never run on checkout or payment pages
 *   - never throw: a failed selector is a warning, not a broken store
 */
import {MOBILE_CSS, buildStyleInjection} from './injectedStyles';

/**
 * The cheap repeat pass, re-exported so the screen has one place to import
 * injections from. See RESTYLE_REPEAT in ./injectedStyles for why the delayed
 * passes send this instead of the whole bundle.
 */
export {RESTYLE_REPEAT} from './injectedStyles';
import {LISTING_PAGE_SCRIPT} from './listingPage';
import {PRODUCT_PAGE_SCRIPT} from './productPage';
import {FACET_BRIDGE_SCRIPT} from './facetBridge';
import {DRAWER_EXTRAS_SCRIPT} from './drawerExtras';
import {BREED_PAGE_SCRIPT} from './breedPage';
import {CART_TOAST_SCRIPT} from './cartToast';
import {READY_SIGNAL_SCRIPT} from './readySignal';
import {SEARCH_DIAGNOSTIC} from './diagnostics';

/**
 * On-screen diagnostic panel. Kept in the tree because it earned its place --
 * it is what finally revealed that the site hides its own header inside a
 * WebView. Set true to bring it back; it must be false in any build given to
 * anyone. Deliberately NOT gated on __DEV__: this project bundles JS into debug
 * builds, which sets __DEV__ false and silently stripped it once already.
 */
const ENABLE_DIAGNOSTIC = false;
import {isCheckoutUrl} from '../utils/urlUtils';

/**
 * Returns the script to inject for a given page, or null when injection must be
 * skipped.
 *
 * Checkout is skipped outright. Zigly's payment path runs through GoKwik and
 * Shopify, and neither is ours to restyle -- a stray rule there risks hiding a
 * payment control, which is the one failure in this app that costs real money.
 */
export const getInjectionForUrl = (url: string): string | null => {
  if (!url || isCheckoutUrl(url)) {
    return null;
  }

  // Styles first, so the grid is never briefly visible unstyled. The category
  // script no-ops on any page that is not the homepage.
  // Diagnostic toggle. NOT gated on __DEV__: this project bundles JS into debug
  // builds, which sets __DEV__ false and silently stripped the diagnostic.
  // Flip to false before cutting a release APK.
  const diagnostic = ENABLE_DIAGNOSTIC ? SEARCH_DIAGNOSTIC : '';

  /*
   * NO DASHBOARD SECTIONS HERE ANY MORE, and that is the point of this file's
   * current shape rather than an omission.
   *
   * Thirteen modules used to be composed in below the stylesheet -- home
   * layout, the banner carousel, the coupon strip, breeds, hot picks, explore,
   * extra sections, brands, concerns, bestsellers, everything, Instagram, and
   * the section cache they all fetched through. Every one of them existed to
   * assemble a dashboard *inside the page*, and ../native/NativeDashboard now
   * draws that dashboard as React Native components over a WebView nobody
   * looks at. Shipping them was 404 KB of JavaScript per home load, building a
   * screen that is never on screen -- 323 KB of it Instagram cover bytes that
   * the native rail loads from ../assets/instagram as real JPEGs instead.
   *
   * The WebView itself stays, and stays mounted: it is the app's session. See
   * the note over the dashboard in ../screens/ZiglyWebViewScreen and
   * DATA-SOURCES.md §7 -- the cart cookie, the wishlist and every
   * /cart/add.js post live in that jar, so what is left below is the session,
   * the pages the app still shows in a WebView, and nothing else.
   *
   * WHAT REMAINS AND WHY, since "it looked dashboard-ish" is what would delete
   * the wrong one next:
   *   MOBILE_CSS       every WebView page is still restyled; the app's whole
   *                    difference from the mobile website is in it.
   *   CART_TOAST       an add can be made from a product page in a layer.
   *   READY_SIGNAL     it emits `page-ready` for inner page layers. Its
   *                    `dashboard-ready` branch is now vestigial -- the splash
   *                    no longer waits for it -- and harmless.
   *   LISTING / PRODUCT / FACET / DRAWER / BREED  the pages still shown in a
   *                    WebView. None of them fetches a section.
   */
  return `${buildStyleInjection(MOBILE_CSS)}
${CART_TOAST_SCRIPT}
${READY_SIGNAL_SCRIPT}
${LISTING_PAGE_SCRIPT}
${PRODUCT_PAGE_SCRIPT}
${FACET_BRIDGE_SCRIPT}
${DRAWER_EXTRAS_SCRIPT}
${BREED_PAGE_SCRIPT}
${diagnostic}`;
};
