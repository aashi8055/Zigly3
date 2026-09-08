/**
 * The eight category circles: what they say, where they go, and how their
 * artwork is found.
 *
 * The mechanism -- learn the image URLs from a rendered section once, keep them
 * on the device, pair them to tiles by filename stem -- now lives in
 * ./tileIcons, because the two breed rails need exactly the same thing. This
 * file is what is particular to the category rail: its tiles, and the section
 * they are read from. The long argument for the approach (why the labels ship
 * and the pictures are learned, why an image URL is cacheable when section
 * markup is not, why stems and never positions) is in ./tileIcons.
 *
 * `page.dog.json` and not `index.json`, and that is the whole point: the app's
 * dashboard is the dog page's section set, not the homepage's (see
 * ../webview/pageCache, whose seeded ids are all `template--26530973942076__`).
 * The homepage ships a different and shorter set of circles -- Dog, Cat,
 * Pharmacy, Treats, Toys, Beds, Clothing -- which is why ../webview/homeLayout
 * fetches this one and swaps it in.
 */
import type {Tile, TileRail} from './tileIcons';

export type {IconMap} from './tileIcons';

/**
 * The rail, as Zigly's theme declares it.
 *
 * Read from `zigly-website-code/zigly-website/templates/page.dog.json`, section
 * `home_category_section_ej8trH`, in `block_order` -- so this is the site's own
 * content and its own ordering, not a selection made here.
 *
 * `shopify://pages/x` and `shopify://collections/x` resolve to `/pages/x` and
 * `/collections/x` on the storefront, which is what both a WebView navigation
 * and a native route need. Resolved here, once, rather than at every call site.
 */
export const CATEGORIES: readonly Tile[] = [
  {label: 'Dogs', path: '/pages/dog', key: 'Dog'},
  {label: 'Cats', path: '/pages/zigly-cat', key: 'Cat'},
  {label: 'Small Pets', path: '/collections/small-pets', key: 'Small-Pets'},
  {label: 'Pharmacy', path: '/collections/pet-pharmacy', key: 'Pharmacy'},
  {label: 'Vet Care', path: '/pages/vet-care-page', key: 'Vet-Care'},
  {label: 'Grooming', path: '/pages/grooming', key: 'Grooming'},
  {label: 'All', path: '/', key: 'All'},
  {
    label: 'New Pet Parent',
    path: '/pages/new-pet-owner-guide',
    key: 'petparent',
  },
];

/**
 * The category rail's storage and its section.
 *
 * The seeded id is ../webview/pageCache's own for this section; a miss falls
 * back to fragment rediscovery and self-heals, so it is a first-run hint rather
 * than something anybody has to keep up to date.
 */
export const CATEGORY_RAIL: TileRail = {
  storeKey: 'zigly.categoryIcons.v1',
  sectionId: 'template--26530973942076__home_category_section_ej8trH',
  fragment: 'home_category_section',
  tiles: CATEGORIES,
};
