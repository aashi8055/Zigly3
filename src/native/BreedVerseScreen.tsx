/**
 * The Breed-verse tab's screen: a tab bar and a grid of breed cards.
 *
 * WHAT THIS REPLACES. A WebView on `/pages/pet-breeds` running the theme's
 * `All-Breeds-Aman` section -- a CSS grid of `.gallery-card` anchors whose
 * filtering and paging are two copies of the same inline script (the second of
 * which references an undefined `IntersectiongalleryObserver` and throws). This
 * draws the same page natively from ./breedVerse.
 *
 * THE THEME'S OWN MOBILE SHAPE, NOT A REINTERPRETATION. Read out of
 * `sections/All-Breeds-Aman.liquid` on 2026-09-09, taking the `max-width: 767px`
 * block wherever the rules disagree:
 *
 *   .gallery-tabs        `#fff7eb`, radius 10, centred row, 40px gap,
 *                        19px/15px padding, 30px below
 *   button.active        `#ffe6bc`, radius 50, 10px/20px padding, weight 700 --
 *                        so the live tab is a pill and the others are bare text
 *                        on the cream bar
 *   .gallery-grid        2 columns, 1.8rem gap
 *   .gallery-card        radius 10, `overflow: hidden`, column
 *   .gallery-card-body   white, radius 10, `1.8px solid #000`, 5px/7px padding
 *   h3                   1.6rem, weight 700, name and arrow spread apart
 *   .gallery-tags        `display: none` -- see ./breedVerse on the traits
 *
 * WHY THE BODY IS A SEPARATE BORDERED BOX. On the site the photo sits above an
 * independently bordered white panel, with no border around the photo itself.
 * That reads as a mistake and is not one -- it is what the section draws, and
 * the reference page shows it -- so it is what this draws.
 *
 * NO PAGING, DELIBERATELY. The section ships `blocks_per_page: 24` and reveals
 * the rest on an IntersectionObserver. That exists because a browser would
 * otherwise decode 32 full-width photographs at once; a `FlatList` already
 * virtualises, so all 32 cards are handed over and only the visible rows are
 * ever mounted. Reproducing the observer would add a delay the app does not
 * need in order to imitate a workaround for a problem it does not have.
 *
 * ARTWORK ARRIVES LATE AND THAT IS FINE. Names, destinations and tabs ship in
 * code, so the grid is complete and tappable on its first frame; each photo
 * appears when ./tileIcons resolves it. A card with no picture keeps its
 * height, its border and its tap target, so nothing reflows as they land.
 */
import React, {useMemo, useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  BREED_CARDS,
  BREED_TABS,
  BREED_VERSE_RAIL,
  cardsForTab,
  type BreedCard,
  type BreedTab,
} from './breedVerse';
import {fetchIcons, loadIcons, saveIcons, type IconMap} from './tileIcons';
import {useSectionData} from './useSectionData';

/**
 * The page inset and the gap between cards.
 *
 * The section's own `padding: 2rem 1.5rem` is 15px at Shopify's 10px root, and
 * its mobile grid gap is 1.8rem -- 18px. Both are kept: 16 for the inset, which
 * is this app's page margin everywhere else and within a pixel of the theme's,
 * and 18 for the gap, which is the theme's exactly.
 */
const EDGE = 16;
const GAP = 18;

/** Two columns, the inset either side and one gap between. */
const CARD_WIDTH = (Dimensions.get('window').width - EDGE * 2 - GAP) / 2;

/**
 * How tall a card's photograph is.
 *
 * The theme gives the image `width: 100%; height: 100%; object-fit: cover`
 * inside a card that is sized by its own content, so the photo's height comes
 * from the grid track rather than from any rule -- there is no number in the
 * stylesheet to copy. 4:3 is what the rendered page measures to at phone width,
 * and it is stated rather than derived so the grid does not reflow as photos
 * arrive one at a time.
 */
const IMAGE_HEIGHT = Math.round((CARD_WIDTH * 3) / 4);

/**
 * The arrow beside each name.
 *
 * Zigly's own `arrow_website.svg`, which the theme loads from its CDN on every
 * card -- an arrow inside a ring, in the file's own `#231f20`. Both paths are
 * lifted verbatim from that file along with its `0 0 279.3 266.8` viewBox, for
 * the same reason ../components/glyphs keeps the wishlist heart as a path: it
 * is the merchant's mark, and a chevron of ours in its place would be a
 * different drawing on the same card.
 *
 * Inlined rather than fetched. It is 1 KB of geometry that never changes, and
 * a card whose only affordance arrives over the network is a card that looks
 * broken on a cold start.
 */
const CircledArrow = ({size = 26}: {size?: number}) => (
  <Svg width={size} height={size} viewBox="0 0 279.3 266.8">
    <Path
      d="M175.5,143.4h-97.5c-.8,0-5-2.5-5.7-3.2-4.2-4.4-2.5-13.3,3.1-15.8s2.4-.9,2.6-.9h97.5l-32.7-32.4c-8.5-9.4,2.3-22.9,13.2-15.2l51.2,51.1c2.5,3,2.8,6.9,1.5,10.5-16.5,18.8-35.4,35.8-52.9,53.9-10.3,6.7-21.1-5.3-13.4-14.9l33.1-33Z"
      fill="#231f20"
    />
    <Path
      d="M139.6,252.2c-65.5,0-118.8-53.3-118.8-118.8S74.1,14.6,139.6,14.6s118.8,53.3,118.8,118.8-53.3,118.8-118.8,118.8ZM139.6,26.6c-58.9,0-106.8,47.9-106.8,106.8s47.9,106.8,106.8,106.8,106.8-47.9,106.8-106.8S198.5,26.6,139.6,26.6Z"
      fill="#231f20"
    />
  </Svg>
);

