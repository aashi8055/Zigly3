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
 * The card's width as a share of the rail.
 *
 * `flex: 0 0 46%` in the web version -- just under half, so two cards and the
 * edge of a third are on screen and the rail plainly continues. Expressed as a
 * percentage string for the same reason: a fixed dp would show a different
 * number of cards on a tablet.
 */
const CARD_WIDTH = '46%';

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
  onOpen,
}: {
  post: InstagramPost;
  onOpen: (url: string) => void;
}) => (
  <Pressable
    onPress={() => onOpen(post.url)}
    accessibilityRole="link"
    // The caption, as the web version uses it for alt text. The reel badge is
    // decorative, so the label says which cards are videos.
    accessibilityLabel={post.isVideo ? `Reel: ${post.alt}` : post.alt}
    style={styles.card}
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
   * The snap interval, when the caller knows the rail's width.
   *
   * A card is 46% of the rail, so the pitch is that plus the gap. Without a
   * width the rail still scrolls -- it simply does not snap, which is the right
   * degradation: a wrong snap interval fights the thumb, while no snap is
   * merely plainer.
   */
  const snap = railWidth ? Math.round(railWidth * 0.46) + GAP : undefined;

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
          <Card key={post.id} post={post} onOpen={onOpen} />
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
    width: CARD_WIDTH,
    // Square, because the covers are Instagram's own square crops.
    aspectRatio: 1,
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
