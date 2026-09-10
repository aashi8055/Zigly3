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
 *   breed   A disc sized so that four and a bit fit the screen -- see
 *           `breedSize` below. The two breed rails, and the reason this is not
 *           just a `circle` with different data: a breed photograph COVERS its
 *           disc where a category icon is contained at 78% of one, so the same
 *           diameter carries a quarter more subject -- which is what keeps a
 *           Beagle distinguishable from a Pug at this size.
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
 * The breed rails' own gap, still wider than every other rail's.
 *
 * THE HISTORY, because this number has moved three times and each move was
 * paying for something. 18 first, on the argument that a 12dp gap between two
 * large photographs reads as a crowded contact sheet. Then 26, because at 18
 * the discs still touched visually -- the disc was doing all the work of
 * filling the row and the gap got whatever was left.
 *
 * 20 NOW, and it is coming back down because the disc is smaller. A 26dp gap
 * was sized against a 78dp photograph; against the 56dp disc `BREEDS_VISIBLE`
 * now gives, the same gap is nearly half the tile again and the rail reads as
 * sparse -- widely spaced small things, which is the opposite failure to the
 * contact sheet. 20 keeps a gap that is read as space rather than as a seam at
 * the size the discs actually are.
 *
 * The gap and the count are one decision, not two -- see `BREEDS_VISIBLE`.
 * Neither number means anything without the other, and the disc that falls out
 * of both is what is actually being chosen.
 */
const BREED_PITCH = 20;

/**
 * How many breed discs are visible at once, and it is deliberately not a whole
 * number.
 *
 * 4.3 NOW, up from 3.2 and 3.4 before it, and each step has made the disc
 * smaller: the same width divided among more tiles. The rail was still reading
 * as three big photographs, which is nearer a set of cards than the pick-a-
 * breed index it is -- twenty-five dogs deep, so the customer's job is to scan
 * it, and a scan wants more of the list on screen at once.
 *
 * The fraction is still deliberate. The fifth disc is a third shown --
 * unmistakably a cut tile rather than a margin, which is the standing way a
 * horizontal rail says "there is more" without a chevron or a scrollbar. A
 * whole 4 or 5 would end flush with the screen and read as a complete set that
 * does not scroll.
 */
const BREEDS_VISIBLE = 4.3;

/**
 * The breed disc's diameter for a given screen width.
 *
 * Derived rather than fixed so it holds on every phone.
 *
 * THE DERIVATION. The row is a leading gutter plus, per cell, a disc and one
 * trailing `marginRight` (see TileCell and `track`), so n visible tiles occupy
 * `pitch + n * (size + pitch)`. Solving for `size` gives what is written
 * below: one pitch off the width, divide by the count, then one pitch off the
 * quotient.
 *
 * Rewritten in that form rather than the equivalent
 * `(width - pitch - count * pitch) / count` it used to carry -- the two are
 * algebraically the same and the old one was NOT a bug, only harder to read
 * against the layout it describes. Kept deliberately in the shape that names
 * each term, so the next person can check it against `track` and TileCell
 * without doing the algebra.
 *
 * On a 360dp phone this lands at 59dp, against 78dp under the previous
 * constants -- the disc gives up 19dp, which is the whole of the size change
 * asked for. That puts it at about the 60dp of a category circle, and it is
 * fair to ask whether the rail has now argued its way back to the thumbnail it
 * was created to escape. It has not, quite: the category circle holds a
 * transparent icon `contain`ed at 78% of its disc, so the drawn subject is
 * ~47dp, while a breed photo COVERS its disc edge to edge. The dog's head is
 * the full 59, which is a quarter more subject than the circles carry and
 * still tells a Beagle from a Pug.
 *
 * Checked across 320-480dp: 4.29-4.31 discs visible on every one of them, so
 * the cut fifth tile that says "this scrolls" survives at every width.
 */
export const breedSize = (width: number): number =>
  Math.round((width - BREED_PITCH) / BREEDS_VISIBLE - BREED_PITCH);

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
            The breed rail's label is scaled with its disc, so it comes back
            down as the disc does. It was 13.5, set when the photograph was
            78dp and a caption-sized name under it read as a caption on a
            picture rather than as the label of a choice. Against a 59dp disc
            13.5 is the opposite problem: the words are wider than the picture
            they belong to, and "Labrador Retriever" -- the longest, and the
            reason the label is allowed two lines at all -- wraps to two lines
            that are each broader than the tile. 12 sits between this and the
            11.5 the category circles use, which is where the disc now sits
            too.
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
  /** The breed rail's label, a shade above the circles'. See the call site. */
  labelBreed: {
    fontSize: 12,
    lineHeight: 15,
  },
});

export default TileRow;
