/**
 * Text rendition of the Zigly lockup: navy "zigly" + red "Pet Care" pill.
 *
 * Deliberately not an image. We have no licensed logo asset in the repo, and
 * shipping a scraped PNG would be worse than an honest approximation. Swap in
 * the real asset once Zigly provides one.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  onDark?: boolean;
}

const ZiglyWordmark = ({onDark = false}: Props) => (
  <View style={styles.row}>
    <Text style={[styles.word, onDark && styles.wordOnDark]}>zigly</Text>
    <View style={styles.pill}>
      <Text style={styles.pillText}>Pet Care</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  word: {
    fontFamily: FONT_FAMILY,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: COLORS.navy,
  },
  wordOnDark: {color: COLORS.white},
  pill: {
    backgroundColor: COLORS.red,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default ZiglyWordmark;
