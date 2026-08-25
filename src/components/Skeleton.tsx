/**
 * The placeholder shapes, and the one pulse they all breathe in.
 *
 * These lived inside `PageCover` as module-private components, which was right
 * while the cover was the only thing that showed a placeholder. The splash now
 * shows one too -- a cold start holds the logo and then dissolves into the shape
 * of the dashboard -- and two implementations of the same grey rectangle would
 * drift apart in exactly the way the customer can see: a different fill, a
 * different radius, a pulse half a second out of step across the hand-off.
 *
 * So it is one primitive with two callers. Nothing here is new work; the fill,
 * the radii and the pulse are `PageCover`'s own, moved.
 *
 * WHY AN OPACITY PULSE AND NOT A SHIMMER. A travelling gradient needs either a
 * masked linear-gradient or a translating overlay per block, and on Android that
 * is a lot of overdraw for a screen whose entire job is to be cheap while the
 * WebView underneath is doing real work. Fading the whole set in step reads as
 * waiting just as well, and runs on the native driver as a single animation.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';

/** Placeholder fill: the navy of the app's own chrome, at a whisper. */
export const FILL = 'rgba(24,55,97,0.07)';

/** How long one breath of the pulse takes. */
export const PULSE_MS = 850;

/**
 * One shared pulse, driven on the native driver.
 *
 * Returned rather than created per block so every shape on screen is at the same
 * point in the breath -- blocks pulsing independently reads as noise, not as one
 * screen waiting. `active` stops the loop once the real content is ready, so a
 * cover that is fading out is not also animating.
 */
export const usePulse = (active: boolean): Animated.Value => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return pulse;
};

/** One placeholder block, breathing in step with the rest. */
export const Block = ({
  pulse,
  style,
}: {
  pulse: Animated.Value;
  style: object;
}) => (
  <Animated.View
    style={[
      styles.block,
      style,
      {
        opacity: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.55, 1],
        }),
      },
    ]}
  />
);

/** A listing card: image, then two lines of type. */
export const CardSkeleton = ({pulse}: {pulse: Animated.Value}) => (
  <View style={styles.card}>
    <Block pulse={pulse} style={styles.cardImage} />
    <Block pulse={pulse} style={styles.lineWide} />
    <Block pulse={pulse} style={styles.lineNarrow} />
  </View>
);

/**
 * A category circle with its label under it.
 *
 * The dashboard opens on a rail of these, directly under the search bar -- the
 * first thing on the screen and the first thing tapped, so it is the shape most
 * worth claiming.
 */
export const CircleSkeleton = ({pulse}: {pulse: Animated.Value}) => (
  <View style={styles.circleCell}>
    <Block pulse={pulse} style={styles.circle} />
    <Block pulse={pulse} style={styles.circleLabel} />
  </View>
);

