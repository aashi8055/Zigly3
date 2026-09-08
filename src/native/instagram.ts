/**
 * "From Our Instagram" — the rail that closes the dashboard.
 *
 * Section twenty-two, and THE ONE SECTION NOT SOURCED FROM ZIGLY.COM. Every
 * other section on this page is the site's own data; this one cannot be,
 * because zigly.com has no Instagram section and nothing on it pulls a feed.
 * DATA-SOURCES.md §9 states the exception in full and it is worth reading
 * before touching this.
 *
 * THE POSTS ARE REAL, AND THEY ARE FROZEN. Eight posts from Zigly's own public
 * account, @ziglypetcare, read on 2026-08-31 -- their posts, their captions,
 * their ordering. The app makes no Instagram request at runtime. That is a
 * deliberate trade over a live feed:
 *
 *   + the section cannot be slow, cannot fail halfway, cannot be rate-limited
 *     mid-scroll, and does not tell Instagram which page the customer is on;
 *   - the rail ages. These are posts from August 2026, and the heading implies
 *     a recency the list cannot keep on its own.
 *
 * NEWEST FIRST, IN THE ACCOUNT'S OWN ORDER, NOT GROUPED.
 * ../webview/instagramSection records that an earlier version put every reel
 * ahead of every photo and that it was dropped: "the heading says 'From Our
 * Instagram', so the order the account shows is the order that is true, and
 * re-sorting it was the app editing Zigly's feed." Same order here.
 *
 * THE COVERS ARE `require()`d FILES, NOT BASE64 -- and this is the one place
 * the native version is simpler than the web one rather than merely different.
 * ../webview/instagramCovers holds each cover as a base64 data: URI, and
 * explains why it has to: "The rail is not React Native markup -- it is a
 * string of JavaScript injected into a WebView showing https://zigly.com. A
 * require()d asset resolves to a Metro URL in dev and a local file path in
 * release, and a remote https document cannot load either."
 *
 * That constraint is the WebView's, and it does not apply here. The same eight
 * covers already exist as real files in ../assets/instagram/, one per
 * shortcode, and a native `<Image source={require(...)}>` loads them directly.
 * So the bytes ship once as JPEGs rather than twice -- once as files and again
 * inflated ~33% inside a JavaScript string.
 *
 * WHICH MEANS THERE IS NO FALLBACK URL HERE, deliberately. The web version
 * keeps `instagram.com/p/<code>/media/` as each card's fallback for the case
 * where a bundled cover is missing -- a shortcode added without re-running the
 * tool. A bundled `require()` cannot be missing: it is a build error, not a
 * runtime one, so the case the fallback exists for cannot happen. Removing it
 * also removes the one third-party request the web rail can still make.
 *
 * REFRESHING THE LIST. Replace `POSTS` below, drop the matching JPEGs into
 * ../assets/instagram/ named `<shortcode>.jpg`, and add them to `COVERS`. The
 * only field that must be right is the shortcode: the link is derived from it,
 * `isVideo` decides the reel badge, and `alt` is the caption used as alt text.
 * `../../tools/fetch-instagram-covers.js` fetches covers for the web version
 * and is the way to get the JPEGs.
 */
import type {ImageSourcePropType} from 'react-native';

/** One post, as the rail draws it. */
export type InstagramPost = {
  /** The shortcode out of the post's own URL. Eleven characters. */
  readonly id: string;
  /** The post's page, derived from the shortcode. */
  readonly url: string;
  /** The bundled cover. */
  readonly cover: ImageSourcePropType;
  /** Reels get a badge; photos do not. */
  readonly isVideo: boolean;
  /** The caption's first sentence, used as alt text. */
  readonly alt: string;
};

/** The section heading, as ../webview/instagramSection sets it. */
export const INSTAGRAM_TITLE = 'From Our Instagram';

