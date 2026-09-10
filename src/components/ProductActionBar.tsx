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
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BUTTON_FILL, COLORS, FONT_FAMILY} from '../constants/appConstants';

interface Props {
  onAddToBag: () => void;
  onBuyNow: () => void;
  /**
   * Add to Bag has been pressed and neither Shopify nor the site's own button
   * has answered yet.
   *
   * The write is not instant and it is not local: ../webview/productActions
   * clicks the theme's real button and then re-reads /cart.js to confirm the
   * line landed, retrying for up to ADD_VERIFY_BUDGET_MS on a slow connection.
   * Until this file existed the only thing that changed in that window was
   * the press opacity, which is gone the moment the finger lifts -- so a tap
   * on a slow network looked like a tap that had done nothing, and the
   * customer pressed again. A second press is a second line in the bag.
   *
   * Same decision the cart bar already made for Checkout (see
   * ./CartScreen's `checkoutPending`): the button that was pressed is the one
   * thing that moves, the page behind it is untouched, and it is not tappable
   * twice while it spins.
   */
  addBusy?: boolean;
  /**
   * Buy Now has been pressed and Shiprocket has not painted yet.
   *
   * Separate from `addBusy` rather than one shared flag, because the two
   * buttons are two different actions and spinning both would claim the app
   * is doing something it is not. Buy Now's own wait is Shiprocket's:
   * a signed, cart-scoped session that takes about a second to arrive.
   */
  buyBusy?: boolean;
}

const ProductActionBar = ({
  onAddToBag,
  onBuyNow,
  addBusy = false,
  buyBusy = false,
}: Props) => (
  <View style={styles.root}>
    <Pressable
      onPress={onAddToBag}
      /*
       * Not tappable while it is working, and not tappable while the other
       * one is. Two reasons, and they are different:
       *
       *   - its own: /cart/add.js is not idempotent, so a second press in the
       *     verify window is a second line in the bag rather than a repeat of
       *     the first.
       *   - the other's: Buy Now hands the screen to Shiprocket. An add
       *     started in the second before that arrives lands in a cart the
       *     customer has already left behind.
       */
      disabled={addBusy || buyBusy}
      accessibilityRole="button"
      accessibilityState={{disabled: addBusy || buyBusy, busy: addBusy}}
      accessibilityLabel="Add to Bag"
      style={({pressed}) => [
        styles.button,
        styles.addButton,
        pressed && styles.pressed,
        (addBusy || buyBusy) && styles.busy,
      ]}>
      {addBusy ? (
        /*
         * Inside the button, at the label's own size, so the bar does not
         * change height and nothing below it moves. `styles.button` already
         * centres its child and carries the minHeight, so the spinner sits
         * exactly where the word did.
         *
         * White on the red fill, matching addLabel -- COLORS.red on red would
         * be an invisible spinner, which is the same bug as no spinner.
         */
        <ActivityIndicator size="small" color={COLORS.white} />
      ) : (
        <Text style={styles.addLabel}>Add to Bag</Text>
      )}
    </Pressable>

    <Pressable
      onPress={onBuyNow}
      disabled={addBusy || buyBusy}
      accessibilityRole="button"
      accessibilityState={{disabled: addBusy || buyBusy, busy: buyBusy}}
      accessibilityLabel="Buy Now"
      style={({pressed}) => [
        styles.button,
        styles.buyButton,
        pressed && styles.pressed,
        (addBusy || buyBusy) && styles.busy,
      ]}>
      {buyBusy ? (
        // Red on the pale fill, matching buyLabel, for the reason above.
        <ActivityIndicator size="small" color={COLORS.red} />
      ) : (
        <Text style={styles.buyLabel}>Buy Now</Text>
      )}
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
   * THIS Add to Bag is red. Every other one in the app is not.
   *
   * The two buttons in this bar were both BUTTON_FILL -- the pale fill with red
   * text -- so that the native bar agreed with the site's own Add to Bag on
   * every product card, which ../webview/injectedStyles paints the same way.
   * The redesigned product page changes that on purpose: this is the page's one
   * primary action, sitting under a photo and a price, and read against a
   * screenful of white it has to be the loudest thing on it. A card's Add to
   * Bag is one of eight on a rail and must stay quiet.
   *
   * So the unified colour now covers the cards and Buy Now, and the sticky Add
   * to Bag is the deliberate exception: solid COLORS.red, white label. Buy Now
   * keeps BUTTON_FILL, which is what makes the pair read as primary and
   * secondary rather than as two equal buttons.
   *
   * ../../__tests__/buttonColour.test.ts holds both halves of this: the cards
   * still agree with BUTTON_FILL, and this button is checked as the exception
   * rather than being allowed to drift into one by accident.
   */
  addButton: {backgroundColor: COLORS.red},
  buyButton: {backgroundColor: BUTTON_FILL},
  pressed: {opacity: 0.85},
  /**
   * The disabled look, on both buttons.
   *
   * Deliberately lighter than `pressed` and not a grey: the button is still
   * the primary action on the page and it is about to succeed. Greying it out
   * would read as "unavailable", which is the wrong thing to say about an add
   * that is in flight. Only the opacity moves -- no colour, no size, nothing
   * that could shift the bar's layout mid-spin.
   */
  busy: {opacity: 0.7},
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
