/**
 * The dashboard, drawn natively — all twenty-three sections, in order.
 *
 * This is the switch-over. Every section in ./dashboardSections has a case
 * below, and the order is that file's rather than this one's: the list is the
 * single source of truth for the running order and
 * ../../__tests__/dashboardSections.test.ts checks it against the web modules
 * that produce it today.
 *
 * ONE SCROLLER, NOT A FlatList. Twenty-three sections of which most are
 * themselves horizontal rails; a FlatList's virtualisation would unmount rails
 * as they leave the viewport and lose their scroll offsets, and the sections
 * are cheap enough that there is nothing to reclaim. `removeClippedSubviews`
 * on Android does the useful half of the same job without the unmounting.
 *
 * THE WEBVIEW STAYS MOUNTED BEHIND THIS, and that is the point of the whole
 * design rather than a transitional compromise. It is the app's session: the
 * cart cookie, the wishlist, the search suggestions and every `/cart/add.js`
 * post live in that jar (DATA-SOURCES.md §7, and ../webview/cartBridge). A
 * native Add to Bag reports its variant id up and the screen runs the bridge
 * inside the WebView, so the line lands in the same cart the customer is
 * shopping. Unmounting the WebView would give the dashboard a second, empty
 * session — the exact failure DATA-SOURCES.md §7 opens with.
 *
 * WHAT THIS DOES NOT DRAW. Not the header, not the bottom bar and not the
 * search band. The first two are already native and already drawn above and
 * below every layer by ../screens/ZiglyWebViewScreen. The band is different and
 * worth stating: it is a section of the *page*
 * (../webview/searchBandSection), injected into the WebView, because three
 * native attempts at it failed. With the WebView no longer visible on the
 * dashboard there is nothing to inject it into, so the screen draws the native
 * band above this list — see `NativeHeader`'s `showSearch`, which exists for
 * exactly this and whose comment says turning it on is a one-word change.
 */
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {COLORS} from '../constants/appConstants';
import {warn} from '../utils/logger';
import {DASHBOARD_SECTIONS} from './dashboardSections';
import TileRailView from './TileRailView';
import BannerCarousel from './BannerCarousel';
import CouponStrip from './CouponStrip';
import {CAT_BREED_RAIL, CAT_BREED_TITLE, DOG_BREED_RAIL, DOG_BREED_TITLE} from './breeds';
import {CATEGORY_RAIL} from './categoryIcons';
import HotPicks from './HotPicks';
import ExploreSection from './ExploreSection';
import OfferRail from './OfferRail';
import {APPLOD_FOOD, APPLOD_TREATS, STYLE_STEALS} from './offerRails';
import BestDeals from './BestDeals';
import BrandRail from './BrandRail';
import PriceTiles from './PriceTiles';
import SingleBanner from './SingleBanner';
import {GIFT_CARD_BANNER, LOGOS_BANNER, PAWTY_BANNER, VET_CARE_BANNER} from './singleBanners';
import ConcernRail from './ConcernRail';
import Bestsellers from './Bestsellers';
import EverythingSection from './EverythingSection';
import TipsRail from './TipsRail';
import VideoBlock from './VideoBlock';
import CommunityCards from './CommunityCards';
import InstagramRail from './InstagramRail';

export type DashboardHandlers = {
  /**
   * Open a storefront path, or an absolute URL.
   *
   * The screen decides what that means -- a page layer for a storefront path,
   * a hand-off to the browser or the Instagram app for an external host. Three
   * sections pass absolute URLs on purpose: Zigly Coins (internal host, kept
   * in-app), the two community partners and Instagram (external).
   */
  onOpen: (target: string) => void;
  /**
   * Add one variant to the bag.
   *
   * Only ever called with a variant id for a single-variant product; a product
   * with choices routes to `onOpen` instead. The screen runs
   * ../webview/cartBridge inside the WebView -- see the note at the top on why
   * this cannot be a native fetch.
   */
  onAdd: (variantId: number) => void;
  /**
   * Play the promotional video, if the app can.
   *
   * Optional, and omitted today: React Native has no `<Video>` and no media
   * package is installed. ./VideoBlock draws the poster, the heading and the
   * copy -- which is the section's resting state on the site too -- and shows
   * no play glyph while this is undefined, because a play button that does
   * nothing is worse than none.
   */
  onPlayVideo?: () => void;
  /** Called once the first screenful has laid out. See the note below. */
  onPainted?: () => void;
};

/**
 * Draw one section by its manifest key.
 *
 * A switch rather than a lookup table, so a key added to ./dashboardSections
 * without a component here is a TypeScript error at the `never` below rather
 * than a section that silently does not appear.
 */
