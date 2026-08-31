/**
 * The account section's own little stack.
 *
 * Every other native screen in this app is a boolean, and that was fine while
 * there were three of them that never sat on top of each other. The account
 * section is five screens deep in places -- Account -> Address -> Add Address,
 * or Account -> Favorites -> a product -- so booleans would have meant a matrix
 * of "which one is really on top" checks in the back handler, which is exactly
 * where an app starts closing the wrong screen.
 *
 * This is not ../pageStack: nothing here is a WebView, so nothing needs keeping
 * alive and eviction has no meaning. It is a list of screen names, and it is
 * pure so the rules can be tested without rendering anything.
 */
import type { AuthState } from '../account/accountData';

export type AccountScreen =
  /** The signed-in account screen: profile, then the rows. */
  | 'account'
  /** Login With OTP: the phone step, drawn natively. ../components/LoginScreen. */
  | 'login'
  /** The code step, drawn natively. ../components/OtpScreen. */
  | 'otp'
  /**
   * The signup step: first name, last name, email, and the phone the OTP just
   * proved. SimplyOTP's own form, restyled -- see ../webview/loginRestyle.ts
   * for why this one step is the widget's and the two before it are not.
   */
  | 'signup'
  | 'orders'
  | 'address'
  | 'addressForm'
  /** The profile form. A device-local overlay; see ../account/accountData. */
  | 'editProfile'
  /** A WebView over the site's own password page. See ../webview/passwordRestyle.ts. */
  | 'changePassword';

export type AccountStack = AccountScreen[];

export const EMPTY_ACCOUNT_STACK: AccountStack = [];

/**
 * The three screens that are all one act: signing in.
 *
 * They are named as a set because `resolveAuth` below has to treat them as one.
 * A customer part-way through an OTP is still signed out, and every account
 * probe that lands while they are typing says so -- so a rule that answered
 * "signed out" by collapsing to the login screen would throw away the code they
 * were entering, on a timer, for as long as they took to enter it.
 */
export const LOGIN_FLOW: AccountScreen[] = ['login', 'otp', 'signup'];

/** Whether a screen is part of that act. */
export const isLoginFlow = (screen: AccountScreen | null): boolean =>
  screen !== null && LOGIN_FLOW.indexOf(screen) !== -1;

/** Whether the section is showing nothing but that act. */
const onlyLoginFlow = (stack: AccountStack): boolean =>
  stack.length > 0 && stack.every(screen => isLoginFlow(screen));

/**
 * Whether two stacks name the same screens in the same order.
 *
 * The login flow is driven by what the widget behind it reports, and the widget
 * reports its step on every re-render -- so the same answer arrives many times.
 * Rebuilding the stack from a repeated answer would hand React a new array each
 * time and re-render the section for nothing. This is how the caller tells a
 * real move from a restatement.
 */
export const sameStack = (a: AccountStack, b: AccountStack): boolean =>
  a.length === b.length && a.every((screen, i) => screen === b[i]);

/** The screen the user is looking at, or null when the section is closed. */
export const topScreen = (stack: AccountStack): AccountScreen | null =>
  stack.length > 0 ? stack[stack.length - 1] : null;

/**
 * Open the section from the bottom navigation.
 *
 * Signed out goes straight to the login screen -- the requirement the whole of
 * this work exists for. Signed in, and not yet known, both open the account
 * screen: it draws a wait while the probe is out, and `resolveAuth` below
 * swaps it for the login screen if the answer comes back "signed out". Opening
 * login on an unknown state instead would show the login form to a customer who
 * is already signed in, every cold start, which is the worse mistake.
 */
export const openAccount = (auth: AuthState): AccountStack =>
  auth === 'signedOut' ? ['login'] : ['account'];

