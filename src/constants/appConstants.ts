/**
 * Zigly WebView shell — app-wide constants.
 *
 * Every value here was verified against the live site on 2026-08-20.
 * See the pre-implementation analysis for provenance.
 */
import {Platform} from 'react-native';

/** App-wide typeface. 'System' on iOS resolves to San Francisco; both are sans-serif. */
export const FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'sans-serif',
});

/** Canonical origin. The site is a Shopify storefront (Dawn 15.2.0). */
export const ZIGLY_ORIGIN = 'https://zigly.com';

/** First page the WebView loads. */
export const START_URL = `${ZIGLY_ORIGIN}/`;

/**
 * Hosts we render inside the WebView as first-class Zigly pages.
 * Sub-properties are included so a tap never drops the user out of the app.
 */
export const INTERNAL_HOSTS = [
  'zigly.com',
  'www.zigly.com',
  'v2.zigly.com',
  'stores.zigly.com',
  'franchise.zigly.com',
  /**
   * Zigly Prime / Zigly Coins. Not on a zigly.com domain, which is why it was
   * first treated as external -- but the reference app keeps it in-app, where
   * it asks for a mobile number. Sending it to the browser broke that flow.
   */
  'ziglyprime.erlpaas.com',
];

/**
 * Hosts that are really Zigly but on the wrong domain.
 * The site's own Wishlist tab links to the raw myshopify domain, which would
 * bounce the user off the canonical origin mid-session. We rewrite the host
 * and keep the path. (Reported upstream; harmless to keep once they fix it.)
 */
export const REWRITE_HOSTS: Record<string, string> = {
  'zigly-store.myshopify.com': 'zigly.com',
};

/**
 * Payment and checkout hosts. These load in the WebView but are NEVER injected
 * into. Entering any of them also unlocks checkout mode (see urlUtils).
 */
export const PAYMENT_HOSTS = [
  'shop.app',
  'pay.shopify.com',
  'checkout.shopify.com',
  'gokwik.co',
  'pdp.gokwik.co',
  'razorpay.com',
  'api.razorpay.com',
  'payu.in',
  'secure.payu.in',
  'cashfree.com',
  'juspay.in',
  'phonepe.com',
  'billdesk.com',
];

/**
 * Known-external destinations. Opened in the system browser so the user keeps
 * a working back-stack inside the app.
 */
export const EXTERNAL_HOSTS = [
  'instagram.com',
  'www.instagram.com',
  'facebook.com',
  'www.facebook.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'www.youtube.com',
  'linkedin.com',
  'www.linkedin.com',
  'play.google.com',
  'apps.apple.com',
  'wa.me',
  'api.whatsapp.com',
  'maps.app.goo.gl',
  'maps.google.com',
  'goo.gl',
  'ziglyfoundation.com',
];

/**
 * URL path fragments that mean "the user is in the money flow".
 * Injection is hard-disabled here and navigation is relaxed (see urlUtils).
 */
export const CHECKOUT_PATH_MARKERS = [
  '/checkouts/',
  '/checkout',
  '/cart/checkout',
  '/wallets/',
  '/payments/',
];

/** Non-http schemes we hand to the OS. UPI matters most: GoKwik emits these. */
export const APP_INTENT_SCHEMES = [
  'upi',
  'tez',
  'phonepe',
  'paytmmp',
  'gpay',
  'bhim',
  'credpay',
  'tel',
  'mailto',
  'sms',
  'whatsapp',
  'geo',
  'intent',
  'market',
];

/** Brand palette, read out of the live theme CSS. */
export const COLORS = {
  navy: '#183761',
  navyDeep: '#0F213B',
  red: '#ED2427',
  white: '#FFFFFF',
  ink: '#323232',
  inkMuted: '#767676',
  hairline: '#DDE3EC',
  ground: '#FFFFFF',
};

/** Minimum time the splash stays up, so it never flashes. */
export const SPLASH_MIN_MS = 900;

/**
 * Hard cap on the splash.
 *
 * It normally lifts when the page reports the dashboard assembled, which is
 * what makes the reveal feel instant. This guarantees a slow network or a
 * missing section delays the app rather than trapping it.
 */
export const SPLASH_MAX_MS = 7000;
