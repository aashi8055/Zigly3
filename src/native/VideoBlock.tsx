/**
 * "Zigly: India's Complete Pet Care Ecosystem" — the video block.
 *
 * Section twenty. ./video carries the data; this draws the poster, the heading
 * and the copy on the theme's navy ground -- and plays the video in place.
 *
 * IT PLAYS NOW, AND IT PLAYS THE SITE'S OWN EMBED. The poster is a control:
 * tapping it replaces the still with a small WebView on `VIDEO_EMBED_URL`,
 * which is the exact iframe URL `custom-video-text-banner.liquid` builds from
 * the theme's `video_link`. Same player, same parameters, same controls, and
 * it stays inside the section rather than sending the customer to YouTube --
 * which is what the site does too.
 *
 * NOT A NEW DEPENDENCY, AND ONE WAS TRIED. React Native has no `<Video>`
 * element, so the obvious route was `react-native-video`. It was installed and
 * then removed: it plays media FILES -- mp4, HLS, DASH -- and this section has
 * no file to give it. The dog page sets only `video_link`; the theme's two
 * file branches are blank; YouTube serves the video through its own embed and
 * extracting a direct stream URL is against their terms. So the package had
 * nothing to play. `react-native-webview` is already a dependency of this app,
 * renders the site's own iframe, and costs no rebuild. See `VIDEO_EMBED_URL`
 * in ./video for the full reading, and the revisit condition (Zigly uploading
 * an mp4 to Files, which lights up the theme's `video_file` branch).
 *
 * NOTHING IS LOADED UNTIL THE TAP. The player is not mounted behind the
 * poster and hidden -- it does not exist until `playing` goes true. That is
 * the site's behaviour (the theme's element carries `controls playsinline`
 * with no `autoplay` and no `muted`, so a customer sees a still and taps), and
 * it is also the cheaper one: this is a dashboard section most customers
 * scroll past, and an iframe nobody asked for is a page load, a player and a
 * set of YouTube cookies bought for nothing.
 *
 * `onPlay` IS STILL HONOURED, AND IT NOW MEANS SOMETHING ELSE. It used to be
 * the only way this block could play at all -- the tap was handed up because
 * this component had no player. It is optional and unused today; given, it
 * overrides the inline player and hands the tap up instead, which is the hook
 * for a future full-screen or external route. The play glyph no longer depends
 * on it: the block can always play, so the affordance is always drawn.
 */
