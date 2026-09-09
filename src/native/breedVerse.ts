/**
 * The Breed-verse index: 32 breeds, three tabs, one grid.
 *
 * WHAT THIS DESCRIBES. `/pages/pet-breeds` -- the page the Breed-verse tab
 * opens -- is a single theme section, `All-Breeds-Aman` ("Pages Gallery
 * Toggle"), rendered on the `page.all-breeds` template. Verified live on
 * 2026-09-09: the served HTML carries exactly one content section,
 * `template--26530973679932__all_breeds_aman_BtKp3Q`, holding 32
 * `.gallery-card` anchors and a three-button tab bar.
 *
 * WHY THIS IS NOT ./breeds. The dashboard's two breed rails and this page look
 * like the same list and are not:
 *
 *   ./breeds      is `home-shop-by-breed-section`, a circular-tile rail that
 *                 appears on `/pages/dog` and `/pages/cat`. 25 dogs and 7 cats,
 *                 split across two templates, with the cats' artwork on a
 *                 different page from the dogs'.
 *   this file     is `All-Breeds-Aman` on `/pages/pet-breeds`. One section, one
 *                 page, 32 photo cards in a single alphabetical run with the
 *                 species carried as a per-card `category` setting.
 *
 * The 32 here are the same 32 animals, but the ORDER, the ARTWORK and the
 * SECTION are all different -- these are landscape photographs sorted A-Z,
 * those are round headshots in the merchant's own block order. Sharing a module
 * would mean one of the two pages drawing the other's pictures.
 *
 * THE TILES ARE READ, NOT INVENTED. Every row below was extracted from the
 * rendered page on 2026-09-09 -- the label from the card's `<h3>`, the path
 * from its `href`, `kind` from its `data-category`, and `key` from the leading
 * stem of its image filename. `traits` is the block's `labels` setting, kept
 * for the reason stated at TRAITS below.
 */
import {BREED_VERSE_PATH} from '../constants/appConstants';
import type {Tile, TileRail} from './tileIcons';

export {BREED_VERSE_PATH};

/** Which tab a card belongs to. The theme's `data-category`, verbatim. */
export type BreedKind = 'dog' | 'cat';

/**
 * One breed card.
 *
 * Extends ./tileIcons' `Tile` rather than restating it, so the same
 * `fetchIcons` / `parseIcons` pair that resolves the category circles and the
 * two dashboard rails resolves these photos too -- `key` means exactly what it
 * means there, and `matchesKey` needs no special case.
 */
export type BreedCard = Tile & {
  /** Which tab shows it. */
  readonly kind: BreedKind;
  /**
   * TRAITS. The block's `labels` setting, e.g. "Curious, Friendly, Merry".
   *
   * NOT DRAWN, and that is a match rather than an omission. The theme renders
   * these into `.gallery-tags`, and its own stylesheet sets that container to
   * `display: none` -- so no customer has ever seen them on the website. They
   * are recorded here because they are real page data and because 15 of the 32
   * breeds have none at all, which is the fact that would make turning them on
   * a design decision rather than a toggle: over a third of the grid would draw
   * a visibly emptier card than its neighbours.
   */
  readonly traits: readonly string[];
};

/**
 * The 32 cards, in the section's own block order.
 *
 * Alphabetical by label with dogs and cats interleaved -- Beagle, then Bengal,
 * then Boxer -- which is the merchant's ordering and is why the "All" tab does
 * not read as two blocks. Kept in this order rather than grouped, because the
 * tabs are what separate the species and re-sorting here would change what the
 * All tab looks like.
 *
 * `key` is the image filename with Shopify's uuid suffix stripped, which is the
 * stem ./tileIcons matches on. Read from the file, never derived from the
 * label: "Ragdoll" is stored as `ragdoll_...` in lower case, and a key guessed
 * from the label would simply leave that one card unillustrated. Every key here
 * is unique within the rail -- asserted by ../../__tests__/breedVerse.test.ts,
 * because two cards sharing a stem would both claim the first matching photo.
 */