export const styles = StyleSheet.create({
  block: {backgroundColor: FILL, borderRadius: 8},
  lineWide: {height: 12, width: '86%', marginBottom: 7},
  lineNarrow: {height: 12, width: '54%', marginBottom: 7},

  /* A listing grid: two columns, the gutter absorbed by a negative margin. */
  grid: {flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5},
  card: {width: '50%', paddingHorizontal: 5, marginBottom: 18},
  /**
   * Roughly square. The theme's cards are portrait overall but their image is
   * close to square, and the point of the shape is the rhythm of the grid rather
   * than a pixel match -- it dissolves into the real thing either way.
   */
  cardImage: {width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 10},

  /** A product page opens on its gallery, the full width of the screen. */
  hero: {width: '100%', aspectRatio: 1, borderRadius: 14, marginBottom: 16},
  button: {height: 46, borderRadius: 23, marginTop: 12},

  /* The dashboard's own furniture. */
  circleRow: {flexDirection: 'row', justifyContent: 'space-between'},
  circleCell: {alignItems: 'center', width: '18%'},
  circle: {width: '100%', aspectRatio: 1, borderRadius: 999, marginBottom: 8},
  circleLabel: {height: 8, width: '76%', borderRadius: 4},
  /**
   * The banner carousel. Close to 2:1, which is the ratio Zigly's homepage
   * banners are cut to -- the one shape here big enough that getting the
   * proportion wrong would be legible as the page settling.
   */
  banner: {width: '100%', aspectRatio: 2, borderRadius: 14},
  /** The coupon strip: one short wide bar directly below the banner. */
  strip: {width: '100%', height: 54, borderRadius: 12},
  /** A section heading, above a rail. */
  railTitle: {height: 15, width: '46%', borderRadius: 4},
  /** A rail scrolls sideways, so its cards are cut off rather than wrapped. */
  rail: {flexDirection: 'row', overflow: 'hidden'},
  railCard: {width: '42%', marginRight: 12},
  railImage: {width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 8},

  /* Rhythm for the dashboard shape, top to bottom. */
  circles: {marginBottom: 18},
  bannerGap: {marginBottom: 16},
  stripGap: {marginBottom: 22},
  railTitleGap: {marginBottom: 14},

  /* A native list row: account, orders, addresses, search suggestions. */
  listRow: {flexDirection: 'row', alignItems: 'center', gap: 16},
  listLead: {width: 24, height: 24, borderRadius: 6},
  listRowText: {flex: 1, minWidth: 0, gap: 7},
});

/** One card in a sideways rail: narrower than a grid card, and never wrapped. */
export const RailCardSkeleton = ({pulse}: {pulse: Animated.Value}) => (
  <View style={styles.railCard}>
    <Block pulse={pulse} style={styles.railImage} />
    <Block pulse={pulse} style={styles.lineWide} />
  </View>
);

/**
 * One row of a native list screen: an optional leading shape, then two lines
 * of text. This is the one row shape shared by every native list this app
 * draws while its data is still out — account, orders, addresses, search
 * suggestions — because all of them are, at bottom, an icon or a thumbnail
 * next to a couple of lines of type. Passing `leading={null}` drops the
 * leading shape for a list with none (an order card, an address card); any
 * other `leading` style stands in for that row's own icon or thumbnail size.
 */
export const ListRowSkeleton = ({
  pulse,
  leading,
  style,
}: {
  pulse: Animated.Value;
  leading?: object | null;
  style?: object;
}) => (
  <View style={[styles.listRow, style]}>
    {leading !== null ? (
      <Block pulse={pulse} style={leading ?? styles.listLead} />
    ) : null}
    <View style={styles.listRowText}>
      <Block pulse={pulse} style={styles.lineWide} />
      <Block pulse={pulse} style={styles.lineNarrow} />
    </View>
  </View>
);

/**
 * The dashboard, in the order the app actually builds it.
 *
 * Category circles under the search bar, then the banner, then the coupon strip,
 * then the first rail. That is `../webview/homeLayout`'s reorder, not an
 * invention -- which is what makes this the one placeholder in the app that is
 * not guessing at Zigly's template. It describes the app's own arrangement.
 *
 * Two callers, and they see it from different places: `PageCover` draws it inside
 * `body`, already below the native header, and the splash draws it over the whole
 * screen and has to leave room for that header itself.
 */
export const HomeSkeleton = ({pulse}: {pulse: Animated.Value}) => (
  <>
    <View style={[styles.circleRow, styles.circles]}>
      <CircleSkeleton pulse={pulse} />
      <CircleSkeleton pulse={pulse} />
      <CircleSkeleton pulse={pulse} />
      <CircleSkeleton pulse={pulse} />
      <CircleSkeleton pulse={pulse} />
    </View>
    <Block pulse={pulse} style={[styles.banner, styles.bannerGap]} />
    <Block pulse={pulse} style={[styles.strip, styles.stripGap]} />
    <Block pulse={pulse} style={[styles.railTitle, styles.railTitleGap]} />
    <View style={styles.rail}>
      <RailCardSkeleton pulse={pulse} />
      <RailCardSkeleton pulse={pulse} />
      <RailCardSkeleton pulse={pulse} />
    </View>
  </>
);
