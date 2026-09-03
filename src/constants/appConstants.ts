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
  /*
   * Shiprocket, which is this store's ACTUAL checkout -- the same embed that
   * owns Buy Now on a product page and Checkout in the cart.
   *
   * Its absence here was a real bug rather than an omission. Everything that
   * asks "is the customer in the money flow?" goes through isCheckoutUrl, and
   * that reads this list: with no Shiprocket host in it, a loaded Shiprocket
   * checkout was not recognised as checkout at all. So the bottom nav stayed
   * over a payment page, the page got injected into like a storefront page,
   * and the native cart overlay was never told to come down -- it sat on top
   * of a working checkout until a timeout declared the checkout had failed.
   *
   * Both apex and the checkout subdomain: hostMatches covers subdomains of an
   * entry, but the entry has to be there to be matched.
   */
  'shiprocket.in',
  'checkout.shiprocket.in',
  'fastrr.shiprocket.in',
  'fastrr-boost-ui.pickrr.com',
  'pickrr.com',
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
  navyDeep: '#113459',
  red: '#ED2427',
  white: '#FFFFFF',
  ink: '#323232',
  inkMuted: '#767676',
  hairline: '#DDE3EC',
  /**
   * The app's page ground: white, and the same white the store paints.
   *
   * It was a warm off-white (#FFFAF1) until 2026-08-23. The tint read badly
   * for a reason that is not taste: the store paints its own sections, cards
   * and rails pure white, so every one of them met the ground on a visible
   * seam, and the seam moved while a page assembled -- a cream field, then
   * white blocks landing on it one at a time. That is read as flicker, which
   * is exactly what this app exists not to do. Agreeing with the site removes
   * the boundary altogether: there is nothing left to repaint.
   *
   * Kept as its own token rather than folded into `white` because the two mean
   * different things -- `white` is also the foreground colour of text on the
   * navy and red fills -- and because the places that need a ground a card can
   * sit *on* now say so, with `surface`.
   */
  ground: '#FFFFFF',
  /**
   * A neutral ground for the native list screens -- cart, orders, wishlist,
   * addresses -- where white cards sit on it and would otherwise vanish into
   * it. Grey, never cream: it is the same job the old warm ground did on those
   * screens, done in a colour that does not fight the store's white.
   */
  surface: '#F4F6F9',
};

/**
 * The fill behind every add-to-cart control in the app.
 *
 * ONE colour, in ONE place, because there are three different renderers drawing
 * this button and they have to agree: the native sticky bar
 * (../components/ProductActionBar), the site's own button on every product card
 * -- Hot Picks, Bestsellers, the listing grid -- which is restyled by
 * ../webview/injectedStyles, and SearchTap's replacement card, which appears the
 * moment a filter is applied. A customer moves between all three in one
 * session, so a per-renderer colour reads as three different buttons for the
 * same action.
 *
 * The pale fill with COLORS.red text is what Buy Now already used. Add to Bag
 * was #1B1B1B with white text, which made it look like the primary of a pair on
 * the product bar and disagreed with the card buttons entirely.
 *
 * The injected stylesheet cannot import this -- it is a CSS string compiled into
 * a script -- so it carries the literal and cites this token. Changing the
 * colour means changing both; ../../__tests__/buttonColour.test.ts fails if they
 * drift apart.
 */
export const BUTTON_FILL = '#FDE8E8';

