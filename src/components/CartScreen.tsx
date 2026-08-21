/**
 * Native cart, matching the reference app.
 *
 * Holds no cart state of its own: every figure comes from Shopify's /cart.js
 * and every change goes through /cart/change.js, both executed inside the
 * WebView so they use the site's own session. Shopify does the arithmetic;
 * this only draws it.
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
import {COLORS} from '../constants/appConstants';

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

/** Shopify reports money in minor units; trim a trailing .00 as the site does. */
const money = (minor: number): string => {
  const value = minor / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return '₹' + text;
};

const percentOff = (original: number, current: number): number =>
  original > current && original > 0
    ? Math.round(((original - current) / original) * 100)
    : 0;

const CartScreen = ({cart, onChangeQty, onCheckout, onOpenItem}: Props) => {
  if (!cart) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (cart.itemCount === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.emptyTitle}>Your bag is empty</Text>
        <Text style={styles.emptyBody}>
          Browse the store and add something for your pet.
        </Text>
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
            <View key={line.key} style={styles.row}>
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
                  {off > 0 ? <Text style={styles.off}>{off}% off</Text> : null}
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
          style={({pressed}) => [styles.checkout, pressed && styles.pressed]}>
          <Text style={styles.checkoutText}>Checkout</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  centre: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: COLORS.navy},
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.inkMuted,
    textAlign: 'center',
  },
  scroll: {paddingBottom: 24},

  row: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    gap: 12,
  },
  thumb: {width: 84, height: 84, borderRadius: 8, backgroundColor: '#F5F5F5'},
  details: {flex: 1},
  title: {fontSize: 15, color: '#1B1B1B', lineHeight: 20, fontWeight: '500'},
  variantChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F1F1',
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 8,
  },
  variantText: {fontSize: 13, color: '#3A3A3A'},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8},
  price: {fontSize: 15, fontWeight: '700', color: '#1B1B1B'},
  was: {fontSize: 13.5, color: '#9A9A9A', textDecorationLine: 'line-through'},
  off: {fontSize: 13.5, color: COLORS.red, fontWeight: '600'},
  saved: {marginTop: 5, fontSize: 13.5, color: '#1B9C5D'},

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
  stepGlyph: {fontSize: 17, color: '#1B1B1B'},
  qty: {minWidth: 26, textAlign: 'center', fontSize: 15, color: '#1B1B1B'},

  remove: {paddingHorizontal: 4, paddingTop: 2},
  removeGlyph: {fontSize: 22, color: '#1B1B1B', lineHeight: 24},

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1B',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  summaryLabel: {fontSize: 15, color: '#1B1B1B'},
  summaryValue: {fontSize: 15, color: '#1B1B1B'},
  savingsLabel: {fontSize: 15, color: '#1B9C5D'},
  savingsValue: {fontSize: 15, color: '#1B9C5D'},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    marginTop: 6,
  },
  totalLabel: {fontSize: 16.5, fontWeight: '700', color: '#1B1B1B'},
  totalValue: {fontSize: 16.5, fontWeight: '700', color: '#1B1B1B'},

  savedBanner: {
    margin: 16,
    backgroundColor: '#F2F4F8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  savedBannerText: {fontSize: 15, color: '#1B1B1B'},

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    backgroundColor: COLORS.white,
  },
  barCount: {fontSize: 13.5, color: '#5A5A5A'},
  barTotal: {fontSize: 19, fontWeight: '700', color: '#1B1B1B'},
  checkout: {
    flex: 1,
    marginLeft: 20,
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  pressed: {opacity: 0.85},
  checkoutText: {color: COLORS.red, fontSize: 16.5, fontWeight: '700'},
});

export default CartScreen;
