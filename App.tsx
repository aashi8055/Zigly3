/**
 * Zigly — WebView shell (preview build).
 *
 * Architecture: a single WebView renders zigly.com; this file only decides when
 * the splash retires and keeps page content clear of the system bars. There is
 * intentionally no navigator — with one WebView and one splash, a navigation
 * graph would be ceremony.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Easing, StatusBar, StyleSheet, View} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  COLORS,
  SPLASH_FADE_MS,
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

  /**
   * The splash's own opacity, and whether it has finished getting out of the
   * way.
   *
   * Two pieces of state rather than one because the splash has to outlive the
   * decision to retire it: it is still on screen, fading, after the app is
   * ready. Unmounting on `ready` alone is the cut this replaces.
   */
  const splashFade = useRef(new Animated.Value(1)).current;
  const [splashGone, setSplashGone] = useState(false);

  /**
   * Ready, and never un-ready.
   *
   * Both inputs latch true, so this cannot go back -- which is the property
   * that rules out the failure the fade is here to avoid: the loader coming off,
   * the page appearing, and a loader appearing again over it.
   */
  const ready = minElapsed && webReady;

  useEffect(() => {
    if (!ready) {
      return;
    }
    const fade = Animated.timing(splashFade, {
      toValue: 0,
      duration: SPLASH_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    // Unmounted only once it is actually invisible. `finished` is false when the
    // animation was stopped -- on unmount -- and setting state then would be a
    // write into a dead tree.
    fade.start(({finished}) => {
      if (finished) {
        setSplashGone(true);
      }
    });
    return () => fade.stop();
  }, [ready, splashFade]);

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
      {/* Dark icons throughout. It used to flip to light-content behind the
          splash, which was right when the splash was a navy field and is the
          wrong way round now that it is white -- white icons on white is an
          empty status bar for as long as the splash is up. */}
      <StatusBar barStyle="dark-content" />

      {/* Mounted immediately and never unmounted: the page loads behind the
          splash, so the first paint is already done when the splash lifts. */}
      <ZiglyWebViewScreen onFirstLoad={handleFirstLoad} splashActive={!ready} />

      {/* Splash ignores the insets and covers the whole screen. */}
      {splashGone ? null : (
        <Animated.View
          style={[
            styles.splashLayer,
            {top: -insets.top, bottom: -insets.bottom, opacity: splashFade},
          ]}
          // Taps stop being swallowed the moment the page is ready, not when
          // the fade ends: the page underneath is finished, and a couple of
          // hundred milliseconds of dead screen after it is visibly there is
          // the kind of unresponsiveness a fade is supposed to hide, not add.
          pointerEvents={ready ? 'none' : 'auto'}>
          <SplashScreen />
        </Animated.View>
      )}
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
