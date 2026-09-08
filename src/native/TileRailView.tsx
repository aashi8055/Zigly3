/**
 * A rail of round tiles with labels: the category circles and both breed rails.
 *
 * Three sections of the dashboard are the same component with different data --
 * a horizontal run of circular artwork, a label under each, a whole page behind
 * each tap. They were going to be two implementations (the circles first, the
 * breeds after) and that is how the web side ended up with the same rail styled
 * in two places; one component with a heading prop is the same work and cannot
 * drift.
 *
 * DRAWN AS A NATIVE RAIL, NOT AS THE SITE DRAWS IT. The brief is the app's
 * styling in a React Native idiom, so this is a `ScrollView` with real momentum
 * and real overscroll rather than the `overflow-x: auto` box
 * ../webview/injectedStyles has to graft onto a dead Swiper. Two things are
 * still taken from the site deliberately, because they are the rail's identity
 * rather than its implementation: the pale disc (`#e8eef5`, the theme's own
 * `bg_color` for the category section) and the labels and destinations.
 *
 * WHAT THE WEB VERSION HAD TO WORK AROUND AND THIS DOES NOT. On the dashboard
 * these rails are transplanted copies, so their Swiper never initialises, and
 * every tile past the fifth was on the page and unreachable until a
 * native-scroll rule was added -- see the long note in
 * ../webview/injectedStyles. A ScrollView scrolls because it is a ScrollView.
 *
 * THE CATEGORY RAIL'S GEOMETRY IS FIXED BY THE SKELETON. `HomeSkeleton` draws
 * five circles at 18% width, `space-between`, 8px above their labels. If this
 * rail used a different size or pitch the dashboard would visibly jump when the
 * placeholder came off, which is the defect this app treats as unacceptable.
 * `CIRCLE` and the paddings below are chosen so five discs and their gaps fill
 * the width the skeleton claimed.
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
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type Tile,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

/**
 * The disc, and the pitch it sits on.
 *
 * Sized from the skeleton rather than from the theme's 70px: five cells must
 * span the screen the way `HomeSkeleton`'s five 18%-wide cells do, and on a
 * 360dp phone that is a 60dp disc on a 72dp pitch. Fixed dp rather than a
 * percentage because a horizontal ScrollView has no width to take a percentage
 * of -- its content is as wide as its children.
 */
const CIRCLE = 60;
const PITCH = 12;

/** The theme's own `bg_color` for these sections, behind transparent PNGs. */
const DISC = '#e8eef5';

type Props = {
  /** The rail's tiles, storage and section. */
  rail: TileRail;
  /**
   * The heading above the rail, or null for none.
   *
   * The category circles have none -- the reference app runs them straight
   * under the search band and ../webview/injectedStyles hides the section's own
   * title. The breed rails have one each, and they are suffixed " - Dogs" and
   * " - Cats" because both source sections are titled "Breed Ready Picks" and
   * the app is the only place they appear together.
   */
  title?: string | null;
  /**
   * Where a tap goes. A storefront path, handed up rather than navigated here,
   * so this component stays drawable in a test and the screen keeps the single
   * decision about how a path is opened.
   */
  onOpen: (path: string) => void;
};

/**
 * One tile.
 *
 * Artwork that has not resolved falls back to the label's initial on the same
 * disc, so the cell keeps its size, its label and its tap target. That is the
 * degradation ../webview/instagramSection settled on, and the reason the
 * artwork is safe to learn from the network at all: a rail is never missing,
 * only ever unillustrated.
 */
const TileCell = ({
  tile,
  icon,
  onOpen,
}: {
  tile: Tile;
  icon?: string;
  onOpen: (path: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(tile.path)}
    accessibilityRole="link"
    accessibilityLabel={tile.label}
    style={styles.cell}
    // The disc is 60dp but the cell is the target, so the whole column
    // including the label is tappable -- 60dp is the minimum, and the label is
    // the part a thumb aims at.
    hitSlop={4}
  >
    {({pressed}) => (
      <>
        <View style={[styles.disc, pressed && styles.discPressed]}>
          {icon ? (
            <Image
              source={{uri: icon}}
              style={styles.icon}
              // `contain`: these are transparent PNGs of a whole animal or
              // object, and `cover` would crop the subject at the disc's edge.
              resizeMode="contain"
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

const TileRailView = ({rail, title = null, onOpen}: Props) => {
  /**
   * The labels are never waited for.
   *
   * `rail.tiles` is the theme's own block list, read at build time, so the rail
   * is complete and tappable on the very first frame with or without a network.
   * Only the pictures are learned -- which is why these sections have no
   * loading state and no skeleton of their own: there is nothing to wait for.
   */
  const {data: icons} = useSectionData<IconMap>({
    load: () => loadIcons(rail),
    fetcher: signal => fetchIcons(rail, signal),
    save: learned => saveIcons(rail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  return (
    <View style={styles.root}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // The rail is short and the page under it is long, so a horizontal drag
        // that starts a few degrees off should still scroll the rail rather
        // than handing the gesture to the page.
        directionalLockEnabled
      >
        {rail.tiles.map(tile => (
          <TileCell
            key={tile.key}
            tile={tile}
            icon={icons[tile.key]}
            onOpen={onOpen}
          />
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * A stable empty map.
 *
 * `{}` written inline would be a new object every render, and `useSectionData`
 * holds it as the initial state -- a fresh identity each time is a needless
 * change of a value the hook compares against.
 */
const EMPTY_ICONS: IconMap = {};

const styles = StyleSheet.create({
  root: {
    // The section's own vertical rhythm, matching `HomeSkeleton`'s `circles`
    // block so the hand-off does not shift what sits below.
    marginBottom: 18,
  },
  title: {
    fontFamily: FONT_FAMILY,
    // The theme's section titles are 2rem/700 on mobile at #000. 17 here: the
    // rails in this app are narrower than the site's columns and a 20px
    // heading over a 60dp disc reads as louder than the content.
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    // Aligned with the track's own gutter so the heading sits over the first
    // tile rather than proud of it.
    paddingHorizontal: PITCH,
    marginBottom: 12,
  },
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
    width: CIRCLE,
    alignItems: 'center',
    marginRight: PITCH,
  },
  disc: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: DISC,
    alignItems: 'center',
    justifyContent: 'center',
    // Clip the artwork to the disc: several of the theme's images are drawn to
    // the edge of their canvas and would otherwise square off the circle.
    overflow: 'hidden',
    marginBottom: 8,
  },
  /**
   * The press state, and it is on the disc rather than the whole cell.
   *
   * A scale on the cell would move the label, which reads as the row
   * twitching. The web version does this with a `:hover` background swap to
   * the theme's `#183761`, which has no meaning on a touch device -- a brief
   * dim is the native equivalent of the same intent.
   */
  discPressed: {
    opacity: 0.62,
  },
  icon: {
    // Inset from the disc so the artwork has a margin inside the circle, which
    // is how the theme's own 70px wrapper around a 70px image reads once its
    // border is accounted for.
    width: CIRCLE * 0.78,
    height: CIRCLE * 0.78,
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
    // a 60dp disc -- "Labrador Retriever" is the constraint here, and it is
    // why the label is allowed two lines rather than one.
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
    color: '#2B2B2A',
    textAlign: 'center',
  },
});

export default TileRailView;
