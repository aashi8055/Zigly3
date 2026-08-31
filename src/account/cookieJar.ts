/**
 * Keeping the session cookie alive across a process death.
 *
 * WHY THIS EXISTS. ../webview/webViewConfig sets `sharedCookiesEnabled` and
 * `cacheEnabled`, and ./authHint says on that basis that "the session itself
 * already survives a relaunch". That is true of a relaunch and NOT true of a
 * kill, which is the ordinary way a mobile app ends: swiped from Recents, or
 * reclaimed while backgrounded. Two things break there, and the native module
 * behind this file is documented at length on both --
 *
 *   - Android writes the cookie jar to disk lazily, so a login made shortly
 *     before the process dies is never written at all;
 *   - Shopify's customer session carries no Max-Age, making it a *session*
 *     cookie that Android discards on process death by design.
 *
 * The requirement is that signing in once lasts until the customer uninstalls
 * or presses Log Out. Neither of those is a relaunch, so neither is covered by
 * the config alone.
 *
 * WHAT THIS IS NOT. Not an auth state, and nothing here may be read as one. A
 * cookie in the jar is not a session -- it can be expired, revoked, or for a
 * customer Shopify no longer recognises -- and ./authHint sets out why the
 * probe stays the only authority on that question. Everything in this file is
 * about DURABILITY: making sure the cookie the site set is still there to be
 * probed. `hasCookies` is a diagnostic for logs, deliberately not exported as
 * anything a screen could branch on.
 *
 * Every failure is swallowed, for ./authHint's reason: this sits in front of a
 * mechanism that mostly works without it, so a missing module or a jar that
 * cannot be read costs some durability and never a crash. iOS takes that path
 * today -- WKWebView's own store persists a session cookie across a relaunch
 * without help, so there is no native counterpart and these are all no-ops.
 */
import {NativeModules, Platform} from 'react-native';
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {log, warn} from '../utils/logger';

interface CookieJarNative {
  flush(): Promise<boolean>;
  persistSessionCookies(url: string, seconds: number): Promise<number>;
  hasCookies(url: string): Promise<boolean>;
}

/**
 * Absent on iOS, and absent on an Android build made before the native module
 * existed. Both are handled the same way: every function below returns quietly.
 */
const native: CookieJarNative | undefined =
  Platform.OS === 'android'
    ? (NativeModules.ZiglyCookieJar as CookieJarNative | undefined)
    : undefined;

/**
 * How long an extended session cookie is given.
 *
 * A year, which is not a guess at Shopify's own session length and does not
 * override it -- the server's cookie remains the thing that decides whether the
 * customer is signed in, and it can expire or be revoked whenever Shopify says
 * so. This is only how long ANDROID is asked to keep the cookie on disk, and
 * the requirement it serves is "until they uninstall or log out". A shorter
 * value would be an expiry policy this app has no business inventing; an
 * unbounded one is not expressible, so a year is the practical stand-in.
 */
const PERSIST_SECONDS = 365 * 24 * 60 * 60;

/**
 * Write the jar to disk now.
 *
 * Called where the app might not get another chance: after a login completes,
 * and when the app goes to the background. Cheap enough to call on every such
 * moment, and safe to call when there is nothing pending.
 */
export const flushCookies = async (): Promise<void> => {
  if (!native) {
    return;
  }
  try {
    await native.flush();
  } catch (error) {
    warn('cookie flush failed:', error);
  }
};

/**
 * Give the site's expiry-less cookies a lifetime, then write them down.
 *
 * This is the half that makes a login outlast the process rather than merely
 * outlast a graceful exit. Called on a completed login -- the moment the
 * cookie worth keeping has just been set -- and again on backgrounding, which
 * catches a session Shopify has since renewed.
 *
 * The name and value are never touched; see the native module for exactly what
 * is rewritten and what is deliberately left alone.
 */
export const persistSession = async (): Promise<void> => {
  if (!native) {
    return;
  }
  try {
    const extended = await native.persistSessionCookies(
      ZIGLY_ORIGIN,
      PERSIST_SECONDS,
    );
    log('session cookies made durable:', extended);
  } catch (error) {
    warn('session persist failed:', error);
  }
};

/**
 * Whether the jar holds anything for the site. Diagnostic only.
 *
 * Says a jar is non-empty. Says nothing about whether anyone is signed in, and
 * nothing in the app may treat it as if it did -- see the note at the top.
 */
export const hasSessionCookies = async (): Promise<boolean> => {
  if (!native) {
    return false;
  }
  try {
    return await native.hasCookies(ZIGLY_ORIGIN);
  } catch (error) {
    warn('cookie check failed:', error);
    return false;
  }
};
