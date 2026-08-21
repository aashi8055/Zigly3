/**
 * Native cart, matching the reference app.
 *
 * Holds no cart state of its own: every figure comes from Shopify's /cart.js
 * and every change goes through /cart/change.js, both executed inside the
 * WebView so they use the site's own session. Shopify does the arithmetic;
 * this only draws it.
 *
 * On the data layer, deliberately: the reference app drives the Storefront Cart
 * API (cartCreate / cartLinesAdd / …) against a cart id it persists itself.
 * This app must not. Its cart has to be the *same* cart the WebView has — the
 * site's own PDP button adds to it, the site's badge counts it, and the site's
 * checkout consumes it. A Storefront cart id would be a second, parallel cart:
 * add something from a product page and this screen would show it empty. The
 * AJAX endpoints below are that one shared cart, keyed by the session cookie
 * both WebViews share.
 *
 * Layout is the reference's: one rectangular card per line on a light ground, a
 * summary card, and a sticky bar carrying the live item count. The merchandising
 * blocks the reference also has — free-shipping progress, free-gift tiers, the
 * upsell rail, the membership card — are absent on purpose: their thresholds and
 * product selections live in server config this app cannot read, and a cart
 * screen is the one place where an invented number becomes a wrong promise.
 * Coupons are absent because the reference turns them off in-app too
 * (show_apply_coupon: "0") — codes are entered in Shopify's checkout, which is
 * where this screen hands off.
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {money, percentOff} from '../utils/money';
import EmptyState from './EmptyState';

export interface CartLine {
  key: string;
  title: string;
  variant: string;
  quantity: number;
  image: string | null;
  url: string;
  price: number;
  originalPrice: number;
  linePrice: number;
  originalLinePrice: number;
}

export interface CartData {
  itemCount: number;
  totalPrice: number;
  originalTotalPrice: number;
  totalDiscount: number;
  items: CartLine[];
}

interface Props {
  cart: CartData | null;
  onChangeQty: (key: string, quantity: number) => void;
  onCheckout: () => void;
  onOpenItem: (url: string) => void;
}

const CartScreen = ({cart, onChangeQty, onCheckout, onOpenItem}: Props) => {
  if (!cart) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (cart.itemCount === 0) {
    // The reference routes to a separate empty screen with no call to action;
    // the header's back arrow is the way out.
    return (
      <View style={styles.root}>
        <EmptyState label="No items" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cart.items.map(line => {
          const off = percentOff(line.originalPrice, line.price);
          const saved = line.originalLinePrice - line.linePrice;
          return (
            <View key={line.key} style={styles.card}>
              <View style={styles.cardBody}>
                <Pressable onPress={() => onOpenItem(line.url)}>
                  {line.image ? (
                    <Image source={{uri: line.image}} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumb} />
                  )}
                </Pressable>

                <View style={styles.details}>
                  <Pressable onPress={() => onOpenItem(line.url)}>
                    <Text style={styles.title} numberOfLines={2}>
                      {line.title}
                    </Text>
                  </Pressable>

                  {line.variant ? (
                    <View style={styles.variantChip}>
                      <Text style={styles.variantText}>{line.variant}</Text>
                    </View>
                  ) : null}

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{money(line.price)}</Text>
                    {off > 0 ? (
                      <Text style={styles.was}>{money(line.originalPrice)}</Text>
                    ) : null}
                    {off > 0 ? (
                      <Text style={styles.off}>{off}% off</Text>
                    ) : null}
                  </View>

                  {saved > 0 ? (
                    <Text style={styles.saved}>You saved {money(saved)}</Text>
                  ) : null}

                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => onChangeQty(line.key, line.quantity - 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease quantity"
                      hitSlop={8}
                      style={styles.stepBtn}>
                      <Text style={styles.stepGlyph}>{'−'}</Text>
                    </Pressable>
                    <Text style={styles.qty}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => onChangeQty(line.key, line.quantity + 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase quantity"
                      hitSlop={8}
                      style={styles.stepBtn}>
                      <Text style={styles.stepGlyph}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => onChangeQty(line.key, 0)}
                accessibilityRole="button"
                accessibilityLabel={'Remove ' + line.title}
                hitSlop={10}
                style={styles.remove}>
                <Text style={styles.removeGlyph}>{'×'}</Text>
              </Pressable>
            </View>
          );
        })}

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cart Total</Text>
            <Text style={styles.summaryValue}>
              {money(cart.originalTotalPrice || cart.totalPrice)}
            </Text>
          </View>
          {cart.totalDiscount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.savingsLabel}>Savings</Text>
              <Text style={styles.savingsValue}>
                {'- ' + money(cart.totalDiscount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>{money(cart.totalPrice)}</Text>
          </View>
          {/*
            No shipping line, as the reference also defers it
            (cartProps.showShippingText: false). Shipping is quoted by Shopify's
            checkout once it knows the address; a figure invented here would be
            one the customer is not going to be charged.
          */}
        </View>

        {cart.totalDiscount > 0 ? (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>
              You saved {money(cart.totalDiscount)} on this order.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bar}>
        <View>
          <Text style={styles.barCount}>
            {cart.itemCount} {cart.itemCount === 1 ? 'Item' : 'Items'}
          </Text>
          <Text style={styles.barTotal}>{money(cart.totalPrice)}</Text>
        </View>
        <Pressable
          onPress={onCheckout}
          accessibilityRole="button"
          accessibilityLabel={`Checkout, ${cart.itemCount} items, ${money(
            cart.totalPrice,
          )}`}
          style={({pressed}) => [styles.checkout, pressed && styles.pressed]}>
          <Text style={styles.checkoutText}>Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
};

