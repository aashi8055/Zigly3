/**
 * Native app header.
 *
 * Required, not decorative: zigly.com deliberately hides its own header inside
 * a WebView (it checks for the `wv` user-agent token and sets display:none on
 * [data-hide-header-in-app]), because Zigly's app is expected to supply this.
 * Without it the app has no header at all.
 *
 * Every control drives the real website -- nothing here reimplements behaviour:
 *   hamburger -> clicks the site's own menu drawer
 *   logo      -> navigates to the site's homepage
 *   search    -> opens the search screen, which reads Shopify's own
 *                predictive search and hands results to the site's /search
 *   cart      -> opens the site's own cart
 *
 * Icons are drawn with plain Views rather than pulling in an icon library, to
 * avoid a dependency for four glyphs. The wishlist heart and the cart basket are
 * the exceptions -- both are real paths, because neither shape can be built
 * honestly out of stacked Views; see ./glyphs.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONT_FAMILY } from '../constants/appConstants';
import {
  FIRST_FRAME,
  frameDelay,
  frameText,
  nextFrame,
  TYPE_MS,
  type TypeFrame,
} from '../search/placeholders';
import { BasketIcon, HeartOutline } from './glyphs';

interface Props {
  onMenuPress: () => void;
  /** Back navigation, used in place of the menu on inner pages. */
  onBackPress: () => void;
  /** Opens the site's own wishlist page. */
  onWishlistPress: () => void;
  onCartPress: () => void;
  onLogoPress: () => void;
  /** Opens the search screen. The bar itself no longer accepts typing. */
  onSearchPress: () => void;
  /** Item count read from the site's own cart bubble; 0 hides the badge. */
  cartCount: number;
  /** Whether the search band is shown beneath the bar. */
  showSearch: boolean;
  /**
   * Wishlist and cart appear on shopping pages only.
   *
   * The reference app's breed and content pages carry just a back arrow and the
   * logo; collection and product pages add the wishlist heart and the cart.
   */
  showWishlist: boolean;
  showCartIcon: boolean;
  /**
   * True once the band has been carried all the way off by the scroll. The bar
   * itself stays pinned; only the search band travels, matching the brief that
   * the hamburger, logo and cart remain static while search scrolls away.
   *
   * This is the *settled* state, not the moving one -- it is what gives the
   * band's layout height back, and what stops the typewriter. The travel
   * itself is `searchOffset` below.
   */
  searchCollapsed: boolean;
  /**
   * How far the band has been carried off, in px, 0..SEARCH_BAND_H.
   *
   * The band is not sticky: it belongs to the page's content and leaves with
   * it. That means its position has to follow the finger continuously rather
   * than flip between two states -- which is what this carries. The parent
   * derives it from the WebView's own scroll (down moves it off, up brings it
   * back from the top, both proportional to the distance travelled), so the
   * band is wherever the scroll has put it on any given frame.
   *
   * An Animated.Value, and only ever read through transform/opacity, so every
   * frame of that travel is composited off the JS thread -- see the effect
   * below for why nothing here is allowed to animate layout.
   */
  searchOffset?: Animated.Value;
  /**
   * Inner pages swap the hamburger for a back arrow, as the reference app does.
   * The menu stays reachable from the home dashboard.
   */
  showBack: boolean;
  /**
   * The prompts the search bar types through, in order.
   *
   * Zigly's own, read off the site's search box at runtime -- see
   * ../search/placeholders.ts. Never empty in practice: it is seeded with
   * Zigly's observed copy, because there is no resting label to fall back to.
   */
  searchPlaceholders: string[];
  /** The site's own per-letter cadence, once it has been measured. */
  searchTypeMs?: number;
}

// The shared outline heart -- Zigly's own path. This used to lay a smaller
// white heart over a black one to hollow it out, which is a stroke only if the
// two are exactly concentric; see ./glyphs.
const WishlistIcon = () => <HeartOutline size={22} color="#1B1B1B" />;

const BackIcon = () => (
  <View style={styles.back}>
    <View style={styles.backChevron} />
    <View style={styles.backShaft} />
  </View>
);

const HamburgerIcon = () => (
  <View style={styles.hamburger}>
    <View style={styles.hamburgerBar} />
    <View style={styles.hamburgerBar} />
    <View style={styles.hamburgerBar} />
  </View>
);

const SearchIcon = () => (
  <View style={styles.searchIcon}>
    <View style={styles.searchLens} />
    <View style={styles.searchHandle} />
  </View>
);

