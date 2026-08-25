/**
 * The sticky Add to Bag / Buy Now bar on a product page.
 *
 * Takes the tab bar's own slot, exactly as SortFilterBar does on a listing --
 * outside `body`, so it takes its own space rather than floating over the
 * page and nothing in the page has to be padded out from under it, and never
 * on screen together with either BottomNav or SortFilterBar. The site's own
 * versions of these two buttons are hidden by ../webview/injectedStyles
 * ("one Add to Bag, not two"); pressing these instead drives the same real
 * controls from outside the page -- see ../webview/productActions.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  onAddToBag: () => void;
  onBuyNow: () => void;
}

const ProductActionBar = ({onAddToBag, onBuyNow}: Props) => (
  <View style={styles.root}>
    <Pressable
      onPress={onAddToBag}
      accessibilityRole="button"
      accessibilityLabel="Add to Bag"
      style={({pressed}) => [
        styles.button,
        styles.addButton,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.addLabel}>Add to Bag</Text>
    </Pressable>

    <Pressable
      onPress={onBuyNow}
      accessibilityRole="button"
      accessibilityLabel="Buy Now"
      style={({pressed}) => [
        styles.button,
        styles.buyButton,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.buyLabel}>Buy Now</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF4',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {backgroundColor: '#1B1B1B'},
  buyButton: {backgroundColor: '#FDE8E8'},
  pressed: {opacity: 0.85},
  addLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  buyLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProductActionBar;
