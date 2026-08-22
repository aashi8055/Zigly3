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
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
   * True once the page has been scrolled away from the top. The bar itself
   * stays pinned; only the search band collapses, matching the brief that the
   * hamburger, logo and cart remain static while search scrolls away.
   */
  searchCollapsed: boolean;
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
  showBack,
  showWishlist,
  showCartIcon,
  searchPlaceholders,
  searchTypeMs = TYPE_MS,
}: Props) => {
  /**
   * Height rather than translate: the band must give its space back so the page
   * moves up behind it, not merely slide out of sight leaving a gap. Height is
   * not a native-driver property, but this is one small view animating only on
   * a scroll-direction change, not per frame.
   */
  const bandHeight = useRef(new Animated.Value(SEARCH_BAND_H)).current;
  const bandOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bandHeight, {
        toValue: searchCollapsed ? 0 : SEARCH_BAND_H,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      // Fades slightly ahead of the height so the field's border cannot show
      // as a sliver while the last few pixels close.
      Animated.timing(bandOpacity, {
        toValue: searchCollapsed ? 0 : 1,
        duration: searchCollapsed ? 120 : 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [searchCollapsed, bandHeight, bandOpacity]);

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
          <Text style={styles.logoWord}>zigly</Text>
          <View style={styles.logoPill}>
            <Text style={styles.logoPillText}>Pet Care</Text>
          </View>
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
        <Animated.View
          style={[
            styles.searchBand,
            { height: bandHeight, opacity: bandOpacity },
          ]}
          pointerEvents={searchCollapsed ? 'none' : 'auto'}
        >
          <View style={styles.searchBandInner}>
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
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};

const BAR_H = 52;
/** Search band height: field plus its padding. */
const SEARCH_BAND_H = 64;

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
  logoWord: {
    fontFamily: FONT_FAMILY,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.9,
    color: COLORS.navy,
  },
  logoPill: {
    backgroundColor: COLORS.red,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  logoPillText: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '700',
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

  // Pale blue band, matching the reference app.
  searchBand: {
    backgroundColor: '#BFD3EE',
    // No padding here: on the animated view it outlives height 0 and lets the
    // field's border show as a sliver. It belongs on the inner view.
    overflow: 'hidden',
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

export default NativeHeader;
