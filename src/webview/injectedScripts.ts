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
import {HOME_LAYOUT_SCRIPT} from './homeLayout';
import {PAGE_CACHE_SCRIPT} from './pageCache';
import {BREED_SECTION_SCRIPT} from './breedSection';
import {HOT_PICKS_SCRIPT} from './hotPicks';
import {EXPLORE_SCRIPT} from './explorePicker';
import {SORT_FILTER_SCRIPT} from './sortFilterBar';
import {DRAWER_EXTRAS_SCRIPT} from './drawerExtras';
import {EXTRA_SECTIONS_SCRIPT} from './extraSections';
import {EVERYTHING_SCRIPT} from './everythingSection';
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

  return `${buildStyleInjection(MOBILE_CSS)}
${HOME_LAYOUT_SCRIPT}
${PAGE_CACHE_SCRIPT}
${BREED_SECTION_SCRIPT}
${HOT_PICKS_SCRIPT}
${EXPLORE_SCRIPT}
${EXTRA_SECTIONS_SCRIPT}
${EVERYTHING_SCRIPT}
${CART_TOAST_SCRIPT}
${READY_SIGNAL_SCRIPT}
${SORT_FILTER_SCRIPT}
${DRAWER_EXTRAS_SCRIPT}
${diagnostic}`;
};