/**
 * The paths the site puts a sortable product grid behind.
 *
 * This is the one place the answer is written down, and both the app and the
 * page read it: `showsSortFilterBar` in ../utils/urlUtils decides whether to
 * draw the Sort / Filter bar, and the same list is compiled into the injected
 * scripts (see ../webview/listingPage.ts). They used to carry a copy each, with
 * a comment asking whoever changed one to change the other.
 *
 * WHY THESE TWO AND NOTHING ELSE. The sort and filter engine on this store is
 * SearchTap, and it is enabled on exactly two templates. Verified against the
 * live site on 2026-08-23 by fetching each surface the app can reach and
 * looking for the engine's own markup:
 *
 *   /collections/{handle}   the collection template. Carries
 *                           #collectionmodalcontainer, initial-search-filters
 *                           and initial-toolbox-bar. Tag, vendor and /all
 *                           listings are the same template, and the trailing
 *                           slash is what keeps the bare collection *list* out
 *                           -- that page has no products on it to sort.
 *   /search                 SearchTap renders the whole grid, so the served
 *                           HTML shows nothing; the engine appears at runtime.
 *
 * And what was checked and does NOT have it: /collections (a list of collection
 * cards), /pages/pet-breeds, and the breed landing pages such as /pages/dog --
 * which carry 200-odd product cards but all of them inside carousels and themed
 * rails, with no grid and no engine. A bar there would have nothing to drive.
 */
export const LISTING_PATHS = ['/collections/', '/search'];

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
 *
 * IT MUST OUTLAST THE DASHBOARD'S OWN DEADLINE, and it did not. This was 2500
 * against a home watcher allowed 9900ms (HOME_TRIES in ../webview/readySignal),
 * which is the same inversion `PageCover` and `readySignal` each record having
 * fixed for inner pages -- and never fixed for home. The grace fired first, so
 * on every dashboard that took more than two and a half seconds to assemble the
 * splash came down at the one moment nobody had said the dashboard was ready:
 * the customer got the half-built page, which is the thing the splash exists to
 * hide.
 *
 * The dashboard now answers inside 5.4s and this is the failsafe behind it, for
 * the case where the signal never comes at all. The ordering that matters --
 * HOME_TRIES x TICK_MS < this < SPLASH_MAX_MS -- is asserted in
 * __tests__/revealBudget.test.ts so it cannot be inverted again by accident.
 */
export const SPLASH_READY_GRACE_MS = 6000;

/**
 * The dashboard's own cover, held over its WebView until `dashboard-ready`
 * fires -- independent of the splash, and on a longer clock than either of
 * its timers.
 *
 * The splash retires on its own failsafe (SPLASH_READY_GRACE_MS, then
 * SPLASH_MAX_MS) so a slow network never traps the customer behind a still
 * logo. But that failsafe is a guess standing in for a signal that has not
 * arrived, and a splash that gives up before the dashboard actually answers
 * used to hand the customer straight to the half-built mobile website -- the
 * thing this whole arrangement exists not to show. This cover is what the
 * splash now dissolves into instead, so it must outlast every timer the
 * splash answers to: giving up first would only move today's bug from the
 * splash to this cover.
 */
export const HOME_COVER_MAX_MS = 9000;

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
 * Where the account screen's Change Password row goes. **UNCONFIRMED.**
 *
 * Say the whole of it, because the row is drawn on the strength of a screenshot
 * and this is the part the screenshot does not settle:
 *
 *   - Shopify's classic customer accounts have **no signed-in change-password
 *     page**. There is no `/account/change-password` and this constant does not
 *     invent one.
 *   - The only password mechanism the platform has is `POST /account/recover`,
 *     which **emails a reset link**. Its form is rendered on the login page
 *     behind the `#recover` fragment, which is what this URL points at.
 *   - So the row opens a password *reset*, not a password *change* -- and on an
 *     OTP-first store many customers have never set a password for that link to
 *     change in the first place.
 *
 * That is open question 1 on this work, and it is unanswered: nobody has
 * confirmed what Zigly's own app shows after tapping the row. The row and this
 * destination are here so the screen matches the reference app's layout; the
 * destination should be confirmed before it reaches customers. See
 * ../components/AccountScreen.tsx and ../webview/passwordRestyle.ts.
 */
export const CHANGE_PASSWORD_URL = `${ZIGLY_ORIGIN}${ACCOUNT_LOGIN_PATH}#recover`;

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
