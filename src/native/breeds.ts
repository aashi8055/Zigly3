/**
 * The two breed rails: dogs, then cats.
 *
 * Sections four and five of the dashboard. `../webview/breedSection` anchors
 * them directly after the coupon strip, and they are the first sections that
 * are not one section at all -- the dogs come from `/pages/dog` and the cats
 * from `/pages/cat`, which is a detail the theme forces rather than a choice.
 *
 * WHY THE CATS CANNOT COME FROM THE DOG PAGE. Read from
 * `templates/page.dog.json` on 2026-09-08: that section carries 32 blocks --
 * 25 `dog_card` and 7 `cat_card` -- and every one of the seven cat blocks is
 * `"disabled": true`. They are also wrong in a way that matters more than being
 * switched off: their URLs point at products and collections rather than breed
 * pages, so "Tabby" links to Pedigree *dog* food and "Maine Coon" to a test
 * collection. Zigly disabled them for a reason.
 *
 * `templates/page.cat.json` carries the same section with 7 enabled `cat_card`
 * blocks whose URLs are the real breed pages. So the cats rail is the cat
 * page's, which is exactly what ../webview/breedSection does by fetching
 * `home_shop_by_breed_section@dog` and `@cat` separately.
 *
 * THE HEADINGS ARE THE APP'S OWN. Both source sections are titled "Breed Ready
 * Picks". The site never shows them together; the app does, and two identical
 * headings one after the other reads as a rendering bug. ../webview/breedSection
 * suffixes them " - Dogs" and " - Cats" and those exact strings are kept here,
 * asserted by ../../__tests__/dashboardSections.test.ts.
 *
 * DISABLED BLOCKS ARE FILTERED, NOT TRIMMED BY HAND. The lists below are what
 * the theme has enabled today; the extraction that produced them dropped
 * `disabled` blocks, which is the same thing Liquid's `{% for block in
 * section.blocks %}` does -- Shopify does not render a disabled block at all.
 */
import type {Tile, TileRail} from './tileIcons';

/**
 * The 25 enabled dog breeds, in the theme's own block order.
 *
 * `key` is the leading word of the theme's image filename, which is how
 * ./tileIcons pairs a rendered `<img>` back to its tile. They are irregular
 * because the filenames are -- `Rott.png` for Rottweiler, `Dashchund.png`
 * (their spelling) for Dachshund, `dalmatin.png` for Dalmatian, `French_Bull`
 * for French Bulldog. Read from the template, never guessed from the label:
 * a key that does not match its file simply leaves that tile unillustrated.
 */
const DOG_TILES: readonly Tile[] = [
  {label: 'Golden Retriever', path: '/pages/golden-retriever', key: 'Golden-Retriever'},
  {label: 'Labrador Retriever', path: '/pages/labrador-retriever', key: 'Labrador-Retriever'},
  {label: 'Shih Tzu', path: '/pages/shih-tzu', key: 'Shih-Tzu'},
  {label: 'Pug', path: '/pages/pug', key: 'Pug'},
  {label: 'Beagle', path: '/pages/beagle', key: 'Beagle'},
  {label: 'Indie', path: '/pages/indie', key: 'Indie'},
  // The theme's filename spells it "Shephard".
  {label: 'German Shepherd', path: '/pages/german-shepherd', key: 'German-Shephard'},
  {label: 'Rottweiler', path: '/pages/rottweiler', key: 'Rott'},
  {label: 'Boxer', path: '/pages/boxer', key: 'boxer'},
  {label: 'Chihuahua', path: '/pages/chihuahua', key: 'Chihuahua'},
  {label: 'Chow Chow', path: '/pages/chow-chow', key: 'Chow_Chow'},
  // Label and page handle disagree on the site: "Cocker Spaniel" links to
  // /pages/english-cocker-spaniel. Both are the theme's own, kept as they are.
  {label: 'Cocker Spaniel', path: '/pages/english-cocker-spaniel', key: 'Cocker-Spaniel'},
  {label: 'Dachshund', path: '/pages/dachshund', key: 'Dashchund'},
  {label: 'Dalmatian', path: '/pages/dalmatian', key: 'dalmatin'},
  {label: 'Doberman', path: '/pages/doberman', key: 'Doberman'},
  {label: 'French Bull', path: '/pages/french-bulldog', key: 'French_Bull'},
  {label: 'Great Dane', path: '/pages/great-dane', key: 'Great_Dane'},
  {label: 'Indian Spitz', path: '/pages/indian-spitz', key: 'Indian_Spitz'},
  {label: 'Lhasa Apso', path: '/pages/lhasa-apso', key: 'Lhasa_Apso'},
  {label: 'Maltese', path: '/pages/maltese', key: 'Maltese'},
  {label: 'Pomeranian', path: '/pages/pomeranian', key: 'Pomeranian'},
  {label: 'Rajapalayam', path: '/pages/rajapalayam', key: 'Rajapalayam'},
  {label: 'Saint Bernard', path: '/pages/saint-bernard', key: 'Saint-Bernard'},
  {label: 'Siberian Husky', path: '/pages/siberian-husky', key: 'Siberian_Husky'},
  {label: 'Toy Poodle', path: '/pages/toy-poodle', key: 'Toy_Poodle'},
];

