/**
 * "Explore. Pick. Pamper." — four tabs of category tiles, dogs and cats merged.
 *
 * Section seven. Both `/pages/dog` and `/pages/zigly-cat` carry this section
 * with the same four tabs (Food, Treats, Toys, Smart Petcare) and
 * species-specific collections behind them, so the two are merged: tapping Food
 * shows dog AND cat categories rather than dog only. That merge is the app's
 * own, and ../webview/explorePicker learned three lessons doing it that are
 * built into the data below rather than re-learned.
 *
 * 1. LABELS COLLIDE AND ARE NOT DUPLICATES. Six labels appear on both pages --
 *    Dry Food, Wet Food, Prescription Food, Meaty Treats, Plush Toys,
 *    Interactive Toys, Fresh Food -- and every colliding pair points at a
 *    DIFFERENT collection, because each pet's tile goes to that pet's own
 *    listing. De-duplicating by label deleted the cat tile of every shared
 *    category and silently turned it into the dog listing: measured on the live
 *    sections, only 1 of 4 cat tiles survived in Food. Nothing is de-duplicated
 *    here at all -- the tiles are declared per pet from the theme, so a
 *    collision cannot arise -- and both members of every colliding pair are
 *    present with their own collection behind them.
 *
 * 2. APPENDING THE CATS AFTER THE DOGS IS STILL A DOG-ONLY RAIL. The rail shows
 *    about two tiles at a time, so four dog tiles followed by four cat tiles
 *    puts every cat off-screen with nothing on screen to suggest scrolling
 *    reaches them. The two sets are interleaved, so a cat tile is second in
 *    every tab.
 *
 * 3. THE CAP MUST BE A RUNAWAY GUARD, NOT THE EXACT TOTAL. Its being 8 -- the
 *    real total -- meant one tile added by Zigly on either page would vanish
 *    with no sign. There is no cap here at all: the tiles are read from the
 *    theme rather than fetched, so there is no runaway to guard against.
 *
 * READ FROM THE THEME, NOT FROM THE RENDERED SECTION, and that is the one place
 * this deliberately departs from the web version. ../webview/explorePicker has
 * to parse the section's markup, and that markup is malformed: Zigly close each
 * tile's link by repeating the opening `<a href>` instead of writing `</a>`, so
 * the parser recovers by leaving empty anchor copies loose in the rail, and
 * asking a tile for its first anchor returns the wrong one about half the time.
 * The tab blocks in `templates/page.dog.json` and `page.cat.json` carry the
 * same headings, links and images as structured settings, so none of that
 * applies. Only the artwork still needs the network (see ./tileIcons).
 */
import type {Tile} from './tileIcons';

/** One tab of the Explore section. */
export type ExploreTab = {
  /** The tab label. Zigly's own, and identical on both source pages. */
  readonly label: string;
  /** Dog and cat tiles, already interleaved. */
  readonly tiles: readonly Tile[];
};

/**
 * The section heading, from both pages' `section_heading` setting.
 */
export const EXPLORE_TITLE = 'Explore. Pick. Pamper.';

/**
 * Interleave two lists, longest-first safe.
 *
 * Exported for its own test. Alternates dog, cat, dog, cat… and appends
 * whatever is left when one list runs out, so an uneven pair keeps every tile
 * rather than truncating to the shorter length. Both lists are four long today;
 * that is the merchant's choice and not something to depend on.
 */
export const interleave = <T,>(a: readonly T[], b: readonly T[]): T[] => {
  const out: T[] = [];
  const longest = Math.max(a.length, b.length);
  for (let i = 0; i < longest; i++) {
    if (i < a.length) {
      out.push(a[i]);
    }
    if (i < b.length) {
      out.push(b[i]);
    }
  }
  return out;
};

