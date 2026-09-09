/**
 * A heading, an optional row of tabs, and a sideways run of product cards.
 *
 * The shape most of the dashboard's remaining sections share. Hot Picks has two
 * tabs, "Everything For" has two, Bestsellers has none and the offer rails have
 * none -- but all of them are this: a title, maybe a tab row, and a horizontal
 * rail of ./ProductCard. One component, for the reason ../webview/productCard
 * gives at length about the card itself: the alternative is the same rail
 * written several times, and the copies drift in ways the customer sees.
 *
 * TABS FETCH LAZILY, WHICH IS THE SITE'S OWN BEHAVIOUR TOO. ../webview/hotPicks
 * fetches its second tab on first tap rather than up front, "so the homepage
 * does not pull a second collection nobody may look at". Same here: a tab's
 * products are requested when it is first selected, and kept after that, so
 * switching back is instant and a tab never looked at costs nothing.
 *
 * THE SKELETON IS THE SITE'S SHAPE, NOT A SPINNER.
 * ../components/Skeleton reserves a title bar and three rail cards for exactly
 * this, so a loading rail occupies the height the real one will and the page
 * below does not move when the cards land.
 */
import React, {useCallback, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {RailCardSkeleton, usePulse} from '../components/Skeleton';
import ProductCard, {CARD_WIDTH} from './ProductCard';
import type {Product} from './products';
import {useSectionData} from './useSectionData';

/** The rail's gutter and the gap between cards, matching every other rail. */
const GUTTER = 12;

/** One tab: what it says, and where its products come from. */
export type RailTab = {
  /** The tab label. Zigly's own wording where the site has one. */
  readonly label: string;
  /** Fetch this tab's products. Called once, on first selection. */
  readonly fetcher: (signal: AbortSignal) => Promise<Product[]>;
};

type Props = {
  /** The section heading. */
  title: string;
  /**
   * The tabs. A single-entry list draws no tab row -- a lone tab is a label
   * that states nothing, and the heading above it already says the same thing.
   */
  tabs: readonly RailTab[];
  onOpen: (path: string) => void;
  onAdd: (variantId: number) => void;
};

const EMPTY: Product[] = [];

/**
 * One tab's products, loaded once and kept.
 *
 * A child component rather than a hook call in a loop, because a hook cannot be
 * called conditionally or per-item -- and the whole point is that an unselected
 * tab must not fetch. Mounting this is what starts a tab's load, so a tab that
 * has never been selected has never mounted and has cost nothing.
 *
 * It stays mounted once selected, hidden rather than unmounted, so switching
 * back does not re-fetch and does not lose the rail's scroll position.
 */
const TabContent = ({
  tab,
  visible,
  onOpen,
  onAdd,
}: {
  tab: RailTab;
  visible: boolean;
  onOpen: (path: string) => void;
  onAdd: (variantId: number) => void;
}) => {
  const {data: products, loading} = useSectionData<Product[]>({
    load: noCache,
    fetcher: tab.fetcher,
    save: passthrough,
    isEmpty: list => !list || list.length === 0,
    empty: EMPTY,
  });

  const pulse = usePulse(loading);

  /*
   * `hidden` rather than unmounting, so this tab keeps its products and its
   * scroll offset. `display: none` is the one way to do that in RN without the
   * children still taking part in layout.
   */
  return (
    <View style={visible ? undefined : styles.hidden}>
      {loading ? (
        <View style={styles.track}>
          <RailCardSkeleton pulse={pulse} />
          <RailCardSkeleton pulse={pulse} />
          <RailCardSkeleton pulse={pulse} />
        </View>
      ) : products.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.track}
          snapToInterval={CARD_WIDTH + GUTTER}
          decelerationRate="fast"
          snapToAlignment="start"
          directionalLockEnabled
        >
          {products.map(product => (
            <ProductCard
              key={product.handle}
              product={product}
              onOpen={onOpen}
              onAdd={onAdd}
            />
          ))}
        </ScrollView>
      ) : (
        /*
         * Out of retries with nothing to show. The rail draws nothing at all
         * rather than an empty box: a heading over a blank strip states that
         * something is missing, while one fewer section simply ends the page a
         * block earlier -- the choice ../webview/instagramSection made for the
         * same reason.
         */
        null
      )}
    </View>
  );
};

