/**
 * ONE product card in the listing grid.
 *
 * WHY THIS IS NOT ./ProductCard. That card is the rail card, and it is
 * deliberately trimmed: no border, no badge, no rating, because eight of them
 * side by side on a white dashboard should read as eight products rather than
 * eight boxes. The grid card is the opposite situation -- two per row, filling
 * the screen, and the reference screenshot shows all three of the things the
 * rail card drops:
 *
 *   a bordered, rounded box     two columns need an edge or the grid reads as
 *                               a jumble of floating photos
 *   the coloured tag pill       top-left, over the photo
 *   the rating                  "4.72 ★" above the title, when there is one
 *
 * Everything the two cards agree on is kept identical on purpose -- the square
 * `contain` photo, the two-line title, the sale price with the struck compare-at
 * beside it, the pale `BUTTON_FILL` Add to Bag with red text, the white-disc
 * wishlist heart at the photo's top-right. Those are the app's settled
 * decisions for a product card and ../../__tests__/buttonColour.test.ts pins
 * the button's halves; a grid that restated them differently would be the same
 * drift ../webview/productCard was written to end.
 *
 * THE BADGE IS THE THEME'S OWN PILL. Its colour comes from ./listing's
 * BADGE_COLORS, which is `snippets/card-product.liquid`'s own `case` block --
 * so "Hot Buys" is the site's `#FF1694` pink and not a pink chosen here. The
 * theme draws the first tag only, and so does this.
 *
 * ADDING TO THE BAG IS STILL NOT DONE HERE, for the reason ./ProductCard states
 * at length: the app has one session and it lives in the WebView's cookie jar
 * (DATA-SOURCES.md §7), so the card reports the variant id upward and the
 * screen runs ../webview/cartBridge inside the WebView.
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BUTTON_FILL, COLORS, FONT_FAMILY} from '../constants/appConstants';
import {HeartOutline, HeartShape} from '../components/glyphs';
import {money} from '../utils/money';
import type {ListingProduct} from './listing';
import {useWishlist} from './wishlistContext';

type Props = {
  product: ListingProduct;
  /** The card's width, computed by the grid from the screen. */
  width: number;
  /** Open the product page. Given the path, not the product. */
  onOpen: (path: string) => void;
  /**
   * Add this variant to the bag. Only ever called with a non-null variant id --
   * see ./ProductCard on why a null one must open the page instead.
   */
  onAdd: (variantId: number) => void;
  /**
   * This card's add is in flight, so its button spins.
   *
   * THE SAME SPINNER ./ProductCard CARRIES, and it is here for the reason that
   * card's arrival on the dashboard was: the two cards are meant to differ only
   * in the three things the grid needs (the border, the badge, the rating), and
   * a button that acknowledged a press on a rail but not in a grid is drift of
   * exactly the kind ../webview/productCard was written to end. A customer
   * reaching the grid from the hamburger's menu got the card that did nothing
   * visible.
   *
   * Owned by ../screens/ZiglyWebViewScreen rather than by this card, for the
   * reason ./ProductRail's `addingHandle` records: the add is confirmed by a
   * message from inside a WebView, so only the screen knows when it lands.
   */
  busy?: boolean;
};

/**
 * The star beside a rating.
 *
 * A filled glyph rather than five partial stars: the site's own card prints the
 * number and one star ("4.72 ★"), which is what the reference screenshot shows,
 * and five stars at this size would be a different design decision than the
 * website's.
 */
const Star = ({size = 12}: {size?: number}) => (
  <Text style={[styles.star, {fontSize: size}]}>★</Text>
);

