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
 * The three tile shapes.
 *
 *   circle  A 60dp disc. The category circles, and the size is fixed by
 *           ../components/Skeleton -- `HomeSkeleton` draws five circles at 18%
 *           width each, so five of these and their gaps must fill the same
 *           width or the dashboard jumps when the placeholder comes off.
 *   breed   A disc sized so that three and a bit fit the screen -- see
 *           `breedSize` below. The two breed rails, and the reason this is not
 *           just a bigger `circle`: at 60dp a breed photograph is a thumbnail
 *           of an animal's head and the breeds are genuinely hard to tell
 *           apart, which is the whole job of that rail.
 *   square  A 104dp rounded square. Explore's tiles are category photographs
 *           with two-word labels rather than icons on a disc, and at 60dp the
 *           photograph is unreadable.
 *   wide    A square sized against the screen so that two and a bit are
 *           visible -- see `wideSize`. Explore uses this: at 104dp its tiles
 *           are photographs of a whole category shrunk to a thumbnail, and
 *           three and a half of them on a row made the section read as a
 *           strip of icons rather than as the pick-something invitation its
 *           heading ("Explore. Pick. Pamper.") promises.
 */
export type TileVariant = 'circle' | 'breed' | 'square' | 'wide';

const CIRCLE = 60;
const SQUARE = 104;

/** The rail's gutter and the gap between tiles, matching every other rail. */
const PITCH = 12;

/**
 * The breed rails' own gap, wider than every other rail's.
 *
 * The discs are more than twice the area of a category circle, and a 12dp gap
 * between two 130dp photographs reads as a crowded contact sheet rather than as
 * a row of choices. 18 is the figure that keeps three and a bit on screen while
 * letting each disc be seen as its own thing.
 */
const BREED_PITCH = 18;

/**
 * How many breed discs are visible at once, and it is deliberately not a whole
 * number.
 *
 * 3.4 leaves the fourth disc a little under half cut by the right edge, which
 * is the standing way a horizontal rail says "there is more" without a chevron
 * or a scrollbar. A whole 3 or 4 would end flush with the screen and read as a
 * complete set that does not scroll -- which is exactly how these rails were
 * being read at 60dp, where six discs fitted and nothing suggested a seventh.
 */
const BREEDS_VISIBLE = 3.4;

/**
 * The breed disc's diameter for a given screen width.
 *
 * Derived rather than fixed so it holds on every phone: the row shows
 * BREEDS_VISIBLE discs and their gaps inside the width, minus the leading
 * gutter. On a 360dp phone this lands at about 130dp -- a little over twice the
 * 60dp circle, which is the "double the size" this rail needed.
 */
export const breedSize = (width: number): number =>
  Math.round((width - BREED_PITCH - BREEDS_VISIBLE * BREED_PITCH) / BREEDS_VISIBLE);

/**
 * How many `wide` tiles are visible at once.
 *
 * 2.25, so the third tile is a quarter shown -- enough to be unmistakably a cut
 * tile rather than a margin, which is what tells the customer the row scrolls.
 */
const WIDE_VISIBLE = 2.25;

/**
 * The `wide` tile's edge for a given screen width.
 *
 * Same derivation as `breedSize` and for the same reason: a fixed number would
 * show a different fraction of the third tile on every phone, and the fraction
 * is the part that does the work.
 */
export const wideSize = (width: number): number =>
  Math.round((width - PITCH - WIDE_VISIBLE * PITCH) / WIDE_VISIBLE);

/** The theme's own `bg_color` for these sections, behind transparent PNGs. */
const DISC = '#e8eef5';

