/**
 * "Pet Parenting Made Easy" — the article cards.
 *
 * Section nineteen. ./tips carries the data and the permission constraint that
 * makes this the one section fed by parsed HTML rather than JSON.
 *
 * THE CARDS ARE NOT IN THE APP, unlike every other tile section. Their titles
 * and dates come from the fetch, because the theme's blocks carry only article
 * handles and the Storefront token cannot read blog content. So this section
 * genuinely has nothing to draw until the network answers -- there is no label
 * to fall back to, no cached text, nothing. That is why it holds a skeleton of
 * the right shape and then draws nothing at all if every attempt fails: a
 * heading over an empty strip states that something is missing.
 *
 * WHICH ALSO MEANS THE PLACEHOLDER COUNT IS KNOWN. ./tips ships the seven
 * handles the section declares, so the skeleton draws seven card shapes rather
 * than an arbitrary three -- the page settles to its real height in one step
 * instead of growing as cards land.
 *
 * `slidesPerView: 1.5` is the theme's own mobile setting for this rail, which
 * is why these cards are wider than any other card in the dashboard: an article
 * title needs the room, and a card and a half on screen is the shape the site
 * shows.
 */
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {
  fetchTips,
  TIPS_TITLE,
  TIPS_VIEW_ALL,
  TIPS_VIEW_ALL_PATH,
  TIP_HANDLES,
  type Tip,
} from './tips';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/** The article cover, at the 16:9 the theme's cards use. */
const IMAGE_RATIO = 16 / 9;

const EMPTY: Tip[] = [];

type Props = {
  onOpen: (path: string) => void;
};

const TipsRail = ({onOpen}: Props) => {
  const {width} = useWindowDimensions();

  /**
   * A card and a half on screen, from the theme's `slidesPerView: 1.5`.
   *
   * Computed from the screen rather than fixed, because 1.5 cards is a
   * proportion: on a 360dp phone that is ~232dp, and a fixed number would show
   * one and a bit on a small screen and two and a bit on a large one.
   */
  const cardWidth = Math.round((width - GUTTER * 2 - GUTTER) / 1.5);

  const {data: tips, loading} = useSectionData<Tip[]>({
    load: noCache,
    fetcher: signal => fetchTips(signal),
    save: passthrough,
    isEmpty: list => !list || list.length === 0,
    empty: EMPTY,
  });

  const pulse = usePulse(loading);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.head}>
          <Text style={styles.title}>{TIPS_TITLE}</Text>
        </View>
        <View style={styles.track}>
          {/*
            Seven, the number the section declares -- see the note at the top on
            why the count is known even though the cards are not.
          */}
          {TIP_HANDLES.map(handle => (
            <View key={handle} style={{width: cardWidth}}>
              <Block
                pulse={pulse}
                style={[styles.imagePlaceholder, {width: cardWidth}]}
              />
              <Block pulse={pulse} style={styles.linePlaceholder} />
              <Block pulse={pulse} style={styles.lineShortPlaceholder} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  /*
   * Out of retries with nothing: no section. There is no cached text and no
   * label to fall back to, so a heading here would sit over an empty strip.
   */
  if (!tips.length) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{TIPS_TITLE}</Text>
        {/*
          The theme's own "View All" control, from `button_helpful_tips`. Red,
          which is its `anchor_color` (#ed2427) -- and COLORS.red is that
          colour. Not an add-to-cart button, so the rule
          ../../__tests__/buttonColour.test.ts governs does not apply.
        */}
        <Text
          onPress={() => onOpen(TIPS_VIEW_ALL_PATH)}
          accessibilityRole="link"
          accessibilityLabel={`${TIPS_VIEW_ALL}, ${TIPS_TITLE}`}
          style={styles.viewAll}
        >
          {TIPS_VIEW_ALL}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        snapToInterval={cardWidth + GUTTER}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {tips.map(tip => (
          <Pressable
            key={tip.path}
            onPress={() => onOpen(tip.path)}
            accessibilityRole="link"
            accessibilityLabel={
              tip.date ? `${tip.title}. ${tip.date}` : tip.title
            }
            style={{width: cardWidth}}
          >
            {({pressed}) => (
              <>
                <View style={[styles.imageBox, {width: cardWidth}]}>
                  {tip.image ? (
                    <Image
                      source={{uri: tip.image}}
                      style={[styles.image, pressed && styles.pressed]}
                      resizeMode="cover"
                      accessible={false}
                    />
                  ) : null}
                </View>
                {tip.date ? (
                  <Text numberOfLines={1} style={styles.date}>
                    {tip.date}
                  </Text>
                ) : null}
                {/*
                  Two lines, matching the theme's own
                  `--line-clamp-count: 2` on `.article-title`.
                */}
                <Text numberOfLines={2} style={styles.cardTitle}>
                  {tip.title}
                </Text>
              </>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Article cards are not cached to disk.
 *
 * They are the site's own rendered markup, and ../webview/sectionIdStore's rule
 * is that markup is never persisted. These carry no price, so the reason is the
 * weaker one ./BrandRail gives: the section is one small fetch and an article
 * Zigly has replaced should not survive a launch.
 */
const noCache = (): Promise<Tip[]> => Promise.resolve(EMPTY);
const passthrough = (value: Tip[]): Promise<Tip[]> => Promise.resolve(value);

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
    /*
     * Extra air above this section, which no other rail has.
     *
     * What sits directly above it is the double banner -- two full-bleed images
     * stacked, edge to edge. Every other rail is preceded by something with its
     * own gutter, so the 22dp the banner carries below itself is enough. Against
     * a full-bleed edge it is not: the article cards started immediately under a
     * photograph that ran the whole width, and the two read as one block with
     * the heading trapped between them.
     */
    marginTop: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    // So a long heading does not push "View All" off the row.
    flex: 1,
    minWidth: 0,
  },
  viewAll: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    fontWeight: '700',
    // The section's own `anchor_color`.
    color: COLORS.red,
    paddingLeft: 12,
    // A readable tap target without moving the row.
    paddingVertical: 4,
  },
  track: {
    flexDirection: 'row',
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  imageBox: {
    aspectRatio: IMAGE_RATIO,
    borderRadius: 10,
    overflow: 'hidden',
    // A card whose cover failed keeps this box, so the rail stays level.
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.72,
  },
  date: {
    fontFamily: FONT_FAMILY,
    fontSize: 10.5,
    lineHeight: 14,
    color: COLORS.inkMuted,
    marginBottom: 3,
  },
  cardTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    color: COLORS.ink,
    // Two lines reserved, so every card's height agrees whatever its title.
    minHeight: 34,
  },
  imagePlaceholder: {
    aspectRatio: IMAGE_RATIO,
    borderRadius: 10,
    marginBottom: 8,
  },
  linePlaceholder: {
    height: 11,
    width: '90%',
    marginBottom: 6,
  },
  lineShortPlaceholder: {
    height: 11,
    width: '60%',
  },
});

export default TipsRail;
