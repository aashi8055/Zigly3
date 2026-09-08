/**
 * "Top Pet Brands, One Spot!" — two tabs of brand logos.
 *
 * Section eleven. ./brands carries the data and the reasoning about where it
 * comes from; this draws it.
 *
 * THE TABS ARE NOT LAZY, unlike ./ProductRail's. Both tabs arrive in the same
 * metaobject and therefore in the same single query -- there is nothing to
 * defer, and deferring would mean a second request for data already in hand.
 * So both are held and switching is instant.
 *
 * THE LOGOS ARE LANDSCAPE, which is why this is not ./TileRow. The artwork is
 * cut to 475x268 (16:9, near enough) and is a wordmark on a coloured card, not
 * an icon on a disc. A square crop would cut the ends off brand names, and
 * `contain` inside a square would leave a logo floating in a box twice its
 * height. So the cell is the artwork's own shape and the image fills it.
 *
 * AND THERE IS NO TEXT LABEL, by the theme's design: the logo IS the label.
 * That has the consequence ./OfferRail spells out -- an unresolved image is a
 * blank card that navigates somewhere -- but it cannot arise here, because
 * ./brands only ever emits a brand that has both an image and a link. A brand
 * missing either is dropped at the parse, before it reaches this component.
 */
import React, {useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {BRANDS_TITLE, fetchBrands, type BrandTab} from './brands';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/**
 * The logo card.
 *
 * 475x268 is the artwork's own ratio, so the card is 148x84 -- a shade over
 * two on screen beside the gutter, which is the "there is more to the right"
 * shape a rail needs. Kept as two constants rather than a width and an
 * aspectRatio so the skeleton can state the same height without recomputing it.
 */
const CARD_WIDTH = 148;
const CARD_HEIGHT = 84;

const EMPTY: BrandTab[] = [];

type Props = {
  onOpen: (path: string) => void;
};

const BrandRail = ({onOpen}: Props) => {
  const [active, setActive] = useState(0);

  const {data: tabs, loading} = useSectionData<BrandTab[]>({
    load: noCache,
    fetcher: signal => fetchBrands(signal),
    save: passthrough,
    isEmpty: list => !list || list.length === 0,
    empty: EMPTY,
  });

  const pulse = usePulse(loading);

  if (loading) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{BRANDS_TITLE}</Text>
        <View style={styles.track}>
          <Block pulse={pulse} style={styles.placeholder} />
          <Block pulse={pulse} style={styles.placeholder} />
          <Block pulse={pulse} style={styles.placeholder} />
        </View>
      </View>
    );
  }

  /*
   * Out of retries with nothing: no section. The theme takes the same view --
   * its whole markup sits behind `{% if show_feature_content or
   * show_other_content %}`, so a store with no brand navigation renders no
   * section rather than an empty one.
   */
  if (!tabs.length) {
    return null;
  }

  // A metaobject can leave one tab empty; ./brands drops it, so `active` must
  // not point past the end after a refresh returns fewer tabs than before.
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{BRANDS_TITLE}</Text>

      {/* One tab is a label that states nothing; the heading already says it. */}
      {tabs.length > 1 ? (
        <View style={styles.tabs}>
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
        </View>
      ) : null}

      <ScrollView
        // Keyed on the tab so switching resets the scroll to the start:
        // arriving at "Emerging" already scrolled three brands in would hide
        // the first ones with nothing to say they were there.
        key={current.label}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        snapToInterval={CARD_WIDTH + GUTTER}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {current.brands.map(brand => (
          <Pressable
            key={brand.link}
            onPress={() => onOpen(brand.link)}
            accessibilityRole="link"
            // The logo is the label, so the derived brand name is the only
            // thing a screen reader has. See ./brands on how it is derived.
            accessibilityLabel={brand.name}
            style={styles.card}
          >
            {({pressed}) => (
              <Image
                source={{uri: brand.image}}
                style={[styles.image, pressed && styles.pressed]}
                // `cover`: the card is the artwork's own ratio, so this fills
                // it exactly and only guards against a logo cut to a slightly
                // different size.
                resizeMode="cover"
                accessible={false}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Brand data is not cached to disk.
 *
 * Logos and links have no price behind them, so this is not the correctness
 * rule ../webview/sectionIdStore states -- it is a smaller judgement: the
 * section is one query, it holds its shape while loading, and a merchant
 * promoting a brand should not be a launch behind. ./bannerSlides caches
 * because the banner is the largest thing on the first screen; this sits ten
 * sections down, where nobody is watching it paint.
 */
const noCache = (): Promise<BrandTab[]> => Promise.resolve(EMPTY);
const passthrough = (value: BrandTab[]): Promise<BrandTab[]> =>
  Promise.resolve(value);

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    paddingHorizontal: GUTTER,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  tab: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.navy,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.navy,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: COLORS.navy,
    color: COLORS.white,
  },
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller -- a scroll container's start
    // padding is scrolled away and older Android drops the end padding. See
    // ../webview/injectedStyles.
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F7F8FA',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  placeholder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
  },
});

export default BrandRail;
