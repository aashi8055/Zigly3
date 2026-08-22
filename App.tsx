/**
 * Zigly — WebView shell (preview build).
 *
 * Architecture: a single WebView renders zigly.com; this file only decides when
 * the splash retires and keeps page content clear of the system bars. There is
 * intentionally no navigator — with one WebView and one splash, a navigation
 * graph would be ceremony.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  COLORS,
  SPLASH_MIN_MS,
  SPLASH_MAX_MS,
} from './src/constants/appConstants';
import SplashScreen from './src/screens/SplashScreen';
import ZiglyWebViewScreen from './src/screens/ZiglyWebViewScreen';

const Shell = () => {
  /**
   * Android 15 draws apps edge-to-edge, so without this the site's header slid
   * under the clock and its fixed bottom nav sat under the gesture pill. We pad
   * natively rather than injecting CSS into the page: the inset belongs to the
   * device, not to Zigly's stylesheet, and injecting would have to be reapplied
   * on every Shopify section re-render.
   */
  const insets = useSafeAreaInsets();

  /** Elapsed minimum display time — stops the splash flashing on fast loads. */
  const [minElapsed, setMinElapsed] = useState(false);
  /**
   * The dashboard has reported itself assembled -- or the cap has fired.
   *
   * The reference app holds its splash and then shows a complete dashboard.
   * Revealing on page-load alone meant the transplanted sections filled in
   * afterwards, in full view.
   */
  const [webReady, setWebReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Never let a slow or missing section trap the user behind the splash.
    const cap = setTimeout(() => setWebReady(true), SPLASH_MAX_MS);
    return () => clearTimeout(cap);
  }, []);

  const handleFirstLoad = useCallback(() => setWebReady(true), []);

  const splashVisible = !minElapsed || !webReady;

  return (
    <View
      style={[
        styles.root,
        // Ground-coloured bands top and bottom: the status bar area and the
        // gesture-pill area read as part of the page, not as a white frame
        // around it.
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}>
      {/* RN 0.87 is always edge-to-edge; `translucent` no longer exists. The
          padding above is what keeps content out from under the bars. */}
      <StatusBar barStyle={splashVisible ? 'light-content' : 'dark-content'} />

      {/* Mounted immediately and never unmounted: the page loads behind the
          splash, so the first paint is already done when the splash lifts. */}
      <ZiglyWebViewScreen onFirstLoad={handleFirstLoad} />

      {/* Splash ignores the insets and covers the whole screen. */}
      {splashVisible ? (
        <View style={[styles.splashLayer, {top: -insets.top, bottom: -insets.bottom}]}>
          <SplashScreen />
        </View>
      ) : null}
    </View>
  );
};

const App = () => (
  <SafeAreaProvider>
    <Shell />
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.ground},
  splashLayer: {position: 'absolute', left: 0, right: 0},
});

export default App;
