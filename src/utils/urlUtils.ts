/**
 * URL policy for the WebView.
 *
 * Design note — why this is not a strict allowlist:
 * A card payment can legitimately redirect to an arbitrary bank 3-D Secure
 * domain that cannot be enumerated ahead of time. A hard allowlist would
 * therefore break real checkouts. Instead we run a two-mode policy:
 *
 *   browsing mode  — tight. Only Zigly hosts render in the WebView.
 *   checkout mode  — relaxed. Once the user is demonstrably in the money flow,
 *                    any https destination is allowed to render, because that
 *                    is what completing a payment requires.
 *
 * Checkout mode is entered only via a Zigly checkout path or a known payment
 * host, and is left on returning to an ordinary Zigly page. It never disables
 * TLS validation and never permits plain http.
 */

import {
  INTERNAL_HOSTS,
  REWRITE_HOSTS,
  PAYMENT_HOSTS,
  EXTERNAL_HOSTS,
  CHECKOUT_PATH_MARKERS,
  APP_INTENT_SCHEMES,
} from '../constants/appConstants';
import {warn} from './logger';

export type UrlAction =
  /** Render it in the WebView. */
  | {kind: 'allow'}
  /** Render it, but at a corrected URL. */
  | {kind: 'rewrite'; url: string}
  /** Hand to the OS — payment app, dialer, WhatsApp, maps. */
  | {kind: 'appIntent'; url: string}
  /** Open in the system browser. */
  | {kind: 'external'; url: string}
  /** Refuse, and say why. */
  | {kind: 'block'; reason: string};

interface Parsed {
  scheme: string;
  host: string;
  path: string;
}

/**
 * Minimal URL parse. Deliberately not `new URL()`: on older Hermes builds it
 * throws on the custom schemes (upi:, intent:) we most need to classify.
 */
export const parseUrl = (raw: string): Parsed | null => {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/.exec(raw);
  if (match) {
    return {
      scheme: match[1].toLowerCase(),
      host: match[2].toLowerCase().replace(/^.*@/, '').replace(/:\d+$/, ''),
      path: match[3] || '/',
    };
  }
  // Schemeless-authority forms such as `mailto:x@y` or `upi:pay?...`.
  const bare = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw);
  if (bare) {
    return {scheme: bare[1].toLowerCase(), host: '', path: raw.slice(bare[0].length)};
  }
  return null;
};

/** Host match that also covers subdomains of a listed apex. */
const hostMatches = (host: string, list: string[]): boolean =>
  list.some(entry => host === entry || host.endsWith(`.${entry}`));

export const isInternalHost = (host: string): boolean => hostMatches(host, INTERNAL_HOSTS);

export const isPaymentHost = (host: string): boolean => hostMatches(host, PAYMENT_HOSTS);

/** True for Zigly's own checkout paths and for any known payment host. */
export const isCheckoutUrl = (raw: string): boolean => {
  const parsed = parseUrl(raw);
  if (!parsed) {
    return false;
  }
  if (isPaymentHost(parsed.host)) {
    return true;
  }
  if (!isInternalHost(parsed.host)) {
    return false;
  }
  const path = parsed.path.toLowerCase();
  return CHECKOUT_PATH_MARKERS.some(marker => path.startsWith(marker));
};

/**
 * True on the pages that get the app's Sort / Filter bar.
 *
 * The native bottom navigation stands down on exactly these, because the
 * reference app shows that bar *instead of* the tab bar on listing screens and
 * because two bars would take a third of a phone screen between them. The bar
 * is native now (see ../components/SortFilterBar) and takes the tab bar's own
 * slot, so this one answer decides both.
 *
 * The test deliberately mirrors `../webview/listingPage.ts` and the same test
 * inside `../webview/facetBridge.ts`, line for line -- `/collections/` with the
 * trailing slash, so the bare collection *list* is not included, and `/search`
 * because SearchTap draws that grid too. If one moves, the others have to, or
 * the app shows a bar for a page that has nothing to drive it.
 */
