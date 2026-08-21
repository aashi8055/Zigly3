/**
 * WebView configuration.
 *
 * Phase 4 rule: the site renders exactly as it would in Chrome. No injected
 * CSS, no injected JS, no patched globals. Anything that changes what the page
 * sees belongs in a later phase, behind a device-verified reason.
 */

import type {WebViewProps} from 'react-native-webview';

/**
 * Identifies the app in the UA while leaving the platform UA intact.
 *
 * We deliberately append rather than replace. A hand-written Chrome UA would
 * hide the "; wv" token, and while that is a common wrapper trick, it also
 * misreports the runtime to Zigly's own analytics and to the payment vendor.
 * If a gateway turns out to reject WebView UAs, that is a finding for device
 * testing, not an assumption to bake in now.
 */
export const APP_UA_TOKEN = 'ZiglyAppPreview/0.1';

export const baseWebViewProps: Partial<WebViewProps> = {
  // Policy lives in onShouldStartLoadWithRequest, so let every URL reach it
  // rather than splitting the decision across two mechanisms.
  originWhitelist: ['*'],

  // --- session persistence (requirement: stay logged in across launches) ---
  javaScriptEnabled: true,
  domStorageEnabled: true,
  thirdPartyCookiesEnabled: true,
  sharedCookiesEnabled: true,
  cacheEnabled: true,

  // --- security ---
  // Never silently load cleartext subresources on an https page.
  mixedContentMode: 'never',
  // No SSL bypass anywhere in this project.
  allowsProtectedMedia: true,

  // --- behaviour ---
  applicationNameForUserAgent: APP_UA_TOKEN,
  allowsFullscreenVideo: true,
  allowsInlineMediaPlayback: true,
  mediaPlaybackRequiresUserAction: true,
  // Android: the site's own pull-to-refresh does not exist, and enabling ours
  // would fight the many horizontal Swiper rails on the home page.
  pullToRefreshEnabled: false,
  overScrollMode: 'never',
  // androidLayerType is deliberately left at its default. Do not set it to
  // 'software' to chase a blank screen on an emulator: a white WebView there is
  // usually the emulator's own Chromium/GPU compositing failing (verify by
  // opening Chrome on the same emulator -- if that is white too, it is not the
  // app), and a software layer would cost real scroll performance on devices.

  // Phase 4: window.open is routed into the main WebView so that the site's
  // 34 target="_blank" links go through our URL policy instead of dead-ending.
  // Shop Pay's popup needs true here; revisit in Phase 6 with a device.
  setSupportMultipleWindows: false,

  // Geolocation is requested by the site's pincode/delivery-estimate widget.
  // The native permission prompt is wired up in Phase 6.
  geolocationEnabled: true,
};