const renderSection = (
  key: string,
  handlers: DashboardHandlers,
  width: number,
): React.ReactNode => {
  const {onOpen, onAdd, onPlayVideo} = handlers;

  switch (key) {
    case 'categories':
      // No heading: the reference app runs the circles straight under the
      // search band, and injectedStyles hides the section's own title.
      return <TileRailView rail={CATEGORY_RAIL} onOpen={onOpen} />;
    case 'banner':
      return <BannerCarousel onOpen={onOpen} />;
    case 'coupons':
      return <CouponStrip />;
    case 'breeds-dogs':
      return (
        <TileRailView
          rail={DOG_BREED_RAIL}
          title={DOG_BREED_TITLE}
          onOpen={onOpen}
        />
      );
    case 'breeds-cats':
      return (
        <TileRailView
          rail={CAT_BREED_RAIL}
          title={CAT_BREED_TITLE}
          onOpen={onOpen}
        />
      );
    case 'hot-picks':
      return <HotPicks onOpen={onOpen} onAdd={onAdd} />;
    case 'explore':
      return <ExploreSection onOpen={onOpen} />;
    case 'offers-food':
      return <OfferRail rail={APPLOD_FOOD} onOpen={onOpen} />;
    case 'offers-treats':
      return <OfferRail rail={APPLOD_TREATS} onOpen={onOpen} />;
    case 'coins':
      return <BestDeals onOpen={onOpen} />;
    case 'brands':
      return <BrandRail onOpen={onOpen} />;
    case 'price-tiles':
      return <PriceTiles onOpen={onOpen} />;
    case 'vet-banner':
      return <SingleBanner banner={VET_CARE_BANNER} onOpen={onOpen} />;
    case 'concern':
      return <ConcernRail onOpen={onOpen} />;
    case 'offers-style':
      return <OfferRail rail={STYLE_STEALS} onOpen={onOpen} />;
    case 'bestsellers':
      return <Bestsellers onOpen={onOpen} onAdd={onAdd} />;
    case 'everything':
      return <EverythingSection onOpen={onOpen} />;
    case 'double-banner':
      /*
       * One manifest entry, two banners. The theme carries both halves in one
       * section and stacks them below 749px, so the dashboard order lists them
       * as one block -- see ./singleBanners.
       */
      return (
        <>
          <SingleBanner banner={PAWTY_BANNER} onOpen={onOpen} />
          <SingleBanner banner={GIFT_CARD_BANNER} onOpen={onOpen} />
        </>
      );
    case 'tips':
      return <TipsRail onOpen={onOpen} />;
    case 'video':
      return <VideoBlock onPlay={onPlayVideo} />;
    case 'community':
      return <CommunityCards onOpen={onOpen} />;
    case 'instagram':
      return <InstagramRail onOpen={onOpen} railWidth={width} />;
    case 'logos':
      return <SingleBanner banner={LOGOS_BANNER} onOpen={onOpen} />;
    default:
      /*
       * A manifest key with no component here.
       *
       * The manifest is the running order, so a section marked `native` there
       * and missing here is a hole in the dashboard that draws as nothing --
       * and nothing about the page would say so. Logged rather than ignored,
       * because this is the one failure in the switch-over that leaves no
       * trace: every other section at least holds a skeleton.
       */
      warn('dashboard: no component for section', key);
      return null;
  }
};

type Props = DashboardHandlers & {
  /** The screen's width, for the sections that size against it. */
  width: number;
};

const NativeDashboard = ({width, ...handlers}: Props) => (
  <ScrollView
    style={styles.root}
    contentContainerStyle={styles.content}
    showsVerticalScrollIndicator={false}
    /*
     * Android only, and the useful half of virtualisation: offscreen subviews
     * stop being drawn without being unmounted, so a rail keeps its scroll
     * offset and its loaded images while costing nothing to composite.
     */
    removeClippedSubviews
    /*
     * The first screenful has laid out. The screen uses this to retire the
     * dashboard's cover -- see `homePainted` in ../screens/ZiglyWebViewScreen,
     * which is what the WebView's ready signal drives today.
     */
    onLayout={handlers.onPainted ? () => handlers.onPainted?.() : undefined}
  >
    {DASHBOARD_SECTIONS.filter(section => section.native).map(section => (
      <View key={section.key}>
        {renderSection(section.key, handlers, width)}
      </View>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The app's page ground -- the same white the store paints, so a section
    // that has not filled leaves no visible seam. See COLORS.ground.
    backgroundColor: COLORS.ground,
  },
  content: {
    // Room at the foot for the bottom bar, which is drawn over this.
    paddingBottom: 24,
  },
});

export default NativeDashboard;