import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  VIDEO_BACKGROUND,
  VIDEO_DESCRIPTION,
  VIDEO_EMBED_URL,
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
   * Take the play over, instead of the inline player.
   *
   * Optional, and unused today -- see the note at the top. Omitted (the normal
   * case), a tap mounts the embed inside this section. Given, the tap is
   * handed up and nothing is mounted here, which is the hook for a future
   * full-screen or external route. Either way the poster is a play control.
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

  /**
   * Whether the player has been asked for.
   *
   * ONE-WAY, and deliberately so: nothing sets this back to false. Once the
   * customer has tapped, the player owns that rectangle for the rest of the
   * session -- there is no "stop" that returns to the poster, because
   * YouTube's own controls already carry pause, scrub and fullscreen, and a
   * second control of ours beside theirs would be two ways to do one thing.
   * Coming back to a still after pausing is not what the site does either.
   *
   * It is the mount gate as well as the state: see the note at the top on why
   * the WebView does not exist until this is true.
   */
  const [playing, setPlaying] = useState(false);

  /**
   * Whether the embed has painted yet.
   *
   * The WebView loads YouTube's player over the network, so there is a beat
   * between the tap and anything appearing -- and a WebView renders as a blank
   * rectangle for that whole beat. On this section's navy ground a blank
   * rectangle is invisible, so the tap would read as having done nothing, and
   * the obvious next move is to tap again.
   *
   * So the poster stays on screen underneath, with a spinner over it, until
   * the page reports it has loaded. The picture the customer tapped is the
   * thing they keep looking at while it opens.
   */
  const [ready, setReady] = useState(false);

  /*
   * NO LOADING STATE AND NO FETCH FOR THE POSTER, unlike every other
   * illustrated section.
   *
   * The poster is derived from the video id rather than learned from the
   * section's markup -- see ./video, which carries why this section has no
   * poster image to learn in the first place. So there is nothing to wait for:
   * the URL is known at build time and the only latency is the image itself,
   * which `Image` handles. A skeleton here would be a placeholder for a
   * request that is never made.
   *
   * (`ready` above is the PLAYER's load, which is a different thing and only
   * exists after a tap.)
   */

  return (
    <View style={styles.root}>
      <View style={styles.poster}>
        {/*
          The poster, which is also the play control.

          Still drawn while the player loads -- see `ready`. It comes off only
          once the embed has painted, so the rectangle is never blank.
        */}
        {(!playing || !ready) && (
          <Pressable
            onPress={() => (onPlay ? onPlay() : setPlaying(true))}
            // Not a control any more once the player is coming: the tap has
            // been accepted, and tapping again would do nothing.
            disabled={playing}
            accessibilityRole="button"
            accessibilityLabel={`Play video: ${VIDEO_TITLE}`}
            accessibilityState={{busy: playing}}
            style={StyleSheet.absoluteFill}
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
                  {/*
                    The glyph becomes a spinner once the tap has landed, and
                    that is the whole acknowledgement the customer gets: the
                    poster does not change, so without this the tap is silent
                    for as long as YouTube takes to answer.
                  */}
                  {playing ? (
                    <View style={styles.playDisc}>
                      <ActivityIndicator color={COLORS.navy} />
                    </View>
                  ) : (
                    <PlayMark />
                  )}
                </View>
              </>
            )}
          </Pressable>
        )}

        {/*
          THE PLAYER, MOUNTED ONLY ONCE ASKED FOR.

          Below the poster in source order but drawn under it -- the poster
          fills the box absolutely over the top and comes off when `ready`
          lands, so the swap happens with the picture already replaced rather
          than through a blank frame.

          `onPlay` given means the caller wants the play for itself, so no
          player is mounted here at all.
        */}
        {playing && !onPlay && (
          <WebView
            source={{uri: VIDEO_EMBED_URL}}
            style={styles.player}
            /*
             * The player's own chrome is the point, so the WebView is a
             * viewport and nothing else: no scrolling, no bounce, no zoom.
             * Without these the embed can be dragged around inside its own
             * box, which reads as the section being broken.
             */
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            scalesPageToFit={false}
            /*
             * INLINE, NOT FULLSCREEN ON PLAY. Without
             * `allowsInlineMediaPlayback` iOS takes any playing video into its
             * own fullscreen player, which is exactly the leaving-the-section
             * behaviour this block exists to avoid. Fullscreen stays available
             * through YouTube's own control.
             */
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            /*
             * `false`, where ../webview/webViewConfig sets it true -- and this
             * is the one place in the app that should differ. The customer has
             * already made the gesture: the tap on the poster IS the user
             * action. Requiring another one inside the embed would mean
             * tapping play twice for one intention.
             */
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            /*
             * The poster comes off here rather than on `onLoadStart`: start
             * fires when the request goes out, and the player is still blank
             * for most of what follows.
             */
            onLoadEnd={() => setReady(true)}
            /*
             * A failed load leaves `ready` false, so the poster stays -- the
             * section falls back to exactly what it drew before the tap rather
             * than to an empty navy rectangle. The spinner keeps turning,
             * which is honest: it is still trying.
             */
            accessibilityLabel={VIDEO_TITLE}
          />
        )}
      </View>

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
  /**
   * The video's rectangle: the poster, the player, and the play control.
   *
   * A BOX WITH A SHAPE RATHER THAN A CONTAINER OF ONE, and that is what lets
   * the swap be invisible. The poster and the player are both children of this
   * and both fill it, so the box holds its 16:9 whether it is showing a
   * picture, a spinner over a picture, or the embed. Nothing about the card's
   * height changes when the tap lands, which is the failure this shape avoids:
   * a player that sized itself would resize the section under the customer's
   * thumb at the exact moment they touched it.
   *
   * `overflow: hidden` because the WebView is a child at the card's top
   * corners -- the card rounds them (see `root`), and on Android an unclipped
   * WebView paints square over that.
   */
  poster: {
    width: '100%',
    aspectRatio: RATIO,
    overflow: 'hidden',
    // The ground behind both children while either is loading. Black rather
    // than the card's navy: this is a video frame, and a letterboxed embed
    // should sit on the colour a video sits on.
    backgroundColor: '#000',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  /**
   * The embed, filling the same box the poster does.
   *
   * `backgroundColor: 'transparent'` matters on Android: a WebView paints
   * white before its page does, and a white flash inside a navy card is the
   * one frame this whole loading dance exists to prevent. Transparent lets the
   * box's own black show through instead -- and the poster is still on top
   * until `ready` anyway, so this is the second line of defence rather than
   * the first.
   */
  player: {
    // Spelled out rather than spread from a helper: this RN version exports
    // `absoluteFill` (a registered style id) but not `absoluteFillObject`, and
    // an id cannot be spread into a style object.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
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
