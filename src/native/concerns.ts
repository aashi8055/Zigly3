/**
 * "Care by Concern" — seven cards, each a health concern and a listing.
 *
 * Section fourteen, and the first tile section whose cards carry REAL TEXT: a
 * heading ("Shedding"), a subheading ("Less fur, more flair!") and a "Shop Now"
 * button, all theme block settings. That changes the failure mode back to the
 * good one — a card whose artwork does not resolve still says what it is and
 * still goes somewhere, so unlike the offer rails and `best_deals` nothing has
 * to be dropped. ./ConcernRail keeps every card.
 *
 * Read from `templates/page.dog.json`, section `shop_of_concern_T9kBGJ`. Seven
 * enabled blocks, none disabled.
 *
 * ONE LINK IS A BLOG POST, NOT A COLLECTION. Deworming goes to
 * `shopify://blogs/all/the-beginners-guide-to-puppy-feeding-best-practices-and-tips`
 * while the other six go to `shopify://collections/x`. That is the merchant's
 * own choice and it is kept: the card says "Shop Now" and lands on an article,
 * which is Zigly's decision to make, not this app's to correct. It does mean a
 * rebuild that assumed `/collections/` for every card would send that one to a
 * collection that does not exist -- so the path is stored whole rather than
 * built from a handle.
 *
 * THE WHOLE CARD IS THE TAP TARGET. ../webview/concernCards has to work for
 * this on the web side -- it "moves each card's contents into an anchor
 * carrying that card's own Shop Now destination, so the photo and the heading
 * now go where the button goes" -- because the theme only makes the button
 * itself a link. Native gets that for free: one `Pressable` around the card,
 * with the button drawn inside it as the affordance it always looked like.
 */
import type {Tile} from './tileIcons';

/** ../webview/pageCache's own template prefix for the dog page. */
const DOG = 'template--26530973942076__';

/** One concern card. */
export type Concern = {
  /** The card's heading. */
  readonly heading: string;
  /** The line under it. Zigly's own copy, exclamation marks included. */
  readonly subheading: string;
  /** Where a tap goes: a collection for six of seven, a blog post for one. */
  readonly path: string;
  /** Filename stem, for pairing the rendered `<img>`; see ./tileIcons. */
  readonly key: string;
};

/** The section heading, from `shop_of_concern_heading`. */
export const CONCERNS_TITLE = 'Care by Concern';

/**
 * The button's label, from the section's own `button_text` setting.
 *
 * One setting for all seven cards -- the theme reads it from the section, not
 * from each block -- so it is one constant here rather than a field on
 * `Concern`.
 */
export const CONCERNS_BUTTON = 'Shop Now';

const concern = (
  heading: string,
  subheading: string,
  path: string,
  key: string,
): Concern => ({heading, subheading, path, key});

/** The seven cards, in the theme's own block order. */
export const CONCERNS: readonly Concern[] = [
  concern('Shedding', 'Less fur, more flair!', '/collections/shedding', 'Shedding'),
  concern(
    'Dental Care',
    'Fresh breath, strong bite!',
    '/collections/dental-care',
    'Dental-Care',
  ),
  /*
   * The blog post. See the note at the top: the merchant sends this one to an
   * article rather than a listing, and the path is stored whole for that
   * reason.
   */
  concern(
    'Deworming',
    'Stay Worm-Free, Stay Healthy!',
    '/blogs/all/the-beginners-guide-to-puppy-feeding-best-practices-and-tips',
    'Deworming',
  ),
  concern(
    'Skin & Coat Care',
    'Shine On, Stay Soft!',
    '/collections/skin-coat-care',
    // The theme's filename is `Skin_-Coat_660X405_…` -- an underscore where the
    // heading has a space, then a hyphen. Read from the file, not derived.
    'Skin_-Coat',
  ),
  concern(
    'Dry Skin Issues',
    'Soothe, Hydrate, Glow!',
    '/collections/dry-skin-issues',
    'Dry-Skin-Issues',
  ),
  concern(
    'Weight Management',
    'Fit, Active & Thriving!',
    '/collections/weight-management',
    'Weight-Management',
  ),
  concern(
    'Joint Pain',
    'Move easy, play hard!',
    // The label says "Joint Pain"; the collection is `hip-joint`. Both are the
    // merchant's, and the handle is not derivable from the heading.
    '/collections/hip-joint',
    'Joint-Pain',
  ),
];

/** The section's artwork store. */
export const CONCERNS_RAIL = {
  storeKey: 'zigly.concernIcons.v1',
  sectionId: DOG + 'shop_of_concern_T9kBGJ',
  fragment: 'shop_of_concern',
  tiles: CONCERNS.map(
    (c): Tile => ({label: c.heading, path: c.path, key: c.key}),
  ) as readonly Tile[],
};
