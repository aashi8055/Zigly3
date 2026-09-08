/**
 * "Real Pets. Real Stories. Real Community." — two partner cards.
 *
 * Section twenty-one. ./community carries the data; this draws it.
 *
 * STACKED, NOT A RAIL, and for a different reason from the other stacked
 * sections. There are only two cards and each carries a paragraph of forty-odd
 * words: a horizontal rail would either cut the second card off mid-sentence or
 * shrink both until the copy was unreadable. Two full-width cards one above the
 * other is the shape the content asks for, and it is what the theme does on a
 * phone too.
 *
 * THE LOGOS ARE NOT PHOTOGRAPHS. `ZF-300X200.png` and the Petsfamilia wordmark
 * are logos on a light ground, so they are `contain`ed inside a fixed box
 * rather than `cover`ing one -- cropping a wordmark cuts letters off, and these
 * two are the partner's identity rather than decoration.
 *
 * EVERY CARD KEEPS ITS TEXT. Both cards have a name, a paragraph and a button
 * from theme settings, so a logo that has not resolved costs the picture and
 * nothing else -- the good failure mode, as with ./ConcernRail. The logo box
 * holds its space so the two cards stay the same height.
 *
 * BOTH BUTTONS LEAVE THE APP. ziglyfoundation.com and an Instagram profile,
 * neither in `INTERNAL_HOSTS`. The absolute URL is handed up and the screen
 * decides -- this component does not open a browser itself, because that
 * decision belongs in one place. ./community carries the full note.
 */
import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {
  COMMUNITIES,
  COMMUNITY_RAIL,
  COMMUNITY_TITLE,
  type Community,
} from './community';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/** The logo box. 300x200 artwork, so 3:2, at a size a wordmark stays legible. */
const LOGO_WIDTH = 108;
const LOGO_HEIGHT = 72;

const EMPTY_ICONS: IconMap = {};

type Props = {
  /** An absolute URL. Both partners are off-site. */
  onOpen: (url: string) => void;
};

/**
 * One partner card, in every state.
 *
 * One implementation rather than one per state, as ./ConcernRail settled on:
 * only the contents of the logo box change.
 */
const Card = ({
  community,
  logo,
  pulse,
  waiting,
  onOpen,
}: {
  community: Community;
  logo?: string;
  pulse: Animated.Value;
  waiting: boolean;
  onOpen: (url: string) => void;
}) => (
  <View style={[styles.card, {backgroundColor: community.background}]}>
    {logo ? (
      <Image
        source={{uri: logo}}
        style={styles.logo}
        // `contain`: a wordmark cropped is a wordmark with letters missing.
        resizeMode="contain"
        accessible={false}
      />
    ) : waiting ? (
      <Block pulse={pulse} style={styles.logoPlaceholder} />
    ) : (
      // Given up: the box holds its space so both cards stay level.
      <View style={styles.logo} />
    )}

    <Text style={styles.name}>{community.name}</Text>
    <Text style={styles.description}>{community.description}</Text>

    <Pressable
      onPress={() => onOpen(community.link)}
      accessibilityRole="link"
      accessibilityLabel={`${community.button}, ${community.name}`}
      style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text numberOfLines={1} style={styles.buttonLabel}>
        {community.button}
      </Text>
    </Pressable>
  </View>
);

const CommunityCards = ({onOpen}: Props) => {
  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(COMMUNITY_RAIL as TileRail),
    fetcher: signal => fetchIcons(COMMUNITY_RAIL as TileRail, signal),
    save: learned => saveIcons(COMMUNITY_RAIL as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{COMMUNITY_TITLE}</Text>
      {COMMUNITIES.map(community => (
        <Card
          key={community.key}
          community={community}
          logo={icons[community.key]}
          pulse={pulse}
          waiting={loading}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginBottom: 22,
    paddingHorizontal: GUTTER,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  card: {
    // The background is the block's own `brand_color`, so it is set inline.
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    // Left-aligned rather than centred: a forty-word paragraph centred is
    // harder to read, and the theme left-aligns it too.
    alignItems: 'flex-start',
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    marginBottom: 10,
  },
  logoPlaceholder: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    borderRadius: 8,
    marginBottom: 10,
  },
  name: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 4,
  },
  description: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.ink,
    marginBottom: 12,
  },
  button: {
    // Navy on the pale card, which is the theme's own pairing for these
    // buttons and reads as the card's one action.
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default CommunityCards;