/**
 * A tile, declared per pet.
 *
 * `key` IS THE FULL FILENAME HERE, not the stem every other rail uses, and this
 * section is the reason ./tileIcons supports both. The two pages ship images
 * whose leading words are identical --
 *
 *   dog  Meaty-Treats_650X765_f5fabe81-…png
 *   cat  Meaty-Treats_650X765_29b8bba3-…png
 *
 * -- and the same is true of Plush-Toys, Interactive-Toys and Fresh-Food. A
 * stem cannot tell those two tiles apart, so a stem match would give the dog
 * and cat tiles the same picture and put a cat photo above a dog collection.
 * All 32 filenames are unique in full, which is why they are written out in
 * full.
 *
 * The cost is honest and worth stating: a filename carries the hash Shopify
 * appends on re-upload, so re-uploading one of these images loses that one
 * tile's picture until the name here is updated. The tile keeps its label and
 * its link. That is the better failure than a mislabelled photo, which is what
 * a stem would give.
 */
const tile = (label: string, handle: string, key: string): Tile => ({
  label,
  path: `/collections/${handle}`,
  key,
});

/**
 * Food.
 *
 * Four labels collide with the cats' here and none is a duplicate:
 * dog-dry-food against cat-dry-food, dog-wet-food against cat-wet-food,
 * prescription-dog-food against cat-prescription-food.
 */
const FOOD_DOG: readonly Tile[] = [
  tile('Dry Food', 'dog-dry-food', 'dog-Food.png'),
  tile('Wet Food', 'dog-wet-food', 'wet-Food_2f63de87-04f5-4fb5-b921-8e3771dbfaf2.png'),
  tile('Puppy Food', 'puppy-food', 'puppy-food_650X765_1.png'),
  tile('Prescription Food', 'prescription-dog-food', 'Prescription-Food.png'),
];
const FOOD_CAT: readonly Tile[] = [
  tile('Dry Food', 'cat-dry-food', 'Dry-food_650X765_711815cd-afb7-4d43-b314-306eac5902ea.png'),
  tile('Wet Food', 'cat-wet-food', 'Wet-food_650X765_29cfbd46-2bbd-4a1e-adfd-5ff057106d50.png'),
  tile('Kitten Food', 'kitten-food', 'Kitten-food_650X765_d0007859-8824-483e-8a63-99df07d976c4.png'),
  tile('Prescription Food', 'cat-prescription-food', 'Prescription-food_650X765_fb698c01-24b2-4f0d-996e-164abb4d300d.png'),
];

/** Treats. "Meaty Treats" is on both pages, going to two collections. */
const TREATS_DOG: readonly Tile[] = [
  tile('Biscuits & Cookies', 'dog-biscuits', 'Dog-Biscuits_650X765_84822a8d-3766-44f8-8b88-1331a7c97375.png'),
  tile('Meaty Treats', 'dog-meaty-treats', 'Meaty-Treats_650X765_f5fabe81-4226-4d2e-82f8-b7fe6c101166.png'),
  tile('Dental Treats', 'dog-dental-treats-chews', 'Dental-Treats_650X765_ec45b160-d786-4024-ace7-449b4aa91077.png'),
  tile('Gluten-free Treats', 'applod-gluten-free-biscuits', 'Gluten-Free_650X765_dd3ac924-8ea0-4fab-a399-3310fd9526d7.jpg'),
];
const TREATS_CAT: readonly Tile[] = [
  tile('Applod Treats', 'applod-cats', 'Applod-Treats_650X765_7eaeee6a-4074-453c-8f8e-74c5a282e6c0.png'),
  tile('Meaty Treats', 'cat-meaty-treats', 'Meaty-Treats_650X765_29b8bba3-75c7-402b-8461-2bd01cc689e1.png'),
  tile('Creamy Treats', 'cat-creamy-treats', 'Creamy-Treats_650X765_267be3a0-d68e-40aa-9d64-532d09295fad.png'),
  tile('Crunchy Treats', 'cat-crunchy-treats', 'Crunchy-Treats_650X765_bfcb4873-0351-4856-a4a9-02263973cd05.png'),
];

