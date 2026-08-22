/**
 * Shown when the device is offline or the page failed to load.
 *
 * Retry re-runs the last navigation rather than resetting to the home page,
 * so a dropped connection on a product page does not cost the user their place.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import ZiglyWordmark from './ZiglyWordmark';

interface Props {
  onRetry: () => void;
  /** Present when the failure was an HTTP/network error rather than airplane mode. */
  detail?: string | null;
}

const NetworkErrorScreen = ({onRetry, detail}: Props) => (
  <View style={styles.root}>
    <View style={styles.mark}>
      <ZiglyWordmark />
    </View>

    <Text style={styles.title}>No internet connection</Text>
    <Text style={styles.body}>
      Please check your internet connection and try again.
    </Text>
    {detail ? <Text style={styles.detail}>{detail}</Text> : null}

    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry loading Zigly"
      style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.buttonText}>Retry</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.ground,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mark: {marginBottom: 40, opacity: 0.9},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.inkMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  detail: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: COLORS.inkMuted,
    marginTop: 12,
    textAlign: 'center',
    opacity: 0.8,
  },
  button: {
    marginTop: 28,
    backgroundColor: COLORS.red,
    paddingHorizontal: 44,
    paddingVertical: 13,
    borderRadius: 6,
  },
  buttonPressed: {opacity: 0.85},
  buttonText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default NetworkErrorScreen;