/**
 * One breed card: a photograph, then a bordered white body holding the name
 * and the arrow.
 *
 * Memoised because a tab change re-renders the list and most cards are
 * unchanged between "All" and "Dog" -- 25 of the 32 survive that switch, and
 * re-rendering them would re-mount 25 `Image`s that already hold their bitmap.
 */
const Card = React.memo(
  ({
    card,
    image,
    onPress,
  }: {
    card: BreedCard;
    image: string | undefined;
    onPress: (path: string) => void;
  }) => (
    <Pressable
      onPress={() => onPress(card.path)}
      accessibilityRole="button"
      accessibilityLabel={card.label}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.imageWrap}>
        {image ? (
          <Image
            source={{uri: image}}
            style={styles.image}
            // `cover`, as the theme has it: these are full-bleed photographs
            // and letterboxing one inside its card would show the ground
            // through the top and bottom of every tile.
            resizeMode="cover"
          />
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {card.label}
        </Text>
        <CircledArrow />
      </View>
    </Pressable>
  ),
);

/** The cream bar and its three buttons. Only the live one is a pill. */
const Tabs = ({
  active,
  onSelect,
}: {
  active: BreedTab['id'];
  onSelect: (id: BreedTab['id']) => void;
}) => (
  <View style={styles.tabs}>
    {BREED_TABS.map(tab => {
      const on = tab.id === active;
      return (
        <Pressable
          key={tab.id}
          onPress={() => onSelect(tab.id)}
          accessibilityRole="tab"
          accessibilityState={{selected: on}}
          style={[styles.tab, on && styles.tabOn]}>
          <Text style={[styles.tabText, on && styles.tabTextOn]}>
            {tab.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

type Props = {
  /** Open a breed's page. Given a storefront path, e.g. `/pages/beagle`. */
  onOpen: (path: string) => void;
  /**
   * Space to leave under the last row.
   *
   * The tab bar draws over the foot of this list. Passed in rather than
   * measured here because the bar's height is the caller's fact -- the same
   * arrangement ./CollectionList uses.
   */
  bottomInset?: number;
};

const BreedVerseScreen = ({onOpen, bottomInset = 0}: Props) => {
  const [tab, setTab] = useState<BreedTab['id']>('all');

  /*
   * Only the photographs load. The cards themselves are constants, so there is
   * no loading state and no skeleton -- the same reasoning as ./CollectionList.
   */
  const {data: icons} = useSectionData<IconMap>({
    load: () => loadIcons(BREED_VERSE_RAIL),
    fetcher: signal => fetchIcons(BREED_VERSE_RAIL, signal),
    save: value => saveIcons(BREED_VERSE_RAIL, value),
    isEmpty: value => Object.keys(value).length === 0,
    empty: {},
  });

  const shown = useMemo(() => cardsForTab(tab, BREED_CARDS), [tab]);

  return (
    <FlatList
      style={styles.root}
      data={shown}
      // The path, not the index: keying by position would hand a Beagle's
      // mounted photo to a Bengal the moment the Dog tab drops it.
      keyExtractor={card => card.path}
      numColumns={2}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={<Tabs active={tab} onSelect={setTab} />}
      contentContainerStyle={[
        styles.content,
        {paddingBottom: EDGE + bottomInset},
      ]}
      showsVerticalScrollIndicator={false}
      renderItem={({item}) => (
        <Card card={item} image={icons[item.key]} onPress={onOpen} />
      )}
    />
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  content: {paddingHorizontal: EDGE, paddingTop: EDGE},
  row: {gap: GAP, marginBottom: GAP},

  /* The tab bar: the theme's cream field, its padding and its 30px skirt. */
  tabs: {
    backgroundColor: '#FFF7EB',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 19,
    paddingHorizontal: 15,
    marginBottom: 30,
  },
  /**
   * An inactive tab is bare text on the cream, so it carries the pill's
   * padding without its fill -- otherwise selecting one would shift all three.
   */
  tab: {paddingVertical: 10, paddingHorizontal: 20, borderRadius: 50},
  tabOn: {backgroundColor: '#FFE6BC'},
  tabText: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  tabTextOn: {fontWeight: '700'},

  /* The card. `overflow: hidden` is the theme's, and it is what cuts the
     photograph to the card's radius. */
  card: {width: CARD_WIDTH, borderRadius: 10, overflow: 'hidden'},
  pressed: {opacity: 0.82},
  /**
   * The photo's own box, sized whether or not a picture has arrived. An
   * unresolved card is a blank of the right height rather than a collapsed
   * one, so the grid never reflows as the 32 land.
   */
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.surface,
  },
  image: {width: '100%', height: '100%'},
  /**
   * The bordered white panel under the photo. The theme's own `1.8px solid
   * #000` and radius 10 -- see the module note on why only this half of the
   * card is bordered.
   */
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    paddingHorizontal: 7,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#000000',
  },
  name: {
    // `flexShrink`, so a long name ellipsises instead of pushing the arrow off
    // the card: "English Cocker Spaniel" is 21 characters at half a phone.
    flexShrink: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
});

export default BreedVerseScreen;