/**
 * The 7 enabled cat breeds, from `/pages/cat` -- see the note above on why not
 * from the dog page. Block order is the cat page's own, which is why Maine Coon
 * leads rather than Tabby.
 */
const CAT_TILES: readonly Tile[] = [
  {label: 'Maine Coon', path: '/pages/maine-coon', key: 'Maine_Coon'},
  {label: 'Ragdoll', path: '/pages/ragdoll', key: 'Ragdoll'},
  {label: 'Persian', path: '/pages/persian', key: 'Persian'},
  {label: 'Tabby', path: '/pages/tabby', key: 'Tabby'},
  {label: 'Bengal', path: '/pages/bengal', key: 'Bengal'},
  {label: 'Siamese', path: '/pages/siamese', key: 'Siamese'},
  {label: 'Sphynx', path: '/pages/sphynx', key: 'Sphynx'},
];

/**
 * The seeded section ids.
 *
 * Both rails are the SAME section instance -- `home_shop_by_breed_section_arbGWM`
 * -- rendered under two different template ids, which is what makes the two
 * fetches necessary and is worth stating because the matching suffixes look
 * like a copy-paste error. `DOG`/`CAT` are ../webview/pageCache's own template
 * prefixes, and the seeds there carry exactly these two values.
 */
const DOG_TEMPLATE = 'template--26530973942076__';
const CAT_TEMPLATE = 'template--26530973843772__';
const BREED_SECTION = 'home_shop_by_breed_section_arbGWM';

/**
 * The fragment is the same for both rails, so rediscovery cannot tell them
 * apart -- it would return whichever instance the homepage happens to carry.
 * Recorded rather than worked around: a seed miss on these two degrades to one
 * rail's artwork appearing on both, which loses the pictures on one rail and
 * never mislabels anything, because the labels never come from the fetch.
 */
const BREED_FRAGMENT = 'home_shop_by_breed_section';

export const DOG_BREED_RAIL: TileRail = {
  storeKey: 'zigly.breedIcons.dog.v1',
  sectionId: DOG_TEMPLATE + BREED_SECTION,
  fragment: BREED_FRAGMENT,
  tiles: DOG_TILES,
};

export const CAT_BREED_RAIL: TileRail = {
  storeKey: 'zigly.breedIcons.cat.v1',
  sectionId: CAT_TEMPLATE + BREED_SECTION,
  fragment: BREED_FRAGMENT,
  tiles: CAT_TILES,
};

/**
 * The headings, as ../webview/breedSection renders them.
 *
 * Kept here beside the tiles rather than only in ./dashboardSections so the
 * component has one import, and asserted equal in the manifest test so the two
 * cannot drift.
 */
export const DOG_BREED_TITLE = 'Breed Ready Picks - Dogs';
export const CAT_BREED_TITLE = 'Breed Ready Picks - Cats';
