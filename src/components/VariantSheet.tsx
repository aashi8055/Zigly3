/**
 * The size picker: which variant of a saved product to put in the bag.
 *
 * WHY THIS EXISTS. Two thirds of Zigly's catalogue is one-variant products,
 * and Add to Bag on those has always added straight from the wishlist. The
 * other third has genuine choices -- M or L, 1 kg or 3 kg -- and for those the
 * wishlist used to open the product page instead, because of a rule this app
 * keeps and is not relaxing here: it never picks a size on the customer's
 * behalf. Adding a 3 kg bag to someone who wanted 1 kg is worse than an extra
 * tap (../native/products spells that argument out).
 *
 * But "open the product page" answers a question the customer did not ask.
 * They tapped Add to Bag; they got a product page, which reads as the button
 * having failed. So the rule stays and the asking moves: this sheet lists the
 * product's own variants and adds the one chosen, without leaving the
 * wishlist. Every tap on Add to Bag now adds something, and it is never a size
 * the app guessed.
 *
 * Modelled on ./SortSheet deliberately -- same Modal, same rise from the foot
 * of the screen, same dimmed backdrop, same head with a close control, same
 * row metrics. A second sheet idiom in one app would be a divergence with
 * nothing behind it, and the customer already knows how this one works.
 *
 * Every figure here is Shopify's, read by ../webview/wishlistBridge from
 * `/products/{handle}.js`: the variant's own label and its own price. Nothing
 * is composed or inferred -- a variant priced differently from the product
 * shows its own price, which is what the product page would show.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {money} from '../utils/money';
import {CloseIcon} from './glyphs';
import type {WishlistVariant} from '../wishlist/wishlistItems';

interface Props {
  /**
   * The product being picked for, or null when the sheet is closed.
   *
   * One nullable object rather than a `visible` flag beside the data, so the
   * two can never disagree -- an open sheet always has a product, and a closed
   * one is never holding a stale title while it animates away.
   */
  product: {
    title: string;
    variants: readonly WishlistVariant[];
  } | null;
  /** Adds the chosen variant. The sheet is expected to close. */
  onSelect: (variantId: number) => void;
  /**
   * Opens the product's own page.
   *
   * The way out for the case this sheet cannot answer completely: the bridge
   * caps how many variants it carries (WISHLIST_VARIANT_LIMIT), so a product
   * with more choices than that is shown the ones it has plus this. The
   * product page is the complete list by definition.
   */
  onSeeAll: () => void;
  onClose: () => void;
  /**
   * True when the bridge capped this product's variant list.
   *
   * Drives the "See all options" row. Passed in rather than compared here:
   * the cap belongs to the bridge, and a component that re-derived it could
   * disagree with the module that applied it.
   */
  capped?: boolean;
}

const VariantSheet = ({
  product,
  onSelect,
  onSeeAll,
  onClose,
  capped = false,
}: Props) => {
  /*
   * A Modal is its own window, outside the inset padding the app applies at
   * its root -- so the sheet has to pad itself off the gesture pill. Only the
   * bottom matters: it rises from the foot of the screen. Same as ./SortSheet.
   */
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={product !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
        />

        <View style={[styles.sheet, {paddingBottom: insets.bottom + 10}]}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.title}>Select an option</Text>
              {/*
                The product's own name under the heading, so a customer who
                tapped one tile in a grid of them is in no doubt which product
                this sheet is about. One line: the heading is the instruction,
                this is the context.
              */}
              {product !== null ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {product.title}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <CloseIcon size={19} color="#1B1B1B" />
            </Pressable>
          </View>

          <ScrollView bounces={false} contentContainerStyle={styles.list}>
            {(product?.variants ?? []).map(variant => (
              <Pressable
                key={variant.id}
                onPress={() => {
                  onSelect(variant.id);
                  onClose();
                }}
                /*
                 * A sold-out size is shown and not tappable, rather than
                 * hidden. A customer who saved this product for the 5 kg bag
                 * needs to know the 5 kg is gone -- a list that silently
                 * omitted it would read as the product having changed.
                 */
                disabled={!variant.available}
                accessibilityRole="button"
                accessibilityState={{disabled: !variant.available}}
                accessibilityLabel={
                  variant.available
                    ? `${variant.title}, ${money(variant.price)}`
                    : `${variant.title}, sold out`
                }
                style={({pressed}) => [
                  styles.row,
                  pressed && variant.available && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.rowLabel,
                    !variant.available && styles.rowLabelOff,
                  ]}>
                  {variant.title}
                </Text>
                {variant.available ? (
                  <Text style={styles.rowPrice}>{money(variant.price)}</Text>
                ) : (
                  <Text style={styles.soldOut}>Sold out</Text>
                )}
              </Pressable>
            ))}

            {/*
              Only when the list was capped. Without the cap this row would
              offer the product page as an alternative to a list that is
              already complete, which is an invitation to leave for no reason.
            */}
            {capped ? (
              <Pressable
                onPress={() => {
                  onSeeAll();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel="See all options on the product page"
                style={({pressed}) => [
                  styles.row,
                  styles.seeAllRow,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.seeAll}>See all options</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)'},
  sheet: {
    backgroundColor: COLORS.white,
    maxHeight: '62%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  /** Takes the width so a long product name truncates instead of the icon. */
  headText: {flex: 1, minWidth: 0, paddingRight: 12},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    fontWeight: '600',
    color: '#1B1B1B',
  },
  subtitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
  },
  list: {paddingBottom: 6},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 58,
  },
  pressed: {backgroundColor: '#F7F8FA'},
  rowLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    color: '#1B1B1B',
    flexShrink: 1,
  },
  /** A size that cannot be bought is greyed, not hidden -- see above. */
  rowLabelOff: {color: '#9AA1AC'},
  rowPrice: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1B',
    paddingLeft: 12,
  },
  soldOut: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    color: '#9AA1AC',
    paddingLeft: 12,
  },
  seeAllRow: {borderTopWidth: 1, borderTopColor: '#ECEEF2'},
  seeAll: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.red,
  },
});

export default VariantSheet;
