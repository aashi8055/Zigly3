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
 *   search    -> submits to the site's real /search endpoint
 *   cart      -> opens the site's own cart
 *
 * Icons are drawn with plain Views rather than pulling in an icon library, to
 * avoid a dependency for four glyphs.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../constants/appConstants';

interface Props {
  onMenuPress: () => void;
  /** Back navigation, used in place of the menu on inner pages. */
  onBackPress: () => void;
  /** Opens the site's own wishlist page. */
  onWishlistPress: () => void;
  onCartPress: () => void;
  onLogoPress: () => void;
  onSearchSubmit: (query: string) => void;
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
}

const HeartShape = ({ size, color }: { size: number; color: string }) => {
  // Proportions tuned so the lobes sit on the square's top edge and its rotated
  // corner forms the point, without either spilling past the box.
  const lobe = size * 0.52;
  const square = size * 0.7;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.02,
          top: size * 0.08,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.02,
          top: size * 0.08,
          width: lobe,
          height: lobe,
          borderRadius: lobe / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - square) / 2,
          top: size * 0.22,
          width: square,
          height: square,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
};

const WishlistIcon = () => (
  <View style={styles.wishlist}>
    <HeartShape size={22} color="#1B1B1B" />
    {/* Inset copy in the bar colour hollows the heart into an outline. The
        4px difference leaves a 2px stroke, matching the bag and back icons;
        the previous 6px gap made it noticeably heavier than the rest. */}
    <View style={styles.wishlistInner}>
      <HeartShape size={18} color={COLORS.white} />
    </View>
  </View>
);

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

const BagIcon = () => (
  <View style={styles.bag}>
    <View style={styles.bagHandle} />
    <View style={styles.bagBody} />
  </View>
);

const NativeHeader = ({
  onMenuPress,
  onBackPress,
  onWishlistPress,
  onCartPress,
  onLogoPress,
  onSearchSubmit,
  cartCount,
  showSearch,
  searchCollapsed,
  showBack,
  showWishlist,
  showCartIcon,
}: Props) => {
  const [query, setQuery] = useState('');

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

  const submit = () => {
    const q = query.trim();
    if (q.length > 0) {
      onSearchSubmit(q);
    }
  };

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
            <View style={styles.searchField}>
              <SearchIcon />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={submit}
                placeholder="Search For"
                placeholderTextColor="#8C97A8"
                returnKeyType="search"
                style={styles.searchInput}
                accessibilityLabel="Search Zigly"
              />
            </View>
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
  root: { backgroundColor: COLORS.white },

  bar: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wishlist: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centred on the outer heart so the stroke is even all the way round.
  wishlistInner: { position: 'absolute', top: 2, left: 2 },

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
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '700',
  },

  bag: {
    width: 22,
    height: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bagHandle: {
    width: 11,
    height: 8,
    borderWidth: 1.8,
    borderColor: '#1B1B1B',
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  bagBody: {
    width: 21,
    height: 16,
    borderWidth: 1.8,
    borderColor: '#1B1B1B',
    borderRadius: 3,
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
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.ink,
    padding: 0,
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
