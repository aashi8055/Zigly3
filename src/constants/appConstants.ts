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
  /**
   * The app's page ground: a warm off-white.
   *
   * Distinct from `white`, which stays pure -- it is also the foreground colour
   * of text and icons on the navy and red fills, so tinting it would tint them.
   * Anything that is a *surface the page sits on* uses this; anything that is a
   * card lifted off that surface stays `white`, which is what gives the card
   * its edge without a border.
   */
  ground: '#FFFAF1',
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

/**
 * How long the splash takes to dissolve once the dashboard is ready.
 *
 * It used to be unmounted outright, and a cut is exactly what reads as the
 * "twitch" this app was accused of: the eye catches the frame boundary between
 * two white screens and reports it as a glitch, not as progress. A fade over a
 * few frames is read as one screen becoming another.
 *
 * Short on purpose. This time is spent *after* the page is ready, so every
 * millisecond here is a millisecond the customer waits for nothing.
 */
export const SPLASH_FADE_MS = 240;

/**
 * How long after the document has loaded the splash will still wait for the
 * dashboard to report itself assembled.
 *
 * The splash lifts on `dashboard-ready` (see ../webview/readySignal), not on
 * the load event -- a load ending is the document arriving, and revealing then
 * showed the transplanted sections filling in afterwards, in full view. But a
 * signal that never comes -- an injection that did not run, a page shape the
 * watcher does not recognise -- must not cost the whole of SPLASH_MAX_MS.
 *
 * So this is the middle deadline: measured from load end rather than from
 * launch, which is what makes it a grace period for assembly rather than a
 * second guess at how slow the network is.
 */
export const SPLASH_READY_GRACE_MS = 2500;

/* ------------------------------------------------------------------
   Account.

   zigly.com runs Shopify's *classic* customer accounts -- verified
   2026-08-22: /account 302s to /account/login?return_url=%2Faccount, not to
   shopify.com's new-accounts host. That matters, because it means the account
   pages are ordinary storefront pages on the canonical origin, readable with
   the session this app already shares (the "one cookie jar" rule), and the
   address form is Shopify's own documented POST target rather than an API that
   would need a token this app has no right to.

   Login itself is a third-party app: SimplyOTP (auth.lucentcommerce.com), with
   `recaptcha_enabled: true` and `fraud_detection: true` in its live config. So
   the OTP request cannot be made from native code -- a reCAPTCHA token only
   exists inside a real page. The login screen therefore runs the site's own
   widget in a WebView and restyles it; see ../webview/loginRestyle.ts.
   ------------------------------------------------------------------ */

/** The account page. Redirects to ACCOUNT_LOGIN_PATH when signed out. */
export const ACCOUNT_PATH = '/account';
export const ACCOUNT_LOGIN_PATH = '/account/login';
export const ACCOUNT_ADDRESSES_PATH = '/account/addresses';
export const ACCOUNT_LOGOUT_PATH = '/account/logout';

/**
 * Where the login WebView is sent, and where a completed login lands.
 *
 * `return_url` is Shopify's own parameter, so the site decides the landing
 * page; the app only has to notice that it is no longer on the login page.
 */
export const LOGIN_URL = `${ZIGLY_ORIGIN}${ACCOUNT_LOGIN_PATH}?return_url=%2Faccount`;

/**
 * Shopify's country/province dataset for this shop, same origin and no key:
 * `var Countries = {...};`. It is what fills the Country and State pickers on
 * the address form, so those lists are the shop's own rather than a table
 * bundled into the app that would drift out of date.
 */
export const COUNTRIES_URL = `${ZIGLY_ORIGIN}/services/countries.js`;

/** Where an account-deletion request goes. Zigly handles these by hand. */
export const SUPPORT_PAGE_URL = `${ZIGLY_ORIGIN}/pages/contact-us`;
export const SUPPORT_EMAIL = 'support@zigly.com';

/**
 * The bottom navigation.
 *
 * The site's own bar (`.fixed-icons`) carries four tabs and no Account item at
 * all -- verified against the live homepage on 2026-08-22 -- while the
 * reference app shows five. It is also drawn inside the page, so it vanished
 * behind every native screen this app has. Both problems have the same fix:
 * the bar is native, and the site's is hidden (see injectedStyles.ts).
 *
 * Hrefs are the site's own, so the destinations stay whatever Zigly points
 * those tabs at.
 */
export type TabKey = 'home' | 'collections' | 'breeds' | 'wishlist' | 'account';

export interface Tab {
  key: TabKey;
  label: string;
  /** Absent for the two tabs that open a native screen. */
  url?: string;
}

export const TABS: Tab[] = [
  {key: 'home', label: 'Zigly', url: `${ZIGLY_ORIGIN}/`},
  {key: 'collections', label: 'Collection', url: `${ZIGLY_ORIGIN}/collections`},
  {key: 'breeds', label: 'Breed-verse', url: `${ZIGLY_ORIGIN}/pages/pet-breeds`},
  {key: 'wishlist', label: 'Wishlist'},
  {key: 'account', label: 'Account'},
];