/**
 * The covers, keyed by shortcode.
 *
 * `require` rather than `import` because Metro resolves image assets by static
 * literal, and a map of them has to name each one. Kept beside `POSTS` so the
 * two lists are edited together -- a post without a cover is a build error
 * here, which is the point.
 */
const COVERS: Record<string, ImageSourcePropType> = {
  DckoBPbsv7S: require('../assets/instagram/DckoBPbsv7S.jpg'),
  DcivNaap81K: require('../assets/instagram/DcivNaap81K.jpg'),
  Dcim_m3uAF_: require('../assets/instagram/Dcim_m3uAF_.jpg'),
  DcdyTRxgdyu: require('../assets/instagram/DcdyTRxgdyu.jpg'),
  DcbTqEBA5lX: require('../assets/instagram/DcbTqEBA5lX.jpg'),
  DcYOOO2K6_N: require('../assets/instagram/DcYOOO2K6_N.jpg'),
  DcTeBeggVFK: require('../assets/instagram/DcTeBeggVFK.jpg'),
  DcSsGr8Td5R: require('../assets/instagram/DcSsGr8Td5R.jpg'),
};

/**
 * The eight posts, verbatim from ../webview/instagramSection.
 *
 * Captions are the posts' own, trimmed to their first sentence with hashtags,
 * @-mentions and emoji removed: the whole caption is a paragraph and this is
 * alt text, read aloud one card at a time.
 */
const POSTS: readonly {id: string; isVideo: boolean; alt: string}[] = [
  {
    id: 'DckoBPbsv7S',
    isVideo: true,
    alt: 'The only sibling who never steals your clothes, just your entire bed',
  },
  {
    id: 'DcivNaap81K',
    isVideo: true,
    alt: 'Gurgaon pet parents, there’s a new pet spot you should know about!',
  },
  {
    id: 'Dcim_m3uAF_',
    isVideo: true,
    alt: 'Pet Pampering Credits: Zigly Pet Care Surat, get ready to tag us along on your pet parenting journey',
  },
  {
    id: 'DcdyTRxgdyu',
    isVideo: true,
    alt: 'Surat, get ready to pamper your furry besties!',
  },
  {
    id: 'DcbTqEBA5lX',
    isVideo: false,
    alt: 'Your pet’s bowl of nutrition is incomplete without hydration',
  },
  {
    id: 'DcYOOO2K6_N',
    isVideo: false,
    alt: 'Taking care of those pearly whites means fresher puppy breath, stronger bites, and way fewer vet worries down the road',
  },
  {
    id: 'DcTeBeggVFK',
    isVideo: true,
    alt: 'Tell me your dog loves playing in puddles without telling me they love puddles',
  },
  {
    id: 'DcSsGr8Td5R',
    isVideo: true,
    alt: 'Some moments are extra special when they combine what you love with what you believe in',
  },
];

/**
 * A post's page on Instagram.
 *
 * Exported for its own test. `/p/<code>/` is the canonical form for both photos
 * and reels -- ../webview/instagramSection uses it for all eight regardless of
 * `isVideo`, and a reel opened at `/p/` redirects to `/reel/` on Instagram's
 * side rather than 404ing.
 */
export const postUrl = (id: string): string =>
  `https://www.instagram.com/p/${id}/`;

/**
 * The rail's cards.
 *
 * A post with no bundled cover is DROPPED rather than drawn coverless: unlike
 * the theme's tiles, whose lettering is inside the picture, these cards are a
 * photograph and nothing else, so a card with no photograph has nothing to
 * show. It cannot happen in a shipped build -- a missing `require` fails the
 * bundle -- but the guard states the intent and keeps the type honest.
 */
export const INSTAGRAM_POSTS: readonly InstagramPost[] = POSTS.filter(
  post => COVERS[post.id] !== undefined,
).map(post => ({
  id: post.id,
  url: postUrl(post.id),
  cover: COVERS[post.id],
  isVideo: post.isVideo,
  alt: post.alt,
}));
