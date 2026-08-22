/**
 * Native wishlist: a two-column grid of saved products.
 *
 * Three states, and the middle one needs no special case — a two-column grid
 * that is two items long *is* the half-filled screen, and the same grid scrolls
 * once it outgrows the viewport. So there is one grid, an empty screen and a
 * wait, and the reference's three screens fall out of that.
 *
 * Where the data comes from is documented in ../webview/wishlistBridge: the page
 * says which products are saved, Shopify says everything about them. Nothing on
 * this screen is computed locally except the discount percentage.
 *
 * The heart is filled because everything here is, by definition, saved. Tapping
 * it removes the item, and the tile goes at once: the write is a press of the
 * site's own control inside the dashboard WebView, which is quick but not
 * instant, so waiting for it would make the tap feel broken. If the write turns
 * out not to have happened, the tile comes back and the screen says so — see the
 * notice strip below.
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
import {money} from '../utils/money';
import EmptyState from './EmptyState';
import {HeartShape} from './glyphs';
import type {WishlistItem} from '../wishlist/wishlistItems';

interface Props {
  /** Null until the page has been read; then possibly empty. */
  items: WishlistItem[] | null;
  onOpenItem: (item: WishlistItem) => void;
  /**
   * Adds the item to the bag. Only ever called for a single-variant product;
   * the screen sends multi-variant products to their page instead.
   */
  onAddToBag: (item: WishlistItem) => void;
  /** Un-saves the item. The tile is expected to disappear immediately. */
  onRemove: (item: WishlistItem) => void;
  /** Shown when a removal could not be confirmed, and the tile came back. */
  notice?: string | null;
}

const Tile = ({
  item,
  onOpen,
  onAdd,
  onRemove,
}: {
  item: WishlistItem;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) => (
  <View style={styles.tile}>
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={item.title}>
      {item.image ? (
        <Image
          source={{uri: item.image}}
          style={styles.image}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.image} />
      )}
    </Pressable>

    {/* Filled because it is saved; tapping it un-saves and the tile goes. */}
    <Pressable
      onPress={onRemove}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={'Remove from wishlist: ' + item.title}
      style={styles.heart}>
      <HeartShape size={22} color='#1B1B1B' />
    </Pressable>

    <Pressable onPress={onOpen}>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>

    <View style={styles.priceRow}>
      <Text style={styles.price}>{money(item.price)}</Text>
      {item.compareAt !== null ? (
        <Text style={styles.was}>{money(item.compareAt)}</Text>
      ) : null}
    </View>

    {item.available ? (
      <Pressable
        onPress={item.variantId === null ? onOpen : onAdd}
        accessibilityRole="button"
        accessibilityLabel={
          item.variantId === null
            ? 'Choose options for ' + item.title
            : 'Add to Bag: ' + item.title
        }
        style={({pressed}) => [styles.addButton, pressed && styles.pressed]}>
        <Text style={styles.addLabel}>Add to Bag</Text>
      </Pressable>
    ) : (
      <View style={[styles.addButton, styles.soldOutButton]}>
        <Text style={styles.soldOutLabel}>Sold out</Text>
      </View>
    )}
  </View>
);

const WishlistScreen = ({
  items,
  onOpenItem,
  onAddToBag,
  onRemove,
  notice,
}: Props) => {
  if (items === null) {
    // Not yet read. Short now that the read is a storage lookup plus one
    // request per saved product, but not nothing -- and showing the empty
    // screen during it would tell the customer their saved items were gone.
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.navy} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <EmptyState title="No items" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.grid}>
        {items.map(item => (
          <Tile
            key={item.handle}
            item={item}
            onOpen={() => onOpenItem(item)}
            onAdd={() => onAddToBag(item)}
            onRemove={() => onRemove(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const GUTTER = 10;
const HAIRLINE = '#ECEEF2';

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  centre: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Only ever appears when a removal could not be confirmed. */
  notice: {
    backgroundColor: '#FDF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#F6DADA',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  noticeText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    lineHeight: 19,
    color: '#8A2B2B',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
    paddingBottom: 24,
    // Wrapping rows and the gap between columns come from one declaration; a
    // margin per tile would need the last column special-cased.
    gap: GUTTER,
  },
  /**
   * Two columns. Expressed as a fraction rather than a measured width, so it
   * holds on any screen and after a rotation.
   */
  tile: {width: '48%', paddingBottom: 6},

  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  heart: {position: 'absolute', top: 6, right: 6, padding: 2},

  title: {
    fontFamily: FONT_FAMILY,
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 19,
    color: '#1B1B1B',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
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

  addButton: {
    marginTop: 10,
    backgroundColor: '#FDE8E8',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pressed: {opacity: 0.85},
  addLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.red,
    fontSize: 15.5,
    fontWeight: '600',
  },
  soldOutButton: {backgroundColor: '#F4F5F7', borderWidth: 1, borderColor: HAIRLINE},
  soldOutLabel: {
    fontFamily: FONT_FAMILY,
    color: COLORS.inkMuted,
    fontSize: 15.5,
    fontWeight: '600',
  },
});

export default WishlistScreen;
