/**
 * Native splash shown over the WebView until the first page has painted.
 *
 * The home page is ~2.1 MB, so without this the user would watch a white
 * rectangle fill in. It sits above the WebView rather than replacing it, so
 * the page keeps loading behind the splash.
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import ZiglyWordmark from '../components/ZiglyWordmark';

const SplashScreen = () => (
  <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Loading Zigly">
    <View style={styles.center}>
      <ZiglyWordmark onDark />
      <Text style={styles.tagline}>Everything your pet needs</Text>
    </View>
    <ActivityIndicator color={COLORS.white} style={styles.spinner} />
  </View>
);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {alignItems: 'center', gap: 14},
  tagline: {
    fontFamily: FONT_FAMILY,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  spinner: {position: 'absolute', bottom: 72},
});

export default SplashScreen;
