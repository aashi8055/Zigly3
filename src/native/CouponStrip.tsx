/**
 * The coupon strip, drawn natively.
 *
 * The third section out of the WebView, and the one where the web version's
 * defect list is longest -- ../webview/couponStrip and the `mySwiper_couponSlider`
 * block in ../webview/injectedStyles between them fix four things, and all four
 * are absent here by construction rather than by repair:
 *
 * 1. IT SLID PAST ON ITS OWN. Not a timer -- the theme drives it with a CSS
 *    marquee (`animation: scroll 30s linear infinite` on `.slider-track`), so a
 *    coupon could not be held still long enough to read. The injected fix stops
 *    the animation and makes the container a native scroller. Here it is a
 *    ScrollView from the start: it moves under a thumb and at no other time,
 *    and no compositor animation runs for the life of the dashboard.
 *
 * 2. EVERY COUPON APPEARED TWICE. `translateX(-50%)` is the marquee's tell --
 *    the theme emits the whole list twice so the loop has somewhere to wrap to,
 *    and six coupons arrive as twelve slides. ../webview/couponStrip has to
 *    de-duplicate them by content. Here the list comes from the API, once.
 *
 * 3. THE COPY BUTTON DID NOTHING. Its markup calls an inline
 *    `onclick="copyCodeCoupon(...)"` defined in the section's own script, which
 *    this app deliberately does not run. There is no copy button here at all,
 *    and that is a data decision rather than an omission -- see below.
 *
 * 4. THE FIRST COUPON HAD NO GUTTER. The theme's inset sits on an ancestor of
 *    the scroller, so once the box scrolled, its content began at x=0. Solved
 *    the same way here as there, and for the same reason: the padding goes on
 *    the content container, which scrolls with the content, not on the
 *    ScrollView's own box.
 *
 * WHY THERE IS NO COPY BUTTON. The theme renders one, so leaving it out is a
 * deliberate divergence and worth stating. Its field is named `discount_code`,
 * but every live value is offer copy -- "INR 50 off on orders between INR 1500 -
 * INR 1999" -- and every `code_description` beside it reads "No code required".
 * There is no code to copy: a copy button would put a sentence on the clipboard
 * and tell the customer it was a coupon code. If Zigly starts issuing real codes
 * the field will start carrying them, and a button belongs here then; ./coupons
 * is where that would be detected.
 *
 * KEPT FROM THE SITE'S OWN LOOK, because these are the strip's identity: the
 * pale `#e8eef5` card on a navy hairline, the 8px radius, and the navy headline
 * over grey terms. All four are the theme's own values, read from
 * `sections/coupon_slider.liquid`.
 */
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {TagIcon} from '../components/glyphs';
import {fetchCoupons, type Coupon} from './coupons';
import {useSectionData} from './useSectionData';

/**
 * The gutter, and the gap between cards.
 *
 * 12px matches the rails above and below -- the category circles, Hot Picks,
 * Explore, Instagram -- which is the figure ../webview/injectedStyles settled on
 * so the strip lines up with them rather than sitting proud of the column.
 */
const GUTTER = 12;

/**
 * How wide a coupon card is.
 *
 * A fixed width rather than one that fits its text: the offer copy varies from
 * "Extra 10% off on orders above ₹1,799" to "INR 750 Off on orders between INR
 * 10000 - INR 14999", and cards that each sized to their own sentence would
 * give the strip a ragged, unrelated rhythm. 268 is wide enough for the longest
 * live headline on two lines at this size.
 */
const CARD_WIDTH = 268;

const EMPTY: Coupon[] = [];