/** Toys. "Plush Toys" and "Interactive Toys" are both on both pages. */
const TOYS_DOG: readonly Tile[] = [
  tile('Rope Toys', 'dog-rope-tug-toys', 'Rope-Toys_650X765_405c8d37-7e8d-4742-a548-c97df62f5658.png'),
  tile('Plush Toys', 'dog-plush-toys', 'Plush-Toys_650X765_5100ed5e-e8b3-42fd-b061-ed514eb1e283.png'),
  tile('Puppy Toys', 'puppy-toys', 'Puppy-Toys_650X765_f323ade7-a6ec-4810-a8d8-d1b3c985f34a.png'),
  tile('Interactive Toys', 'dog-interactive-toys', 'Interactive-Toys_650X765_7ab5f06e-7f15-4497-b5db-4bf9bbbf2032.png'),
];
const TOYS_CAT: readonly Tile[] = [
  tile('Interactive Toys', 'cat-interactive-toys', 'Interactive-Toys_650X765_8606a493-719b-4959-9857-cc7b086c6e70.png'),
  tile('Catnip Toys', 'catnip-toys', 'Catnip-Toys_650X765_eba8cf27-3470-43c3-b294-2f3425cefa90.png'),
  tile('Plush Toys', 'cat-plush-toys', 'Plush-Toys_650X765_a92d7480-cd21-4c64-be85-8d7de948c465.png'),
  tile('Wand Toys', 'cat-teasers-wands', 'Wand-Toys_650X765_021cf7e7-d9f1-40c7-ab5d-e2d3a02c33b1.png'),
];

/** Smart Petcare. "Fresh Food" is on both, going to two collections. */
const CARE_DOG: readonly Tile[] = [
  tile('Fresh Food', 'fresh-dog-food', 'Fresh-Food_650X765_1dba7516-458f-4e89-87df-a30a052f4780.png'),
  tile('Grooming', 'dog-grooming-tools-accessories', 'Grooming_Tools_650X765_50aacb07-0690-4b36-8984-4adb70770f16.png'),
  tile('Travel Essentials', 'dog-carriers-travel', 'TravelEssentials.png'),
  tile('Car Seat Cover', 'car-seat-cover', 'ZL-carSeatcover.png'),
];
const CARE_CAT: readonly Tile[] = [
  tile('Fresh Food', 'fresh-for-purr', 'Fresh-Food_650X765_87f8a852-bd94-4bbc-9381-bb9efff2aa83.png'),
  tile('Litter Accessories', 'cat-litter-accessories', 'LitterAccessories_650X765_0d750a1b-c532-46f0-ab39-955316e282fb.png'),
  tile('Wipes', 'cat-towel-wipes', 'Wipes_650X765_25be1fec-1146-4008-ae8d-23a14b3d0c7d.png'),
  tile('Carriers', 'cat-carriers-travel', 'Carriers_650X765_ed84e24e-a680-4a23-9f98-1ecc34dad38e.png'),
];

/**
 * The four tabs, in the order both source pages declare them.
 *
 * One disabled block on the dog page is excluded, as Shopify excludes it: a
 * `tab_block` titled "Dog Food" carrying leash and accessory tiles, marked
 * `"disabled": true`. Liquid's `{% for block in section.blocks %}` never
 * renders a disabled block, so neither does this.
 */
export const EXPLORE_TABS: readonly ExploreTab[] = [
  {label: 'Food', tiles: interleave(FOOD_DOG, FOOD_CAT)},
  {label: 'Treats', tiles: interleave(TREATS_DOG, TREATS_CAT)},
  {label: 'Toys', tiles: interleave(TOYS_DOG, TOYS_CAT)},
  {label: 'Smart Petcare', tiles: interleave(CARE_DOG, CARE_CAT)},
];

/**
 * Artwork for the tiles, from the dog page's section.
 *
 * One rail's worth of storage for all four tabs, because the stems are unique
 * across the whole section -- so a single fetch of either page's rendered
 * section resolves whatever it carries and the rest stay unillustrated until
 * the other page is asked for. Both pages are asked for; see ./ExploreSection.
 */
export const EXPLORE_DOG_RAIL = {
  storeKey: 'zigly.exploreIcons.v1',
  sectionId: 'template--26530973942076__explore_product_8WFgmB',
  fragment: 'explore_product',
  tiles: EXPLORE_TABS.flatMap(t => t.tiles),
};

/** The same section on the cat page, for the cat tiles' artwork. */
export const EXPLORE_CAT_RAIL = {
  storeKey: 'zigly.exploreIcons.v1',
  sectionId: 'template--26530973843772__explore_product_8WFgmB',
  fragment: 'explore_product',
  tiles: EXPLORE_TABS.flatMap(t => t.tiles),
};
