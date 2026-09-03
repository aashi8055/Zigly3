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
 * Nothing on this screen ever shows a figure Shopify has not confirmed, and
 * that is why a quantity does not move the instant it is tapped. A change is
 * two round trips - /cart/change.js, then /cart.js - and until the second one
 * answers, the only quantity this screen knows is the one it is already showing.
 * So the controls go inert and say so, rather than drawing a number and hoping.
 *
 * What that replaced was worse than slow. The controls stayed live, and a second
 * tap computed its new quantity from the SAME quantity as the first - qty 3,
 * tap minus twice, and both requests asked Shopify for 2. The second was a
 * no-op, the number stopped where the first tap left it, and it read as stuck.
 * Going inert is what makes that impossible rather than unlikely.
 *
 * Layout is the reference's: one full-bleed white block per line, separated by
 * the grey ground showing through, then the order summary, then two pinned
 * footers — the savings line and the checkout bar. Only the list scrolls, so the
 * total and the button never leave the screen. The merchandising
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
  Animated,
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
import {Block, usePulse} from './Skeleton';

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
  /**
   * Checkout has been asked for and Shiprocket has not painted yet.
   *
   * This screen deliberately stays up for that second rather than coming off
   * on the tap. The cart is an overlay over a live WebView, so uncovering it
   * early shows the customer the dashboard underneath until Shiprocket's own
   * screen arrives -- a page they did not ask for, flashing between the two
   * they did. Held here, the only thing that changes is this bar.
   */
  checkoutPending?: boolean;
  onOpenItem: (url: string) => void;
  /** Leaves the empty cart for the dashboard. */
  onContinueShopping: () => void;
}

/** One cart line's shape: the thumbnail, the title, then the price. */
const CartLineSkeleton = ({pulse}: {pulse: Animated.Value}) => (
  <View style={styles.card}>
    <View style={styles.cardBody}>
      <Block pulse={pulse} style={styles.skThumb} />
      <View style={styles.details}>
        <Block pulse={pulse} style={styles.skTitle} />
        <Block pulse={pulse} style={styles.skTitleShort} />
        <Block pulse={pulse} style={styles.skPrice} />
      </View>
    </View>
  </View>
);

/**
 * Shown while the cart's own read is still out -- Shopify's /cart.js has not
 * answered yet, so there is nothing here to draw but the shape of the lines
 * and the summary that are about to arrive.
 */
const CartSkeleton = () => {
  const pulse = usePulse(true);
  return (
    <View style={styles.root}>
      <View style={styles.scroll}>
        <CartLineSkeleton pulse={pulse} />
        <CartLineSkeleton pulse={pulse} />
      </View>
    </View>
  );
};

