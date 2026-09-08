/**
 * A heading, a row of tabs, and a rail of tiles per tab.
 *
 * Two sections are this: "Explore. Pick. Pamper." (four tabs of category tiles)
 * and "Everything For Your Pet" (two tabs, Dogs and Cats). They were written as
 * two components and the second was a copy of the first with different data,
 * which is the drift ../webview/productCard exists to undo on the web side --
 * so it is one component with the differences as props.
 *
 * BOTH SECTIONS SHARE AN UNUSUAL LOADING SHAPE, which is why they can share
 * this at all: their tiles are theme settings held in the app, and only the
 * artwork is learned. So every tab is complete and tappable immediately,
 * switching costs no request, and there is nothing to defer -- unlike
 * ./ProductRail, whose tabs each fetch their own products and therefore load
 * lazily.
 *
 * BOTH ALSO SOURCE ARTWORK FROM TWO PAGES. The dog page's section and the cat
 * page's are fetched together and merged into one store: whichever answers
 * first fills its half, ./tileIcons' `saveIcons` merges rather than replacing,
 * and a launch where only one answers still draws half the pictures and every
 * label. One `useSectionData` for the pair rather than two, so the section
 * settles once instead of filling in two visible steps.
 */
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import TileRow, {type TileVariant} from './TileRow';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type Tile,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/** One tab: a label and the tiles behind it. */
export type TileTab = {
  readonly label: string;
  readonly tiles: readonly Tile[];
};

type Props = {
  title: string;
  tabs: readonly TileTab[];
  /**
   * The rails to resolve artwork from. More than one where a section's tiles
   * come from more than one page; they must share a `storeKey` so the results
   * merge into one map.
   */
  rails: readonly TileRail[];
  /** The tile shape. See ./TileRow. */
  variant?: TileVariant;
  /**
   * Wrap the tab row instead of keeping it on one line.
   *
   * Explore's four tabs include "Smart Petcare" and will not fit a narrow
   * phone; Everything For has two short ones and should not wrap. A
   * horizontally scrolling tab strip is the wrong answer for either -- it
   * hides tabs behind an edge with nothing to say they are there.
   */
  wrapTabs?: boolean;
  onOpen: (path: string) => void;
};

const EMPTY_ICONS: IconMap = {};

const TabbedTileSection = ({
  title,
  tabs,
  rails,
  variant = 'square',
  wrapTabs = false,
  onOpen,
}: Props) => {
  const [active, setActive] = useState(0);

  const {data: icons} = useSectionData<IconMap>({
    // Every rail shares a storeKey, so either handle reads the same map.
    load: () => loadIcons(rails[0]),
    fetcher: async signal => {
      const results = await Promise.all(
        rails.map(rail => fetchIcons(rail, signal)),
      );
      return Object.assign({}, ...results) as IconMap;
    },
    save: learned => saveIcons(rails[0], learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  // A refresh returning fewer tabs must not leave `active` past the end.
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>

      {/* One tab is a label that states nothing; the heading already says it. */}
      {tabs.length > 1 ? (
        <View style={[styles.tabs, wrapTabs && styles.tabsWrap]}>
          {tabs.map((tab, index) => (
            <Text
              key={tab.label}
              onPress={() => setActive(index)}
              numberOfLines={1}
              accessibilityRole="tab"
              accessibilityState={{selected: tab === current}}
              style={[styles.tab, tab === current && styles.tabActive]}
            >
              {tab.label}
            </Text>
          ))}
        </View>
      ) : null}

      {/*
        Only the selected tab is drawn. Unlike ./ProductRail there is nothing to
        preserve by keeping the others mounted -- no fetch to avoid repeating,
        and a tile row's scroll offset is not worth three extra mounted rails.
        Keyed on the tab so switching resets the scroll to the start: arriving
        at "Cats" already scrolled three tiles in would hide the first ones with
        nothing to say they were there.
      */}
      <TileRow
        key={current.label}
        tiles={current.tiles}
        icons={icons}
        onOpen={onOpen}
        variant={variant}
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
    gap: 8,
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  tabsWrap: {
    flexWrap: 'wrap',
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

export default TabbedTileSection;
