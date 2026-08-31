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
import {BUTTON_FILL, COLORS, FONT_FAMILY} from '../constants/appConstants';

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
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF4',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * One button colour for both, and for every Add to Bag in the app.
   *
   * Add to Bag was #1B1B1B with white text, which made the two buttons in this
   * bar read as a primary and a secondary -- and it also disagreed with the Add
   * to Bag on every product card, which is the site's own button and is styled
   * by ../webview/injectedStyles. Three different add buttons in one session is
   * what this unifies: the pale fill with red text is now the app's add-to-cart
   * look wherever one appears, native or in the page.
   *
   * `addButton` and `buyButton` stay as separate keys, both pointing at the
   * same token, rather than collapsing into one style. They are two controls
   * with two jobs, and a later decision to distinguish them again should be an
   * edit to one line here -- not an unpicking of a shared style.
   */
  addButton: {backgroundColor: BUTTON_FILL},
  buyButton: {backgroundColor: BUTTON_FILL},
  pressed: {opacity: 0.85},
  addLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.red,
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
