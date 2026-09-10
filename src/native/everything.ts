/**
 * "Everything For Your Pet" — two tabs, Dogs and Cats, merged from two pages.
 *
 * Section seventeen, and the one section whose TABS ARE THE APP'S OWN
 * CONSTRUCTION rather than the theme's. No template anywhere ships the tabs the
 * app shows:
 *
 *   /pages/dog   section_heading "Everything For", tabs: Puppy  / Adult
 *   /pages/cat   section_heading "Everything For", tabs: Kitten / Cat
 *   homepage     no such section at all
 *
 * ../webview/everythingSection resolves that by using the dog section as the
 * frame, relabelling its two tabs Dogs and Cats, and filling the second from
 * the cat page. This does the same merge from the theme's block settings, and
 * the reason is worth stating: the two tabs a customer taps do not correspond
 * to any single tab in the theme. The Dogs tab is the dog page's Puppy AND
 * Adult tiles together; the Cats tab is the cat page's Kitten AND Cat tiles.
 *
 * That is a real editorial decision, so it is recorded rather than buried:
 * nothing is invented -- every tile, its artwork and its collection are Zigly's
 * -- but which tiles sit behind which label is this app's arrangement, exactly
 * as ../webview/everythingSection says ("All tiles remain Zigly's own markup
 * with their real collection links; only which tiles sit behind which label
 * changes").
 *
 * THE HEADING IS EXTENDED, AND THAT IS ALSO THE APP'S. The theme's
 * `section_heading` is the bare phrase "Everything For", which reads as
 * unfinished standing alone -- it was written to be followed by the tab. The
 * app's dashboard heads it "Everything For Your Pet", which is what
 * ./dashboardSections records and what the customer sees today.
 *
 * ONE TILE IS DROPPED BECAUSE IT CANNOT DRAW. The dog page's Adult tab has a
 * fifth slot carrying a link (`shopify://collections/wet-dog-food-adult`) and
 * NO IMAGE -- `block_image__1` is absent while `block_image_link__1` is set.
 * The theme's own loop skips it (`{% if block.settings.block_image %}`), and
 * these tiles have no text of their own, so a tile with neither picture nor
 * label would be a blank square that navigates somewhere. Skipped here for the
 * same reason, and written down so its absence is not read as an oversight.
 *
 * ARTWORK IS MATCHED BY FULL FILENAME, not by stem. Five stems collide across
 * the twenty tiles -- `Treats` appears FOUR times, `Bowls`, `Litter`,
 * `Scratcher` and `GroomingEssentials` twice each -- differing only in the hash
 * Shopify appended. A stem match would give the puppy-treats tile the cat's
 * photo. All twenty filenames are unique in full. ./tileIcons' two matching
 * modes exist for this and for ./explore.
 */
import type {Tile} from './tileIcons';

/** ../webview/pageCache's own template prefixes. */
const DOG = 'template--26530973942076__';
const CAT = 'template--26530973843772__';

/** One tab of the section. */
export type EverythingTab = {
  readonly label: string;
  readonly tiles: readonly Tile[];
};

/**
 * The heading, as the app draws it.
 *
 * The theme says "Everything For"; see the note above on why the app completes
 * the phrase.
 */
export const EVERYTHING_TITLE = 'Everything For';

/**
 * A tile.
 *
 * `label` is the accessibility name only -- every `block_heading__N` in this
 * section is an empty string, so the tiles show no text and the words are
 * lettering inside the artwork. Written out in full words rather than taken
 * from the filename: "OutdoorToys" and "Kittenfood" are filenames, not things
 * to read aloud.
 */
const tile = (label: string, handle: string, file: string): Tile => ({
  label,
  path: `/collections/${handle}`,
  key: file,
});

/**
 * The Dogs tab: the dog page's Puppy and Adult tiles, in that order.
 *
 * Eight of the nine slots across those two tabs (four Puppy, five Adult); the
 * ninth is the imageless one described above.
 */
