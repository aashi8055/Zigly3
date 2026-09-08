/**
 * "Explore. Pick. Pamper." — four tabs, each a rail of category tiles.
 *
 * Section seven. The tiles, their labels and their destinations are all in
 * ./explore, read from the theme; this draws them and resolves their artwork.
 *
 * ARTWORK COMES FROM TWO PAGES, WHICH IS WHY THE FETCH IS UNUSUAL. The dog
 * tiles' images are in the dog page's rendering of this section and the cat
 * tiles' in the cat page's, so both are asked for and the two results merge
 * into one store. ./tileIcons' `saveIcons` merges rather than replacing, which
 * is exactly what this needs: whichever page answers first fills its half, the
 * other fills the rest, and a launch where only one answers still draws half
 * the pictures and every label.
 *
 * All 32 tiles are declared to both rails, deliberately. A rail is told the
 * whole tile list and matches whatever the fetched section happens to contain,
 * so neither fetch needs to know which tiles are "its own" -- the filenames
 * decide. That also means the two can be merged without either overwriting the
 * other's entries.
 *
 * THE TABS ARE NOT LAZY HERE, unlike ./ProductRail's. There is nothing to
 * fetch per tab: every tile is already in hand and only the pictures are
 * learned, in one pass for the whole section. So all four tabs are drawn and
 * switching between them is instant with no request at all.
 */
import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  EXPLORE_CAT_RAIL,
  EXPLORE_DOG_RAIL,
  EXPLORE_TABS,
  EXPLORE_TITLE,
} from './explore';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import TileRow from './TileRow';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

type Props = {
  onOpen: (path: string) => void;
};

const EMPTY_ICONS: IconMap = {};

const ExploreSection = ({onOpen}: Props) => {
  const [active, setActive] = useState(0);

  /**
   * Both pages' artwork, merged into one map.
   *
   * One `useSectionData` rather than two, because the section is one thing to
   * the customer: two would each have their own retry clock and the rail would
   * fill in two visible steps. `Promise.all` on both fetches, merged, is one
   * settle for the whole section.
   */
  const {data: icons} = useSectionData<IconMap>({
    load: () => loadIcons(EXPLORE_DOG_RAIL),
    fetcher: async signal => {
      const [dog, cat] = await Promise.all([
        fetchIcons(EXPLORE_DOG_RAIL as TileRail, signal),
        fetchIcons(EXPLORE_CAT_RAIL as TileRail, signal),
      ]);
      return {...dog, ...cat};
    },
    // Both rails share `storeKey`, so either handle saves to the same map.
    save: learned => saveIcons(EXPLORE_DOG_RAIL as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const tabs = useMemo(() => EXPLORE_TABS, []);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{EXPLORE_TITLE}</Text>

      <View style={styles.tabs}>
        {tabs.map((tab, index) => (
          <Text
            key={tab.label}
            onPress={() => setActive(index)}
            numberOfLines={1}
            accessibilityRole="tab"
            accessibilityState={{selected: index === active}}
            style={[styles.tab, index === active && styles.tabActive]}
          >
            {tab.label}
          </Text>
        ))}
      </View>

      {/*
        Only the selected tab is drawn. Unlike ./ProductRail there is nothing to
        preserve by keeping the others mounted -- no fetch to avoid repeating
        and no scroll position worth more than the memory of three extra rails.
      */}
      <TileRow
        tiles={tabs[active].tiles}
        icons={icons}
        onOpen={onOpen}
        // Wider than a category circle: these are category photographs with
        // two-word labels, not icons on a disc.
        variant="square"
      />
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
  tabs: {
    flexDirection: 'row',
    // Four tabs including "Smart Petcare" will not fit one line on a narrow
    // phone, so they wrap rather than scroll: a wrapped second line is
    // readable, while a horizontally scrolling tab strip hides tabs behind an
    // edge with nothing to say they are there.
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  tab: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.navy,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.navy,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: COLORS.navy,
    color: COLORS.white,
  },
});

export default ExploreSection;