const CartScreen = ({
  cart,
  onChangeQty,
  onCheckout,
  checkoutPending = false,
  onOpenItem,
  onContinueShopping,
}: Props) => {
  /** The line whose change is in flight, or null when nothing is. */
  const [changing, setChanging] = React.useState<string | null>(null);
  const busy = changing !== null;

  /*
   * Any answer at all clears it. `cart` is replaced wholesale on every reply
   * from /cart.js -- including the re-read changeQtyScript does when the change
   * itself failed -- so this is one release for both outcomes, and the screen
   * cannot be waiting for something that has already come back.
   */
  React.useEffect(() => {
    setChanging(null);
  }, [cart]);

  /*
   * And released anyway if no answer arrives. The reply is a WebView injection
   * away, so it can be lost in ways this screen cannot see; inert controls that
   * never come back would be a worse failure than the one being fixed.
   */
  React.useEffect(() => {
    if (!busy) {
      return;
    }
    const failsafe = setTimeout(() => setChanging(null), 10000);
    return () => clearTimeout(failsafe);
  }, [busy]);

  /** One change at a time, and each one computed from a confirmed quantity. */
  const change = (key: string, quantity: number) => {
    if (busy) {
      return;
    }
    setChanging(key);
    onChangeQty(key, quantity);
  };

  if (!cart) {
    return <CartSkeleton />;
  }

  if (cart.itemCount === 0) {
    // The reference's own empty cart: a smiling bag, a headline, one line of
    // body copy and a way back to shopping. (Its bare "No items" box belongs to
    // list screens like the wishlist -- EmptyState still draws that one too.)
    return (
      <View style={styles.root}>
        <EmptyState
          glyph="bag"
          title="Your Cart is Empty"
          body="Start shopping today and fill your cart with your favorite products."
          actionLabel="Continue Shopping"
          onAction={onContinueShopping}
        />
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

                  <View style={styles.stepperRow}>
                    <View style={[styles.stepper, busy && styles.inert]}>
                      <Pressable
                        onPress={() => change(line.key, line.quantity - 1)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Decrease quantity"
                        accessibilityState={{disabled: busy}}
                        hitSlop={8}
                        style={styles.stepBtn}>
                        <Text style={styles.stepGlyph}>{'−'}</Text>
                      </Pressable>
                      <Text style={styles.qty}>{line.quantity}</Text>
                      <Pressable
                        onPress={() => change(line.key, line.quantity + 1)}
                        disabled={busy}
                        accessibilityRole="button"
                        accessibilityLabel="Increase quantity"
                        accessibilityState={{disabled: busy}}
                        hitSlop={8}
                        style={styles.stepBtn}>
                        <Text style={styles.stepGlyph}>+</Text>
                      </Pressable>
                    </View>
                    {/*
                      On the line being changed only, so it says which quantity
                      Shopify is working on rather than that the screen is busy.
                    */}
                    {changing === line.key ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.navy}
                        style={styles.working}
                      />
                    ) : null}
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => change(line.key, 0)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={'Remove ' + line.title}
                accessibilityState={{disabled: busy}}
                hitSlop={10}
                style={[styles.remove, busy && styles.inert]}>
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

      </ScrollView>

      {/*
        Pinned, not scrolled. The reference keeps this line sitting above the
        checkout bar while the items move behind it, so the saving stays on
        screen at the moment the customer is deciding -- which is the only
        moment it is worth anything.
      */}
      {cart.totalDiscount > 0 ? (
        <View style={styles.savedBanner}>
          <Text style={styles.savedBannerText}>
            You saved {money(cart.totalDiscount)} on this order.
          </Text>
        </View>
      ) : null}

      <View style={styles.bar}>
        <View>
          <Text style={styles.barCount}>
            {cart.itemCount} {cart.itemCount === 1 ? 'Item' : 'Items'}
          </Text>
          <Text style={styles.barTotal}>{money(cart.totalPrice)}</Text>
        </View>
        <Pressable
          onPress={onCheckout}
          /*
           * Not tappable twice. Shiprocket's flow takes about a second to
           * appear, and a second tap in that window starts it again -- which
           * is how a customer ends up with two checkout sessions over one
           * cart.
           */
          disabled={checkoutPending}
          accessibilityRole="button"
          accessibilityState={{disabled: checkoutPending, busy: checkoutPending}}
          accessibilityLabel={`Checkout, ${cart.itemCount} items, ${money(
            cart.totalPrice,
          )}`}
          style={({pressed}) => [
            styles.checkout,
            pressed && styles.pressed,
            checkoutPending && styles.checkoutPending,
          ]}>
          {checkoutPending ? (
            /*
              The bar is the only thing that moves while the flow opens. A
              spinner here rather than a cover over the whole screen: the cart
              behind it is still true, still theirs, and blanking it would put
              back the missing second this is here to fill.
            */
            <ActivityIndicator size="small" color={COLORS.red} />
          ) : (
            <Text style={styles.checkoutText}>Checkout</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

/**
 * The ground the white line cards sit on.
 *
 * `surface`, not `ground`: the app's ground is white now, and full-bleed white
 * cards separated by nothing but the gap between them would have no edge at
 * all -- the list would read as one sheet. This is the same job the old warm
 * ground did here, in a neutral grey.
 */
const GROUND = COLORS.surface;
const HAIRLINE = '#ECEEF2';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: GROUND},
  /** No bottom padding: the pinned footers below are not scrolled past. */
  scroll: {paddingTop: 8},

  /**
   * Full-bleed rather than an inset card: the reference runs each line edge to
   * edge and lets the grey ground show through between them, so the separator
   * is the gap itself and there is no border to draw.
   */
  card: {
    position: 'relative',
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  cardBody: {flexDirection: 'row', gap: 12},
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
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

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DADADA',
    borderRadius: 6,
  },
  /** Waiting on Shopify: visibly not a control right now. */
  inert: {opacity: 0.4},
  working: {marginLeft: 10},
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

  summaryCard: {paddingBottom: 10, backgroundColor: COLORS.white},
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

  /** Pinned above the bar, so it stays put while the items scroll behind. */
  savedBanner: {
    backgroundColor: '#EEF0F4',
    paddingVertical: 15,
    alignItems: 'center',
  },
  savedBannerText: {fontFamily: FONT_FAMILY, fontSize: 15, color: '#1B1B1B'},

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  /*
   * Held, not greyed out. The button keeps its ground and its height -- the
   * spinner swaps in for the word at the same size -- so the bar does not
   * change shape at the moment the customer is waiting on it.
   */
  checkoutPending: {opacity: 0.9},
  checkoutText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.red,
    fontSize: 16.5,
    fontWeight: '700',
  },

  skThumb: {width: 84, height: 84, borderRadius: 8},
  skTitle: {height: 15, width: '90%', borderRadius: 4, marginTop: 2},
  skTitleShort: {height: 15, width: '55%', borderRadius: 4, marginTop: 6},
  skPrice: {height: 15, width: '30%', borderRadius: 4, marginTop: 12},
});

export default CartScreen;
