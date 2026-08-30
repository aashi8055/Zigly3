/**
 * The last auth state this app saw, kept across launches.
 *
 * WHAT PROBLEM THIS SOLVES.
 *
 * The session itself already survives a relaunch: the cookie jar is shared and
 * persistent (`sharedCookiesEnabled`, `thirdPartyCookiesEnabled` and
 * `cacheEnabled` in ../webview/webViewConfig), so the WebView is still signed in
 * to zigly.com when the app comes back. What does NOT survive is the app's
 * *knowledge* of that. `auth` starts every launch at 'unknown' and is only
 * settled by ACCOUNT_PROBE, which cannot answer until the dashboard has loaded
 * and the probe has made its round trip.
 *
 * Tap Account inside that window and the app has nothing to go on. It opens the
 * account screen empty, and a probe that has not yet found the session can flip
 * it to the login form -- so a customer who is signed in is asked to sign in
 * again. That is the bug this file exists for.
 *
 * A HINT, AND ONLY EVER A HINT.
 *
 * This is not a session and it is not evidence of one. It is the answer the last
 * probe gave, written down so the NEXT launch has something better than
 * 'unknown' to open on while the real answer is being fetched. The probe is
 * still the authority and still overrides this the moment it speaks -- including
 * when it says 'signedOut', which is what a session expired between launches
 * looks like.
 *
 * That is also why 'unknown' is never stored. It is the absence of an answer,
 * not an answer, and persisting it would mean writing down that we do not know.
 *
 * WHAT IS DELIBERATELY NOT KEPT HERE: anything about the customer. No name, no
 * email, no phone, no orders, no addresses. Those come from the theme on every
 * read and are the customer's own data; a hint about which SCREEN to open costs
 * nothing if it is wrong and discloses nothing if the device is read. The whole
 * value stored by this module is one of two words.
 *
 * Failures are swallowed, like ../webview/sectionIdStore: this sits in front of
 * a mechanism that already works without it, so a storage error must cost a
 * little smoothness and nothing else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {log, warn} from '../utils/logger';
import type {AuthState} from './accountData';

/** Namespaced under the app, not the site. See ./sectionIdStore's note. */
const KEY = 'zigly.authHint.v1';

/**
 * What may be written down: a definite answer, and nothing else.
 *
 * 'unknown' is excluded by the type rather than by a check, so a caller cannot
 * ask to persist the absence of an answer without the compiler saying no.
 */
export type AuthHint = Exclude<AuthState, 'unknown'>;

/**
 * The stored hint, or 'unknown' when there is none to be had.
 *
 * Anything that is not one of the two words this module writes is treated as
 * absent -- a truncated write, a value from an older build, a store someone has
 * edited. The app then does exactly what it did before this file existed.
 */
export const loadAuthHint = async (): Promise<AuthState> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'signedIn' || raw === 'signedOut') {
      log('auth hint:', raw);
      return raw;
    }
    return 'unknown';
  } catch (error) {
    warn('auth hint read failed:', error);
    return 'unknown';
  }
};

/**
 * Write down a definite answer.
 *
 * Called only where a probe or a completed login has actually settled the
 * question -- never speculatively, and never from a screen's own guess about
 * what it is showing.
 */
export const saveAuthHint = async (state: AuthHint): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, state);
  } catch (error) {
    warn('auth hint write failed:', error);
  }
};

/**
 * Forget the hint.
 *
 * Signing out goes through saveAuthHint('signedOut') rather than this: the fact
 * that the customer is signed out is itself worth knowing on the next launch,
 * because it opens the login screen without the account screen flickering past
 * first. This exists for the case where the stored answer must simply cease to
 * exist, and is kept so that a caller never has to reach for the raw key.
 */
export const clearAuthHint = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (error) {
    warn('auth hint clear failed:', error);
  }
};
