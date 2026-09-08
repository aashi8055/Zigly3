/**
 * "Explore. Pick. Pamper." — the dog/cat merge, and the two ways it went wrong.
 *
 * ../src/webview/explorePicker records that this section read as dog-only for
 * three separate reasons, each of which had to be found on a device because
 * none of them throws. Two are data shape and are asserted here; the third (a
 * per-tab cap equal to the real total) cannot recur, because the tiles are read
 * from the theme rather than fetched and there is no cap.
 *
 * 1. DE-DUPLICATING BY LABEL DELETED THE CATS. Seven labels appear on both
 *    pages and every colliding pair points at a *different* collection, since
 *    each pet's tile goes to that pet's own listing. Keying on the label
 *    therefore dropped the cat tile of every shared category and silently
 *    turned it into the dog listing -- measured on the live sections, 1 of 4
 *    cat tiles survived in Food.
 *
 * 2. APPENDING THE CATS AFTER THE DOGS IS STILL A DOG-ONLY RAIL. The row shows
 *    about two tiles at a time, so four dogs followed by four cats puts every
 *    cat off-screen with nothing to suggest scrolling reaches them.
 *
 * And one this file adds, found while building it: the artwork cannot be paired
 * by filename stem here, because both pages ship
 * `Meaty-Treats_650X765_<hash>.png` and the hashes are all that differ. A stem
 * match would give the dog and cat tiles the same picture and put a cat photo
 * above a dog collection.
 */
import {EXPLORE_TABS, EXPLORE_TITLE, interleave} from '../src/native/explore';
import {matchesKey} from '../src/native/tileIcons';

/** Every tile in the section, across all four tabs. */
const allTiles = () => EXPLORE_TABS.flatMap(t => t.tiles);

describe('the section as the site declares it', () => {
  it('is headed as the theme heads it', () => {
    expect(EXPLORE_TITLE).toBe('Explore. Pick. Pamper.');
  });

  it('has the four tabs both pages declare, in order', () => {
    expect(EXPLORE_TABS.map(t => t.label)).toEqual([
      'Food',
      'Treats',
      'Toys',
      'Smart Petcare',
    ]);
  });

  /** Four dog tiles and four cat tiles per tab, from the two source pages. */
  it('carries eight tiles in every tab', () => {
    for (const tab of EXPLORE_TABS) {
      expect(tab.tiles).toHaveLength(8);
    }
    expect(allTiles()).toHaveLength(32);
  });

  it('sends every tile to a collection', () => {
    for (const tile of allTiles()) {
      expect(tile.path.startsWith('/collections/')).toBe(true);
      expect(tile.path).not.toContain('shopify://');
    }
  });

  /**
   * The disabled "Dog Food" tab block on the dog page -- leash and accessory
   * tiles, `"disabled": true` -- must not appear. Liquid never renders a
   * disabled block, so neither may this.
   */
  it('excludes the disabled tab block the site does not render', () => {
    expect(EXPLORE_TABS.map(t => t.label)).not.toContain('Dog Food');
    const labels = allTiles().map(t => t.label);
    expect(labels).not.toContain('Leashes- Collars-Harness');
    expect(labels).not.toContain('Accessories');
  });
});

