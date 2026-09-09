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
import {ScrollView, StyleSheet, Text, View} from 'react-native';
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
   * Keep the tab row on ONE LINE and let it scroll sideways.
   *
   * Explore's four tabs include "Smart Petcare" and will not fit a narrow
   * phone. This was `wrapTabs`, which broke them onto a second line, and the
   * note here used to argue against scrolling on the grounds that it "hides
   * tabs behind an edge with nothing to say they are there".
   *
   * The wrap is the worse of the two in practice, which is why it is gone. Two
   * lines of pills stop reading as a tab strip at all -- they read as a block
   * of chips above the rail, and the second line lands directly on the tiles
   * with no boundary of its own. A partly-visible fourth pill at the right
   * edge is the standard, understood signal that a strip continues, and it is
   * what the app already does with every rail on the dashboard.
   *
   * Off by default: "Everything For Your Pet" has two short labels that fit
   * with room to spare, and a scroller for content that fits only adds a
   * bounce.
   */
  scrollTabs?: boolean;
  /**
   * Which edge the heading and the tab strip sit against.
   *
   * `center` by default, which is how both sections read when this component
   * was written -- a heading over a row of pills, centred as a unit. Explore
   * asks for `left`, which also puts it in line with every other section
   * heading in the dashboard: the rails, the product sections and the tile
   * rows all range their headings left at the same gutter, so a centred one
   * was the odd section out. Left-aligned, the heading sits directly above the
   * first tile of the rail beneath it.
   */
  align?: 'center' | 'left';
  /**
   * The screen's width. Required by the width-derived tile variants (`wide`,
   * `breed`) and ignored by the fixed ones. See ./TileRow.
   */
  width?: number;
  onOpen: (path: string) => void;
};

const EMPTY_ICONS: IconMap = {};

const TabbedTileSection = ({
  title,
  tabs,
  rails,
  variant = 'square',
  scrollTabs = false,
  align = 'center',
  width,
  onOpen,
}: Props) => {
  const left = align === 'left';
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
      <Text style={[styles.title, left && styles.titleLeft]}>{title}</Text>

      {/* One tab is a label that states nothing; the heading already says it. */}
      {tabs.length > 1 ? (
        <TabStrip scroll={scrollTabs} left={left}>
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
        </TabStrip>
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
        width={width}
      />
    </View>
  );
};

/**
 * The tab row: one scrolling line, or a centred static row.
 *
 * Two containers rather than one with conditional styles, because the padding
 * has to go in a different place in each. A `ScrollView` keeps the gutter on
 * its CONTENT container -- a scroll container's own start padding is scrolled
 * away and older Android drops the end padding, the defect the coupon strip
 * hit -- while a plain View takes it directly. Sharing one style object across
 * both would put the gutter on whichever of the two is wrong.
 *
 * `numberOfLines={1}` on the pills is what makes the scrolling case correct:
 * inside a horizontal scroller the row is unbounded, so a long label sets the
 * pill's width instead of being squeezed and truncated.
 */
const TabStrip = ({
  scroll,
  left,
  children,
}: {
  scroll: boolean;
  left: boolean;
  children: React.ReactNode;
}) =>
  scroll ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /*
       * No rubber-band when the pills already fit. Explore's four do not on a
       * narrow phone and do on a wide one, so this is the same component
       * behaving correctly at both sizes rather than a guess about either.
       */
      alwaysBounceHorizontal={false}
      contentContainerStyle={[styles.tabs, styles.tabsScroll]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.tabs, left && styles.tabsLeft]}>{children}</View>
  );

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
  },
  /**
   * The section heading, centred over its tabs.
   *
   * 20 rather than a plain rail's 17: both sections that use this component
   * lead with a heading and a row of pills, and that pair reads as a unit
   * centred on the page rather than as a label above a left-aligned rail. The
   * same treatment ./BrandRail gives its own heading, for the same reason.
   */
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: COLORS.ink,
    paddingHorizontal: GUTTER,
    textAlign: 'center',
    marginBottom: 12,
  },
  /** Centred under the heading. Wrapped rows stay centred too. */
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: GUTTER,
    marginBottom: 14,
  },
  /**
   * Ranged left, for the heading and the pills together.
   *
   * The horizontal padding is untouched: GUTTER is the same figure every rail
   * on the dashboard uses, so the heading lands exactly above the first tile
   * of the row beneath it rather than proud of it.
   */
  titleLeft: {
    textAlign: 'left',
  },
  tabsLeft: {
    justifyContent: 'flex-start',
  },
  /**
   * The scrolling strip's own content container.
   *
   * `justifyContent` is overridden back to the start: the base `tabs` centres
   * its children, which inside a horizontal scroller would centre a row that
   * is wider than the screen -- clipping the FIRST pill off the left edge
   * rather than leaving the last one peeking off the right.
   *
   * This replaced `tabsWrap` (`flexWrap: 'wrap'`), which put Explore's four
   * tabs on two lines. See the `scrollTabs` prop for why the wrap was the
   * worse of the two.
   */
  tabsScroll: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  /**
   * A tab pill: red outline, red text, white ground.
   *
   * Navy before. Red is the app's active colour everywhere else -- the card
   * buttons, ./ProductRail's tabs -- and these were the odd pair out. See
   * ./BrandRail, which carries the same pills.
   */
  tab: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
    backgroundColor: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.red,
    // Android paints a Text's background square without this.
    overflow: 'hidden',
  },
  /** The selected tab: filled red, white text. */
  tabActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
    color: COLORS.white,
  },
});

export default TabbedTileSection;