// The shared basket -- a real path. This used to be a rounded rectangle with a
// separate arc floating above it, which is two shapes that never quite met; see
// ./glyphs.
const BagIcon = () => <BasketIcon size={22} color="#1B1B1B" />;

/**
 * The search bar's rotating prompt, typed out a letter at a time.
 *
 * A component of its own, and memoised, for one reason: it changes state ten
 * times a second, and if that state lived on the header then the hamburger, the
 * logo, the badge and the whole animated band would be re-rendered on every
 * letter. Here, a frame re-renders one <Text>.
 *
 * The cycle is a pure function of the previous frame -- see
 * ../search/placeholders.ts -- so all this owns is one timeout, re-armed per
 * frame rather than an interval at a fixed rate: erasing runs at twice the speed
 * of typing and the two holds are ten times slower again, so a single interval
 * would either be wrong or would wake up twenty times for every frame it drew.
 */
interface PromptProps {
  phrases: string[];
  typeMs: number;
  /**
   * False while the band is closed or nothing has been read yet. The timer
   * stops entirely rather than drawing into something nobody can see -- and the
   * band is closed for the whole time the user is scrolling, which is exactly
   * when frames are worth most.
   */
  running: boolean;
}

const SearchPrompt = React.memo(({phrases, typeMs, running}: PromptProps) => {
  const [frame, setFrame] = useState<TypeFrame>(FIRST_FRAME);

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setTimeout(
      () => setFrame(current => nextFrame(current, phrases)),
      frameDelay(frame, typeMs),
    );
    return () => clearTimeout(timer);
  }, [running, frame, phrases, typeMs]);

  /**
   * Only ever the phrase being typed. There is no resting label: the cycle
   * hands from the last erased character straight to the next phrase's first
   * one, so the bar is never empty for longer than a single frame.
   */
  const typed = frameText(frame, phrases);

  return (
    <Text
      // One line, clipped rather than reflowed: the phrases differ in length
      // and a wrap mid-cycle would make the whole header jump.
      style={styles.searchPlaceholder}
      numberOfLines={1}
      // Decorative while it animates -- a screen reader reading a half-typed
      // prompt letter by letter is noise, and the button is already labelled.
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {typed}
    </Text>
  );
});
SearchPrompt.displayName = 'SearchPrompt';