describe('colliding labels are not duplicates', () => {
  /**
   * THE FAILURE THIS SUITE EXISTS FOR.
   *
   * Both members of every colliding pair must be present, each with its own
   * collection. Named per pair so a regression says which category was lost.
   */
  const COLLISIONS: Array<[string, string, string]> = [
    ['Dry Food', '/collections/dog-dry-food', '/collections/cat-dry-food'],
    ['Wet Food', '/collections/dog-wet-food', '/collections/cat-wet-food'],
    [
      'Prescription Food',
      '/collections/prescription-dog-food',
      '/collections/cat-prescription-food',
    ],
    [
      'Meaty Treats',
      '/collections/dog-meaty-treats',
      '/collections/cat-meaty-treats',
    ],
    ['Plush Toys', '/collections/dog-plush-toys', '/collections/cat-plush-toys'],
    [
      'Interactive Toys',
      '/collections/dog-interactive-toys',
      '/collections/cat-interactive-toys',
    ],
    ['Fresh Food', '/collections/fresh-dog-food', '/collections/fresh-for-purr'],
  ];

  it.each(COLLISIONS)(
    'keeps both "%s" tiles, one per pet',
    (label, dogPath, catPath) => {
      const paths = allTiles()
        .filter(t => t.label === label)
        .map(t => t.path);
      expect(paths).toContain(dogPath);
      expect(paths).toContain(catPath);
    },
  );

  /** Stated as a count too: seven labels appear twice, so 32 tiles have 25 labels. */
  it('has fewer distinct labels than tiles, and that is correct', () => {
    const tiles = allTiles();
    const labels = new Set(tiles.map(t => t.label));
    expect(tiles).toHaveLength(32);
    expect(labels.size).toBe(32 - COLLISIONS.length);
  });

  /** Every destination is distinct, which is what makes them all real tiles. */
  it('sends no two tiles to the same collection', () => {
    const paths = allTiles().map(t => t.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('the cats are reachable without scrolling', () => {
  /**
   * A cat tile must be SECOND in every tab. The row shows about two tiles at a
   * time, so this is the difference between a merged rail and one that looks
   * dog-only.
   */
  it('puts a cat tile second in every tab', () => {
    const catSecond: Record<string, string> = {
      Food: '/collections/cat-dry-food',
      Treats: '/collections/applod-cats',
      Toys: '/collections/cat-interactive-toys',
      'Smart Petcare': '/collections/fresh-for-purr',
    };
    for (const tab of EXPLORE_TABS) {
      expect(tab.tiles[1].path).toBe(catSecond[tab.label]);
    }
  });

  it('alternates the two pets rather than appending one after the other', () => {
    // Dog collections carry "dog"/"puppy" in the handle; cat ones "cat"/
    // "kitten"/"purr". Checked on the tabs where that holds for all eight.
    const food = EXPLORE_TABS[0].tiles.map(t =>
      /\/(?:dog|puppy|prescription-dog)/.test(t.path) ? 'd' : 'c',
    );
    expect(food.join('')).toBe('dcdcdcdc');
  });
});

describe('interleaving, directly', () => {
  it('alternates two equal lists', () => {
    expect(interleave([1, 3, 5], [2, 4, 6])).toEqual([1, 2, 3, 4, 5, 6]);
  });

  /**
   * An uneven pair must keep every element. Truncating to the shorter length
   * would silently drop tiles if Zigly added one to a single page.
   */
  it('keeps the tail when one list is longer', () => {
    expect(interleave([1, 3, 5, 7, 9], [2, 4])).toEqual([1, 2, 3, 4, 5, 7, 9]);
    expect(interleave([1], [2, 4, 6])).toEqual([1, 2, 4, 6]);
  });

  it('handles an empty list on either side', () => {
    expect(interleave([], [1, 2])).toEqual([1, 2]);
    expect(interleave([1, 2], [])).toEqual([1, 2]);
    expect(interleave([], [])).toEqual([]);
  });
});

describe('artwork is paired by full filename here, not by stem', () => {
  /**
   * The reason ./tileIcons supports two matching modes. Both pages ship
   * `Meaty-Treats_650X765_<hash>.png`; only the hash differs.
   */
  it('gives every tile a unique key across the whole section', () => {
    const keys = allTiles().map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(32);
  });

  it('names a full filename, so the two pets cannot share a picture', () => {
    const meaty = allTiles().filter(t => t.label === 'Meaty Treats');
    expect(meaty).toHaveLength(2);
    for (const tile of meaty) {
      // A key with an extension is matched exactly by ./tileIcons.
      expect(tile.key).toMatch(/\.(png|jpg|jpeg|webp)$/i);
    }
    // The two share a leading word, which is exactly why a stem will not do.
    expect(meaty[0].key.split('_')[0]).toBe(meaty[1].key.split('_')[0]);
    expect(meaty[0].key).not.toBe(meaty[1].key);
  });

  /**
   * And the matcher must honour that: the dog tile's key must match the dog
   * file and NOT the cat file, which a stem match would have done.
   */
  it('matches only its own file', () => {
    const [dog, cat] = allTiles().filter(t => t.label === 'Meaty Treats');
    const base = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files/';
    expect(matchesKey(base + dog.key, dog.key)).toBe(true);
    expect(matchesKey(base + cat.key, dog.key)).toBe(false);
    expect(matchesKey(base + dog.key, cat.key)).toBe(false);
  });

  /** A `?v=` cache stamp must not defeat an exact filename match. */
  it('ignores a query string on an exact match', () => {
    const [dog] = allTiles().filter(t => t.label === 'Meaty Treats');
    expect(
      matchesKey('https://cdn.shopify.com/x/' + dog.key + '?v=123', dog.key),
    ).toBe(true);
  });
});
