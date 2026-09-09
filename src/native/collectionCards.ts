/**
 * The twelve category cards on `/collections`: what they say, what colour they
 * are, where they go, and how their artwork is found.
 *
 * WHAT THIS IS. The Collection tab's first screen -- a vertical list of wide
 * coloured cards, each with a photo on the left, a heading, a sub-heading and a
 * chevron. It was a WebView on `/collections`; it is native now, and this is
 * its content.
 *
 * READ FROM THE THEME, NOT INVENTED. Every field below comes from
 * `zigly-website-code/zigly-website/templates/list-collections.json`, section
 * `collections_list_section_ridiUy`, in the theme's own block order -- so the
 * cards, their wording, their colours and their destinations are Zigly's, and
 * the order is Zigly's. `main` (the stock `main-list-collections` grid) is
 * `"disabled": true` in that template, which is why the site shows these cards
 * instead of Shopify's own alphabetical collection grid, and why this list is
 * the whole screen.
 *
 * THE COLOURS ARE THE MERCHANT'S. `bg_color` per block, verbatim. They are not
 * a palette this app chose and they are not derived from the artwork; a card
 * whose colour drifted from the site would be the one thing on this screen that
 * is visibly ours.
 *
 * ARTWORK IS LEARNED, AS EVERYWHERE ELSE. The theme records each image as
 * `shopify://shop_images/Category_Applod_175X200_ce5bfb3a-….png`, which is a
 * Liquid reference and not a URL -- only the rendered section carries the
 * `cdn.shopify.com` address, and that address carries a `?v=` stamp that
 * changes on re-upload. So ./tileIcons resolves them once and keeps them, and
 * this screen is complete and tappable on its first frame without any of them.
 * The long argument for that split is in ./tileIcons.
 *
 * ITS SECTION IS NOT ON THE HOMEPAGE, which is the one new thing here. The
 * three rails that came before all read sections off `/`, and `fetchIcons`
 * assumed it. This section exists only on `/collections`, so the rail names its
 * page -- see `TileRail.page`.
 */
import type {Tile, TileRail} from './tileIcons';

export type {IconMap} from './tileIcons';

/** One card: a tile, plus the colour the theme paints it. */
export type CollectionCard = Tile & {
  /** The card's fill, straight from the block's `bg_color`. */
  readonly color: string;
  /** The line under the heading. Zigly's own wording. */
  readonly subtitle: string;
};

/**
 * The twelve cards, in `block_order`.
 *
 * `key` is the filename stem ./tileIcons pairs artwork by -- the part of the
 * theme's filename before the size and the hash, which is the stable part. All
 * twelve are distinct, which `__tests__/collectionCards.test.ts` asserts:
 * two cards sharing a stem would both claim the first matching image.
 *
 * `path` is the block's `url` with the `shopify://collections/` prefix
 * resolved, because that is what both a native route and a WebView navigation
 * need. Two of them are worth reading twice rather than tidying:
 *
 *   Monsoon Essentials -> `/collections/monsoon-essentials-backup-27jul2026-151414`
 *   Luxe Life          -> `/collections/premium-pet-accessories-luxe`
 *
 * Neither handle matches its heading. Both are what the theme actually links
 * to, and "backup-27jul2026-151414" is the live destination however temporary
 * it looks -- guessing `/collections/monsoon-essentials` would be this app
 * inventing a URL, and a 404 behind a card that works on the website.
 */
export const COLLECTION_CARDS: readonly CollectionCard[] = [
  {
    label: 'Applod',
    subtitle: 'Baked Biscuits & Pet Treats',
    color: '#ffdfa6',
    path: '/collections/applod',
    key: 'Category_Applod',
  },
  {
    label: 'Monsoon Essentials',
    subtitle: 'Raincoats, Wipes & Tick Care',
    color: '#ecffa6',
    path: '/collections/monsoon-essentials-backup-27jul2026-151414',
    key: 'Category_monsoon',
  },
  {
    label: 'Luxe Life',
    subtitle: 'Premium Food, Apparel & Gear',
    color: '#effffc',
    path: '/collections/premium-pet-accessories-luxe',
    key: 'Category_Luxe',
  },
  {
    label: 'Dog Food',
    subtitle: 'Dry, Wet & Prescription Meals',
    color: '#fff2de',
    path: '/collections/dog-food',
    key: 'Category_DogFood',
  },
  {
    label: 'Cat Food',
    subtitle: 'Wet, Dry & Special Diets',
    color: '#e4caf7',
    path: '/collections/cat-food',
    key: 'Category_CatFood',
  },
  {
    label: 'Dog Treats',
    subtitle: 'Training Bites, Jerky & Biscuits',
    color: '#b1ffa6',
    path: '/collections/dog-treats',
    key: 'Category_Dog-Treats',
  },
  {
    label: 'Cat Treats',
    subtitle: 'Crunchy, Creamy & Chew Snacks',
    color: '#ffdb9f',
    path: '/collections/cat-treats',
    key: 'Category_Cat-Treats',
  },
  {
    label: 'Toy Store',
    subtitle: 'Chew, Fetch, Plush & Interactive Toys',
    color: '#e5cefa',
    path: '/collections/dog-cat-toys',
    key: 'Category_Toys',
  },
  {
    label: 'Cat Litter',
    subtitle: 'Clumping, Non-Clumping & Natural',
    color: '#fad9ca',
    path: '/collections/cat-litter',
    key: 'Category_CatLitter',
  },
  {
    label: 'Walk Gear',
    subtitle: 'Collars, Harnesses & Leashes',
    color: '#e9fdf4',
    path: '/collections/dog-cat-walk-essentials',
    key: 'Category_WalkGear',
  },
  {
    label: 'Bowls & Feeders',
    subtitle: 'Steel, Slow-Feed & Dispensers',
    color: '#faf2af',
    path: '/collections/dog-cat-bowls',
    key: 'Category_Bowls_feeders',
  },
  {
    label: 'Grooming & Hygiene',
    subtitle: 'Shampoos, Wipes & Brushes',
    color: '#d0ecf9',
    path: '/collections/dog-cat-grooming-hygiene',
    key: 'Category_Grooming-_-Hygiene',
  },
];

/**
 * Where the artwork is read from.
 *
 * `page: '/collections'` is load-bearing: the Section Rendering API returns
 * only sections the requested page actually renders, so `/?sections=…` would
 * answer empty here and look exactly like a stale id. The fragment is the
 * stable half of the section id, so a re-saved section is rediscovered rather
 * than losing every picture.
 */
export const COLLECTION_CARD_RAIL: TileRail = {
  storeKey: 'zigly.collectionCards.icons.v1',
  sectionId: 'collections_list_section_ridiUy',
  fragment: 'collections_list_section',
  tiles: COLLECTION_CARDS,
  page: '/collections',
};
