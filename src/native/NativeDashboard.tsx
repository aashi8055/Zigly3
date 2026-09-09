/**
 * The dashboard, drawn natively — twenty-two sections, in order.
 *
 * This is the switch-over. Every section in ./dashboardSections has a case
 * below, and the order is that file's rather than this one's: the list is the
 * single source of truth for the running order and
 * ../../__tests__/dashboardSections.test.ts checks it against the web modules
 * that produce it today.
 *
 * TWENTY-TWO OF TWENTY-THREE. All twenty-three have a case here, but the list
 * is filtered on the manifest's `native` flag and the video block's is false:
 * React Native cannot play the video, so the section drew a still photograph
 * that filled most of a screen and did nothing when tapped. Its entry in
 * ./dashboardSections carries the reasoning, and nothing about it is deleted --
 * flipping the flag restores the section.
 *
 * ONE SCROLLER, NOT A FlatList. Twenty-two sections of which most are
 * themselves horizontal rails; a FlatList's virtualisation would unmount rails
 * as they leave the viewport and lose their scroll offsets, and the sections
 * are cheap enough that there is nothing to reclaim.
 *
 * `removeClippedSubviews` on Android does the useful half of the same job
 * without the unmounting, and it is what keeps this list smooth. It requires
 * every section to be shorter than the viewport -- Android will not re-attach
 * the children that follow an over-tall one -- which is a constraint on the
 * sections, not a reason to give the prop up. See the note on it below.
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
 * WHAT THIS DOES NOT DRAW. Not the header and not the bottom bar: both are
 * native already and drawn above and below every layer by
 * ../screens/ZiglyWebViewScreen.
 *
 * IT DOES DRAW THE SEARCH BAND NOW, as its first section — see `searchBand`.
 * On every other page the band is a section of the *page*
 * (../webview/searchBandSection), injected into the WebView, because three
 * native attempts at it failed. With the WebView no longer visible on the
 * dashboard there is nothing to inject it into, so the band is drawn natively
 * here. It was drawn by `NativeHeader` above this list until it turned out
 * that a band pinned outside the scroller has to reserve layout height it
 * cannot paint, and leaves a white panel under the bar once it travels off.
 * Inside the list it simply scrolls, like the page's own band does.
 */
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
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

/**
 * How often a scroll reports itself, in ms.
 *
 * 250, not 16. At 16 Android fires a scroll event every frame, and the only
 * consumer left is the `bandGone` threshold that stops the search band's
 * typewriter -- so sixty JS callbacks a second were being spent to notice one
 * transition. The band used to be translated from that value frame by frame,
 * which justified the rate; it is a section of this list now and moves on its
 * own.
 *
 * Deliberately not 0. Zero means "only when the scroll settles" on Android,
 * and a customer who scrolls once and holds still would keep a typewriter
 * running in a band that is already off screen.
 */
