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
 *    this app deliberately does not run. Here the button is real, and it is
 *    conditional -- see below.
 *
 * 4. THE FIRST COUPON HAD NO GUTTER. The theme's inset sits on an ancestor of
 *    the scroller, so once the box scrolled, its content began at x=0. Solved
 *    the same way here as there, and for the same reason: the padding goes on
 *    the content container, which scrolls with the content, not on the
 *    ScrollView's own box.
 *
 * ONE LINE PER COUPON, AND THE COPY BUTTON IS CONDITIONAL.
 *
 * The strip is single-line cards: the offer on one row, capped to one line, with
 * a copy affordance at its end when -- and only when -- there is something to
 * copy. Two-line headlines with terms underneath made each card a small
 * paragraph, and six paragraphs in a horizontal scroller is a block of reading
 * where the section's job is to be skimmed.
 *
 * WHEN THE BUTTON APPEARS. The theme's field is named `discount_code`, but every
 * live value is offer copy -- "INR 50 off on orders between INR 1500 - INR 1999"
 * -- and every `code_description` beside it reads "No code required". zigly.com
 * renders a copy button for those anyway, which puts a sentence on the clipboard
 * and calls it a coupon code. This app will not: ./coupons' `looksLikeCode`
 * decides, and `Coupon.code` is null for every offer live today, so what ships
 * right now is a clean single-line strip with no buttons on it. The day Zigly
 * issues a real code the button appears on that coupon by itself, with no change
 * here.
 *
 * THE TERMS MOVED RATHER THAN BEING DROPPED. "No code required" and the
 * qualifying thresholds are still read out -- they are in each card's
 * accessibility label -- so nothing a screen reader had is lost by the visual
 * line becoming one.
 *
 * KEPT FROM THE SITE'S OWN LOOK, because these are the strip's identity: the
 * pale `#e8eef5` card on a navy hairline, the 8px radius, and the navy headline
 * over grey terms. All four are the theme's own values, read from
 * `sections/coupon_slider.liquid`.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
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
 * give the strip a ragged, unrelated rhythm.
 *
 * WIDER NOW THAT THE CARD IS ONE LINE. It was 268, which held the longest live
 * headline across two lines. On a single line that same sentence would be
 * truncated at about its halfway point -- "INR 750 Off on orders betwee..." --
 * which loses the threshold, and the threshold is the part of an offer that
 * matters. 318 carries the longest live headline on one line at this size, and
 * still leaves the next card's edge visible on the narrowest phone so the strip
 * reads as scrollable.
 */
const CARD_WIDTH = 318;

/** How long the tapped card says "Copied" before returning to the code. */
const COPIED_MS = 1600;

const EMPTY: Coupon[] = [];

/**
 * Put a code on the clipboard.
 *
 * ISOLATED IN ONE FUNCTION ON PURPOSE. `Clipboard` is still exported by React
 * Native 0.87 but accessing it logs a deprecation warning: it was extracted from
 * core and the community package (`@react-native-clipboard/clipboard`) is where
 * it lives now. That package is not a dependency of this app and adding one for
 * a button that no live offer currently shows would be the wrong trade.
 *
 * So the deprecated call is used, reached through exactly one function, and the
 * `require` is lazy -- the property getter that warns is only touched when a
 * customer actually taps a copy button, which today is never. Installing the
 * package later is a one-line change here and nothing else moves.
 */
const copyToClipboard = (text: string): void => {
  try {
    // Required lazily: the property getter itself is what logs the deprecation
    // warning, so touching it at module load would warn on every launch.
    const clipboard = require('react-native').Clipboard;
    clipboard?.setString(text);
  } catch {
    // A clipboard that is unavailable is not worth a crash in a coupon strip.
    // The button simply does not confirm, which is the honest outcome.
  }
};

/**
 * One offer, on one line, with a copy affordance at its end.
 *
 * EVERY CARD CAN BE COPIED NOW, AND WHAT IT COPIES IS STILL DECIDED BY THE
 * DATA. That split is the point, because the naive version of this button is
 * actively misleading and zigly.com ships it: the theme renders a copy control
 * on every coupon wired to `copyCodeCoupon(...)`, and since every live
 * `discount_code` holds offer copy rather than a code, tapping it puts "INR 50
 * off on orders between INR 1500 - INR 1999" on the clipboard and calls that a
 * coupon code. A customer pastes that at checkout and it fails.
 *
 * So the button is always there -- a customer asking to copy an offer should
 * never find a card that cannot -- but it does not claim to be something it is
 * not. ./coupons' `looksLikeCode` decides which of two things a card is:
 *
 *   A real code     "Copy" on a navy fill, and the code goes to the clipboard.
 *                   The loud treatment, because a code is the actionable thing
 *                   on the card and is worthless unless it is carried away.
 *   Offer copy      "Copy" outlined rather than filled, and the OFFER TEXT
 *                   goes to the clipboard -- which is honest: it is the offer,
 *                   copied, and it is what a customer sharing a deal actually
 *                   wants. It never presents itself as a checkout code, and
 *                   the accessibility label says "Copy offer" rather than
 *                   "Copy code".
 *
 * Every live offer today is the second kind -- verified against the metaobject
 * list on 2026-09-09: seven offers, every `discount_code` a sentence, every
 * `code_description` "No code required". The day Zigly issues a real code that
 * card promotes itself, with no change here.
 *
 * The terms are not drawn -- they were a second line, and every live value is
 * "No code required". They stay in the accessibility label, so nothing is lost
 * to a screen reader.
 */
