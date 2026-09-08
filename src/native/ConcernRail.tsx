/**
 * "Care by Concern" — seven cards, photo over heading, subheading and button.
 *
 * Section fourteen. ./concerns carries the data; this draws it.
 *
 * EVERY CARD IS KEPT, unlike the offer rails. These cards have real text, so a
 * card whose photo has not resolved still says what it is and still goes
 * somewhere -- the same degradation ../webview/instagramSection settled on and
 * the one this app prefers wherever there is a label to fall back to. The photo
 * box holds its space with a plain ground rather than collapsing, so the rail
 * stays level.
 *
 * THE WHOLE CARD IS ONE TAP TARGET. ../webview/concernCards has to build that
 * on the web side -- the theme makes only the button a link, so it "moves each
 * card's contents into an anchor carrying that card's own Shop Now
 * destination". Native gets it for one `Pressable`, and the button inside is
 * then drawn as the affordance it always looked like rather than as a second
 * target competing with the card around it. That is why it is a `View` and not
 * a nested `Pressable`: two overlapping targets going to the same place is a
 * tap that sometimes registers on the wrong one.
 *
 * THE BUTTON IS RED, AND THAT IS NOT THE CARD-BUTTON EXCEPTION.
 * ../../__tests__/buttonColour.test.ts governs ADD-TO-CART buttons: pale
 * `BUTTON_FILL` on a product card, solid red only on the product page's sticky
 * bar. This is neither -- it is a navigation button, `#ed2427` in the theme's
 * own stylesheet for this section, and `COLORS.red` is that same colour. No
 * add-to-cart control is drawn here, so the two rules do not meet.
 */
import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {
  CONCERNS,
  CONCERNS_BUTTON,
  CONCERNS_RAIL,
  CONCERNS_TITLE,
  type Concern,
} from './concerns';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/**
 * The card's width.
 *
 * The theme's mobile rule is `width: calc(calc(100% / 2.5) - 10px)` -- two and
 * a half cards on screen. On a 360dp phone that is ~134dp; 148 is a little
 * wider because these cards carry three lines of text under the photo where
 * the theme's carry the same three at a smaller size, and "Weight Management"
 * needs the room.
 */
const CARD_WIDTH = 148;

/** The photo, at the artwork's own 660x405. */
const IMAGE_RATIO = 660 / 405;

const EMPTY_ICONS: IconMap = {};

type Props = {
  onOpen: (path: string) => void;
};

/**
 * One card, in every state.
 *
 * ONE implementation, not one per state, and that is deliberate: the card is
 * the same shape with a photo, without a photo, and while its photo is still
 * out, so a second copy for the loading case would be two card layouts kept in
 * step by nothing but attention. That is exactly the drift
 * ../webview/productCard exists to undo on the web side. Only the contents of
 * the photo box change.
 *
 * `pulse` is passed rather than created here so every card in the rail breathes
 * in step -- ../components/Skeleton's note on `usePulse` explains why blocks
 * pulsing independently reads as noise rather than as one screen waiting.
 */
const Card = ({
  concern,
  image,
  pulse,
  waiting,
  onOpen,
}: {
  concern: Concern;
  image?: string;
  pulse: Animated.Value;
  /** The photo has not arrived and is still being waited for. */
  waiting: boolean;
  onOpen: (path: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(concern.path)}
    accessibilityRole="link"
    // One label for the whole card, so a screen reader says the concern, its
    // line and the action together rather than as three unrelated strings.
    accessibilityLabel={`${concern.heading}. ${concern.subheading}. ${CONCERNS_BUTTON}`}
    style={styles.card}
  >
    {({pressed}) => (
      <>
        {image ? (
          <View style={styles.imageBox}>
            <Image
              source={{uri: image}}
              style={[styles.image, pressed && styles.imagePressed]}
              resizeMode="cover"
              accessible={false}
            />
          </View>
        ) : waiting ? (
          // Still out: the same box, pulsing.
          <Block pulse={pulse} style={styles.imagePlaceholder} />
        ) : (
          // Given up: the same box, plain. The card keeps its text and its
          // destination -- see the note at the top on why nothing is dropped.
          <View style={styles.imageBox} />
        )}
        <Text numberOfLines={2} style={styles.heading}>
          {concern.heading}
        </Text>
        <Text numberOfLines={2} style={styles.subheading}>
          {concern.subheading}
        </Text>
        {/*
          A View, not a Pressable: the card around it already goes here, and
          two overlapping targets to the same place is a tap that sometimes
          registers on the wrong one. See the note at the top.
        */}
        <View style={[styles.button, pressed && styles.buttonPressed]}>
          <Text numberOfLines={1} style={styles.buttonLabel}>
            {CONCERNS_BUTTON}
          </Text>
        </View>
      </>
    )}
  </Pressable>
);

const ConcernRail = ({onOpen}: Props) => {
  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(CONCERNS_RAIL as TileRail),
    fetcher: signal => fetchIcons(CONCERNS_RAIL as TileRail, signal),
    save: learned => saveIcons(CONCERNS_RAIL as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);

  /*
   * The cards are drawn whether or not their photos have arrived -- the text
   * is in the app. So `loading` only decides whether the photo boxes pulse,
   * and the rail never has a state where it is absent or a different shape.
   */
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{CONCERNS_TITLE}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        snapToInterval={CARD_WIDTH + GUTTER}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {CONCERNS.map(concern => (
          <Card
            key={concern.key}
            concern={concern}
            image={icons[concern.key]}
            pulse={pulse}
            waiting={loading}
            onOpen={onOpen}
          />
        ))}
      </ScrollView>
    </View>
  );
};

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
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller. See ../webview/injectedStyles.
    paddingHorizontal: GUTTER,
    gap: GUTTER,
  },
  card: {
    width: CARD_WIDTH,
  },
  imageBox: {
    width: '100%',
    aspectRatio: IMAGE_RATIO,
    // The theme's own `border-radius: 12px` for these cards.
    borderRadius: 12,
    overflow: 'hidden',
    // A card whose photo never arrives keeps this box, so the rail stays
    // level and the text below it does not move up.
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePressed: {
    opacity: 0.72,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: IMAGE_RATIO,
    borderRadius: 12,
    marginBottom: 8,
  },
  heading: {
    fontFamily: FONT_FAMILY,
    // The theme's `font-size: 2rem` on a 62.5% rem base, brought down to fit a
    // 148dp card: "Weight Management" and "Skin & Coat Care" both wrap to two
    // lines and must not clip.
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.ink,
  },
  subheading: {
    fontFamily: FONT_FAMILY,
    // The theme's `font-size: 1.4rem`.
    fontSize: 11.5,
    lineHeight: 15,
    color: COLORS.inkMuted,
    marginTop: 2,
    // Two lines reserved whether or not the copy needs them, so every card's
    // button sits on the same line.
    minHeight: 30,
  },
  button: {
    // The theme's own `background: #ed2427` and `border-radius: 8px` for this
    // section's button. COLORS.red is that colour. NOT the add-to-cart rule --
    // see the note at the top.
    backgroundColor: COLORS.red,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    // The theme darkens to #dc1a1d on hover; a dim is the touch equivalent.
    opacity: 0.82,
  },
  buttonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default ConcernRail;