export const BREED_CARDS: readonly BreedCard[] = [
  {label: 'Beagle', path: '/pages/beagle', key: 'Beagle', kind: 'dog', traits: ['Curious', 'Friendly', 'Merry']},
  {label: 'Bengal', path: '/pages/bengal', key: 'Bengal', kind: 'cat', traits: ['Intelligent', 'Active', 'Affectionate']},
  {label: 'Boxer', path: '/pages/boxer', key: 'Boxer', kind: 'dog', traits: []},
  {label: 'Chihuahua', path: '/pages/chihuahua', key: 'Chihuahua', kind: 'dog', traits: ['Charming', 'Graceful', 'Sassy']},
  {label: 'Chow Chow', path: '/pages/chow-chow', key: 'Chow_Chow', kind: 'dog', traits: ['Dignified', 'Bright', 'Serious']},
  {label: 'Dachshund', path: '/pages/dachshund', key: 'Dachshund', kind: 'dog', traits: []},
  {label: 'Dalmatian', path: '/pages/dalmatian', key: 'Dalmatian', kind: 'dog', traits: []},
  {label: 'Doberman', path: '/pages/doberman', key: 'Doberman', kind: 'dog', traits: ['Charming', 'Loving', 'Mischievous']},
  {label: 'English Cocker Spaniel', path: '/pages/english-cocker-spaniel', key: 'English_Cocker_Spaniel', kind: 'dog', traits: ['Energetic', 'Merry', 'Responsive']},
  {label: 'French Bulldog', path: '/pages/french-bulldog', key: 'French_Bulldog', kind: 'dog', traits: []},
  {label: 'German Shepherd', path: '/pages/german-shepherd', key: 'German_Shepherd', kind: 'dog', traits: []},
  {label: 'Golden Retriever', path: '/pages/golden-retriever', key: 'Golden_Retriever', kind: 'dog', traits: []},
  {label: 'Great Dane', path: '/pages/great-dane', key: 'Great_Dane', kind: 'dog', traits: ['Friendly', 'Patient', 'Dependable']},
  {label: 'Indie', path: '/pages/indie', key: 'Indie', kind: 'dog', traits: []},
  {label: 'Indian Spitz', path: '/pages/indian-spitz', key: 'Indian_Spitz', kind: 'dog', traits: []},
  {label: 'Labrador Retriever', path: '/pages/labrador-retriever', key: 'Labrador_Retriever', kind: 'dog', traits: ['Friendly', 'Active', 'Outgoing']},
  {label: 'Lhasa Apso', path: '/pages/lhasa-apso', key: 'Lhasa_Apso', kind: 'dog', traits: []},
  {label: 'Maine Coon', path: '/pages/maine-coon', key: 'Maine_Coon', kind: 'cat', traits: ['Gentle', 'Intelligent', 'Sociable']},
  {label: 'Maltese', path: '/pages/maltese', key: 'Maltese', kind: 'dog', traits: []},
  {label: 'Persian', path: '/pages/persian', key: 'Persian', kind: 'cat', traits: []},
  {label: 'Pomeranian', path: '/pages/pomeranian', key: 'Pomeranian', kind: 'dog', traits: ['Inquisitive', 'Lively', 'Bold']},
  // The merchant typed this first trait lower case. Their wording, kept as is.
  {label: 'Pug', path: '/pages/pug', key: 'Pug', kind: 'dog', traits: ['charming', 'Loving', 'Mischievous']},
  {label: 'Ragdoll', path: '/pages/ragdoll', key: 'ragdoll', kind: 'cat', traits: []},
  {label: 'Rajapalayam', path: '/pages/rajapalayam', key: 'Rajapalayam', kind: 'dog', traits: []},
  {label: 'Rottweiler', path: '/pages/rottweiler', key: 'Rottweiler', kind: 'dog', traits: ['Loving', 'Loyal', 'Champion']},
  {label: 'Saint Bernard', path: '/pages/saint-bernard', key: 'Saint_Bernard', kind: 'dog', traits: ['Playful', 'Charming', 'Inquisitive']},
  {label: 'Shih Tzu', path: '/pages/shih-tzu', key: 'Shih_Tzu', kind: 'dog', traits: ['Playful', 'Outgoing', 'Affectionate']},
  {label: 'Siamese', path: '/pages/siamese', key: 'Siamese', kind: 'cat', traits: ['Vocal', 'Affectionate', 'Sociable']},
  {label: 'Siberian Husky', path: '/pages/siberian-husky', key: 'Siberian_Husky', kind: 'dog', traits: ['Loyal', 'outgoing', 'Mischievous']},
  {label: 'Sphynx', path: '/pages/sphynx', key: 'Sphynx', kind: 'cat', traits: ['Energetic', 'Affectionate', 'Showy']},
  {label: 'Tabby', path: '/pages/tabby', key: 'Tabby', kind: 'cat', traits: []},
  {label: 'Toy Poodle', path: '/pages/toy-poodle', key: 'Toy_Poodle', kind: 'dog', traits: []},
];

/**
 * The seeded section id, and the fragment that recovers it.
 *
 * The theme builds it as `template--{page id}__{section handle}`, so the
 * template half moves whenever Zigly duplicates or republishes the page while
 * the section half does not. A stale seed costs one extra request and then
 * heals, exactly as ./tileIcons describes -- and the fragment is unambiguous
 * here because, unlike the two dashboard breed rails, this section has exactly
 * one instance on the whole storefront.
 */
const BREED_VERSE_SECTION = 'template--26530973679932__all_breeds_aman_BtKp3Q';

/**
 * Where the photographs come from.
 *
 * `page` is stated because the Section Rendering API only answers for a
 * section the requested page actually renders: asking `/` for this one returns
 * an empty body, which is indistinguishable from a stale id. Same reason
 * ./collectionCards states `/collections`.
 */
export const BREED_VERSE_RAIL: TileRail = {
  storeKey: 'zigly.breedVerse.photos.v1',
  sectionId: BREED_VERSE_SECTION,
  fragment: 'all_breeds_aman',
  page: BREED_VERSE_PATH,
  tiles: BREED_CARDS,
};

/** One tab: what it says, and which cards it admits. */
export type BreedTab = {
  readonly id: 'all' | BreedKind;
  readonly label: string;
};

/**
 * The three tabs, in the theme's own order.
 *
 * "All" is written into the template; "Dog" and "Cat" are generated by Liquid
 * from `section.blocks | map: 'category' | uniq`, which -- because Beagle is
 * block one and Bengal is block two -- yields Dog before Cat. Fixed here rather
 * than derived from BREED_CARDS: deriving would silently reorder the tabs if
 * the merchant ever moved a card, and a tab bar that reorders itself is worse
 * than one needing a code change when a species is added.
 */
export const BREED_TABS: readonly BreedTab[] = [
  {id: 'all', label: 'All'},
  {id: 'dog', label: 'Dog'},
  {id: 'cat', label: 'Cat'},
];

/** The cards a tab shows. "All" is every card, in block order. */
export const cardsForTab = (
  tab: BreedTab['id'],
  cards: readonly BreedCard[] = BREED_CARDS,
): readonly BreedCard[] =>
  tab === 'all' ? cards : cards.filter(c => c.kind === tab);