export const showsSortFilterBar = (raw: string): boolean => {
  const parsed = parseUrl(raw);
  if (!parsed || !isInternalHost(parsed.host)) {
    return false;
  }
  const path = parsed.path.toLowerCase();
  return path.startsWith('/collections/') || path.startsWith('/search');
};

/**
 * True for the customer account area: the pages this app draws natively.
 *
 * Used to keep the WebView out of them. A tap that lands on /account inside a
 * page layer would show Shopify's own account page, which is the web experience
 * the native account section exists to replace.
 */
export const isAccountUrl = (raw: string): boolean => {
  const parsed = parseUrl(raw);
  if (!parsed || !isInternalHost(parsed.host)) {
    return false;
  }
  const path = parsed.path.toLowerCase();
  if (path.startsWith('/account/orders/')) {
    // The one account page that stays on the web: an order's own page carries
    // line items, tax, shipping and tracking, none of which this app has a
    // second source for. Opened in a layer, inside the app.
    return false;
  }
  return path === '/account' || path.startsWith('/account/');
};

/**
 * Android `intent://` URLs carry a browser fallback. Prefer it when present,
 * so a missing payment app degrades to the web flow instead of a dead tap.
 */
const intentFallback = (raw: string): string | null => {
  const match = /S\.browser_fallback_url=([^;]+)/.exec(raw);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

/**
 * Classify a navigation request.
 *
 * @param raw            the target URL
 * @param inCheckoutFlow whether the session is currently inside the money flow
 */
export const classifyUrl = (raw: string, inCheckoutFlow = false): UrlAction => {
  if (!raw) {
    return {kind: 'block', reason: 'empty url'};
  }

  const parsed = parseUrl(raw);
  if (!parsed) {
    // Relative URLs are resolved by the WebView itself; nothing to police.
    return {kind: 'allow'};
  }

  const {scheme, host} = parsed;

  // 1. Non-web schemes go to the OS. This is what makes UPI payment work.
  if (scheme !== 'http' && scheme !== 'https') {
    if (APP_INTENT_SCHEMES.includes(scheme)) {
      if (scheme === 'intent') {
        const fallback = intentFallback(raw);
        if (fallback) {
          return {kind: 'appIntent', url: fallback};
        }
      }
      return {kind: 'appIntent', url: raw};
    }
    // about:blank and data: are used internally by the WebView.
    if (scheme === 'about' || scheme === 'data' || scheme === 'blob') {
      return {kind: 'allow'};
    }
    return {kind: 'block', reason: `unhandled scheme "${scheme}"`};
  }

  // 2. Never downgrade to cleartext.
  if (scheme === 'http') {
    return {kind: 'rewrite', url: raw.replace(/^http:/i, 'https:')};
  }

  // 3. Wrong-domain Zigly pages get corrected rather than blocked.
  const rewriteTo = REWRITE_HOSTS[host];
  if (rewriteTo) {
    return {kind: 'rewrite', url: raw.replace(host, rewriteTo)};
  }

  // 4. Zigly proper.
  if (isInternalHost(host)) {
    return {kind: 'allow'};
  }

  // 5. Payment hosts always render.
  if (isPaymentHost(host)) {
    return {kind: 'allow'};
  }

  // 6. Mid-payment, an unrecognised https host is far more likely to be a bank
  //    3-D Secure step than something hostile. Allow it, but leave a trail.
  if (inCheckoutFlow) {
    warn('allowing unrecognised host during checkout:', host);
    return {kind: 'allow'};
  }

  // 7. Known third-party destinations.
  if (hostMatches(host, EXTERNAL_HOSTS)) {
    return {kind: 'external', url: raw};
  }

  // 8. Anything else leaves the app rather than rendering unvetted content
  //    inside a session that holds the user's cart and login.
  warn('sending unknown host to browser:', host);
  return {kind: 'external', url: raw};
};
