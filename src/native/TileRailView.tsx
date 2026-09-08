/**
 * A tile rail with its own data: the category circles and both breed rails.
 *
 * Three sections of the dashboard are this component with different data -- a
 * heading (or none), a horizontal run of round artwork with labels, and a whole
 * page behind each tap. The row itself is ./TileRow, shared with
 * ./ExploreSection; what this adds is the heading and the artwork loading.
 *
 * THE LABELS ARE NEVER WAITED FOR, which is the point of the whole approach.
 * `rail.tiles` is the theme's own block list, read at build time, so a rail is
 * complete and tappable on its very first frame with or without a network.
 * Only the pictures are learned -- which is why these sections have no loading
 * state and no skeleton of their own: there is nothing to wait for.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import TileRow from './TileRow';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

type Props = {
  /** The rail's tiles, storage and section. */
  rail: TileRail;
  /**
   * The heading above the rail, or null for none.
   *
   * The category circles have none -- the reference app runs them straight
   * under the search band and ../webview/injectedStyles hides the section's own
   * title. The breed rails have one each, suffixed " - Dogs" and " - Cats"
   * because both source sections are titled "Breed Ready Picks" and the app is
   * the only place they appear together.
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
 * A stable empty map.
 *
 * `{}` written inline would be a new object every render, and `useSectionData`
 * holds it as the initial state -- a fresh identity each time is a needless
 * change of a value the hook compares against.
 */
const EMPTY_ICONS: IconMap = {};

const TileRailView = ({rail, title = null, onOpen}: Props) => {
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
      <TileRow tiles={rail.tiles} icons={icons} onOpen={onOpen} />
    </View>
  );
};

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
    // Aligned with the row's own gutter so the heading sits over the first
    // tile rather than proud of it.
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
});

export default TileRailView;
