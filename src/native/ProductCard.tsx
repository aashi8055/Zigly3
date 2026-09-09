/**
 * ONE product card, natively — the component every product rail draws.
 *
 * This is the highest-leverage component in the migration. Hot Picks,
 * Bestsellers, the three offer rails, Explore and the listing grid all draw
 * this card, which is why ../webview/productCard exists on the web side: the
 * card's trim was hand-written three times over in ../webview/injectedStyles,
 * once per surface, and the copies drifted until the same product wore a
 * different card depending on which page it was on. There is one of these.
 *
 * WHAT THE CARD SHOWS, and it is deliberately less than the theme's.
 * ../webview/productCard trims four rows off the site's card on every surface,
 * and this draws the trimmed shape directly rather than reproducing rows in
 * order to hide them:
 *
 *   image, title, sale price, struck compare-at price, Add to Bag
 *
 * Not shown, each for the reason that file records: the brand line (redundant
 * above a title that already names the product), the "45% Off" chip (a second
 * statement of the saving the struck price already makes), the "Enjoy offers on
 * Checkout!" note (true of every product, so it distinguishes none), and the
 * delivery row (a van icon beside an empty date, because the theme fills it
 * from a script that never runs on these pages).
 *
 * THE BUTTON IS PALE, NOT RED, AND THAT IS ENFORCED ELSEWHERE.
 * `BUTTON_FILL` with red text is the app's single decision for a card's Add to
 * Bag; the solid red one belongs to the product page's sticky bar, which is a
 * documented exception because it is that page's one primary action.
 * ../../__tests__/buttonColour.test.ts pins both halves. A card's button is one
 * of eight on a rail and stays quiet.
 *
 * ADDING TO THE BAG IS NOT DONE HERE, and this is the constraint that shapes
 * the component. The app has one session and it lives in the WebView's cookie
 * jar (DATA-SOURCES.md §7), so a native `fetch('/cart/add.js')` would write to
 * a *different* cart than the one the customer is shopping. The card therefore
 * reports the variant id upward and the screen runs
 * ../webview/cartBridge's `addToCartScript` inside the WebView.
 *
 * AND IT NEVER GUESSES A VARIANT. That bridge's own comment is explicit —
 * "never for a product with more than one variant, where choosing on the
 * customer's behalf could add the wrong size." ./products sets `variantId` to
 * null whenever there is a choice to make, and a card with a null id opens the
 * product page instead of adding anything. A customer who wanted the 1 kg bag
 * must not silently receive the 3 kg one.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {BUTTON_FILL, COLORS, FONT_FAMILY} from '../constants/appConstants';
import {HeartOutline, HeartShape} from '../components/glyphs';
import {money} from '../utils/money';
import type {Product} from './products';
import {useWishlist} from './wishlistContext';

/**
 * The card's width on a rail.
 *
 * ../components/Skeleton's `railCard` reserves 42% of the screen, which on a
 * 360dp phone is ~151dp. 156 is that figure rounded to something that divides
 * cleanly with the 12dp rail gutter, and it puts a little over two cards on
 * screen — the "there is more to the right" shape a rail needs. Exported so a
 * rail can compute its own snap interval from the same number rather than
 * declaring a second one that could drift.
 */
export const CARD_WIDTH = 156;

type Props = {
  product: Product;
  /** Open the product page. Given the path, not the product. */
  onOpen: (path: string) => void;
  /**
   * Add this variant to the bag.
   *
   * Only ever called with a non-null `variantId` -- the first in-stock variant,
   * resolved in ./products. A card whose product yielded no parseable id at all
   * routes its button to `onOpen` instead. The screen runs the WebView bridge
   * -- see the note above on why this cannot be a native fetch.
   */
  onAdd: (variantId: number) => void;
};

