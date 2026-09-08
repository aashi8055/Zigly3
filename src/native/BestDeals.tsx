/**
 * Zigly Coins over a grid of six category tiles — the `best_deals` section.
 *
 * Section ten, and the first that is a GRID rather than a rail. That is the
 * theme's own shape on a phone, not a choice made here: `sections/best-deals.liquid`
 * collapses its two-column desktop layout to one column below 1000px, so the
 * coins banner sits above the tiles, and lays the tiles out as
 * `grid-template-columns: repeat(3, 1fr)` dropping to `repeat(2, 1fr)` below
 * 400px.
 *
 * Three columns is kept, with two as the narrow-screen fallback for the same
 * reason the theme has one: six tiles in three columns is two tidy rows, and at
 * 360dp a third of the width is a 104dp tile -- readable, because these are
 * flat category illustrations rather than photographs. Below 400dp the theme
 * itself gives up on three, and so does this.
 *
 * A GRID, NOT A SCROLLER, and it matters that this is deliberate. Every other
 * section so far scrolls sideways; this one shows all six at once because the
 * theme does, and because a 2x3 block reads as "here is the whole range" where
 * a rail reads as "here are some". ../webview/injectedStyles makes the same
 * call for the price tiles further down the dashboard -- "Laid out as a 2x3
 * grid rather than a rail".
 *
 * THE TILES HAVE NO LABELS, so an unresolved image is dropped rather than drawn
 * blank -- ./OfferRail's note carries the full argument. One difference here:
 * dropping a tile from a grid reflows the rows, where dropping one from a rail
 * only shortens it. Five tiles in three columns is a row of three and a row of
 * two, which still reads as a grid, so no placeholder is held for a tile that
 * will never fill.
 *
 * THE COINS BANNER LEAVES ZIGLY.COM ON PURPOSE. Its link is Zigly Prime on
 * `ziglyprime.erlpaas.com`, which ../constants/appConstants deliberately lists
 * as an INTERNAL host: the reference app keeps it in-app because that flow asks
 * for a mobile number, and sending it to the browser broke it. So this hands up
 * an absolute URL and the screen's own host rules decide -- exactly as the
 * WebView dashboard does today.
 */
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {Block, usePulse} from '../components/Skeleton';
import {
  BEST_DEALS_RAIL,
  BEST_DEALS_TILES,
  COINS_BANNER,
} from './bestDeals';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/** The gap between tiles, both ways. The theme's own `column-gap: 10px`. */
const GAP = 10;

/**
 * The tile's height.
 *
 * `a.block_link_div { height: 126px }` at the mobile breakpoint, verbatim from
 * the theme. A fixed height rather than an aspect ratio because the theme fixes
 * it too -- the artwork is 620x540 and is shown cropped to this box, so a ratio
 * here would disagree with the site by a few pixels per row.
 */
const TILE_HEIGHT = 126;

/**
 * The coins banner's height.
 *
 * `.best-deals-collage_left { min-height: 181px }` at the same breakpoint.
 */
const BANNER_HEIGHT = 181;

/** Below this the theme drops to two columns, and so does this. */
const TWO_COLUMN_BELOW = 400;

type Props = {
  /** A storefront path, or an absolute URL for the coins banner. */
  onOpen: (target: string) => void;
};

const EMPTY_ICONS: IconMap = {};

const BestDeals = ({onOpen}: Props) => {
  const {width} = useWindowDimensions();
  const columns = width < TWO_COLUMN_BELOW ? 2 : 3;

  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(BEST_DEALS_RAIL as TileRail),
    fetcher: signal => fetchIcons(BEST_DEALS_RAIL as TileRail, signal),
    save: learned => saveIcons(BEST_DEALS_RAIL as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);

  /** Only what resolved; see the note at the top. */
  const drawable = BEST_DEALS_TILES.filter(tile => icons[tile.key]);
  const banner = icons[COINS_BANNER.key];

  if (loading) {
    return (
      <View style={styles.root}>
        <Block pulse={pulse} style={styles.bannerPlaceholder} />
        {/*
          The placeholders go through the same padded cell wrapper the real
          tiles use. Putting a percentage width straight on the Block would
          overflow the row by the grid's negative margin and wrap the third
          tile onto its own line -- so the skeleton would be a different shape
          from the thing it stands in for, which is the one thing a skeleton
          must not be.
        */}
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View
              key={i}
              style={[styles.cell, {width: `${100 / columns}%`}]}
            >
              <Block pulse={pulse} style={styles.tilePlaceholder} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  /*
   * Nothing resolved at all: no section. A heading-less block of empty
   * rectangles states nothing, and the dashboard simply ends this slot.
   */
  if (!banner && !drawable.length) {
    return null;
  }

  return (
    <View style={styles.root}>
      {banner ? (
        <Pressable
          onPress={() => onOpen(COINS_BANNER.link)}
          accessibilityRole="link"
          // The banner shows no text of its own; the lettering is in the
          // artwork. See ./bestDeals on why this is the only name available.
          accessibilityLabel={COINS_BANNER.label}
          style={styles.banner}
        >
          {({pressed}) => (
            <Image
              source={{uri: banner}}
              style={[styles.bannerImage, pressed && styles.pressed]}
              // `cover`: the mobile crop is cut for this box, so a sliver is
              // trimmed rather than letterboxed against the page.
              resizeMode="cover"
              accessible={false}
            />
          )}
        </Pressable>
      ) : null}

      <View style={styles.grid}>
        {drawable.map(tile => (
          <View
            key={tile.key}
            // The column width lives on a wrapper so the gap can be padding
            // inside it: a `gap` on the grid plus percentage widths overflows
            // by the gap on Android, and the row wraps a tile early.
            style={[styles.cell, {width: `${100 / columns}%`}]}
          >
            <Pressable
              onPress={() => onOpen(tile.path)}
              accessibilityRole="link"
              accessibilityLabel={tile.label}
              style={styles.tile}
            >
              {({pressed}) => (
                <Image
                  source={{uri: icons[tile.key]}}
                  style={[styles.tileImage, pressed && styles.pressed]}
                  resizeMode="cover"
                  accessible={false}
                />
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
    paddingHorizontal: GUTTER,
  },
  banner: {
    width: '100%',
    height: BANNER_HEIGHT,
    // `.best-deals-collage_left_image_container img { border-radius: 10px }`
    // at the mobile breakpoint.
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The gutter is absorbed by each cell's padding rather than by a gap, so
    // percentage widths still add to 100%. See the note on `cell`.
    marginHorizontal: -GAP / 2,
  },
  cell: {
    paddingHorizontal: GAP / 2,
    // `row-gap: 22px` in the theme; as bottom padding here so the last row
    // does not add a trailing gap the section's own margin already provides.
    paddingBottom: GAP,
  },
  tile: {
    width: '100%',
    height: TILE_HEIGHT,
    // `.best-deals-collage_right_image_container img { border-radius: 4.26px }`
    // -- the theme's own figure, and an odd one; kept rather than rounded, so
    // it agrees with the site rather than with a tidier number.
    borderRadius: 4.26,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  bannerPlaceholder: {
    width: '100%',
    height: BANNER_HEIGHT,
    borderRadius: 10,
    marginBottom: 16,
  },
  tilePlaceholder: {
    width: '100%',
    height: TILE_HEIGHT,
    borderRadius: 4.26,
  },
});

export default BestDeals;
