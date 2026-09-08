/**
 * A horizontal run of tiles: artwork, a label, a page behind each tap.
 *
 * The row itself, without the heading or the data loading around it, so the
 * three sections that need one share it: ./TileRailView (the category circles
 * and both breed rails) and ./ExploreSection (four tabs of category tiles).
 * They differ only in the tile's shape, which is what `variant` selects.
 *
 * Split out of ./TileRailView when Explore needed the same row with square
 * artwork. The alternative was a second row implementation, and the web side
 * already demonstrates where that leads: ../webview/productCard exists because
 * the same card was styled three times over and the copies drifted until the
 * same content looked different on different surfaces.
 *
 * DRAWN AS A NATIVE ROW, NOT AS THE SITE DRAWS IT. A `ScrollView` with real
 * momentum, rather than the `overflow-x: auto` box ../webview/injectedStyles
 * has to graft onto a Swiper that never initialises on a transplanted section.
 * The pale disc (`#e8eef5`) is the theme's own `bg_color`; the labels and
 * destinations are the theme's; everything else here is the app's.
 */
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import type {IconMap, Tile} from './tileIcons';

/**
 * The two tile shapes.
 *
 *   circle  A 60dp disc. The category circles and the breed rails, and the
 *           size is fixed by ../components/Skeleton -- `HomeSkeleton` draws
 *           five circles at 18% width each, so five of these and their gaps
 *           must fill the same width or the dashboard jumps when the
 *           placeholder comes off.
 *   square  A 104dp rounded square. Explore's tiles are category photographs
 *           with two-word labels rather than icons on a disc, and at 60dp the
 *           photograph is unreadable.
 */
export type TileVariant = 'circle' | 'square';

const CIRCLE = 60;
const SQUARE = 104;

/** The rail's gutter and the gap between tiles, matching every other rail. */
const PITCH = 12;

/** The theme's own `bg_color` for these sections, behind transparent PNGs. */
const DISC = '#e8eef5';

type Props = {
  tiles: readonly Tile[];
  /** Learned artwork, keyed by `Tile.key`. Missing entries fall back. */
  icons: IconMap;
  onOpen: (path: string) => void;
  variant?: TileVariant;
};

/**
 * One tile.
 *
 * Artwork that has not resolved falls back to the label's initial on the same
 * ground, so the tile keeps its size, its label and its tap target. That is the
 * degradation ../webview/instagramSection settled on, and the reason artwork is
 * safe to learn from the network at all: a rail is never missing, only ever
 * unillustrated.
 */
const TileCell = ({
  tile,
  icon,
  variant,
  onOpen,
}: {
  tile: Tile;
  icon?: string;
  variant: TileVariant;
  onOpen: (path: string) => void;
}) => {
  const round = variant === 'circle';
  const size = round ? CIRCLE : SQUARE;

  return (
    <Pressable
      onPress={() => onOpen(tile.path)}
      accessibilityRole="link"
      accessibilityLabel={tile.label}
      style={[styles.cell, {width: size}]}
      // The artwork is the smallest part but the cell is the target, so the
      // label is tappable too -- it is the part a thumb aims at.
      hitSlop={4}
    >
      {({pressed}) => (
        <>
          <View
            style={[
              styles.art,
              {width: size, height: size},
              round ? {borderRadius: size / 2} : styles.artSquare,
              pressed && styles.artPressed,
            ]}
          >
            {icon ? (
              <Image
                source={{uri: icon}}
                style={
                  round
                    ? {width: size * 0.78, height: size * 0.78}
                    : styles.fill
                }
                // `contain` on a disc: these are transparent PNGs of a whole
                // animal or object and `cover` would crop the subject at the
                // edge. `cover` on a square: those are photographs cut to
                // 650x765 and shown in a square, so a little is trimmed
                // rather than letterboxed.
                resizeMode={round ? 'contain' : 'cover'}
                accessible={false}
              />
            ) : (
              <Text style={styles.initial}>{tile.label.charAt(0)}</Text>
            )}
          </View>
          <Text numberOfLines={2} style={styles.label}>
            {tile.label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const TileRow = ({tiles, icons, onOpen, variant = 'circle'}: Props) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.track}
    // The row is short and the page under it is long, so a horizontal drag
    // that starts a few degrees off should still scroll the row rather than
    // handing the gesture to the page.
    directionalLockEnabled
  >
    {tiles.map(tile => (
      <TileCell
        key={tile.key}
        tile={tile}
        icon={icons[tile.key]}
        variant={variant}
        onOpen={onOpen}
      />
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  track: {
    // The gutter belongs to the track, not the scroller: a scroll container's
    // start padding is scrolled away and older Android drops the end padding
    // outright, which is the exact defect the coupon strip hit (see
    // ../webview/injectedStyles). On the content container it is part of the
    // scrollable width and both ends keep it.
    paddingHorizontal: PITCH,
    alignItems: 'flex-start',
  },
  cell: {
    alignItems: 'center',
    marginRight: PITCH,
  },
  art: {
    backgroundColor: DISC,
    alignItems: 'center',
    justifyContent: 'center',
    // Clip the artwork to its shape: several of the theme's images are drawn
    // to the edge of their canvas and would otherwise square off a circle.
    overflow: 'hidden',
    marginBottom: 8,
  },
  artSquare: {
    borderRadius: 12,
  },
  /**
   * The press state, and it is on the artwork rather than the whole cell.
   *
   * A scale on the cell would move the label, which reads as the row
   * twitching. The web version does this with a `:hover` background swap to
   * the theme's `#183761`, which has no meaning on a touch device -- a brief
   * dim is the native equivalent of the same intent.
   */
  artPressed: {
    opacity: 0.62,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  /** The fallback mark when artwork has not resolved. */
  initial: {
    fontFamily: FONT_FAMILY,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.navy,
  },
  label: {
    fontFamily: FONT_FAMILY,
    // The theme sets 1.4rem/600 at #2B2B2A. 11.5 rather than 14 because the
    // theme's rem base is 62.5%, and because two lines of this must fit under
    // a 60dp disc -- "Labrador Retriever" is the constraint, and it is why the
    // label is allowed two lines rather than one.
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
    color: '#2B2B2A',
    textAlign: 'center',
  },
});

export default TileRow;