const ProductRail = ({title, tabs, onOpen, onAdd}: Props) => {
  const [active, setActive] = useState(0);

  /**
   * Which tabs have ever been selected.
   *
   * A tab is mounted only after its first selection and stays mounted
   * afterwards -- that is what makes the lazy fetch lazy and the switch back
   * instant. The first tab is in the set from the start because it is showing.
   */
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));

  const select = useCallback((index: number) => {
    setActive(index);
    setSeen(current => {
      if (current.has(index)) {
        return current;
      }
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }, []);

  /** A lone tab is a label that states nothing; the heading already says it. */
  const showTabs = tabs.length > 1;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>

      {showTabs ? (
        /*
         * The tab row SCROLLS, because the pills grew and the labels are long.
         *
         * It was a plain flex row. At the pill's new size Hot Picks' own two
         * labels -- "Hot Picks of The Week" and "New Arrivals" -- come to more
         * than a 360dp screen holds once the gutters and the gap are counted,
         * and in a fixed row that overflow is spent on the pills themselves:
         * flex shrinks them and `numberOfLines={1}` truncates the label to
         * "Hot Picks of The W...". A tab the customer cannot read is worse
         * than one they have to reach for.
         *
         * `alwaysBounceHorizontal={false}` so a pair that DOES fit -- which is
         * most sections, all of which pass two short labels or one -- does not
         * rubber-band as though something were hidden.
         */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.label}
              label={tab.label}
              selected={index === active}
              onPress={() => select(index)}
            />
          ))}
        </ScrollView>
      ) : null}

      {tabs.map((tab, index) =>
        seen.has(index) ? (
          <TabContent
            key={tab.label}
            tab={tab}
            visible={index === active}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ) : null,
      )}
    </View>
  );
};

/**
 * One tab control.
 *
 * The site draws these as pills in a row, the selected one filled navy -- read
 * from `sections/home-shop-by-breed-section.liquid`, whose
 * `.shop-the-bread-tab-wrapper li.active` is the same treatment. Kept, because
 * a filled pill is the clearest two-state control at this size and it is
 * already the app's own idiom in ../components/SortFilterBar.
 */
const Tab = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Text
    onPress={onPress}
    numberOfLines={1}
    accessibilityRole="tab"
    accessibilityState={{selected}}
    style={[styles.tab, selected && styles.tabActive]}
  >
    {label}
  </Text>
);

/**
 * Product data is never cached to disk.
 *
 * The rule ../webview/sectionIdStore states and this migration has kept
 * throughout: ids and artwork may be persisted, markup and prices may not.
 * A rail painted from yesterday's copy would show a wrong price or a sold-out
 * product as available, which is a correctness bug wearing a performance
 * costume. These two no-ops keep ./useSectionData's contract without a store.
 */
const noCache = (): Promise<Product[]> => Promise.resolve(EMPTY);
const passthrough = (value: Product[]): Promise<Product[]> =>
  Promise.resolve(value);

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
  },
  /**
   * The section heading, at the same 20 the tabbed tile sections use.
   *
   * 17 before, which is the figure a plain rail's heading takes -- a label
   * above a row of cards. This component draws a heading with a row of PILLS
   * under it, and that pair reads as one unit introducing the section rather
   * than as a caption: at 17 over a 20px-tall pill the heading was the
   * quieter of the two. ../native/TabbedTileSection's own note argues 20 for
   * exactly this shape, so the two tabbed sections now agree.
   *
   * Rails with no tab row are unaffected in kind -- Bestsellers and the offer
   * rails pass a single tab and draw no pills -- but they take the same 20, so
   * every section heading on the dashboard is one size.
   */
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: COLORS.ink,
    paddingHorizontal: GUTTER,
    marginBottom: 10,
  },
  /*
   * On the CONTENT container of the scroller above, not on a View. Same reason
   * `track` below carries the rail's padding: a scroll container's own start
   * padding scrolls away and older Android drops the end padding.
   */
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  /**
   * A tab pill: RED outline, red text, white ground -- and bigger.
   *
   * Navy before, at 12.5/600 with a hairline border. Two things were wrong
   * with that pair and both are the same mistake:
   *
   *   - The colour was the odd one out. Red is the app's active colour
   *     everywhere else on the dashboard -- the card buttons, and
   *     ./TabbedTileSection's pills, whose own note records them being moved
   *     off navy for this reason. Hot Picks and New Arrivals were the last
   *     navy pair, so the customer met two different colours for the same
   *     control on one scroll.
   *   - They were too quiet to read as tabs. A hairline border at 12.5 is a
   *     caption with a line round it; the two-state control needs to be
   *     legible as a choice before it is tapped.
   *
   * 13/700 on a full-weight 1px border, matching ./TabbedTileSection exactly,
   * so the dashboard has ONE pill rather than two that nearly agree.
   */
  tab: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
    backgroundColor: COLORS.white,
    // Padding on the Text itself: the tap target is the pill, and a wrapping
    // Pressable would need its own layout to stay the same size.
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.red,
    overflow: 'hidden',
  },
  /** The selected tab: filled red, white text. */
  tabActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
    color: COLORS.white,
  },
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller -- a scroll container's start
    // padding is scrolled away and older Android drops the end padding, which
    // is the defect the coupon strip hit. See ../webview/injectedStyles.
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  hidden: {
    display: 'none',
  },
});

export default ProductRail;
