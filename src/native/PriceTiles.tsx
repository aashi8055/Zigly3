/**
 * "Find the Best Deals!" — six coloured price tiles in a 3x2 grid.
 *
 * Section twelve. ./priceTilesData carries the data and why none of it is parsed;
 * this draws it.
 *
 * NO LOADING STATE, NO SKELETON, NO FETCH. The only section in the dashboard
 * that is complete before the app has touched the network -- every tile is text
 * and a colour from theme settings, with no artwork to resolve. So there is
 * nothing to wait for and nothing to hold a placeholder for, which is why this
 * file has no `useSectionData` and is the shortest section in the set.
 *
 * A GRID, THREE ACROSS, MATCHING THE APP AS IT SHIPS TODAY.
 * ../webview/injectedStyles already overrides the theme's Swiper for this
 * section --
 *
 *   #zigly-x-price .swiper-wrapper {
 *     display: grid;
 *     grid-template-columns: repeat(3, minmax(0, 1fr));
 *     gap: 10px;
 *   }
 *
 * -- so the customer's app shows six tiles as two rows of three, not a rail.
 * That is what this reproduces. The theme's own mobile rule is a rail
 * (`width: calc(100% / 3 - 54px)` with `margin-right: 10px`), and the app
 * deliberately departed from it; departing the same way keeps the two in step.
 *
 * `minmax(0, 1fr)` has a direct equivalent here and it matters for the same
 * reason the injected rule spells out: a column that sizes to its content would
 * widen past the row rather than wrapping inside it. In flexbox that is
 * `minWidth: 0` on the cell, which is why it is set explicitly below.
 *
 * TYPE SIZES ARE THE THEME'S MOBILE RULES, converted from its 62.5% rem base:
 * the heading is 1.4rem (14px) and the price 2rem (20px), both at line-height
 * 1, with the card padded 20px vertically and 12px horizontally.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {PRICE_TILES, PRICE_TILES_TITLE, type PriceTile} from './priceTilesData';

const GUTTER = 12;

/** The theme's own `gap: 10px`, kept by the injected grid rule. */
const GAP = 10;

type Props = {
  onOpen: (path: string) => void;
};

/**
 * One tile.
 *
 * The background and text colour come from the block, not from
 * ../constants/appConstants -- see ./priceTilesData on why this is the one place
 * the app takes a colour from theme data.
 */
const Tile = ({
  tile,
  onOpen,
}: {
  tile: PriceTile;
  onOpen: (path: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(tile.path)}
    accessibilityRole="link"
    // Read as one phrase: "Under ₹599" rather than two unrelated strings.
    accessibilityLabel={`${tile.heading} ${tile.price}`}
    style={({pressed}) => [
      styles.tile,
      {backgroundColor: tile.background},
      pressed && styles.tilePressed,
    ]}
  >
    <Text numberOfLines={1} style={[styles.heading, {color: tile.text}]}>
      {tile.heading}
    </Text>
    <Text numberOfLines={1} style={[styles.price, {color: tile.text}]}>
      {tile.price}
    </Text>
  </Pressable>
);

const PriceTiles = ({onOpen}: Props) => (
  <View style={styles.root}>
    <Text style={styles.title}>{PRICE_TILES_TITLE}</Text>
    <View style={styles.grid}>
      {PRICE_TILES.map(tile => (
        <View key={tile.path} style={styles.cell}>
          <Tile tile={tile} onOpen={onOpen} />
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
    paddingHorizontal: GUTTER,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The gap is absorbed by each cell's padding rather than by `gap`, so the
    // 33.333% widths still add to a row. A `gap` plus percentage widths
    // overflows by the gap on Android and wraps the third tile early -- the
    // same trap ./BestDeals notes.
    marginHorizontal: -GAP / 2,
  },
  cell: {
    // Three across, as ../webview/injectedStyles lays this section out today.
    width: '33.333%',
    paddingHorizontal: GAP / 2,
    paddingBottom: GAP,
    // The flexbox equivalent of the injected rule's `minmax(0, 1fr)`: without
    // it a long price would widen its column past the row instead of being
    // clipped inside it.
    minWidth: 0,
  },
  tile: {
    // The theme's `padding: 20px 12px` and `border-radius: 8px`.
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The press state.
   *
   * The theme's is `transform: scale(1.05)` on hover, which has no meaning on
   * a touch device and would push a tile over its neighbours. A brief dim is
   * the native equivalent of the same intent, and it is what every other
   * section in this set uses.
   */
  tilePressed: {
    opacity: 0.72,
  },
  heading: {
    fontFamily: FONT_FAMILY,
    // The theme's mobile `font-size: 1.4rem; line-height: 1` on a 62.5% base.
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  price: {
    fontFamily: FONT_FAMILY,
    // `font-size: 2rem; line-height: 1`, with the theme's own 2px margin.
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default PriceTiles;