/**
 * Whether a step the widget just reported should be acted on at all.
 *
 * There is exactly one case where it should not, and it is the flash between
 * Submit and the dashboard. A correct code makes the widget tear its verify
 * step down BEFORE the page navigates: '.verify-box' goes away, '.login-box' is
 * briefly unhidden as the widget resets itself, and only then does the session
 * land. The driver reads that intermediate frame honestly and reports 'phone',
 * so the app rebuilt the login screen for a moment -- a customer who had just
 * typed a correct code being shown "log in" on the way to being logged in.
 *
 * `verifying` is true from Submit until something answers it. While it is, a
 * report of the phone step is the widget unwinding rather than a step the
 * customer is on, and is ignored.
 *
 * Deliberately narrow. Only 'phone', and only while a verdict is outstanding:
 * 'otp', 'details', 'success' and 'missing' are all real answers and always act,
 * so this can delay a screen but never swallow an outcome. The widget remains
 * the authority on which step it is on -- this says only which of its reports
 * describes a screen worth showing.
 */
export const actOnPhase = (
  phase: AccountPhase,
  verifying: boolean,
): boolean => !(verifying && phase === 'phone');

/**
 * The steps a widget report can name.
 *
 * Kept structural rather than importing LoginPhase from ../webview/otpDriver:
 * this module is the navigation layer and does not otherwise know that the
 * driver exists, and the rule above only ever asks about 'phone'.
 */
export type AccountPhase = string;

/**
 * Whether an auth answer should be believed, given a login just completed.
 *
 * The third fault reported against v15: sign in, and the app bounces straight
 * back to the login screen. It is a race between two WebViews rather than a
 * navigation mistake. The login completes in the LOGIN WebView -- that is where
 * the widget verified the code and where Shopify set the session cookie -- and
 * the app then probes /account inside the DASHBOARD WebView. Android's
 * CookieManager does not publish the new cookie to the second WebView
 * synchronously, so for a moment that fetch goes out with the pre-login jar,
 * /account redirects to /account/login, and the probe reports 'signedOut' in
 * perfect good faith. Believing it over the login just watched to succeed is
 * what collapsed the section back to the login screen.
 *
 * So a 'signedOut' is disbelieved for a short window after a login, and ONLY
 * then. Everything else is believed immediately, including every 'signedOut'
 * once the window has passed -- a session that genuinely expires still signs
 * the customer out, and the caller re-probes at the end of the window so the
 * app settles on what the site says rather than on this rule.
 *
 * `since` is 0 when no login has been watched, which is the ordinary case and
 * believes everything.
 *
 * WHY THE WINDOW ALONE WAS NOT ENOUGH (the fault this parameter fixes).
 *
 * The window is measured from the login, but the re-probe it schedules is armed
 * when the STALE REPLY lands -- which is always a little later. So the answer to
 * that re-probe arrives after `now - since` has already passed `window`, and was
 * believed on arrival. On a device where the cookie flush had still not
 * happened, that second 'signedOut' was just as stale as the first and was
 * taken as fact: `auth` went to 'signedOut' and the hint was written to disk.
 * Nothing was on screen to show it, because the section closes on success --
 * the customer saw it on the NEXT tap of Account, as the login flow all over
 * again for someone who was already signed in.
 *
 * `confirmed` is what closes that hole. It is false until a probe has actually
 * come back 'signedIn' since the login, and while it is false no 'signedOut' is
 * believed at all, however long it has been. The app watched the login succeed;
 * until something independently confirms the session, a WebView saying otherwise
 * is describing its own cookie jar rather than the customer.
 *
 * This cannot strand a customer in a session that has really ended:
 *   - Once ANY probe answers 'signedIn', `confirmed` is true for good and every
 *     later 'signedOut' is believed on the window's ordinary terms.
 *   - A sign-out the customer PRESSES clears `since` to 0 before it asks, so it
 *     takes the first branch here and is never suppressed.
 *   - `since` is 0 on a cold start, so a session that expired between launches
 *     is believed immediately.
 * The only state it holds open is the one between a login this app watched
 * succeed and the first probe that agrees -- which is exactly the race.
 */
export const believeAuth = (
  state: AuthState,
  since: number,
  now: number,
  window: number,
  confirmed: boolean = true,
): boolean => {
  if (state !== 'signedOut' || since === 0) {
    return true;
  }
  // Nothing has confirmed the session yet, so every 'signedOut' since the login
  // is a WebView that has not been handed the cookie -- not an answer about the
  // customer. See `confirmed` above for why this cannot strand a real expiry.
  if (!confirmed) {
    return false;
  }
  return now - since >= window;
};

