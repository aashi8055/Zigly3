/**
 * An offer rail: a heading and a row of image-only tiles.
 *
 * Draws all three of the theme's `offer-section` instances -- Applod Food,
 * Applod Treats and Zigly Style Steals -- from ./offerRails.
 *
 * THE TILES HAVE NO LABEL, AND THAT CHANGES THE FAILURE MODE. Every other rail
 * in this app falls back to its label's initial when artwork has not arrived,
 * so the tile keeps its size, its words and its tap target -- the degradation
 * ../webview/instagramSection settled on. These tiles have no words at all: the
 * theme renders each block as an image inside a link and nothing else, and the
 * lettering ("Applod Dog Fresh Food") is part of the picture.
 *
 * So an unresolved tile here would be a blank rectangle that navigates
 * somewhere, which is worse than no tile: a customer cannot tell what it is,
 * cannot tell whether it is broken, and tapping it is a guess. A tile with no
 * artwork is therefore NOT DRAWN, and if none of them resolve the section draws
 * nothing at all.
 *
 * That is the same reasoning ../webview/instagramSection applies in the
 * opposite direction, and the difference is the label: there, a card that loses
 * its cover "keeps its place, its badge and its link" because those still say
 * what it is. Here there is nothing left to say it.
 *
 * WHICH MAKES THE FIRST LAUNCH VISIBLE, and that is the honest cost. The
 * artwork is learned from the site (see ./tileIcons), so on a first run with no
 * cache these three sections appear a moment after the rest. A skeleton holds
 * their place while the fetch is out, so the page does not jump -- but a
 * launch that never reaches the network shows the dashboard without them.
 * Accepted, because the alternative is three rails of blank tiles.
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
import {Block, usePulse} from '../components/Skeleton';
import type {OfferRail as OfferRailData} from './offerRails';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/**
 * How many tiles are visible at once.
 *
 * 1.8, so the second tile is most of the way on and the third is off the edge.
 * The theme's artwork here is a promotional composition -- a product, a
 * discount and a word or two of copy baked into the image -- rather than a
 * packshot, and at 132dp (two and a bit on screen) that copy was too small to
 * read, which made the rail a row of coloured squares.
 */
const TILES_VISIBLE = 1.8;

/**
 * The tile's size for a given screen width.
 *
 * The theme's artwork is cut to 650x610 and 610x650 -- square either way,
 * within a few percent -- and its own stylesheet rounds these to 8px.
 *
 * DERIVED RATHER THAN FIXED, which is the change here. It was a flat 132dp,
 * chosen to put "two and a bit on screen beside the 12dp gutter". A fixed
 * number shows a different fraction of the next tile on every phone, and the
 * fraction is the part that says the rail scrolls -- so the count is what is
 * fixed now and the size follows from it. On a 360dp phone this is ~180dp.
 *
 * Exported so the rail's snap interval is computed from the same number rather
 * than from a second one that could drift.
 */
export const offerTileSize = (width: number): number =>
  Math.round((width - GUTTER - TILES_VISIBLE * GUTTER) / TILES_VISIBLE);

/** The fallback when no width is given: the old fixed size. */
const TILE_FALLBACK = 132;

type Props = {
  rail: OfferRailData;
  onOpen: (path: string) => void;
  /** The screen's width, which the tile is sized against. */
  width?: number;
};

const EMPTY_ICONS: IconMap = {};

const OfferRail = ({rail, onOpen, width}: Props) => {
  const TILE = width ? offerTileSize(width) : TILE_FALLBACK;
  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(rail as TileRail),
    fetcher: signal => fetchIcons(rail as TileRail, signal),
    save: learned => saveIcons(rail as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);

  /**
   * Only the tiles whose artwork resolved.
   *
   * See the note at the top: a tile with no picture has nothing to say what it
   * is, so it is dropped rather than drawn blank. The order of those that
   * remain is the theme's own.
   */
  const drawable = rail.tiles.filter(tile => icons[tile.key]);

  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{rail.title}</Text>
        <View style={styles.track}>
          <Block pulse={pulse} style={[styles.placeholder, {width: TILE, height: TILE}]} />
          <Block pulse={pulse} style={[styles.placeholder, {width: TILE, height: TILE}]} />
          <Block pulse={pulse} style={[styles.placeholder, {width: TILE, height: TILE}]} />
        </View>
      </View>
    );
  }

  /*
   * Nothing resolved: no section, not a heading over an empty strip. A heading
   * with nothing under it states that something is missing; one fewer section
   * simply ends the page a block earlier.
   */
  if (!drawable.length) {
    return null;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{rail.title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        snapToInterval={TILE + GUTTER}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {drawable.map(tile => (
          <Pressable
            key={tile.key}
            onPress={() => onOpen(tile.path)}
            accessibilityRole="link"
            /*
             * The artwork's own lettering, read from the theme, because there
             * is no visible label and no useful alt text -- a screen reader
             * would otherwise be handed a link containing nothing. See the note
             * on `label` in ./offerRails.
             */
            accessibilityLabel={tile.label}
            style={[styles.cell, {width: TILE, height: TILE}]}
          >
            {({pressed}) => (
              <Image
                source={{uri: icons[tile.key]}}
                style={[styles.image, pressed && styles.imagePressed]}
                // `cover`: the crop is within a few percent of square and is
                // shown square, so a sliver is trimmed rather than letterboxed
                // against the page.
                resizeMode="cover"
                accessible={false}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    paddingHorizontal: GUTTER,
    marginBottom: 10,
  },
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller -- a scroll container's start
    // padding is scrolled away and older Android drops the end padding, which
    // is the defect the coupon strip hit. See ../webview/injectedStyles.
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  /**
   * The tile. Its size is applied at the call site, not here: it is derived
   * from the screen width now (see `offerTileSize`) and a stylesheet is built
   * once at module load, before any width is known.
   */
  cell: {
    // The theme's own radius for these tiles: `.block_image_div img,
    // .block_image_div { border-radius: 8px }`.
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePressed: {
    opacity: 0.72,
  },
  /** Sized at the call site, for the same reason as `cell`. */
  placeholder: {
    borderRadius: 8,
  },
});

export default OfferRail;
