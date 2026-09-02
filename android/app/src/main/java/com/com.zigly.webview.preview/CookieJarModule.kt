package com.zigly.webview.preview

import android.os.Build
import android.webkit.CookieManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Making the login survive the app being killed.
 *
 * THE PROBLEM. The requirement is that a customer who signs in once stays
 * signed in until they uninstall or press Log Out. The session lives in the
 * WebView's cookie jar, and `sharedCookiesEnabled` / `cacheEnabled` in
 * ../../../../../src/webview/webViewConfig.ts already point every WebView at
 * the one persistent jar. That is necessary and it is not sufficient, for two
 * separate reasons:
 *
 *  1. ANDROID WRITES COOKIES LAZILY. CookieManager keeps them in memory and
 *     syncs to disk on its own schedule. If Android kills the process before
 *     that sync -- swiped from Recents, or reclaimed while backgrounded, which
 *     is the ordinary fate of a backgrounded app -- everything written since
 *     the last sync is simply gone. A login is exactly what tends to be in that
 *     window, because the customer signs in and then leaves.
 *
 *  2. A SESSION COOKIE IS DISCARDED ON PROCESS DEATH BY DESIGN. Shopify sets
 *     the customer session without an Expires/Max-Age, so it is a session
 *     cookie: correct for a browser tab, wrong for an app the customer expects
 *     to still be signed in tomorrow. No amount of flushing keeps it, because
 *     Android is not failing to save it -- it is deleting it on purpose.
 *
 * WHAT THIS MODULE DOES ABOUT EACH. `flush` forces the pending write for (1).
 * `persistSessionCookies` reads the jar back for a host, finds the cookies that
 * carry no expiry, and re-sets them with a far-future Max-Age -- turning a
 * browser-tab session into an app-lifetime one for (2). Both are the whole of
 * this module; it does not decide when to call them, and it never invents,
 * edits or moves a cookie's VALUE.
 *
 * WHY THE APP MAY NOT SIMPLY CLEAR THESE. Sign-out stays where it is, on the
 * site's own /account/logout (see ../../../../../src/webview/accountBridge.ts).
 * This module has no clear method on purpose: the one reliable way to end up
 * with the app and the website disagreeing about who is signed in is for the
 * app to start deleting cookies behind the site's back. Log Out already works
 * against a re-set cookie -- Shopify's own Set-Cookie in the logout response
 * overwrites the value here, expiry and all.
 */
class CookieJarModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /**
   * Write the in-memory cookie jar to disk, now.
   *
   * Called at the moments the app might not get another chance -- a completed
   * login, and going to the background. `flush()` is asynchronous inside the
   * WebView, so the promise resolving means "the write was asked for", not
   * "the bytes are on disk"; there is no API that promises the latter. That is
   * still the whole of the difference between a login that survives being
   * swiped away and one that does not.
   *
   * Resolves rather than rejects when the WebView is unavailable. A device with
   * no WebView cannot have signed anyone in, so there is nothing to report and
   * nothing a caller could usefully do about it.
   */
  @ReactMethod
  fun flush(promise: Promise) {
    try {
      CookieManager.getInstance().flush()
      promise.resolve(true)
    } catch (error: Throwable) {
      // Includes the AndroidX WebView being absent or still updating, which is
      // a device state rather than a fault in the call.
      promise.resolve(false)
    }
  }

  /**
   * Give this host's expiry-less cookies a real expiry, then flush.
   *
   * The mechanism is deliberately dull: read what the jar has for `url`, keep
   * the pairs whose attributes say nothing about when they end, and set each one
   * back with the same name and the same value plus a Max-Age. Same jar, same
   * host, same value -- the only thing that changes is that Android now has a
   * reason to keep it when the process dies.
   *
   * Attributes are rebuilt rather than echoed because getCookie() does not
   * return them: it hands back `name=value; name=value`, so Path, Secure and
   * SameSite have to be stated here.
   *
   * AND THAT IS EXACTLY WHY THE SHOP'S OWN COOKIES ARE SKIPPED. `setCookie`
   * REPLACES a cookie with the attributes given; it does not merge them into
   * what is already there. An earlier revision of this file claimed the
   * opposite -- "cookies already marked HttpOnly by the server keep that flag,
   * because setCookie does not clear an attribute it does not mention" -- and
   * that claim was false. Rebuilding a server-set cookie here therefore
   * silently strips HttpOnly and anything else not restated, which is how
   * `_shopify_essential` stopped being sent and every account probe started
   * reading as signed out. The loop below now leaves those alone; see the
   * comment on the skip itself.
   *
   * Only cookies that lack an expiry are touched. One Shopify has already given
   * a lifetime is a decision by the site about that cookie, and this module
   * does not overrule it -- it fills a gap, it does not impose a policy.
   *
   * Resolves with how many were extended, which is what the JS side logs. It
   * never rejects: this sits in front of a session that mostly works without
   * it, exactly like the hint in ../../../../../src/account/authHint.ts, so a
   * failure here must cost durability and never a crash.
   */
  @ReactMethod
  fun persistSessionCookies(url: String, seconds: Double, promise: Promise) {
    try {
      val manager = CookieManager.getInstance()
      val raw = manager.getCookie(url)
      if (raw.isNullOrBlank()) {
        promise.resolve(0)
        return
      }
      val maxAge = seconds.toLong().coerceAtLeast(0L)
      var extended = 0
      for (pair in raw.split(";")) {
        val cookie = pair.trim()
        if (cookie.isEmpty()) continue
        val eq = cookie.indexOf('=')
        // A cookie with no '=' is malformed, and one with an empty name is not
        // addressable; neither can be re-set without guessing at it.
        if (eq <= 0) continue
        val name = cookie.substring(0, eq)
        val value = cookie.substring(eq + 1)
        /*
         * Leave the shop's own cookies exactly as the server set them.
         *
         * THE FAULT THIS FIXES: the loop used to re-set every cookie
         * getCookie() returned, and `setCookie` REPLACES a cookie rather than
         * merging attributes into it -- the note above this function used to
         * claim otherwise, and it was wrong. So `_shopify_essential`, which
         * Shopify issues as `Max-Age=31536000; Path=/; HttpOnly; Secure;
         * Priority=High; SameSite=Lax`, was rewritten without HttpOnly and
         * without Priority. The rewritten cookie stayed visible in the jar --
         * which is why it still appeared in a jar dump -- but was no longer
         * the cookie the storefront issued, and the WebView stopped sending it
         * on its own fetches. /account then answered every probe with a
         * redirect to /account/login, and the account screen never filled in.
         *
         * These cookies also do not need this module: Shopify already gives
         * them a year. What this module exists for is the expiry-LESS session
         * cookie, and rewriting anything else was never part of that job.
         */
        if (name.startsWith("_shopify") || name.startsWith("_secure_")) continue
        // getCookie() strips attributes, so every pair it returns is one the
        // jar is currently serving. Re-setting it with Max-Age is what makes it
        // outlive the process; the value is copied through untouched.
        manager.setCookie(url, "$name=$value; Path=/; Max-Age=$maxAge; Secure; SameSite=Lax")
        extended += 1
      }
      manager.flush()
      promise.resolve(extended)
    } catch (error: Throwable) {
      promise.resolve(0)
    }
  }

  /**
   * Whether the jar currently holds anything for this host.
   *
   * Used only as a diagnostic on the JS side -- it says a jar is non-empty, not
   * that anyone is signed in, and nothing may branch on it as if it did. The
   * probe in ../../../../../src/webview/accountBridge.ts remains the only thing
   * that answers the auth question, for the reason authHint.ts sets out at
   * length: a cookie's presence is not a session.
   */
  @ReactMethod
  fun hasCookies(url: String, promise: Promise) {
    try {
      promise.resolve(!CookieManager.getInstance().getCookie(url).isNullOrBlank())
    } catch (error: Throwable) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "ZiglyCookieJar"
  }
}
