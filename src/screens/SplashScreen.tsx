/**
 * Native splash shown over the WebView until the first page has painted.
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
 */
import React from 'react';
import {ActivityIndicator, Image, StyleSheet, View} from 'react-native';
import {COLORS} from '../constants/appConstants';

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

const SplashScreen = () => (
  <View
    style={styles.root}
    accessibilityRole="progressbar"
    accessibilityLabel="Loading Zigly">
    <Image
      source={LOGO}
      style={styles.logo}
      // The mark must never be stretched: it is a wordmark, and a wordmark that
      // is a few percent wide is the kind of wrong that is felt without being
      // noticed.
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
    <ActivityIndicator color={COLORS.navy} style={styles.spinner} />
  </View>
);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {width: LOGO_SIZE, height: LOGO_SIZE},
  // Navy, not white: on this ground a white spinner is an empty space where
  // something is plainly meant to be.
  spinner: {position: 'absolute', bottom: 72},
});

export default SplashScreen;
