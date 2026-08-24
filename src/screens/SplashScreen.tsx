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
 * gone. The mark is the real one -- ../assets/zigly-logo.png is the launcher
 * icon's own artwork, at every density -- so the splash, the launcher icon and
 * the site's header now show the same logo.
 *
 * The white matters beyond taste. The page behind this is white while it loads,
 * and so is the app's ground, so lifting the splash is now a fade between two
 * whites instead of a navy sheet snapping away to reveal a bright page.
 *
 * WHY IT NO LONGER STAYS A LOGO. The splash waits for `dashboard-ready`, and the
 * dashboard is now allowed to take its time answering -- that is the point of
 * the change this file is part of, and it is the right trade: a held logo beats a
 * half-built store. But a logo held for five seconds stops reading as loading and
 * starts reading as stuck, because nothing about it changes.
 *
 * So the mark gets its beat and then dissolves into the shape of the dashboard.
 * The customer sees a brand, then sees where the store is going to be, then sees
 * the store. Nothing here shortens the wait; it makes the wait legible.
 */
import React, {useEffect, useRef} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, SPLASH_SKELETON_AFTER_MS} from '../constants/appConstants';
import {HomeSkeleton, usePulse} from '../components/Skeleton';

/**
 * Zigly's own mark, from the launcher icon set.
 *
 * `require` rather than a URI, so Metro picks the density it needs from the
 * @1.5x/@2x/@3x/@4x siblings and the file is in the bundle -- a splash that
 * had to fetch its own logo would be showing nothing at the one moment it
 * exists for.
 */
const LOGO = require('../assets/zigly-logo.png');

/**
 * The artwork is square with the wordmark across its middle, so this is the
 * width the wordmark gets; the height follows from `contain`. Sized to sit
 * comfortably inside the narrowest phone this app supports.
 */
const LOGO_SIZE = 240;

/** How long the mark takes to give way to the shape. */
const HANDOVER_MS = 320;

/**
 * Where the dashboard's content actually starts, below the app's own chrome.
 *
 * This splash covers the whole screen, including the header the rest of the app
 * draws, so it has to leave that room itself or the placeholder circles would sit
 * where the search bar is. The three contributors, and where they live:
 *
 *   38  the announcement bar    ../components/AnnouncementBar
 *   52  the header bar          BAR_H in ../components/NativeHeader
 *   64  the search band         SEARCH_BAND_H in ../components/NativeHeader
 *
 * DELIBERATELY AN APPROXIMATION. The announcement bar only appears once the page
 * has reported something to put in it, so the true offset is not knowable at the
 * moment this is drawn. It does not need to be: the splash dissolves rather than
 * cutting, so a placeholder a few points out of register melts into the real
 * thing instead of jumping. That is the same reasoning ../components/PageCover
 * records for its own shapes.
 */
const CHROME_H = 38 + 52 + 64;

const SplashScreen = () => {
  const insets = useSafeAreaInsets();
  /** 1 while the mark is the whole screen, 0 once the shape has taken over. */
  const mark = useRef(new Animated.Value(1)).current;
  const shape = useRef(new Animated.Value(0)).current;
  const pulse = usePulse(true);

  /*
   * The wait before the hand-over is `Animated.delay`, not a `setTimeout`.
   *
   * It has to be. A bare timer of over a second outlives the tree that armed it
   * in any environment that tears down without unmounting -- the test renderer
   * does exactly that -- and it then wakes up and reaches for an `Animated` that
   * is no longer there. Inside the animation, the delay is something `stop()` can
   * cancel, and the cleanup below does.
   */
  useEffect(() => {
    const handover = Animated.parallel([
      Animated.sequence([
        Animated.delay(SPLASH_SKELETON_AFTER_MS),
        Animated.timing(mark, {
          toValue: 0,
          duration: HANDOVER_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(SPLASH_SKELETON_AFTER_MS),
        Animated.timing(shape, {
          toValue: 1,
          duration: HANDOVER_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    handover.start();
    return () => handover.stop();
  }, [mark, shape]);

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Zigly">
      {/*
        The shape is underneath and fades up, so there is never a frame with
        neither on it -- the two cross, rather than one leaving before the other
        arrives.
      */}
      <Animated.View
        style={[
          styles.sheet,
          {paddingTop: insets.top + CHROME_H, opacity: shape},
        ]}
        pointerEvents="none">
        <HomeSkeleton pulse={pulse} />
      </Animated.View>

      <Animated.View style={[styles.centre, {opacity: mark}]}>
        <Image
          source={LOGO}
          style={styles.logo}
          // The mark must never be stretched: it is a wordmark, and a wordmark
          // that is a few percent wide is the kind of wrong that is felt without
          // being noticed.
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/*
        Outside the cross-fade, and it stays for the whole wait.

        The placeholder's pulse says "there will be something here"; only the
        spinner says "something is still happening". Losing it at the hand-over
        would take the one moving thing off the screen at exactly the point the
        wait starts to feel long. Navy, not white: on this ground a white spinner
        is an empty space where something is plainly meant to be.
      */}
      <ActivityIndicator color={COLORS.navy} style={styles.spinner} />
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
  /**
   * The mark stays centred on the whole screen, which is where it has always
   * been -- the shape arriving underneath must not move it.
   */
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Same gutter as the page cover's sheet, so the two agree. */
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  logo: {width: LOGO_SIZE, height: LOGO_SIZE},
  spinner: {position: 'absolute', bottom: 72, left: 0, right: 0},
});

export default SplashScreen;
