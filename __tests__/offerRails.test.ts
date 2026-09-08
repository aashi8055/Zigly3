/**
 * The three offer rails, and the one thing that makes them different.
 *
 * Applod Food, Applod Treats and Zigly Style Steals are three instances of the
 * theme's `offer-section`, and their tiles have NO LABEL: the section renders
 * each block as an image inside a link and nothing else, with the words
 * ("Applod Dog Fresh Food") drawn inside the picture.
 *
 * That is why these deserve their own suite rather than riding on the tile-rail
 * one. Two consequences, both asserted here:
 *
 * 1. A KEY THAT DOES NOT MATCH ITS FILE LOSES THE WHOLE TILE. Elsewhere an
 *    unresolved tile falls back to its label's initial and stays useful. Here
 *    there is no label, so ./OfferRail drops it -- meaning a mistyped key is a
 *    tile that silently vanishes from the dashboard rather than one that looks
 *    slightly wrong. Every key is therefore checked against the real filename
 *    from the theme.
 *
 * 2. A LINK'S QUERY STRING CAN BE THE WHOLE POINT. One tile's link is a full
 *    URL rather than a Liquid reference:
 *    `/collections/dog-dry-food?f.Brands=applod`. Without that filter the tile
 *    lands on every brand's dry food, which is not what an "Applod Food" tile
 *    promises.
 *
 * Filenames below are verbatim from `templates/page.dog.json`, sections
 * `offer_section_nYDda8`, `_H88hDB` and `_4xR48g`.
 */
import {
  APPLOD_FOOD,
  APPLOD_TREATS,
  OFFER_RAILS,
  STYLE_STEALS,
} from '../src/native/offerRails';
import {matchesKey} from '../src/native/tileIcons';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** The real image filename for every tile, from the theme. */
const FILENAMES: Record<string, string> = {
  // Applod Food
  Applod_Dog_Fresh_Food: 'Applod_Dog_Fresh_Food.png',
  Applod_Dog_Wet_Food: 'Applod_Dog_Wet_Food.png',
  Applod_Dog_Cat_Bone_Broth: 'Applod_Dog_Cat_Bone_Broth.png',
  ApplodDryFood: 'ApplodDryFood_650X610_1.png',
  // Applod Treats
  Applod_Dog_Biscuits: 'Applod_Dog_Biscuits.png',
  Applod_Dog_Yak_Treat: 'Applod_Dog_Yak_Treat.png',
  Applod_Dog_Treats: 'Applod_Dog_Treats.png',
  Applod_Dog_Dental_Treats: 'Applod_Dog_Dental_Treats.png',
  // Zigly Style Steals
  'ZL-WE': 'ZL-WE_610X650-copy.png',
  'ZL-Bowl': 'ZL-Bowl_650X610_32ef9932-cb7d-4ac4-8dc0-42543f24a765.png',
  'ZL-Summer-Shirts-':
    'ZL-Summer-Shirts-_-Accessories_610X650-copy_abd01ec0-586a-4837-985f-d02e5a230d3c.png',
  'ZL-PetIDs': 'ZL-PetIDs_610X650-copy.png',
  'ZL-Beds': 'ZL-Beds_610X650_967adc08-af65-4a07-84de-88d2819a69c4.png',
  'ZL-Blankets': 'ZL-Blankets_610X650-copy.png',
  'ZL-Toys': 'ZL-Toys_610X650-copy_656a060d-1392-4d5e-acb2-782f233ce42c.png',
};

const allTiles = () => OFFER_RAILS.flatMap(r => r.tiles);

