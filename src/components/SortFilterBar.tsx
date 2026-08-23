/**
 * Sort and Filter, along the foot of a listing.
 *
 * WHAT CHANGED. This used to be the site's own two controls, moved into a bar
 * we pinned inside the page with CSS (the old ../webview/sortFilterBar.ts).
 * That kept SearchTap's listeners, which was the point -- but it also kept
 * SearchTap's UI: tapping Sort opened a panel of the site's design, and tapping
 * Filter slid a two-column accordion in from the left. It is now native, and
 * so are both panels; the site's engine is still what answers, through
 * ../webview/facetBridge.
 *
 * It takes its own space rather than floating over the page, exactly as
 * `BottomNav` does and in the same slot -- the two are never on screen
 * together. That is what keeps it out of the page's way entirely: nothing has
 * to be padded out from under it, the last row of products is reachable, and no
 * overlay inside the page can cover it.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {FilterIcon, SortIcon} from './glyphs';

interface Props {
  onSortPress: () => void;
  onFilterPress: () => void;
}

const LABEL = '#1B1B1B';

const SortFilterBar = ({onSortPress, onFilterPress}: Props) => (
  <View style={styles.root}>
    <Pressable
      onPress={onSortPress}
      accessibilityRole="button"
      accessibilityLabel="Sort"
      style={({pressed}) => [
        styles.half,
        styles.divider,
        pressed && styles.pressed,
      ]}>
      <SortIcon size={18} color={LABEL} />
      <Text style={styles.label}>Sort</Text>
    </Pressable>

    <Pressable
      onPress={onFilterPress}
      accessibilityRole="button"
      accessibilityLabel="Filter"
      style={({pressed}) => [styles.half, pressed && styles.pressed]}>
      <FilterIcon size={18} color={LABEL} />
      <Text style={styles.label}>Filter</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF4',
  },
  half: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  /** One hairline between the two, which is what makes them read as halves. */
  divider: {borderRightWidth: 1, borderRightColor: '#E8EDF4'},
  pressed: {backgroundColor: '#F2F4F8'},
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 16.5,
    color: LABEL,
  },
});

export default SortFilterBar;