const ProductCard = ({product, onOpen, onAdd}: Props) => {
  /**
   * The wishlist, from ./wishlistContext rather than from props.
   *
   * Every product surface in the app draws this card, and the state lives five
   * levels up in ../screens/ZiglyWebViewScreen -- see that file for why it is a
   * context. With no provider this is an empty set and no toggle, and the heart
   * is simply not drawn.
   */
  const {handles, toggle: onWish} = useWishlist();
  const saved = handles.has(product.handle);

  /**
   * Whether the button adds or navigates.
   *
   * Two states now, and they are the same button so the rail's rhythm never
   * breaks: a product in stock adds; a sold-out one says so and does nothing.
   *
   * There USED to be a third, "View Options", for a product with more than one
   * variant -- which on a New Arrivals card in Hot Picks or Bestsellers is most
   * of them, so those rails read "View Options" where the website reads "Add to
   * Bag". ../native/products now resolves a variant for every product the way
   * the theme's cards do (the first in stock), so the only reason left to not
   * add is stock.
   *
   * `variantId !== null` stays in `canAdd` because `onAdd` must never be called
   * with null -- a product whose gids were all unparseable still yields none.
   * Such a card falls back to opening the product page, same as before.
   */
  const canAdd = product.available && product.variantId !== null;
  const label = product.available ? 'Add to Bag' : 'Sold Out';

  return (
    <View style={styles.card}>
      {/* The photo and the words are one target: the whole card opens the
          product, as the theme's card does, with the button the only part that
          does something else. */}
      <Pressable
        onPress={() => onOpen(product.path)}
        accessibilityRole="link"
        accessibilityLabel={product.title}
        style={styles.body}
      >
        {({pressed}) => (
          <>
            <View style={styles.imageBox}>
              {product.image ? (
                <Image
                  source={{uri: product.image}}
                  style={[styles.image, pressed && styles.imagePressed]}
                  // `contain`: Zigly's product photography is packshots on
                  // white, and `cover` crops a tall bag or a wide bed at the
                  // frame's edge.
                  resizeMode="contain"
                  accessible={false}
                />
              ) : (
                // A product with no photo keeps its place, its price and its
                // button rather than being dropped from the rail.
                <View style={styles.noImage} />
              )}
            </View>

            <Text numberOfLines={2} style={styles.title}>
              {product.title}
            </Text>

            {/* Sale price, then the struck original beside it. Both are read
                from the same source and both are prices the customer buys on,
                which is why ../webview/productCard keeps them when it trims
                everything else off the card. */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{money(product.price)}</Text>
              {product.compareAt !== null ? (
                <Text style={styles.compareAt}>{money(product.compareAt)}</Text>
              ) : null}
            </View>
          </>
        )}
      </Pressable>

      {/*
        The wishlist heart, over the top-right of the photo.
        
        OUTSIDE THE CARD'S MAIN Pressable, not inside it. A Pressable nested in
        another Pressable is ambiguous on Android -- the outer one frequently
        wins the gesture -- so a heart drawn inside the card's link would open
        the product about as often as it saved it. Absolutely positioned over
        the image box instead, as a sibling, which is also how the theme's own
        card places it.

        Drawn only when there is a toggle to call. See `onWish`.
      */}
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
          // The glyph is 18dp in a 30dp disc at the corner of a 156dp card, so
          // the target is grown well past its ink.
          hitSlop={10}
          style={({pressed}) => [styles.wish, pressed && styles.wishPressed]}
        >
          {saved ? (
            <HeartShape size={18} color={COLORS.red} />
          ) : (
            /*
              Hollow until the handle set says otherwise, including before the
              set has arrived -- it starts empty. An unsaved product is by far
              the common case, so an outline is right almost always and is
              corrected within a frame of the set landing; starting filled would
              flash a save the customer never made.
            */
            <HeartOutline size={18} color={COLORS.ink} />
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
        disabled={!product.available}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${product.title}`}
        accessibilityState={{disabled: !product.available}}
        style={({pressed}) => [
          styles.button,
          !product.available && styles.buttonDisabled,
          pressed && product.available && styles.buttonPressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.buttonLabel,
            !product.available && styles.buttonLabelDisabled,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    // No border and no shadow: the theme's card has both, and on a rail of
    // eight against a white page they read as eight boxes rather than eight
    // products. The photo and the price carry the card here.
    backgroundColor: COLORS.white,
  },
  body: {
    marginBottom: 8,
  },
  /**
   * The wishlist heart's disc, at the photo's top-right.
   *
   * A white disc under the glyph rather than the bare glyph: Zigly's packshots
   * are on white but not uniformly -- a pale bag or a light-coloured bed can
   * sit directly under the corner and an unbacked outline disappears into it.
   * The disc is the theme's own treatment on its card too.
   *
   * Positioned against the card, which is this style's parent and is the
   * default `relative`. 6dp in from the photo's corner.
   */
  wish: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    // A hairline rather than a shadow: an elevation on Android would paint a
    // grey halo on the white photo, which reads as a smudge at this size.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.hairline,
  },
  wishPressed: {
    opacity: 0.6,
  },
  imageBox: {
    width: '100%',
    // Square, matching ../components/Skeleton's `railImage`. The theme's cards
    // are portrait overall but their image is close to square, and the
    // placeholder reserves that shape -- a different ratio here would make the
    // rail jump when the skeleton comes off.
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  /**
   * The press state is on the photo, not the card.
   *
   * A whole-card dim would take the button with it, and the button is a
   * separate target -- dimming it while it is not the thing being pressed
   * reads as the wrong control responding.
   */
  imagePressed: {
    opacity: 0.72,
  },
  /** A product with no photo: the same box, empty, so the rail stays level. */
  noImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F2F5',
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
    color: COLORS.ink,
    // Two lines, fixed. Titles here run long ("ZL Chomp Monster Treat
    // Dispensing Dog Chew Toy") and a card that grew to fit its own title
    // would leave every shorter card in the rail carrying empty space.
    minHeight: 32,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // The row keeps its height whether or not there is a saving to show, so
    // cards with and without a compare-at price line up.
    minHeight: 18,
  },
  price: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.navy,
  },
  compareAt: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    fontWeight: '500',
    color: COLORS.inkMuted,
    textDecorationLine: 'line-through',
  },
  button: {
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    /*
     * BUTTON_FILL, the app's one colour for a card's add-to-cart. The solid red
     * button belongs to the product page's sticky bar and is a documented
     * exception; ../../__tests__/buttonColour.test.ts pins that this card has
     * NOT followed it.
     */
    backgroundColor: BUTTON_FILL,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  /** Sold out: still drawn, so the rail's rhythm holds, but plainly inert. */
  buttonDisabled: {
    backgroundColor: '#F1F3F6',
  },
  buttonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.red,
  },
  buttonLabelDisabled: {
    color: COLORS.inkMuted,
  },
});

export default ProductCard;