const SCROLL_SETTLE_MS = 250;

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
  /**
   * Told when the list has scrolled, at a settled cadence rather than per
   * frame.
   *
   * The screen uses it for one thing: to notice that the search band has gone
   * off the top, so its typewriter can stop. See `SCROLL_SETTLE_MS` on the
   * prop below for why this is no longer an `Animated.Value` written every
   * frame.
   */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * DEAD, AND KEPT ONLY AS A NOTE. Was: where the band's travel was written.
   *
   * THE BAND IS CONTENT, NOT FURNITURE, which is the whole reason this existed.
   * ../components/NativeHeader draws the band beneath a pinned bar and has
   * always been able to carry it off with the scroll -- its `searchOffset` prop
   * and the `bandLift` interpolation were written for exactly that -- but
   * nothing ever drove the value, so the band sat fixed above a list that
   * scrolled underneath it. The dashboard's own scroll is the only thing that
   * knows how far the content has moved, so the offset is written from here.
   *
   * An `Animated.Value` written by a native-driver `onScroll` rather than a
   * `useState` number: the band tracks the finger frame for frame, and routing
   * that through JS state would re-render this entire list on every scroll
   * event. Written on the UI thread, read by a transform on the UI thread, so
   * no frame of the travel touches JS at all.
   *
   * All of which is now moot: the band is this list's first section
   * (`searchBand`), so it leaves the screen with the content and there is
   * nothing to translate. The per-frame value was pure cost after that move --
   * a native scroll event plus a JS listener every 16ms to find one threshold
   * -- and removing it is what took the scrolling back to where it was.
   */
  searchOffset?: never;
  /**
   * The search band, drawn as this list's FIRST SECTION.
   *
   * The final step of "the band is content, not furniture" above. With
   * `searchOffset` the band was still furniture that had been taught to move:
   * it lived in the header, reserved SEARCH_BAND_H of layout height there, and
   * a transform carried it off that slot. The slot is unpainted, so once the
   * field had gone what was left was a white panel pinned under the bar --
   * exactly the height and position of the search field. See the note on
   * `SearchBandSection` in ../components/NativeHeader for the two repairs that
   * each re-introduced a different defect.
   *
   * A section of the page needs neither the slot nor the travel: it leaves the
   * screen because the content above it does. So the screen passes the band in
   * here and stops asking the header to draw one.
   *
   * Optional, and only the dashboard supplies it -- every other page still has
   * the band injected into the WebView by ../webview/searchBandSection.
   */
  searchBand?: React.ReactNode;
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
    /*
     * Both breed rails draw the `breed` tile: a disc sized against the screen
     * so three and a bit are visible, rather than the 60dp category circle.
     * They are pictures of animals and the whole point of the rail is telling
     * one breed from another, which a thumbnail cannot do. See ./TileRow.
     */
    case 'breeds-dogs':
      return (
        <TileRailView
          rail={DOG_BREED_RAIL}
          title={DOG_BREED_TITLE}
          onOpen={onOpen}
          variant="breed"
          width={width}
        />
      );
    case 'breeds-cats':
      return (
        <TileRailView
          rail={CAT_BREED_RAIL}
          title={CAT_BREED_TITLE}
          onOpen={onOpen}
          variant="breed"
          width={width}
        />
      );
    case 'hot-picks':
      return <HotPicks onOpen={onOpen} onAdd={onAdd} />;
    case 'explore':
      // `width` drives the tile size: Explore's are photographs of a category
      // and are sized so two and a quarter fill the row. See ./TileRow.
      return <ExploreSection onOpen={onOpen} width={width} />;
    /*
     * The offer rails size their tiles against the screen too -- 1.8 on a row.
     * Their artwork carries baked-in copy, which was unreadable at the old
     * fixed 132dp. See ./OfferRail.
     */
    case 'offers-food':
      return <OfferRail rail={APPLOD_FOOD} onOpen={onOpen} width={width} />;
    case 'offers-treats':
      return <OfferRail rail={APPLOD_TREATS} onOpen={onOpen} width={width} />;
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
      return <OfferRail rail={STYLE_STEALS} onOpen={onOpen} width={width} />;
    case 'bestsellers':
      return <Bestsellers onOpen={onOpen} onAdd={onAdd} />;
    case 'everything':
      return <EverythingSection onOpen={onOpen} width={width} />;
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
      /*
       * NOT DRAWN TODAY, and the case is kept rather than deleted.
       *
       * The manifest marks this section `native: false` -- see its entry in
       * ./dashboardSections for why a video the app cannot play is hidden
       * instead of shown as a still -- and the list below filters on that
       * flag, so this branch is unreachable while it stays false. Keeping the
       * case means flipping the flag back is the whole change; deleting it
       * would make the flag a lie and trip the `never` guard in `default`.
       */
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
     * BACK ON, and the bug it was turned off for is fixed at its cause instead.
     *
     * This is the useful half of virtualisation: offscreen subviews stop being
     * drawn without being unmounted, so a rail keeps its scroll offset and its
     * loaded images while costing nothing to composite. With twenty-two
     * sections, most of them horizontal rails of remote images, that is most
     * of what keeps this list smooth -- turning it off made the whole
     * dashboard scroll visibly worse, which is how it was reported.
     *
     * IT WAS OFF BRIEFLY, and turning it off is what made the scrolling worse.
     * The bug it was turned off for is real: on Android the clipping stops
     * re-attaching the children that follow one taller than the viewport, and
     * the three sections after ./VideoBlock (Real Pets, From Our Instagram,
     * the logo strip) never came back -- so that block's solid navy ground
     * read as a wall ending the page below "Pet Parenting Made Easy".
     *
     * `collapsable={false}` on each section wrapper below is what makes both
     * true at once. It stops Android flattening a section into its parent, so
     * every section keeps a view of its own for the clipping to attach and
     * detach as a unit, and none of them can be folded into a sibling's
     * bounds. That is the actual mechanism behind the missing sections, and
     * fixing it there costs nothing per frame.
     *
     * IT WAS NOT THE WHOLE FIX, and the video block proved it. `collapsable`
     * keeps each section's box real, but the over-tall section itself is still
     * a trigger: a section taller than the viewport stops the ones after it
     * coming back regardless of how many boxes there are. So a section that
     * can outgrow the viewport is marked `tall` in ./dashboardSections and
     * opts out of the clipping individually -- see the wrapper below.
     *
     * The video block was the only one that ever did, and it is hidden now, so
     * no section sets the flag. The mechanism is kept as the documented fix
     * for the next one that does.
     */
    removeClippedSubviews
    /*
     * The first screenful has laid out. The screen uses this to retire the
     * dashboard's cover -- see `homePainted` in ../screens/ZiglyWebViewScreen,
     * which is what the WebView's ready signal drives today.
     */
    onLayout={handlers.onPainted ? () => handlers.onPainted?.() : undefined}
    /*
     * The search band's travel, written straight from the scroll.
     *
     * `useNativeDriver` is the point: the band is positioned by a transform
     * reading this same value, so with the driver on, the whole loop -- scroll
     * event to offset to transform -- stays on the UI thread and this list
     * never re-renders while the band moves. Without it every frame of the
     * travel would be a JS round trip through twenty-three mounted sections.
     *
     * `y` is clamped by the interpolation in ../components/NativeHeader
     * (`extrapolate: 'clamp'`), so an overscroll at the top cannot push the
     * band down past where it belongs -- which is why the raw offset is safe
     * to hand over unprocessed.
     */
    /*
     * ONE EVENT PER SCROLL, NOT ONE PER FRAME -- and that is a consequence of
     * the band becoming a section of this list.
     *
     * It was `scrollEventThrottle={16}`, a native-driver `Animated.event`
     * writing `searchOffset` on every frame, because a band pinned in the
     * header had to be translated to follow the content. Nothing translates
     * now: the band scrolls because the list scrolls, so a per-frame value has
     * nothing left to position.
     *
     * What still wants the offset is `bandGone`, which stops the search
     * band's typewriter once it has scrolled out of sight. That is a single
     * threshold, and a JS listener firing sixty times a second to find it is
     * most of what a per-frame event costs. `16` is dropped so Android
     * reports the settled offset instead -- the throttle is what made this
     * expensive, and the typewriter does not care when it stops to the frame.
     */
    onScroll={handlers.onScroll}
    scrollEventThrottle={SCROLL_SETTLE_MS}
  >
    {/*
      The band, above every section and INSIDE the scroller.

      First child rather than a `stickyHeaderIndices` entry: the point is that
      it scrolls away with the content, which is what removed the white slot it
      used to leave behind in the header.
    */}
    {handlers.searchBand}
    {DASHBOARD_SECTIONS.filter(section => section.native).map(section => (
      /*
       * `collapsable={false}` is load-bearing, not a hint.
       *
       * Android flattens a View that draws nothing of its own into its parent,
       * and these wrappers draw nothing -- they exist to give each section a
       * key and a box. Flattened, a section has no view for
       * `removeClippedSubviews` to attach and detach on its own, which is how
       * the sections after the tall video block ended up clipped away and
       * never restored. Keeping the box real is what lets the clipping be
       * correct and cheap at the same time.
       */
      <View
        key={section.key}
        collapsable={false}
        /*
         * A `tall` section opts out of the clipping, and only that section.
         *
         * `removeClippedSubviews` is inherited down the tree, so setting it
         * false on one wrapper exempts the section inside it while its
         * siblings stay clipped.
         *
         * NOTHING IS MARKED `tall` TODAY. The video block was the only section
         * that ever outgrew the viewport and it is hidden now, so every
         * section the dashboard draws is inside the limit. The wiring stays
         * because the constraint does: it belongs to this scroller, not to
         * that block. See `tall` in ./dashboardSections.
         */
        removeClippedSubviews={section.tall ? false : undefined}
      >
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
    /*
     * NO TOP PADDING -- and that is a consequence of the band moving in here.
     *
     * It was `paddingTop: 14`, for air between the search band and the first
     * row of category circles: the band was drawn by `NativeHeader` above this
     * list and its own padding ended at the field's edge, so without this the
     * circles started hard against the bottom of the search field.
     *
     * The band is now this list's first child (see `searchBand`), so padding
     * here is above the BAND, not below it -- it would open a white gap
     * between the header and the blue, which is a thinner version of the very
     * panel this change removes. The air the circles need is now the band's
     * own bottom padding, which it already had.
     */
    paddingTop: 0,
    // Room at the foot for the bottom bar, which is drawn over this.
    paddingBottom: 24,
  },
});

export default NativeDashboard;
