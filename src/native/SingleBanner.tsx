/**
 * One full-width banner: an image, and usually a link.
 *
 * Draws the theme's `custom-single-banner` instances -- the Vet Care banner
 * (section thirteen) and the brand-claims strip that closes the dashboard.
 * ./singleBanners carries the data and why these are images and nothing else.
 *
 * A BANNER WITH NO LINK IS NOT A CONTROL. The brand-claims strip's
 * `button_link` is empty in the theme: it is a row of claim icons, a statement
 * rather than a destination. So it is drawn as an image with
 * `accessibilityRole="image"`, takes no press state, and cannot be tapped --
 * announcing it as a link and then doing nothing is worse than not announcing
 * it at all.
 *
 * EDGE TO EDGE, LIKE THE HERO CAROUSEL. ../webview/injectedStyles already
 * strips the inset and radius off the banner carousel at the top of the
 * dashboard, on the grounds that on a phone an inset strip "reads as a bordered
 * card floating in a gutter rather than the full-width banner the reference app
 * shows". The same argument applies here and to the same kind of artwork, so
 * these are full-bleed too -- which is a deliberate departure from this
 * section's own `border-radius: 10px`.
 *
 * THE ASPECT RATIO IS THE ARTWORK'S. The mobile crops are 600x210, so 20:7.
 * Stated as a ratio rather than a fixed height so the banner is the same shape
 * on every screen width, and `cover` then trims a sliver rather than
 * letterboxing.
 *
 * NO LABEL TO FALL BACK ON, so an unresolved banner draws nothing at all
 * rather than a blank strip -- ./OfferRail carries that argument, and it is why
 * a skeleton holds the space while the fetch is out.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {Block, usePulse} from '../components/Skeleton';
import type {SingleBanner as SingleBannerData} from './singleBanners';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

/** 600x210, the mobile crop's own ratio. */
const RATIO = 600 / 210;

const EMPTY_ICONS: IconMap = {};

type Props = {
  banner: SingleBannerData;
  onOpen: (path: string) => void;
};

const SingleBanner = ({banner, onOpen}: Props) => {
  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(banner as TileRail),
    fetcher: signal => fetchIcons(banner as TileRail, signal),
    save: learned => saveIcons(banner as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);
  const tile = banner.tiles[0];
  const image = tile ? icons[tile.key] : undefined;

  if (loading) {
    return (
      <View style={styles.root}>
        <Block pulse={pulse} style={styles.placeholder} />
      </View>
    );
  }

  // Out of retries: no banner. A blank strip that will never fill states that
  // something is missing; one fewer section simply ends the page earlier.
  if (!image || !tile) {
    return null;
  }

  /*
   * An empty `path` is the theme's own "no link" -- see ./singleBanners on the
   * brand-claims strip. Drawn as a picture, with no press state and no link
   * role.
   */
  if (!tile.path) {
    return (
      <View style={styles.root}>
        <Image
          source={{uri: image}}
          style={styles.image}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={tile.label}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => onOpen(tile.path)}
        accessibilityRole="link"
        // The words are lettering inside the artwork, so this is the only
        // description a screen reader gets.
        accessibilityLabel={tile.label}
      >
        {({pressed}) => (
          <Image
            source={{uri: image}}
            style={[styles.image, pressed && styles.pressed]}
            // `cover`: the crop is cut for this ratio, so this trims a sliver
            // rather than letterboxing the banner against the page.
            resizeMode="cover"
            accessible={false}
          />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    // No horizontal padding: full-bleed, as the hero carousel is. See the note
    // at the top on why the section's own 10px radius is dropped.
    marginBottom: 22,
  },
  image: {
    width: '100%',
    aspectRatio: RATIO,
  },
  pressed: {
    opacity: 0.86,
  },
  /**
   * Square-cornered, like the banner it stands in for.
   *
   * `Skeleton.tsx`'s `block` gives every placeholder an 8px radius by default
   * and this overrides it back to none, deliberately: the banner is full-bleed
   * with square corners, and a rounded placeholder would round off at the
   * screen edge and then square up when the image landed. That is the visible
   * settling this app exists to avoid, and it is the same mistake the
   * ./BestDeals skeleton made with its widths.
   */
  placeholder: {
    width: '100%',
    aspectRatio: RATIO,
    borderRadius: 0,
  },
});

export default SingleBanner;