const Card = ({coupon}: {coupon: Coupon}) => {
  const [copied, setCopied] = useState(false);

  /**
   * The "Copied" timer, held so it can be cleared.
   *
   * A `Pressable`'s handler is not an effect and its return value is discarded,
   * so a `clearTimeout` returned from `onCopy` would never run -- the timer
   * would outlive the card and write state into an unmounted tree if the
   * customer scrolled the dashboard away within COPIED_MS. Kept in a ref and
   * cleared both on the next tap and on unmount.
   */
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current);
      }
    },
    [],
  );

  /**
   * What the clipboard gets: the code where there is one, the offer otherwise.
   *
   * Never a sentence presented as a code -- see the note above the component
   * for why that distinction is the whole design of this button.
   */
  const payload = coupon.code ?? coupon.headline;

  const onCopy = useCallback(() => {
    copyToClipboard(payload);
    setCopied(true);
    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current);
    }
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [payload]);

  /**
   * The full sentence, for a screen reader.
   *
   * The visible line is capped to one and may truncate; this is not. The terms
   * are appended here because they no longer have a line of their own.
   */
  const label = coupon.terms
    ? `${coupon.headline}. ${coupon.terms}`
    : coupon.headline;

  return (
    <View
      style={styles.card}
      /*
       * NOT grouped as one accessible element any more.
       *
       * It was `accessible={!coupon.code}` -- group the card when there is
       * nothing to tap, and let the button announce itself when there is. Every
       * card carries a button now, so grouping would swallow it: a grouped
       * View is announced as a single element and the control inside it stops
       * being reachable. The text and the button are two nodes, and the button
       * carries its own label below.
       */
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <TagIcon size={20} color={COLORS.navy} />
      {/*
        One line, capped. The API text is the merchant's and its length is not
        this app's to rely on: an uncapped line would push the card wider than
        its declared width and give the strip a ragged rhythm.
      */}
      <Text numberOfLines={1} style={styles.headline}>
        {coupon.headline}
      </Text>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        /*
         * The label says which of the two things this is, because a screen
         * reader user has no fill colour to go on -- and "copy code" on an
         * offer sentence is the exact false promise this card refuses to make.
         */
        accessibilityLabel={
          copied
            ? coupon.code
              ? 'Code copied'
              : 'Offer copied'
            : coupon.code
              ? `Copy code ${coupon.code}`
              : `Copy offer: ${coupon.headline}`
        }
        // The button is small and sits at the end of a scrolling row, so the
        // tap target is grown past its ink rather than the button being
        // drawn larger than it should read.
        hitSlop={8}
        style={({pressed}) => [
          styles.copyBtn,
          // Outlined, not filled, when there is no real code: the affordance
          // is there without claiming the card's loudest treatment for a
          // sentence. See the note above the component.
          !coupon.code && styles.copyBtnQuiet,
          pressed && styles.copyPressed,
        ]}
      >
        <Text
          style={[styles.copyText, !coupon.code && styles.copyTextQuiet]}
          numberOfLines={1}
        >
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </Pressable>
    </View>
  );
};

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
  headline: {
    fontFamily: FONT_FAMILY,
    // The theme sets 16px/700 at #0f213b for the code line. Kept, in the app's
    // navy token, which is the same colour family and already the app's own.
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.navy,
    // Takes the room the glyph and the button do not. `minWidth: 0` so a long
    // headline truncates inside the card instead of pushing it wider than its
    // declared width -- without it the flex child refuses to shrink below its
    // text and the fixed-width strip goes ragged.
    flex: 1,
    minWidth: 0,
  },
  /**
   * The copy button. Navy fill so it reads as the one thing on the card that
   * does something, against the pale card and the navy text.
   *
   * This is the treatment for a REAL code. See `copyBtnQuiet` for the other.
   */
  copyBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    // The headline takes the room this does not, and truncates rather than
    // pushing the card wider -- so the button must not shrink to fit a long
    // offer. Without this the word "Copy" wraps or clips on the longest card.
    flexShrink: 0,
  },
  /**
   * The button on a card whose "code" is really offer copy -- every live offer
   * today. Outlined rather than filled.
   *
   * The tap does the same thing and is just as reachable; what changes is how
   * loudly the card advertises it. A navy fill on all seven cards would make
   * the strip a row of call-to-action buttons for a set of automatic discounts
   * that need no action at all, and would imply each one hands over a code.
   */
  copyBtnQuiet: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.navy,
  },
  copyPressed: {
    opacity: 0.7,
  },
  copyText: {
    fontFamily: FONT_FAMILY,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  /** Navy ink on the outlined button, since there is no fill to sit on. */
  copyTextQuiet: {
    color: COLORS.navy,
  },
  /** A card-shaped placeholder, so the strip loads as cards and not as a bar. */
  placeholder: {
    width: CARD_WIDTH,
    // One line now, so the placeholder is the height a single-line card is:
    // 17 of text plus 10 of padding top and bottom.
    height: 39,
    borderRadius: 8,
  },
});

export default CouponStrip;
