/**
 * The three offer rails: Applod Food, Applod Treats, Zigly Style Steals.
 *
 * Sections eight, nine and sixteen -- three instances of the theme's
 * `offer-section`, identical in shape and differing only in their heading and
 * their tiles. They are declared together here for that reason: three copies of
 * the same list would drift, and the dashboard order already keeps them apart
 * (Zigly Style Steals sits seven sections below the other two).
 *
 * AN OFFER TILE HAS NO LABEL. This is the shape that makes these sections
 * unlike every other tile rail in the app, and it is the theme's own choice:
 * `sections/offer-section.liquid` renders each block as an image inside a link
 * and nothing else --
 *
 *   {% for block in section.blocks %}
 *     {% if block.settings.block_image %}
 *       <a class="block_link" href="{{ block.settings.block_link }}">
 *         <div class="block_image_div">{{ block.settings.block_image | ... }}</div>
 *       </a>
 *
 * -- with no heading, no caption and no alt text worth reading. The artwork
 * carries the words: "Applod Dog Fresh Food" is lettering inside the picture.
 *
 * That has a consequence worth stating plainly, because it is a real
 * degradation and not a detail. Every other rail in this app falls back to the
 * label's initial when its artwork has not arrived, so the tile stays useful.
 * These tiles have no label to fall back to, so a tile whose image fails is a
 * blank rectangle that goes somewhere. ./OfferRail draws nothing at all in that
 * case rather than a mystery target -- see the note there.
 *
 * `block_link` IS NOT ALWAYS A LIQUID REFERENCE. Most are `shopify://collections/x`,
 * but one is a full URL with a filter query --
 * `https://zigly.com/collections/dog-dry-food?f.Brands=applod` -- and that query
 * is what makes the tile show Applod's dry food rather than every brand's. It is
 * kept whole; stripping it would land the customer on a different listing than
 * the tile promises.
 */
import type {Tile} from './tileIcons';

/**
 * One offer tile.
 *
 * Reuses ./tileIcons' `Tile` so the artwork resolution is shared, but `label`
 * means something different here: there is no visible label, so it carries the
 * accessibility name instead. It is read from the artwork's own lettering,
 * which is the only description of these tiles that exists -- a screen reader
 * would otherwise be handed a link with nothing in it.
 */
export type OfferTile = Tile;

const tile = (label: string, link: string, key: string): OfferTile => ({
  label,
  path: link,
  key,
});

/**
 * A rail of offer tiles.
 *
 * `storeKey` and `sectionId` are the same shape ./tileIcons wants, so these
 * plug into `loadIcons`/`fetchIcons`/`saveIcons` unchanged. Each rail gets its
 * own store: the three sections are separate fetches and merging them would
 * make a miss on one look like a miss on all three.
 */
export type OfferRail = {
  readonly storeKey: string;
  readonly sectionId: string;
  readonly fragment: string;
  readonly title: string;
  readonly tiles: readonly OfferTile[];
};

/** ../webview/pageCache's own template prefix for the dog page. */
const DOG = 'template--26530973942076__';

/**
 * "Applod Food" -- the fresh-food rail. `offer_section#1` in
 * ../webview/extraSections, `offer_section_nYDda8` in the theme.
 */
export const APPLOD_FOOD: OfferRail = {
  storeKey: 'zigly.offerIcons.food.v1',
  sectionId: DOG + 'offer_section_nYDda8',
  fragment: 'offer_section',
  title: 'Applod Food',
  tiles: [
    tile('Applod Fresh Food', '/collections/applod-fresh-food', 'Applod_Dog_Fresh_Food'),
    tile('Applod Wet Food', '/collections/applod-wet-dog-food', 'Applod_Dog_Wet_Food'),
    tile('Applod Bone Broth', '/collections/applod-broth', 'Applod_Dog_Cat_Bone_Broth'),
    /*
     * The one tile whose link is a full URL rather than a Liquid reference, and
     * the filter is load-bearing: without `?f.Brands=applod` this lands on
     * every brand's dry food, which is not what an "Applod Food" tile promises.
     */
    tile(
      'Applod Dry Food',
      '/collections/dog-dry-food?f.Brands=applod',
      'ApplodDryFood',
    ),
  ],
};

/**
 * "Applod Treats" -- biscuits, chews and toys. `offer_section#2`,
 * `offer_section_H88hDB`.
 */
export const APPLOD_TREATS: OfferRail = {
  storeKey: 'zigly.offerIcons.treats.v1',
  sectionId: DOG + 'offer_section_H88hDB',
  fragment: 'offer_section',
  title: 'Applod Treats',
  tiles: [
    tile('Applod Biscuits', '/collections/applod-biscuits', 'Applod_Dog_Biscuits'),
    tile('Applod Yak & Roll', '/collections/applod-yak-and-roll', 'Applod_Dog_Yak_Treat'),
    tile('Applod Meaty Treats', '/collections/applod-meaty-treats', 'Applod_Dog_Treats'),
    tile(
      'Applod Dental & Training Treats',
      '/collections/applod-dental-training-treats',
      'Applod_Dog_Dental_Treats',
    ),
  ],
};

/**
 * "Zigly Style Steals" -- the lifestyle range. `offer_section#3`,
 * `offer_section_4xR48g`. Seven tiles, where the other two rails have four.
 */
export const STYLE_STEALS: OfferRail = {
  storeKey: 'zigly.offerIcons.style.v1',
  sectionId: DOG + 'offer_section_4xR48g',
  fragment: 'offer_section',
  title: 'Zigly Style Steals',
  tiles: [
    tile('Walk Essentials', '/collections/zigly-lifestyle-walk-essentials', 'ZL-WE'),
    tile('Bowls', '/collections/dog-bowls', 'ZL-Bowl'),
    tile('Summer Styles', '/collections/summer-styles', 'ZL-Summer-Shirts-'),
    tile('Pet Name Tags', '/collections/pet-name-tags', 'ZL-PetIDs'),
    tile('Beds & Mats', '/collections/dog-beds-mats', 'ZL-Beds'),
    tile('Blankets', '/collections/dog-mats', 'ZL-Blankets'),
    tile('Lifestyle Toys', '/collections/zigly-lifestyle-toys', 'ZL-Toys'),
  ],
};

/**
 * All three, so a test can check them together.
 *
 * NOT a render order: these are three separate sections with eleven other
 * sections between the second and the third. ./dashboardSections is the order.
 */
export const OFFER_RAILS: readonly OfferRail[] = [
  APPLOD_FOOD,
  APPLOD_TREATS,
  STYLE_STEALS,
];
