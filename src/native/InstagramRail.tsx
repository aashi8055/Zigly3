/**
 * "From Our Instagram" — eight square covers, a reel badge on the videos.
 *
 * Section twenty-two, the last of the dashboard's content. ./instagram carries
 * the posts and the argument for freezing them; this draws them, matching the
 * `.zigly-ig` block in ../webview/injectedStyles measurement for measurement:
 *
 *   card    flex: 0 0 46%, square, border-radius 14px, ground #EFEFEF
 *   rail    gap 12px, horizontal scroll, snap to start
 *   badge   26x26 at top/right 8px, radius 8, rgba(0,0,0,0.45)
 *   glyph   15x15 white play triangle
 *   block   padding 8px 12px 24px, heading margin 22px 0 14px
 *
 * SQUARE BECAUSE THE COVERS ARE SQUARE. The web version notes it uses padding
 * rather than `aspect-ratio` so that "the covers are Instagram's own 640px
 * square crops, so the card is showing them at their natural shape and nothing
 * is cropped twice". `aspectRatio: 1` here is the same statement without the
 * CSS workaround.
 *
 * NO NETWORK, NO FAILURE STATE. The covers are bundled files (see ./instagram
 * on why `require` works here where the WebView needed base64), so there is
 * nothing to fetch, nothing to retry and no `useSectionData` -- this is the
 * only section in the set with no loading state at all besides ./PriceTiles.
 *
 * Which also means the web version's failed-cover treatment has no counterpart
 * here, and that is worth being explicit about rather than looking like an
 * omission. ../webview/injectedStyles draws a darker tile with a centred glyph
 * for a cover Instagram would not serve, and ../webview/instagramSection walks
 * a fallback URL list before giving up -- both exist because that rail loads
 * over the network and this one does not. A bundled `require()` that is missing
 * is a build error, not a runtime one.
 *
 * A TAP LEAVES THE APP, AND THAT IS THE POINT. `instagram.com` is in
 * `EXTERNAL_HOSTS`, so the screen hands the URL to the Instagram app or the
 * browser. ../webview/instagramSection uses a plain anchor for exactly this
 * reason -- "no window.open, which this app disables, and no login wall opening
 * inside the customer's shopping session". The absolute URL goes up and the
 * screen decides, as with the community cards.
 */
import React from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {
  INSTAGRAM_POSTS,
  INSTAGRAM_TITLE,
  type InstagramPost,
} from './instagram';

/** The rail's gap, from `.zigly-ig__rail { gap: 12px }`. */
const GAP = 12;

/** The block's horizontal padding, from `.zigly-ig { padding: 8px 12px 24px }`. */
const GUTTER = 12;

/**
 * How many cards fill the rail's width.
 *
 * 2.25, so two covers and a quarter of the third are on screen: the fraction is
 * what tells the customer the rail scrolls. The same figure and the same
 * reasoning as `WIDE_VISIBLE` in ./TileRow, which sizes the Explore tiles.
 */
const CARDS_VISIBLE = 2.25;

/**
 * The card's edge for a given rail width, IN DP RATHER THAN A PERCENTAGE.
 *
 * THIS IS THE FIX FOR THE CUT-OFF FRAME, and the percentage was the cause.
 * `width: '46%'` was carried over from the web version's `flex: 0 0 46%`, where
 * it is correct because a CSS flex item resolves its percentage against the
 * flex container's own content box. React Native has no such guarantee inside a
 * horizontal `ScrollView`: the scroll content's width is unbounded by design --
 * that is what makes it scrollable -- so a percentage width has no definite
 * base to resolve against. Android measured it against a width that is not the
 * screen's, so the squares came out the wrong size and the last one was clipped
 * mid-cover.
 *
 * Sized in dp from the measured rail width instead, which is what every other
 * rail on the dashboard already does (`breedSize` and `wideSize` in ./TileRow).
 * The gaps and the leading gutter are subtracted first so the arithmetic
 * describes the row that is actually drawn -- 2.25 cards, 2 gaps between them,
 * and the gutter at each end -- rather than an idealised one.
 */
export const coverSize = (width: number): number =>
  Math.round((width - 2 * GUTTER - CARDS_VISIBLE * GAP) / CARDS_VISIBLE);

/**
 * The fallback edge, for a rail drawn before anything has measured it.
 *
 * 150dp is `coverSize` at 360dp, the width this app's reference phone reports.
 * A number rather than a percentage for the reason above: at least this one is
 * wrong by a predictable amount on an unusual screen, instead of being
 * undefined on every screen.
 */
const FALLBACK_SIZE = 150;

/**
 * The reel marker's play triangle.
 *
 * The same path ../webview/instagramSection embeds, at the same 15x15 in a
 * 24-unit box, so the badge is identical to the one the WebView draws. Copied
 * rather than redrawn: it is already the app's own glyph for this, and two
 * hand-drawn triangles would differ.
 */
