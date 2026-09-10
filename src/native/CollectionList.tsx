/**
 * The Collection tab's first screen: twelve coloured category cards.
 *
 * WHAT THIS REPLACES. A WebView on `/collections`. The page it drew is the
 * theme's `collections-list-section` -- a flex list of `.category-list-card`
 * anchors -- and on a phone each of those is a photo at 20% width, a heading, a
 * sub-heading and a chevron, with the "Explore Now" button hidden by the
 * theme's own `small-hide`. That is what this draws, natively, from
 * ./collectionCards.
 *
 * THE THEME'S OWN MOBILE SHAPE, NOT A REINTERPRETATION. Read out of
 * `sections/collections-list-section.liquid` on 2026-09-09:
 *
 *   .category-list-card        radius 12, `background-color: var(--background-color)`
 *                              from the block's own `bg_color`
 *   .category-list-image-wrapper  `width: 20%` under 750px, `overflow: hidden`
 *   h3.fw-700                  the heading
 *   p.fw-500                   the sub-heading
 *   .svg-wrapper               an 8x12 chevron, `M1.5 11L6.5 6L1.5 1`,
 *                              stroke black, width 2 -- shown ONLY on mobile
 *                              (`medium-hide large-up-hide`)
 *   button.fw-600              "Explore Now" -- `small-hide`, so never on a phone
 *   gap                        15px under 415px, 40px above
 *
 * The button is therefore not drawn here, and that is a match rather than an
 * omission: the whole card is the tap target on mobile, exactly as the anchor
 * is on the site.
 *
 * ARTWORK ARRIVES LATE AND THAT IS FINE. The twelve cards paint on the first
 * frame with their real colours, headings and destinations -- all of which ship
 * in code -- and each photo appears when ./tileIcons has resolved it. A card
 * with no picture yet keeps its height, its colour and its tap target, so
 * nothing reflows when they land. See ./tileIcons for why the pictures cannot
 * simply be constants.
 */
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  COLLECTION_CARDS,
  COLLECTION_CARD_RAIL,
  type CollectionCard,
} from './collectionCards';
import {fetchIcons, loadIcons, saveIcons, type IconMap} from './tileIcons';
import {useSectionData} from './useSectionData';

/**
 * The gap between cards, and the page's own inset.
 *
 * The theme's mobile gap is 15px (its `max-width: 415px` rule); 14 is that gap
 * at this app's own 16dp page margin, which is the inset every other native
 * screen here uses. Matching the site's 40px desktop gap on a phone would put
 * three cards on a screen instead of six.
 */
const GAP = 14;
const EDGE = 16;

/**
 * How tall a card is.
 *
 * The theme sizes the card by its content and lets the 175x200 artwork set the
 * height. On a phone that lands at roughly a 3.4:1 card, which is what the
 * reference screenshot shows -- so the height is stated rather than derived,
 * and the image is fitted inside it. A fixed height is also what keeps the list
 * from reflowing as the twelve photos arrive one by one.
 */
const CARD_HEIGHT = 104;

/**
 * The chevron, as the theme draws it.
 *
 * An 8x12 stroke rather than this app's `ChevronRight` glyph: that one is a
 * rotated bordered box sized for a settings row, and the site's is a
 * heavier two-stroke caret. Drawn from the same two borders, at the site's
 * proportions and its 2px stroke, so it reads as the site's chevron at the
 * size the site uses.
 */
const Chevron = () => <View style={styles.chevron} />;

/** One card. */
const Card = ({
  card,
  image,
  onPress,
}: {
  card: CollectionCard;
  image: string | undefined;
  onPress: (path: string) => void;
}) => (
  <Pressable
    onPress={() => onPress(card.path)}
    accessibilityRole="button"
    // The heading alone: the sub-heading is a description, and a screen reader
    // announcing "Applod, Baked Biscuits & Pet Treats, button" buries the name.
    accessibilityLabel={card.label}
    accessibilityHint={card.subtitle}
    style={({pressed}) => [
      styles.card,
      {backgroundColor: card.color},
      pressed && styles.pressed,
    ]}>
    <View style={styles.imageWrap}>
      {image ? (
        <Image
          source={{uri: image}}
          style={styles.image}
          // `contain`: the artwork is a cut-out on transparent, sized 175x200
          // by the merchant, and cropping it to fill would clip the pet.
          resizeMode="contain"
        />
      ) : null}
    </View>
    <View style={styles.text}>
      <Text style={styles.heading} numberOfLines={2}>
        {card.label}
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        {card.subtitle}
      </Text>
    </View>
    <Chevron />
  </Pressable>
);

