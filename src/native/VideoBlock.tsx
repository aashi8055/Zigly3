/**
 * "Zigly: India's Complete Pet Care Ecosystem" — the video block.
 *
 * Section twenty. ./video carries the data; this draws the poster, the heading
 * and the copy on the theme's navy ground.
 *
 * IT DOES NOT PLAY THE VIDEO, AND THAT IS AN OPEN DECISION RATHER THAN A GAP.
 * React Native has no `<Video>` element. Playing the mp4 needs a native module
 * -- `react-native-video` or `expo-video` -- and none is installed
 * (`package.json` carries react-native-webview, netinfo, safe-area-context and
 * react-native-svg; no media package). Adding one is a dependency decision with
 * a build cost attached, so it is not made silently here.
 *
 * The two ways it could be wired, recorded so the choice is a choice:
 *
 *   1. A media dependency, and this component gains a real player. Closest to
 *      the site, and the honest answer if the video matters -- but it is a
 *      native module, so it needs `npm install` and an Android/iOS rebuild, and
 *      it is the first non-trivial dependency this app would take on.
 *   2. Hand the tap to the WebView the app already runs, on the video's own
 *      page. No new dependency, and the customer gets the site's own controls
 *      -- but it leaves the dashboard for a video, which the site does not.
 *
 * Until then the block draws exactly what the site draws BEFORE a tap: the
 * poster frame, the heading and the paragraph. That is not a placeholder -- it
 * is the section's resting state, since the theme's `<video>` carries
 * `controls playsinline` with no `autoplay` and no `muted`. A customer who
 * never taps sees the same thing on the site and in the app.
 *
 * THE PLAY GLYPH APPEARS ONLY WHEN `onPlay` IS GIVEN. With
 * no handler the poster is announced as an image and takes no press state: a
 * play button that does nothing is worse than no play button. So the affordance
 * follows the capability rather than being painted on regardless.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import {
  VIDEO_BACKGROUND,
  VIDEO_DESCRIPTION,
  VIDEO_RAIL,
  VIDEO_TEXT,
  VIDEO_TITLE,
} from './video';
import {
  fetchIcons,
  loadIcons,
  saveIcons,
  type IconMap,
  type TileRail,
} from './tileIcons';
import {useSectionData} from './useSectionData';

const GUTTER = 12;

/** The poster, at the source video's 16:9. */
const RATIO = 16 / 9;

const EMPTY_ICONS: IconMap = {};

type Props = {
  /**
   * Play the video, if the app can.
   *
   * Optional on purpose -- see the note at the top. Omitted, the poster is a
   * picture; given, it is a play control.
   */
  onPlay?: () => void;
};

/** A play triangle in a white disc, drawn from Views rather than an asset. */
const PlayMark = () => (
  <View style={styles.playDisc}>
    <View style={styles.playTriangle} />
  </View>
);

const VideoBlock = ({onPlay}: Props) => {
  const {data: icons, loading} = useSectionData<IconMap>({
    load: () => loadIcons(VIDEO_RAIL as TileRail),
    fetcher: signal => fetchIcons(VIDEO_RAIL as TileRail, signal),
    save: learned => saveIcons(VIDEO_RAIL as TileRail, learned),
    isEmpty: map => !map || Object.keys(map).length === 0,
    empty: EMPTY_ICONS,
  });

  const pulse = usePulse(loading);
  const poster = icons[VIDEO_RAIL.tiles[0].key];

  return (
    <View style={styles.root}>
      {loading && !poster ? (
        <Block pulse={pulse} style={styles.posterPlaceholder} />
      ) : poster ? (
        onPlay ? (
          <Pressable
            onPress={onPlay}
            accessibilityRole="button"
            accessibilityLabel={`Play video: ${VIDEO_TITLE}`}
            style={styles.poster}
          >
            {({pressed}) => (
              <>
                <Image
                  source={{uri: poster}}
                  style={[styles.posterImage, pressed && styles.pressed]}
                  resizeMode="cover"
                  accessible={false}
                />
                <View style={styles.playOverlay}>
                  <PlayMark />
                </View>
              </>
            )}
          </Pressable>
        ) : (
          /*
           * No handler: a picture, not a control. No play glyph either -- see
           * the note at the top on why the affordance follows the capability.
           */
          <Image
            source={{uri: poster}}
            style={[styles.poster, styles.posterImage]}
            resizeMode="cover"
            accessibilityRole="image"
            accessibilityLabel={VIDEO_TITLE}
          />
        )
      ) : (
        /*
         * The poster never arrived. The heading and the copy are in the app, so
         * the block still says what Zigly wanted said -- unlike the offer
         * rails, there is text to fall back to.
         */
        null
      )}

      <View style={styles.copy}>
        <Text style={styles.title}>{VIDEO_TITLE}</Text>
        <Text style={styles.description}>{VIDEO_DESCRIPTION}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    // The theme's own `background_color` for this block. Full-bleed, so the
    // navy runs to both edges as it does on the site.
    backgroundColor: VIDEO_BACKGROUND,
    marginBottom: 22,
  },
  poster: {
    width: '100%',
    aspectRatio: RATIO,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.86,
  },
  posterPlaceholder: {
    width: '100%',
    aspectRatio: RATIO,
    borderRadius: 0,
  },
  /** Centred over the poster, without intercepting anything. */
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDisc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * A right-pointing triangle from one View: three transparent borders and one
   * coloured, which is the standard trick and needs no asset. Offset two pixels
   * right because a triangle's visual centre sits left of its bounding box, so
   * an unshifted one reads as off-centre inside the disc.
   */
  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLORS.navy,
  },
  copy: {
    paddingHorizontal: GUTTER + 4,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    // The theme's own `text_color` -- white on the navy ground.
    color: VIDEO_TEXT,
    marginBottom: 8,
  },
  description: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    lineHeight: 19,
    color: VIDEO_TEXT,
    // Slightly under full white: forty lines of pure white on navy is harsh,
    // and the heading above it should still read as the louder of the two.
    opacity: 0.88,
  },
});

export default VideoBlock;