/** Light ground, so the white line cards read as cards. */
const GROUND = '#F5F6F8';
const HAIRLINE = '#ECEEF2';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: GROUND},
  centre: {
    flex: 1,
    backgroundColor: GROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  scroll: {paddingTop: 10, paddingBottom: 24},

  card: {
    position: 'relative',
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  cardBody: {flexDirection: 'row', gap: 12},
  thumb: {width: 84, height: 84, borderRadius: 8, backgroundColor: '#F5F5F5'},
  /** Right padding keeps the title clear of the remove control above it. */
  details: {flex: 1, paddingRight: 22},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    color: '#1B1B1B',
    lineHeight: 20,
    fontWeight: '500',
  },
  variantChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F1F1',
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 8,
  },
  variantText: {fontFamily: FONT_FAMILY, fontSize: 13, color: '#3A3A3A'},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8},
  price: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  was: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    color: '#9A9A9A',
    textDecorationLine: 'line-through',
  },
  off: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    color: COLORS.red,
    fontWeight: '600',
  },
  saved: {
    fontFamily: FONT_FAMILY,
    marginTop: 5,
    fontSize: 13.5,
    color: '#1B9C5D',
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: 6,
  },
  stepBtn: {paddingHorizontal: 14, paddingVertical: 6},
  stepGlyph: {fontFamily: FONT_FAMILY, fontSize: 17, color: '#1B1B1B'},
  qty: {
    fontFamily: FONT_FAMILY,
    minWidth: 26,
    textAlign: 'center',
    fontSize: 15,
    color: '#1B1B1B',
  },

  /** Over the card's own corner, so it never pushes the title around. */
  remove: {position: 'absolute', top: 6, right: 8, paddingHorizontal: 6},
  removeGlyph: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    color: '#9A9A9A',
    lineHeight: 24,
  },

  summaryCard: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingBottom: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1B1B',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  summaryLabel: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B1B1B'},
  summaryValue: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B1B1B'},
  savingsLabel: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B9C5D'},
  savingsValue: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B9C5D'},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    marginTop: 6,
  },
  totalLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 16.5,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  totalValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 16.5,
    fontWeight: '700',
    color: '#1B1B1B',
  },

  savedBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#EEF3FA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  savedBannerText: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B1B1B'},

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: COLORS.white,
  },
  barCount: {fontFamily: FONT_FAMILY, fontSize: 13.5, color: '#5A5A5A'},
  barTotal: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  checkout: {
    flex: 1,
    marginLeft: 20,
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  pressed: {opacity: 0.85},
  checkoutText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.red,
    fontSize: 16.5,
    fontWeight: '700',
  },
});

export default CartScreen;