const NativeHeader = ({
  onMenuPress,
  onBackPress,
  onWishlistPress,
  onCartPress,
  onLogoPress,
  onSearchPress,
  cartCount,
  showSearch,
  searchCollapsed,
  searchOffset,
  showBack,
  showWishlist,
  showCartIcon,
  searchPlaceholders,
  searchTypeMs = TYPE_MS,
}: Props) => {
  /**
   * The band's travel, driven by the scroll rather than by a toggle.
   *
   * The band is part of the page's content, not furniture pinned over it: it
   * has to leave with the content on the way down and come back from the top
   * on the way up, at whatever rate the finger moves. So the thing that
   * positions it is the parent's scroll-derived offset, read straight through
   * a transform -- not a timing whose duration is fixed in advance and which
   * would therefore be either ahead of or behind the content it belongs to.
   *
   * `fallback` is what stands in when no offset is supplied (the drawer, the
   * tests, any caller that only knows the boolean). It is driven by the
   * effect below, so those callers still get a smooth transition rather than
   * a jump; when an offset IS supplied it is what the band follows, and the
   * fallback is left alone.
   *
   * Either way what moves is opacity and translateY only. Both are compositor
   * properties under useNativeDriver, so they cost the WebView underneath
   * nothing to run alongside -- which is the whole reason the band's real
   * layout height is never what animates; see bandHeight below.
   */
  const fallback = useRef(
    new Animated.Value(searchCollapsed ? SEARCH_BAND_H : 0),
  ).current;
  const travel = searchOffset ?? fallback;

  /**
   * Off by its own height is fully gone; anything less is partly showing.
   *
   * clamp:true matters -- an overscroll at the top would otherwise drive the
   * offset negative and push the band down past where it belongs, leaving a
   * gap under the bar.
   */
  const bandLift = travel.interpolate({
    inputRange: [0, SEARCH_BAND_H],
    outputRange: [0, -SEARCH_BAND_H],
    extrapolate: 'clamp',
  });
  /*
   * There is deliberately no opacity here.
   *
   * The field used to fade out over the first half of the travel, so that it
   * was gone before the band's top edge met the bar and never read as sliding
   * *under* it. But sliding under the bar is exactly what a section does, and
   * the band is a section: the clipping box above is what hides it, edge by
   * edge, the same way the page's own first section is hidden. Fading as well
   * made it dissolve rather than leave, which is the one thing content never
   * does.
   */

  const [bandHeight, setBandHeight] = useState(
    searchCollapsed ? 0 : SEARCH_BAND_H,
  );
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      // No transition on first paint -- the values above already match
      // whatever searchCollapsed is at mount.
      mounted.current = true;
      return;
    }

    if (searchCollapsed) {
      /*
       * Only the fallback is animated here, and only when the parent is not
       * already positioning the band: with an offset supplied, the scroll has
       * by definition already carried the band off by the time this runs, and
       * a timing on top of it would fight what the finger just did.
       */
      if (!searchOffset) {
        Animated.timing(fallback, {
          toValue: SEARCH_BAND_H,
          duration: BAND_FADE_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start();
      }
      /*
       * The layout still has to give its space back, but on a plain timer
       * rather than the animation's own completion callback: the callback
       * fires when the platform's animation driver reports "finished", which
       * a fast re-toggle (scroll up, then straight back down) can cancel or
       * delay in ways this file has no control over. A timer matched to the
       * same duration is what the app actually wants -- the travel has had
       * its BAND_FADE_MS -- and it is the one thing here a re-toggle can
       * cleanly cancel, via the cleanup below, rather than leaving a stale
       * callback to fire after a later toggle already decided something else.
       */
      const timer = setTimeout(() => setBandHeight(0), BAND_FADE_MS);
      return () => clearTimeout(timer);
    }

    /*
     * Opening is the other order: the band's height comes back first, still
     * translated off by the offset above, and the scroll then walks it down
     * into place. Restoring height only after the travel finished would mean
     * revealing into a band that has no room yet, and the first frames of the
     * reveal would be clipped to nothing.
     */
    setBandHeight(SEARCH_BAND_H);
    if (!searchOffset) {
      Animated.timing(fallback, {
        toValue: 0,
        duration: BAND_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
    return undefined;
    // fallback is a ref to a stable Animated.Value instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCollapsed, searchOffset]);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Pressable
          onPress={showBack ? onBackPress : onMenuPress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={showBack ? 'Go back' : 'Open menu'}
          style={styles.iconButton}
        >
          {showBack ? <BackIcon /> : <HamburgerIcon />}
        </Pressable>

        <Pressable
          onPress={onLogoPress}
          accessibilityRole="button"
          accessibilityLabel="Zigly home"
          style={styles.logoWrap}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Pressable>

        {showWishlist ? (
          <Pressable
            onPress={onWishlistPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Wishlist"
            style={styles.iconButton}
          >
            <WishlistIcon />
          </Pressable>
        ) : null}

        {showCartIcon ? (
          <Pressable
            onPress={onCartPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'
            }
            style={styles.iconButton}
          >
            <BagIcon />
            {cartCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartCount > 99 ? '99+' : String(cartCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          // Keeps the logo optically centred when no trailing icon is shown.
          <View style={styles.iconButton} />
        )}
      </View>

      {showSearch ? (
        /*
         * Height still moves in ONE step -- not animated -- for the reason
         * written up on bandHeight above: interpolating it was eleven Android
         * WebView resizes mid-scroll and a blank strip for the length of the
         * animation.
         *
         * What follows the scroll instead is bandLift, on both the paint and
         * the field below. It is compositor-only and never touches layout, so
         * the band can track the finger frame for frame -- leaving with the
         * content on the way down, coming back from the top on the way up --
         * while the one relayout this was written to bound still happens
         * exactly once per settled toggle, at either end of the travel and
         * never during it.
         */
        <View
          style={[styles.searchBand, { height: bandHeight }]}
          pointerEvents={searchCollapsed ? 'none' : 'auto'}
        >
          {/*
            The blue rides with the field, rather than being painted on the box
            that owns the height.

            It used to sit on the clipping View above, whose only moving
            property is that one-step `bandHeight` -- so the field slid off
            smoothly under the finger while its own background stayed put and
            then vanished in a single frame when the scroll settled. Here the
            paint is a layer of its own, lifted by the same `bandLift` as the
            field, so the two leave together; the height snap behind them then
            happens on a box that is already empty and offscreen.

            Filling the box absolutely rather than wrapping the field keeps
            the band's height coming from searchBandInner exactly as before,
            and -SEARCH_BAND_H of `bottom` gives the paint a second band's
            worth of body below itself, so an overscroll bounce at the top
            never exposes bare ground beneath it.
          */}
          <Animated.View
            style={[
              styles.searchBandPaint,
              { transform: [{ translateY: bandLift }] },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.searchBandInner,
              { transform: [{ translateY: bandLift }] },
            ]}
          >
            {/*
              A button, not a field. Typing here used to submit straight to the
              site's search page, so nothing happened until enter and there was
              no room for suggestions. The real input lives on the search
              screen, which opens from this.
            */}
            <Pressable
              onPress={onSearchPress}
              accessibilityRole="search"
              accessibilityLabel="Search Zigly"
              style={styles.searchField}
            >
              <SearchIcon />
              <SearchPrompt
                phrases={searchPlaceholders}
                typeMs={searchTypeMs}
                running={!searchCollapsed && searchPlaceholders.length > 0}
              />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
};

const BAR_H = 52;
/** Search band height: field plus its padding. */
const SEARCH_BAND_H = 64;
/** How long the band's own fade-and-lift runs; see the effect above. */
const BAND_FADE_MS = 160;
/**
 * The wordmark, at the size the bar can actually hold.
 *
 * ../assets/logo.png is the tight lock-up -- 493x124, so 3.976:1 -- and it is
 * deliberately the file with no @2x/@3x siblings. The header used to require
 * zigly-logo.png, which does have them, and every one of those is the square
 * 216/324/432px launcher icon: React Native resolves an asset by density, so on
 * a real phone the header was drawing the padded square, not the wordmark. That
 * padding is why the logo read small inside its 90x70 box no matter what the
 * box was set to.
 *
 * 40dp tall keeps 6dp of air top and bottom inside the 52dp bar, and 159dp is
 * the width the ratio gives at that height.
 */
const LOGO_H = 40;
const LOGO_W = Math.round(LOGO_H * (493 / 124));

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.ground },

  bar: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: COLORS.ground,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hamburger: { width: 22, height: 15, justifyContent: 'space-between' },

  // Arrow drawn from two Views: a rotated chevron plus a shaft.
  back: { width: 22, height: 18, justifyContent: 'center' },
  backChevron: {
    position: 'absolute',
    left: 1,
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#1B1B1B',
    transform: [{ rotate: '45deg' }],
  },
  backShaft: {
    position: 'absolute',
    left: 2,
    right: 1,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#1B1B1B',
  },
  hamburgerBar: { height: 2, borderRadius: 2, backgroundColor: '#1B1B1B' },

  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // Takes the slack so the logo stays centred as icons come and go.
    flex: 1,
    justifyContent: 'center',
  },
  logoImage: {
    /*
     * Width is a ceiling, not a size.
     *
     * logoWrap takes the slack between the icons, so '100%' is exactly the
     * room the wordmark has -- which on a 320dp phone showing hamburger,
     * wishlist and cart is under LOGO_W. Capping rather than fixing the width
     * lets it give way there instead of pushing the cart off the bar, and
     * resizeMode="contain" keeps the 493:124 ratio either way.
     */
    width: '100%',
    maxWidth: LOGO_W,
    height: LOGO_H,
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },

  // The band's clipping box. It owns the height and nothing else: the pale
  // blue itself is searchBandPaint below, so that the colour travels with the
  // field instead of disappearing with the height.
  searchBand: {
    // No padding here: on the animated view it outlives height 0 and lets the
    // field's border show as a sliver. It belongs on the inner view.
    overflow: 'hidden',
  },
  // Pale blue band, matching the reference app.
  searchBandPaint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // Extra body below, so a bounce at the top of the page shows more blue
    // rather than the ground behind it.
    bottom: -SEARCH_BAND_H,
    backgroundColor: '#BFD3EE',
  },
  searchBandInner: { paddingHorizontal: 14, paddingVertical: 10 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1B1B1B',
    paddingHorizontal: 12,
    height: 44,
  },
  searchPlaceholder: {
    fontFamily: FONT_FAMILY,
    flex: 1,
    fontSize: 15,
    color: '#8C97A8',
  },

  searchIcon: { width: 18, height: 18 },
  searchLens: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: '#5A6472',
  },
  searchHandle: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 6,
    height: 1.8,
    backgroundColor: '#5A6472',
    transform: [{ rotate: '45deg' }],
  },
});

/**
 * Memoised: the parent screen carries dozens of state values unrelated to the
 * header (cart contents, account data, page stack...), and every one of them
 * used to re-render this too. All of that churn was landing on the same frame
 * as the WebView's own scroll compositing, which is what made scrolling feel
 * uneven even though the header itself was not changing.
 */
export default memo(NativeHeader);
