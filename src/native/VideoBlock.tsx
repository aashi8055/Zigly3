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
import React, {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  VIDEO_BACKGROUND,
  VIDEO_DESCRIPTION,
  VIDEO_POSTER,
  VIDEO_POSTER_FALLBACK,
  VIDEO_TEXT,
  VIDEO_TITLE,
} from './video';

const GUTTER = 12;

/** The poster, at the source video's 16:9. */
const RATIO = 16 / 9;

/**
 * How many lines of the paragraph show before "Read more".
 *
 * FIVE, and the figure is a viewport budget rather than a taste. See the note
 * on `root` below: the dashboard clips away everything after a section taller
 * than the viewport, and this is the tallest section on the page. On a 360dp
 * phone the poster is 189dp and the copy's fixed furniture -- padding, the
 * heading, the toggle row -- is another 94dp, so the paragraph is the only
 * part of the card whose height is a choice. At its full 9 lines the card
 * comes to 454dp, which overflows a short screen's viewport and takes Real
 * Pets, From Our Instagram and the logo strip with it.
 *
 * Five lines put the collapsed card at 378dp, comfortably inside the ~526dp
 * a 640dp-tall phone leaves between the header and the bottom bar. Nothing is
 * lost: the tap expands it in place, and an expanded card is allowed to be
 * tall because it is the customer's own doing -- by then they have scrolled it
 * to the top of the screen, and the sections below are reached by collapsing
 * it again or by the scroll that follows.
 */
const DESCRIPTION_LINES = 5;

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
  /**
   * Fall back to the standard-definition still if the HD one 404s.
   *
   * `maxresdefault` exists for this video, but it is the one YouTube still
   * that is not guaranteed -- it is only generated for uploads above 720p. If
   * Zigly ever swaps the video for a lower-resolution one, this keeps the
   * block illustrated instead of blank. `hqdefault` exists for every video.
   */
  const [hd, setHd] = useState(true);
  const poster = hd ? VIDEO_POSTER : VIDEO_POSTER_FALLBACK;

  /**
   * Whether the paragraph is showing in full.
   *
   * Collapsed to `DESCRIPTION_LINES` until tapped -- see that constant for the
   * viewport budget behind the figure. The site shows the whole paragraph and
   * so does this once expanded; the cap exists because this app draws the
   * block inside a clipping scroller and the site does not.
   */
  const [expanded, setExpanded] = useState(false);

  /*
   * NO LOADING STATE AND NO FETCH, unlike every other illustrated section.
   *
   * The poster is derived from the video id rather than learned from the
   * section's markup -- see ./video, which carries why this section has no
   * poster image to learn in the first place. So there is nothing to wait for:
   * the URL is known at build time and the only latency is the image itself,
   * which `Image` handles. A skeleton here would be a placeholder for a
   * request that is never made.
   */
  const image = (
    <Image
      source={{uri: poster}}
      style={[styles.poster, styles.posterImage]}
      resizeMode="cover"
      onError={() => setHd(false)}
      {...(onPlay
        ? {accessible: false}
        : {
            accessibilityRole: 'image' as const,
            accessibilityLabel: VIDEO_TITLE,
          })}
    />
  );

  return (
    <View style={styles.root}>
      {onPlay ? (
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
                onError={() => setHd(false)}
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
        image
      )}

      <View style={styles.copy}>
        <Text style={styles.title}>{VIDEO_TITLE}</Text>
        <Text
          style={styles.description}
          /*
           * `undefined` rather than 0 when expanded: on Android
           * `numberOfLines={0}` is not "no limit" in every RN version, and
           * omitting the prop is the only spelling that reliably means it.
           */
          numberOfLines={expanded ? undefined : DESCRIPTION_LINES}
        >
          {VIDEO_DESCRIPTION}
        </Text>
        {/*
          The toggle, and it goes both ways.
          A "Read more" with no way back would leave the card tall for the rest
          of the session -- which is the state the cap exists to avoid.
        */}
        <Text
          onPress={() => setExpanded(current => !current)}
          accessibilityRole="button"
          accessibilityState={{expanded}}
          style={styles.more}
        >
          {expanded ? 'Read less' : 'Read more'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * A CARD, INSET AND ROUNDED -- not the full-bleed field this used to draw.
   *
   * The old note here said "full-bleed, so the navy runs to both edges as it
   * does on the site", and that was simply wrong about the site. Read from
   * `zigly-website-code/.../sections/custom-video-text-banner.liquid`: the
   * section carries the `page-width` class, so it is inset like every other
   * section, and `.content-video-text-banner` sets `border-radius: 16px` with
   * the mobile rules rounding the video's top corners to match. It is a card
   * on the page, and it never touched the window's edges.
   *
   * WHY IT MATTERED RATHER THAN BEING A DETAIL. The poster is a photograph of
   * a warm brown living room -- brown sofa, brown floor, lamplight. Bled to
   * both edges with the navy copy directly beneath it and no boundary between
   * them, the two read as one continuous block whose colour changes halfway
   * down: the navy appeared to "turn brown" further down the page, which is
   * exactly how it was reported. Neither colour was wrong; the missing edge
   * was. Inset and rounded, the poster is a picture inside a card and the navy
   * is the card's own ground, so the change of colour lands on a border where
   * the eye expects one.
   */
  root: {
    // The theme's own `background_color` for this block.
    backgroundColor: VIDEO_BACKGROUND,
    marginHorizontal: GUTTER,
    borderRadius: 16,
    /*
     * THIS CARD MUST STAY SHORTER THAN THE VIEWPORT, and that is a constraint
     * from ../native/NativeDashboard rather than a look.
     *
     * The dashboard scrolls with `removeClippedSubviews`, and on Android the
     * clipping stops re-attaching the children that follow a section taller
     * than the viewport. This block is the tallest section on the page -- a
     * 16:9 poster plus a 431-character paragraph -- and when it overflowed,
     * the three sections after it (Real Pets, From Our Instagram, the logo
     * strip) never came back: the navy card with its brown-sofa poster read as
     * a wall ending the page just below "Pet Parenting Made Easy", which is
     * exactly how it was reported.
     *
     * `maxHeight` is not the fix and was not used -- it would clip the card's
     * own text instead. The paragraph is capped at `DESCRIPTION_LINES` below,
     * which is what keeps the whole card inside a short screen's viewport.
     */
    // The poster is a child at the top corners, so the card has to clip it --
    // without this Android paints the image square over the rounded ground.
    overflow: 'hidden',
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
  /**
   * The copy, inside the card.
   *
   * `GUTTER + 4` before, which was the page's own inset -- correct when this
   * block ran to both edges and had to create its own. The card now supplies
   * that, so repeating it here would inset the text twice and leave the
   * paragraph in a narrow column down the middle of the card. 16 is the
   * theme's own mobile figure, near enough: `.text-div-banner` sets
   * `padding: 20px 16.5px` below 749px.
   */
  copy: {
    paddingHorizontal: 16,
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
  /**
   * "Read more" / "Read less", on the card's own navy.
   *
   * Full white against the paragraph's 0.88, so it reads as the control rather
   * than as another line of the copy. `paddingTop` gives it a tap target
   * without a border: the paragraph's last line ends flush against it
   * otherwise.
   */
  more: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '700',
    color: VIDEO_TEXT,
    paddingTop: 8,
  },
});

export default VideoBlock;