/**
 * Whether a passive probe's 'signedOut' is enough, on its own, to sign the
 * customer out of a session the app currently believes in.
 *
 * The fault this exists for, reported after v16: sign in, go back to the
 * dashboard, tap Account again -- and get the login screen instead of the
 * account screen.
 *
 * `believeAuth` above covers the race it was built for and no more: it is
 * anchored to `signedInAt`, so it only protects the seconds after a login this
 * app WATCHED complete. Its first line returns true whenever `since` is 0, and
 * `since` is 0 in every other situation there is -- a cold start whose session
 * came from the cookie jar, a hint-seeded 'signedIn' (the seeding effect
 * deliberately bypasses applyAuth and so never sets the mark), or simply any
 * moment more than one window after signing in. In all of those, a single
 * 'signedOut' from ACCOUNT_PROBE was believed at face value.
 *
 * That matters because the read is not reliable enough to be trusted once. The
 * probe runs in the dashboard WebView and calls `ZA.load`, which reports
 * 'signedOut' whenever the fetch lands on /account/login -- which is what a
 * genuine expiry looks like, and equally what a momentary cookie-jar lapse, a
 * redirect caught mid-flight or a connection that dropped and re-served the
 * login page looks like. One such misread set auth to 'signedOut', collapsed
 * the section to ['login'] through `resolveAuth`, and -- because nothing
 * re-checks a verdict once applied -- left `openAccount` opening the login
 * screen on every tap afterwards.
 *
 * So a probe that contradicts a session the app is holding has to say it twice.
 * `agreed` is how many consecutive 'signedOut' reads have now arrived; the
 * first is treated as a question rather than an answer, and the caller re-probes
 * to settle it.
 *
 * This deliberately does NOT gate the routes that carry real evidence:
 *   - The customer's own Log Out goes through the 'auth' reply of LOGOUT_SCRIPT,
 *     which asked the site to end the session and watched it agree.
 *   - A write rejected with 'signedOut' has had a POST refused, not a page read.
 *   - A cold start has nothing to contradict: `held` is not 'signedIn', so the
 *     first answer stands, exactly as it always did.
 * Only the passive read is asked to repeat itself, because only the passive read
 * has been observed to be wrong.
 */
export const confirmSignedOut = (
  held: AuthState,
  agreed: number,
): boolean => held !== 'signedIn' || agreed >= 2;

/**
 * Apply an auth answer that arrived while the section was open.
 *
 * Signing out from anywhere in the section collapses it to the login screen,
 * because Orders, Address and the rest have nothing to show without a session.
 * Signing in replaces a login screen with the account screen and leaves any
 * other screen alone.
 */
export const resolveAuth = (
  stack: AccountStack,
  auth: AuthState,
): AccountStack => {
  if (stack.length === 0) {
    return stack;
  }
  if (auth === 'signedOut') {
    // Anywhere inside the login flow is left exactly where it is; see
    // LOGIN_FLOW above for why that is the whole point of this branch.
    return onlyLoginFlow(stack) ? stack : ['login'];
  }
  if (auth === 'signedIn' && isLoginFlow(stack[stack.length - 1])) {
    return ['account'];
  }
  return stack;
};

/**
 * Push a screen.
 *
 * Pushing the screen already on top is ignored, so a double tap on "Address"
 * does not cost two Backs to undo.
 */
export const pushScreen = (
  stack: AccountStack,
  screen: AccountScreen,
): AccountStack => (topScreen(stack) === screen ? stack : [...stack, screen]);

/** One step back. An empty stack means the section has closed. */
export const popScreen = (stack: AccountStack): AccountStack =>
  stack.slice(0, -1);

/** Close the whole section, e.g. when a bottom-navigation tab is tapped. */
export const closeAccount = (): AccountStack => EMPTY_ACCOUNT_STACK;