/** One offer. */
const Card = ({coupon}: {coupon: Coupon}) => (
  <View
    style={styles.card}
    // The card is a statement, not a control -- there is nothing to tap, so it
    // announces itself as text. Read as one label so a screen reader says the
    // offer and its terms together rather than as two unrelated strings.
    accessible
    accessibilityRole="text"
    accessibilityLabel={
      coupon.terms ? `${coupon.headline}. ${coupon.terms}` : coupon.headline
    }
  >
    <TagIcon size={22} color={COLORS.navy} />
    <View style={styles.copy}>
      {/*
        Two lines for the headline and one for the terms, both capped. The API
        text is the merchant's and its length is not this app's to rely on: an
        uncapped card would grow the whole strip's height to fit its longest
        entry, and every other card would carry the empty space.
      */}
      <Text numberOfLines={2} style={styles.headline}>
        {coupon.headline}
      </Text>
      {coupon.terms ? (
        <Text numberOfLines={1} style={styles.terms}>
          {coupon.terms}
        </Text>
      ) : null}
    </View>
  </View>
);

const CouponStrip = () => {
  const {data: coupons, loading} = useSectionData<Coupon[]>({
    load: noCache,
    fetcher: signal => fetchCoupons(signal),
    save: passthrough,
    isEmpty: list => !list || list.length === 0,
    empty: EMPTY,
  });

  const pulse = usePulse(loading);

  /**
   * Loading holds the strip's shape.
   *
   * ../components/Skeleton reserves a 54px bar directly under the banner for
   * exactly this section, so the placeholder here is that bar -- two card-shaped
   * blocks rather than one full-width one, because the real strip is cards and a
   * single bar resolving into three would read as the layout changing.
   */
  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.track}>
          <Block pulse={pulse} style={styles.placeholder} />
          <Block pulse={pulse} style={styles.placeholder} />
        </View>
      </View>
    );
  }

  /*
   * No visible offers: no section.
   *
   * The same thing the theme does -- `{% if shop.metaobjects.offers.values !=
   * blank %}` wraps the entire section, so a store with nothing on offer shows
   * no strip rather than an empty one. A merchant who switches every offer off
   * has made that decision and the app follows it.
   */
  if (!coupons.length) {
    return null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        // Cards rest where the first one does rather than under the gutter --
        // `snapToOffsets` would need every card's x; a fixed pitch is exact
        // here because every card is the same width.
        snapToInterval={CARD_WIDTH + GUTTER}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {coupons.map(coupon => (
          <Card key={coupon.id} coupon={coupon} />
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Offers are never cached, unlike ./bannerSlides.
 *
 * An offer is a commercial term with a threshold in it. A stale banner shows
 * last week's artwork; a stale offer tells a customer they get ₹50 off at
 * ₹1,500 when the merchant has changed it. ./coupons carries the full argument.
 * These two no-ops keep ./useSectionData's contract without a store behind it.
 */
const noCache = (): Promise<Coupon[]> => Promise.resolve(EMPTY);
const passthrough = (value: Coupon[]): Promise<Coupon[]> =>
  Promise.resolve(value);

const styles = StyleSheet.create({
  root: {
    // The strip's own rhythm, matching `HomeSkeleton`'s `stripGap` so the rail
    // below it does not move when the placeholder comes off.
    marginBottom: 22,
  },
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller: a scroll container's start
    // padding is scrolled away and older Android WebViews drop the end padding
    // outright. Part of the track's width, both ends keep it.
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  card: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // The theme's own card: pale blue, a navy hairline, 8px radius, 8px/6px
    // padding. Read from sections/coupon_slider.liquid.
    backgroundColor: '#e8eef5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  copy: {
    // `minWidth: 0` so a long headline wraps inside the card instead of
    // pushing the card wider than its declared width.
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontFamily: FONT_FAMILY,
    // The theme sets 16px/700 at #0f213b for the code line. Kept, in the app's
    // navy token, which is the same colour family and already the app's own.
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.navy,
  },
  terms: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  /** A card-shaped placeholder, so the strip loads as cards and not as a bar. */
  placeholder: {
    width: CARD_WIDTH,
    height: 58,
    borderRadius: 8,
  },
});

export default CouponStrip;
