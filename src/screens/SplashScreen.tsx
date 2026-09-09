/**
 * Native splash shown over the WebView until the dashboard has assembled.
 *
 * The home page is ~2.1 MB, so without this the user would watch a white
 * rectangle fill in. It sits above the WebView rather than replacing it, so
 * the page keeps loading behind the splash.
 *
 * White, and Zigly's own logo. It used to be a navy field with the wordmark
 * drawn from Views and a tagline underneath, which was two departures from the
 * real app at the first thing anyone sees: the wrong ground, and a line of copy
 * ("Everything your pet needs") that this app had written for itself. Both are
 * gone.
 *
 * THE MARK IS ../assets/logo.png, AND WHICH FILE IT IS MATTERS. That is the
 * tight wordmark lock-up -- 493x124 -- and it is deliberately the one asset
 * with no @2x/@3x siblings. This used to require zigly-logo.png, which does
 * have them, and every one of those siblings is the SQUARE launcher icon
 * (162/216/324/432px). React Native resolves an asset by density, so the base
 * wordmark was only ever drawn in a simulator: on a real phone the splash was
 * painting the padded square icon, which is why the customer saw a small square
 * mark and then a wide wordmark -- two different logos, back to back, at launch.
 * ../components/NativeHeader hit the identical bug and records the same fix.
 *
 * The Android launch screen (android/.../drawable/zigly_splash.xml) now draws
 * that same wordmark at a matching size, so the hand-off from the window
 * manager to this component is one continuous image rather than a swap.
 *
 * The white matters beyond taste. The page behind this is white while it loads,
 * and so is the app's ground, so lifting the splash is now a fade between two
 * whites instead of a navy sheet snapping away to reveal a bright page.
 *
 * WHY IT STAYS A LOGO, AND WHY THE LOGO BREATHES. The splash waits for
 * `dashboard-ready`, and the dashboard is allowed to take its time answering --
 * a held logo beats a half-built store. A logo held perfectly still for several
 * seconds stops reading as loading and starts reading as stuck, so instead of
 * handing off to a separate skeleton/spinner, the mark itself gently pulses in
 * scale for as long as the splash is up. It is still just the brand -- nothing
 * that reads as a distinct "loading widget" -- but it is visibly alive.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {COLORS} from '../constants/appConstants';

/**
 * Zigly's own wordmark.
 *
 * `require` rather than a URI, so the file is in the bundle -- a splash that
 * had to fetch its own logo would be showing nothing at the one moment it
 * exists for. And ../assets/logo.png rather than zigly-logo.png: see the note
 * at the top on why the latter resolves to the square launcher icon on a real
 * device.
 */
const LOGO = require('../assets/logo.png');

/**
 * The wordmark's drawn size. 493x124 is 3.976:1, so the height follows the
 * width rather than being guessed; `contain` would letterbox anything else.
 * 240dp wide sits comfortably inside the narrowest phone this app supports.
 */
const LOGO_W = 240;
const LOGO_H = Math.round(LOGO_W * (124 / 493));

/** How far the mark grows at the top of each breath. 1.04 reads as alive, not as motion. */
const BREATHE_SCALE = 1.04;
/** One full in-and-out breath. Slow enough to read as idle, not as urgency. */
const BREATHE_MS = 1400;

const SplashScreen = () => {
  /** 1 at rest, BREATHE_SCALE at the top of each breath. */
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: BREATHE_SCALE,
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: BREATHE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Zigly">
      <View style={styles.centre}>
        <Animated.Image
          source={LOGO}
          style={[styles.logo, {transform: [{scale: breathe}]}]}
          // The mark must never be stretched: it is a wordmark, and a wordmark
          // that is a few percent wide is the kind of wrong that is felt without
          // being noticed.
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {width: LOGO_W, height: LOGO_H},
});

export default SplashScreen;