describe('the three rails as the theme declares them', () => {
  it('is headed as the theme heads each one', () => {
    expect(APPLOD_FOOD.title).toBe('Applod Food');
    expect(APPLOD_TREATS.title).toBe('Applod Treats');
    expect(STYLE_STEALS.title).toBe('Zigly Style Steals');
  });

  it('carries the tile counts the theme has', () => {
    expect(APPLOD_FOOD.tiles).toHaveLength(4);
    expect(APPLOD_TREATS.tiles).toHaveLength(4);
    // Style Steals has seven where the other two have four.
    expect(STYLE_STEALS.tiles).toHaveLength(7);
  });

  it('points every tile at a collection', () => {
    for (const tile of allTiles()) {
      expect(tile.path.startsWith('/collections/')).toBe(true);
      expect(tile.path).not.toContain('shopify://');
    }
  });

  /**
   * Three separate sections, three separate stores. Sharing one would make a
   * miss on any rail look like a miss on all three, because ./tileIcons merges.
   */
  it('gives each rail its own store and section id', () => {
    const stores = OFFER_RAILS.map(r => r.storeKey);
    const ids = OFFER_RAILS.map(r => r.sectionId);
    expect(new Set(stores).size).toBe(3);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('the filter query on the one full-URL link', () => {
  /**
   * THE FAILURE THIS PAIR OF TESTS EXISTS FOR. Every other tile's link is
   * `shopify://collections/x`; this one is a full URL carrying a brand filter,
   * and the filter is what makes it an Applod tile.
   */
  it('keeps ?f.Brands=applod on the dry-food tile', () => {
    const dry = APPLOD_FOOD.tiles.find(t => t.key === 'ApplodDryFood');
    expect(dry?.path).toBe('/collections/dog-dry-food?f.Brands=applod');
  });

  it('would otherwise land on every brand’s dry food', () => {
    const dry = APPLOD_FOOD.tiles.find(t => t.key === 'ApplodDryFood');
    // Stated as the thing that must not happen, so a "tidy-up" that strips
    // query strings from these paths fails here rather than on a device.
    expect(dry?.path).not.toBe('/collections/dog-dry-food');
  });
});

describe('every key matches its real filename', () => {
  /**
   * The check that matters most in this file. A tile whose key does not match
   * has no artwork, and with no label to fall back to ./OfferRail drops it --
   * so a typo here is a tile that disappears with nothing to show it did.
   */
  it.each(Object.entries(FILENAMES))(
    'resolves %s',
    (key, filename) => {
      expect(matchesKey(`${CDN}/${filename}`, key)).toBe(true);
    },
  );

  it('has a filename recorded for every tile in all three rails', () => {
    for (const tile of allTiles()) {
      expect(FILENAMES[tile.key]).toBeDefined();
    }
    expect(allTiles()).toHaveLength(Object.keys(FILENAMES).length);
  });

  /**
   * The risk a stem match carries: a short key claiming a longer file. All
   * four Applod Treats keys share the `Applod_Dog_` prefix and sit in the same
   * rail, so a collision would give two tiles the same picture -- and with no
   * label on either, nothing on screen would say which was wrong.
   */
  it('does not let one Applod key claim another Applod file', () => {
    expect(
      matchesKey(`${CDN}/Applod_Dog_Dental_Treats.png`, 'Applod_Dog_Treats'),
    ).toBe(false);
    expect(
      matchesKey(`${CDN}/Applod_Dog_Fresh_Food.png`, 'Applod_Dog_Wet_Food'),
    ).toBe(false);
  });

  /**
   * `ZL-Summer-Shirts-` ends in the separator character, which is the one key
   * in the app that does. Worth pinning: the theme's filename is
   * `ZL-Summer-Shirts-_-Accessories_…`, so the key has to end that way, and it
   * looks like a typo to anybody tidying up.
   */
  it('keeps the trailing hyphen on the Summer Shirts key', () => {
    const tile = STYLE_STEALS.tiles.find(t => t.label === 'Summer Styles');
    expect(tile?.key).toBe('ZL-Summer-Shirts-');
    expect(matchesKey(`${CDN}/${FILENAMES['ZL-Summer-Shirts-']}`, tile!.key)).toBe(
      true,
    );
  });

  it('gives every tile a unique key within its rail', () => {
    for (const rail of OFFER_RAILS) {
      const keys = rail.tiles.map(t => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('the accessibility name stands in for a label that is not drawn', () => {
  /**
   * These tiles show no text, so `label` is the only description a screen
   * reader gets. An empty one would be a link announcing nothing.
   */
  it('gives every tile a non-empty name', () => {
    for (const tile of allTiles()) {
      expect(tile.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('names the tile after what its artwork says', () => {
    expect(
      APPLOD_FOOD.tiles.find(t => t.key === 'Applod_Dog_Fresh_Food')?.label,
    ).toBe('Applod Fresh Food');
    expect(STYLE_STEALS.tiles.find(t => t.key === 'ZL-Beds')?.label).toBe(
      'Beds & Mats',
    );
  });
});