const ReelGlyph = () => (
  <Svg viewBox="0 0 24 24" width={15} height={15}>
    <Path
      fill="#FFFFFF"
      d="M9.5 7.8v8.4c0 .5.6.9 1 .6l6.7-4.2c.4-.2.4-.8 0-1L10.5 7.2c-.4-.3-1 .1-1 .6z"
    />
  </Svg>
);

type Props = {
  /** An absolute instagram.com URL. Leaves the app -- see the note above. */
  onOpen: (url: string) => void;
  /** The rail's width, so a percentage card can be measured for snapping. */
  railWidth?: number;
};

const Card = ({
  post,
  size,
  onOpen,
}: {
  post: InstagramPost;
  /** The card's edge in dp. Square, so one number. See `coverSize`. */
  size: number;
  onOpen: (url: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(post.url)}
    accessibilityRole="link"
    // The caption, as the web version uses it for alt text. The reel badge is
    // decorative, so the label says which cards are videos.
    accessibilityLabel={post.isVideo ? `Reel: ${post.alt}` : post.alt}
    /*
     * The size is given rather than styled, and both edges are set explicitly.
     * `aspectRatio: 1` alone would leave the square dependent on the width
     * resolving, which is the problem this replaced -- stating height as well
     * means the card cannot be measured into the wrong shape.
     */
    style={[styles.card, {width: size, height: size}]}
  >
    {({pressed}) => (
      <>
        <Image
          source={post.cover}
          style={[styles.image, pressed && styles.imagePressed]}
          // `cover` on a square card holding a square crop is a no-op in the
          // usual case, and guards against a cover saved at another ratio.
          resizeMode="cover"
          accessible={false}
        />
        {post.isVideo ? (
          <View style={styles.badge}>
            <ReelGlyph />
          </View>
        ) : null}
      </>
    )}
  </Pressable>
);

const InstagramRail = ({onOpen, railWidth}: Props) => {
  /*
   * Nothing to draw. Cannot happen in a shipped build -- a missing cover is a
   * bundler error -- but a rail of nothing under a heading would be worse than
   * no section, so the section ends the page one block earlier instead.
   */
  if (!INSTAGRAM_POSTS.length) {
    return null;
  }

  /**
   * The card's edge, and the pitch the rail snaps to.
   *
   * One derivation for both, which is the point: the snap interval has to be
   * the card plus the gap, and computing the two from different formulas is
   * how a rail ends up snapping to somewhere that is not a card edge. It did
   * before -- the snap was `railWidth * 0.46 + GAP` while the card was a
   * percentage measured against something else entirely.
   *
   * Without a measured width the rail still scrolls, at `FALLBACK_SIZE`, and
   * simply does not snap: a wrong snap interval fights the thumb, while no
   * snap is merely plainer.
   */
  const size = railWidth ? coverSize(railWidth) : FALLBACK_SIZE;
  const snap = railWidth ? size + GAP : undefined;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{INSTAGRAM_TITLE}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}
        snapToInterval={snap}
        decelerationRate="fast"
        snapToAlignment="start"
        directionalLockEnabled
      >
        {INSTAGRAM_POSTS.map(post => (
          <Card key={post.id} post={post} size={size} onOpen={onOpen} />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    // `.zigly-ig { padding: 8px 12px 24px }` -- the 24 at the foot is the last
    // gap before the brand-claims strip that ends the page.
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontFamily: FONT_FAMILY,
    // The web version notes the heading "matches 'Hot Picks Of The Week'
    // exactly", inheriting the transplanted-slot h2 rules -- which is the 17/700
    // every other native section states. Its own margins are 22px 0 14px.
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    paddingHorizontal: GUTTER,
    marginTop: 22,
    marginBottom: 14,
  },
  track: {
    flexDirection: 'row',
    // On the content container, not the scroller: a scroll container's start
    // padding is scrolled away and older Android drops the end padding. See
    // ../webview/injectedStyles.
    paddingHorizontal: GUTTER,
    gap: GAP,
    // `.zigly-ig__rail { padding-bottom: 6px }`.
    paddingBottom: 6,
  },
  card: {
    /*
     * NO WIDTH AND NO `aspectRatio` HERE. Both edges are set inline from
     * `coverSize` -- see the note on the `style` prop in `Card`, and
     * `coverSize` itself for why a percentage was the cut-off frame's cause.
     * Square is still the shape; it is now stated in dp instead of inferred.
     */
    borderRadius: 14,
    overflow: 'hidden',
    // Holds the card's shape while the cover decodes, so the rail does not
    // assemble itself in front of the customer. The web version's own #EFEFEF.
    backgroundColor: '#EFEFEF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePressed: {
    opacity: 0.82,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});

export default InstagramRail;