type Props = {
  /** Open a collection. Given the storefront path, e.g. `/collections/applod`. */
  onOpen: (path: string) => void;
  /**
   * Space to leave under the last card.
   *
   * The tab bar draws over the foot of this list, so the twelfth card would sit
   * behind it. Passed in rather than measured here because the bar's height is
   * the caller's fact.
   */
  bottomInset?: number;
  /**
   * The search band, above the first card.
   *
   * Same slot and the same reasoning as ./CollectionScreen's: this screen is
   * drawn on an opaque layer over the WebView, so the band injected into the
   * page (../webview/searchBandSection) is underneath it and cannot be seen.
   * A node rather than a callback, so this file knows nothing about the
   * search wiring -- it renders what it is handed.
   *
   * Inside the scroller, so it travels with the cards as it does everywhere
   * else in the app.
   */
  searchBand?: React.ReactNode;
};

const CollectionList = ({
  onOpen,
  bottomInset = 0,
  searchBand = null,
}: Props) => {
  /*
   * Only the pictures load. The cards themselves are constants, so there is no
   * loading state and no skeleton -- the same reasoning as ./TileRailView.
   */
  const {data: icons} = useSectionData<IconMap>({
    load: () => loadIcons(COLLECTION_CARD_RAIL),
    fetcher: signal => fetchIcons(COLLECTION_CARD_RAIL, signal),
    save: value => saveIcons(COLLECTION_CARD_RAIL, value),
    isEmpty: value => Object.keys(value).length === 0,
    empty: {},
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {paddingBottom: EDGE + bottomInset},
      ]}
      showsVerticalScrollIndicator={false}>
      {/*
        Pulled out to the screen's edges, because the band's ground is a
        full-bleed blue and this scroller's content is inset by EDGE either
        side. Left in the padding it would draw the blue as a floating panel
        with white gutters, which is not how the band looks on any other
        screen. The band supplies its own internal padding, so this only
        cancels the container's.
      */}
      {searchBand ? (
        <View style={styles.bandBleed}>{searchBand}</View>
      ) : null}
      {COLLECTION_CARDS.map(card => (
        <Card
          key={card.path}
          card={card}
          image={icons[card.key]}
          onPress={onOpen}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  content: {paddingHorizontal: EDGE, paddingTop: EDGE, gap: GAP},
  /**
   * Cancels `content`'s horizontal inset for the band alone.
   *
   * The negative margins are exactly EDGE, so the band spans the full width
   * whatever EDGE becomes. `marginTop` cancels the container's `paddingTop`
   * too: the band sits against the header above it on every other screen, and
   * a strip of white above the blue here would be the one place it floats.
   */
  bandBleed: {marginHorizontal: -EDGE, marginTop: -EDGE},
  card: {
    height: CARD_HEIGHT,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    // `hidden`, as the theme has it: the artwork bleeds to the card's left edge
    // and the radius must cut it.
    overflow: 'hidden',
    paddingRight: 16,
  },
  pressed: {opacity: 0.82},
  /**
   * 20% of the card, which is the theme's own mobile width for this wrapper.
   * Full height so the cut-out sits on the card's floor as it does on the site.
   */
  imageWrap: {width: '24%', height: '100%', justifyContent: 'flex-end'},
  image: {width: '100%', height: '100%'},
  text: {flex: 1, minWidth: 0, gap: 3, paddingLeft: 4},
  heading: {
    fontFamily: FONT_FAMILY,
    fontSize: 19,
    fontWeight: '700',
    // The theme's own `#282828` for this h3, not the app's body colour.
    color: '#282828',
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 13.5,
    fontWeight: '500',
    color: '#3F3F3F',
  },
  /** The site's 8x12 caret: two borders, 2px, rotated. */
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#000000',
    transform: [{rotate: '45deg'}],
    marginLeft: 10,
  },
});

export default CollectionList;