const DOG_TILES: readonly Tile[] = [
  // Puppy
  tile('Dog Bowls', 'dog-bowls', 'Bowls_650X685_76fad150-2ee8-424c-b800-0d9410bb6ca0.png'),
  tile('Puppy Treats', 'puppy-treats', 'Treats_650X685_b30e1b91-3543-4f73-b44b-a045619b5d8a.png'),
  tile('Pee Pads', 'dog-diaper-pee-pads', 'Peepads_650X685_7e3d20fa-0bf4-4077-a580-4b4c55dda147.png'),
  tile('Dog Beds', 'dog-beds', 'Beds_650X685_ebe02c27-8d93-4018-bb3b-091828178148.png'),
  // Adult. The wet-food slot is skipped -- it has a link and no image.
  tile('Adult Treats', 'dog-treats-adult', 'Treats_650X685_5286df5f-120e-4e91-96f2-306171830078.png'),
  tile('Outdoor Toys', 'dog-fetch-toys', 'OutdoorToys_650X685_becd838b-85b5-4a97-afdd-d0a796efbd08.png'),
  tile('Ice Creams', 'pup-ice', 'Icecreams_650X685_7c678df8-7528-4f20-87f1-865ce794ecc4.png'),
  tile(
    'Grooming Essentials',
    'dog-grooming',
    'Grooming-Essentials_650X685_469ae296-368f-42ab-ba43-0c1dd6c18fb8.png',
  ),
];

/** The Cats tab: the cat page's Kitten and Cat tiles, in that order. */
const CAT_TILES: readonly Tile[] = [
  // Kitten
  tile('Kitten Food', 'kitten-food', 'Kittenfood_650X685_80a53c7e-0821-4590-a131-001ba84e6452.png'),
  tile('Cat Treats', 'cat-treats', 'Treats_650X685_2e1e3eaa-c04b-440b-8292-b29d8ed6bdb9.png'),
  tile('Litter Accessories', 'cat-litter-accessories', 'Litter_650X685_dbe57458-04b4-495d-98b5-c525871921d5.png'),
  tile('Cat Collars', 'cat-collars', 'Collars_650X685_9d609de6-15a3-4ddb-a863-3d8333c41970.png'),
  tile('Trees & Scratchers', 'cat-trees-scratchers', 'Scratcher_650X685_ccd3be89-62e9-44d7-ae77-d6bee3ac912c.png'),
  tile('Grooming Essentials', 'cat-grooming', 'GroomingEssentials_650X685_74c0c404-8c80-400d-b343-aeee92b945a0.png'),
  // Cat. Four of these six repeat a Kitten collection with different artwork;
  // that is the theme's own duplication and both tiles are kept, because each
  // has its own picture and the merchant put both there.
  tile('Cat Wet Food', 'cat-wet-food', 'Wet-Food_650X685_44c92ead-55ea-4ef7-994a-70dc4303cc1b.png'),
  tile('Cat Treats', 'cat-treats', 'Treats_650X685_c5b019dd-f28f-449c-b861-a4266cb7d556.png'),
  tile('Cat Bowls', 'cat-bowls', 'Bowls_650X685_0035fb06-4aca-443c-ba92-b7775df9b8cf.png'),
  tile('Litter Accessories', 'cat-litter-accessories', 'Litter_650X685_16708cf0-25c8-4ae5-92d1-fbec4e0a55a2.png'),
  tile('Grooming Essentials', 'cat-grooming', 'GroomingEssentials_650X685_61cbf7c2-0e1e-41e5-89c6-c8b15c68fb31.png'),
  tile('Trees & Scratchers', 'cat-trees-scratchers', 'Scratcher_650X685_234fe723-250a-4d1d-a982-230c74e4e86b.png'),
];

/**
 * The two tabs the app shows.
 *
 * Dogs first, matching the dashboard's own bias towards the dog page -- the
 * whole section set is `/pages/dog`'s (see ../webview/pageCache).
 */
export const EVERYTHING_TABS: readonly EverythingTab[] = [
  {label: 'Dogs', tiles: DOG_TILES},
  {label: 'Cats', tiles: CAT_TILES},
];

/**
 * Artwork from the dog page's section, and from the cat page's.
 *
 * Both rails are given ALL twenty tiles and share one store, exactly as
 * ./explore does: each fetch resolves whatever its own page's section happens
 * to carry, the filenames decide which, and ./tileIcons' merge-on-save means
 * neither overwrites the other's entries.
 */
const ALL_TILES: readonly Tile[] = [...DOG_TILES, ...CAT_TILES];

export const EVERYTHING_DOG_RAIL = {
  storeKey: 'zigly.everythingIcons.v1',
  sectionId: DOG + 'everything_czXFGJ',
  fragment: 'everything',
  tiles: ALL_TILES,
};

export const EVERYTHING_CAT_RAIL = {
  storeKey: 'zigly.everythingIcons.v1',
  sectionId: CAT + 'everything_czXFGJ',
  fragment: 'everything',
  tiles: ALL_TILES,
};