type Props = {
  tiles: readonly Tile[];
  /** Learned artwork, keyed by `Tile.key`. Missing entries fall back. */
  icons: IconMap;
  onOpen: (path: string) => void;
  variant?: TileVariant;
  /**
   * The screen's width, required by the `breed` variant and ignored by the
   * others -- its disc is sized against the screen so that a fixed count is
   * visible on any phone. See `breedSize`.
   */
  width?: number;
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
  size,
  pitch,
  onOpen,
}: {
  tile: Tile;
  icon?: string;
  variant: TileVariant;
  /** The disc or square's edge, decided by the row. */
  size: number;
  /** The gap to the next cell. */
  pitch: number;
  onOpen: (path: string) => void;
}) => {
  const round = variant === 'circle' || variant === 'breed';
  /*
   * The breed disc carries a PHOTOGRAPH, and that is why it does not get the
   * pale ground the category circles get.
   *
   * The category tiles are transparent PNGs of an object, so `contain` at 78%
   * of the disc on `#e8eef5` is right -- the ground is the tile and the icon
   * sits on it. A breed photo is opaque and rectangular: contained at 78% it
   * left a grey ring all the way round every disc, which read as a border the
   * design never asked for and which the site does not draw. So the photo
   * fills its disc, on white, and the only edge left is the photo's own.
   */
  const photo = variant === 'breed';

  return (
    <Pressable
      onPress={() => onOpen(tile.path)}
      accessibilityRole="link"
      accessibilityLabel={tile.label}
      style={[styles.cell, {width: size, marginRight: pitch}]}
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
              photo && styles.artPhoto,
              pressed && styles.artPressed,
            ]}
          >
            {icon ? (
              <Image
                source={{uri: icon}}
                style={
                  round && !photo
                    ? {width: size * 0.78, height: size * 0.78}
                    : styles.fill
                }
                /*
                 * `contain` on the category disc: those are transparent PNGs
                 * of a whole animal or object and `cover` would crop the
                 * subject at the edge. `cover` everywhere else -- the breed
                 * disc and the square tiles are photographs, and a photograph
                 * inset inside its own frame reads as a bordered thumbnail.
                 * See `photo` above for why the breed disc changed sides.
                 */
                resizeMode={round && !photo ? 'contain' : 'cover'}
                accessible={false}
              />
            ) : (
              <Text style={styles.initial}>{tile.label.charAt(0)}</Text>
            )}
          </View>
          {/*
            The breed rail's label is scaled with its disc. At 11.5 under a
            130dp photograph the name reads as a caption on a picture rather
            than as the label of a choice, and "Labrador Retriever" -- the
            longest and the reason the label is allowed two lines at all -- has
            room to sit on one.
          */}
          <Text
            numberOfLines={2}
            style={[styles.label, variant === 'breed' && styles.labelBreed]}
          >
            {tile.label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const TileRow = ({tiles, icons, onOpen, variant = 'circle', width}: Props) => {
  const breed = variant === 'breed';
  /*
   * The breed disc is sized against the screen; the other two are fixed. A
   * `breed` row rendered without a width falls back to twice the category
   * circle, which is the same order of size -- so a caller that forgets the
   * prop gets a large rail rather than a broken one.
   */
  const size = breed
    ? width
      ? breedSize(width)
      : CIRCLE * 2
    : variant === 'wide'
      ? // Same fallback rule as the breed disc: a `wide` row with no width
        // given draws a larger square rather than a broken one.
        width
        ? wideSize(width)
        : SQUARE
      : variant === 'square'
        ? SQUARE
        : CIRCLE;
  const pitch = breed ? BREED_PITCH : PITCH;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.track, {paddingHorizontal: pitch}]}
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
          size={size}
          pitch={pitch}
          onOpen={onOpen}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  track: {
    // The gutter belongs to the track, not the scroller: a scroll container's
    // start padding is scrolled away and older Android drops the end padding
    // outright, which is the exact defect the coupon strip hit (see
    // ../webview/injectedStyles). On the content container it is part of the
    // scrollable width and both ends keep it.
    //
    // The value is applied by the row, not here: the breed rail uses a wider
    // one. This keeps the alignment rule in one place.
    alignItems: 'flex-start',
  },
  cell: {
    alignItems: 'center',
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
   * A photographic disc: white behind it rather than the pale ground.
   *
   * The photo covers the whole disc, so this colour is only ever seen in the
   * moment before the image decodes -- and white is the ground the section
   * sits on, so that moment shows nothing at all instead of a grey coin.
   */
  artPhoto: {
    backgroundColor: COLORS.white,
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
  /** The breed rail's larger label. See the note at the call site. */
  labelBreed: {
    fontSize: 13.5,
    lineHeight: 17,
  },
});

export default TileRow;
