/**
 * Thin progress bar for navigations after the first paint.
 *
 * A full-screen spinner on every tap would feel heavier than the site does on
 * its own, so subsequent loads only get a top progress hairline.
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {COLORS} from '../constants/appConstants';

const LoadingOverlay = () => (
  <View pointerEvents="none" style={styles.root}>
    <ActivityIndicator size="small" color={COLORS.navy} />
  </View>
);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
});

export default LoadingOverlay;
