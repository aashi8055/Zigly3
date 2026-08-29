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