const ListingCard = ({product, width, onOpen, onAdd, busy = false}: Props) => {
  const {handles, toggle: onWish} = useWishlist();
  const saved = handles.has(product.handle);

  /* Same two states as the rail card, for the same reasons. */
  const canAdd = product.available && product.variantId !== null;
  const label = product.available ? 'Add to Bag' : 'Sold Out';

  return (
    <View style={[styles.card, {width}]}>
      <Pressable
        onPress={() => onOpen(product.path)}
        accessibilityRole="link"
        accessibilityLabel={product.title}
        style={styles.body}>
        {({pressed}) => (
          <>
            <View style={styles.imageBox}>
              {product.image ? (
                <Image
                  source={{uri: product.image}}
                  style={[styles.image, pressed && styles.imagePressed]}
                  // `contain`, as everywhere: these are packshots and `cover`
                  // clips a tall bag at the frame's edge.
                  resizeMode="contain"
                  accessible={false}
                />
              ) : (
                <View style={styles.noImage} />
              )}
            </View>

            {/*
              The rating, when the product has one.

              Above the title, as the site places it, and absent entirely
              otherwise -- an unrated product must not draw a "0". The row is
              not reserved when there is no rating: the grid's cards are
              measured independently, so a card without one is simply shorter
              than its neighbour, which is what the site's own grid does.
            */}
            {product.rating !== null ? (
              <View style={styles.ratingRow}>
                <Text style={styles.rating}>{product.rating.toFixed(2)}</Text>
                <Star />
              </View>
            ) : null}

            <Text numberOfLines={2} style={styles.title}>
              {product.title}
            </Text>

            {/*
              Struck original FIRST, then the sale price -- which is the order
              the reference screenshot shows on this surface ("₹99  ₹94"), and
              the reverse of the rail card's. Read off the live grid rather than
              assumed, because the two surfaces genuinely differ.
            */}
            <View style={styles.priceRow}>
              {product.compareAt !== null ? (
                <Text style={styles.compareAt}>{money(product.compareAt)}</Text>
              ) : null}
              <Text style={styles.price}>{money(product.price)}</Text>
            </View>
          </>
        )}
      </Pressable>

      {/*
        The tag pill, over the photo's top-left.

        A sibling of the card's Pressable rather than a child, like the heart --
        but for a different reason: it is not interactive at all, so it must not
        swallow a tap meant for the card. `pointerEvents="none"` says so.
      */}
      {product.badge ? (
        <View
          pointerEvents="none"
          style={[styles.badge, {backgroundColor: product.badge.color}]}>
          <Text numberOfLines={1} style={styles.badgeLabel}>
            {product.badge.label}
          </Text>
        </View>
      ) : null}

      {/* Outside the card's Pressable: nesting one Pressable in another is
          ambiguous on Android. See ./ProductCard. */}
      {onWish ? (
        <Pressable
          onPress={() => onWish(product.handle)}
          accessibilityRole="button"
          accessibilityState={{selected: saved === true}}
          accessibilityLabel={
            saved
              ? `Remove ${product.title} from wishlist`
              : `Save ${product.title} to wishlist`
          }
          hitSlop={10}
          style={({pressed}) => [styles.wish, pressed && styles.wishPressed]}>
          {saved ? (
            <HeartShape size={19} color={COLORS.red} />
          ) : (
            <HeartOutline size={19} color={COLORS.ink} />
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() =>
          canAdd && product.variantId !== null
            ? onAdd(product.variantId)
            : product.available
            ? onOpen(product.path)
            : undefined
        }
        /*
         * Not tappable while it spins, which is the point of the spinner and
         * not a side effect of it -- ./ProductCard's own note. The add is
         * verified against /cart.js over up to ADD_VERIFY_BUDGET_MS, and a
         * second press inside that window is a second line in the bag.
         */
        disabled={!product.available || busy}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${product.title}`}
        accessibilityState={{disabled: !product.available || busy, busy}}
        style={({pressed}) => [
          styles.button,
          !product.available && styles.buttonDisabled,
          busy && styles.buttonBusy,
          pressed && product.available && !busy && styles.buttonPressed,
        ]}>
        {busy ? (
          /*
           * Red on the pale fill, matching `buttonLabel` -- ./ProductCard's
           * reasoning verbatim, because it is the same button in the same two
           * colours. White would be an invisible spinner here, and an
           * invisible spinner is the same bug as no spinner.
           */
          <ActivityIndicator size="small" color={COLORS.red} />
        ) : (
          <Text
            numberOfLines={1}
            style={[
              styles.buttonLabel,
              !product.available && styles.buttonLabelDisabled,
            ]}>
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * The bordered box the rail card does not have.
   *
   * A hairline and a 10dp radius, which is the theme's own card treatment and
   * what the reference grid shows. `overflow: visible` is left alone -- the
   * badge and the heart sit inside the card's bounds, so nothing needs
   * clipping, and a clip would cut the heart's disc border.
   */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
    padding: 8,
  },
  body: {marginBottom: 8},
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  image: {width: '100%', height: '100%'},
  imagePressed: {opacity: 0.72},
  noImage: {flex: 1, backgroundColor: '#F1F3F6'},
  /**
   * The tag pill.
   *
   * Top-left at the card's own inset, so it sits over the photo's corner as the
   * site's does. Fully rounded, white bold text, tight padding -- measured from
   * the reference screenshot.
   */
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '78%',
  },
  badgeLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.white,
  },
  /** The heart's white disc, exactly as ./ProductCard places it. */
  wish: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
  },
  wishPressed: {opacity: 0.6},
  ratingRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4},
  rating: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ink,
  },
  /** Amber, which is the star's colour on the site's own card. */
  star: {color: '#FFB300'},
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    color: COLORS.ink,
    marginBottom: 6,
  },
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
  price: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  compareAt: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    color: '#8A8F98',
    textDecorationLine: 'line-through',
  },
  /**
   * The pale fill with red text: the app's one decision for a card's Add to
   * Bag, pinned by ../../__tests__/buttonColour.test.ts. The solid red button
   * belongs to the product page's sticky bar and nowhere else.
   */
  button: {
    backgroundColor: BUTTON_FILL,
    borderRadius: 8,
    /*
     * PINNED, so the swap to a spinner cannot reflow the grid -- and `height`
     * rather than the `minHeight` that was here, for the reason ./ProductCard
     * spells out at its own button: 40 was a floor the LABEL set, and an
     * ActivityIndicator is a fixed 20dp that does not follow the device's font
     * scale. At a large accessibility text size the label's line box exceeds 40
     * and the spinner does not, so a card mid-add would change height. That
     * matters more in two columns than on a rail: the grid is measured per
     * card, so one shrinking button re-lays out its whole row.
     */
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  buttonPressed: {opacity: 0.75},
  /*
   * Held near the pressed opacity for the whole wait, so the card the customer
   * touched stays the one that looks touched. Not dimmed to `buttonDisabled`'s
   * grey: that is this card's Sold Out state, and a busy button must not be
   * confused with an unavailable one. ./ProductCard's `buttonBusy` exactly.
   */
  buttonBusy: {opacity: 0.9},
  buttonDisabled: {backgroundColor: '#F2F4F7'},
  buttonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.red,
  },
  buttonLabelDisabled: {color: '#9AA0A8'},
});

export default ListingCard;
