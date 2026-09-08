/**
 * "Everything For Your Pet" — the tabs the app invents, and the tile it cannot
 * draw.
 *
 * THE TABS CORRESPOND TO NOTHING IN THE THEME. No template ships Dogs/Cats:
 * `/pages/dog` has Puppy and Adult, `/pages/cat` has Kitten and Cat, and the
 * homepage has no such section. The app's Dogs tab is BOTH of the dog page's
 * tabs together and its Cats tab is both of the cat page's. That is an
 * editorial arrangement rather than a rendering detail -- nothing is invented,
 * every tile and link is Zigly's, but which tiles sit behind which label is the
 * app's decision -- so it is asserted rather than left implicit.
 *
 * ONE SLOT CANNOT BE DRAWN. The dog page's Adult tab has a fifth entry with a
 * link (`shopify://collections/wet-dog-food-adult`) and NO image. The theme's
 * own loop skips it (`{% if block.settings.block_image %}`), and since these
 * tiles carry no text a blank square that navigates somewhere is worse than one
 * fewer tile. Its absence is tested so it is not later "fixed" back in.
 *
 * ARTWORK MUST MATCH BY FULL FILENAME. Five stems collide across the twenty
 * tiles and `Treats` collides FOUR ways, differing only in Shopify's hash. A
 * stem match would put the cat's treats photo on the puppy-treats tile.
 */
import {
  EVERYTHING_CAT_RAIL,
  EVERYTHING_DOG_RAIL,
  EVERYTHING_TABS,
  EVERYTHING_TITLE,
} from '../src/native/everything';
import {matchesKey} from '../src/native/tileIcons';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

const allTiles = () => EVERYTHING_TABS.flatMap(t => t.tiles);
const dogs = () => EVERYTHING_TABS[0];
const cats = () => EVERYTHING_TABS[1];

describe('the tabs are the app’s own', () => {
  it('shows Dogs and Cats, which no template ships', () => {
    expect(EVERYTHING_TABS.map(t => t.label)).toEqual(['Dogs', 'Cats']);
  });

  /** The theme's labels, named so a regression to them is obvious. */
  it('does not show the theme’s own tab labels', () => {
    const labels = EVERYTHING_TABS.map(t => t.label);
    for (const themeLabel of ['Puppy', 'Adult', 'Kitten', 'Cat']) {
      expect(labels).not.toContain(themeLabel);
    }
  });

  /**
   * The merge is not tab-for-tab: each app tab is two theme tabs together.
   * Eight dog tiles (four Puppy + five Adult, less the imageless one) and
   * twelve cat tiles (six Kitten + six Cat).
   */
  it('merges two theme tabs into each app tab', () => {
    expect(dogs().tiles).toHaveLength(8);
    expect(cats().tiles).toHaveLength(12);
    expect(allTiles()).toHaveLength(20);
  });

  /**
   * The heading completes the theme's phrase. `section_heading` is the bare
   * "Everything For", which reads as unfinished alone -- it was written to be
   * followed by a tab label.
   */
  it('completes the theme’s unfinished heading', () => {
    expect(EVERYTHING_TITLE).toBe('Everything For Your Pet');
    expect(EVERYTHING_TITLE).not.toBe('Everything For');
  });
});

describe('the tile that cannot be drawn', () => {
  /**
   * THE ABSENCE THIS SUITE PROTECTS. A link with no artwork, skipped by the
   * theme and skipped here.
   */
  it('omits the imageless wet-dog-food-adult slot', () => {
    const paths = allTiles().map(t => t.path);
    expect(paths).not.toContain('/collections/wet-dog-food-adult');
  });

  /** Every tile that IS drawn has artwork to draw. */
  it('gives every drawn tile a filename to resolve', () => {
    for (const tile of allTiles()) {
      expect(tile.key).toMatch(/\.(png|jpg|jpeg|webp)$/i);
    }
  });
});

describe('the tiles', () => {
  it('sends every tile to a collection', () => {
    for (const tile of allTiles()) {
      expect(tile.path.startsWith('/collections/')).toBe(true);
      expect(tile.path).not.toContain('shopify://');
    }
  });

  /**
   * Labels are the accessibility name only -- every `block_heading__N` in this
   * section is an empty string, so nothing is drawn as text. They are written
   * as words rather than taken from the filename: "OutdoorToys" and
   * "Kittenfood" are filenames, not things to read aloud.
   */
  it('names every tile in readable words', () => {
    for (const tile of allTiles()) {
      expect(tile.label.trim().length).toBeGreaterThan(0);
      // A filename would carry a size or an extension.
      expect(tile.label).not.toMatch(/650X685|\.png$/i);
    }
    expect(dogs().tiles[5].label).toBe('Outdoor Toys');
    expect(cats().tiles[0].label).toBe('Kitten Food');
  });

  /**
   * Four collections appear twice within the Cats tab -- the theme's own
   * duplication across its Kitten and Cat tabs, each with different artwork.
   * Both are kept: each has its own picture and the merchant put both there.
   */
  it('keeps the theme’s repeated collections, each with its own artwork', () => {
    const treats = cats().tiles.filter(t => t.path === '/collections/cat-treats');
    expect(treats).toHaveLength(2);
    expect(treats[0].key).not.toBe(treats[1].key);
  });
});

describe('artwork is matched by full filename', () => {
  it('gives every tile a unique key across the whole section', () => {
    const keys = allTiles().map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * `Treats_650X685_<hash>.png` appears four times across the section. A stem
   * match would give all four the same photo.
   */
  it('keeps the four Treats tiles apart', () => {
    const treats = allTiles().filter(t => t.key.startsWith('Treats_'));
    expect(treats).toHaveLength(4);
    expect(new Set(treats.map(t => t.key)).size).toBe(4);
    // Each key matches only its own file.
    for (const tile of treats) {
      expect(matchesKey(`${CDN}/${tile.key}`, tile.key)).toBe(true);
      for (const other of treats) {
        if (other !== tile) {
          expect(matchesKey(`${CDN}/${other.key}`, tile.key)).toBe(false);
        }
      }
    }
  });

  /** The other four colliding stems, checked the same way. */
  it.each(['Bowls', 'Litter', 'Scratcher', 'GroomingEssentials'])(
    'keeps the two %s tiles apart',
    stem => {
      const pair = allTiles().filter(t => t.key.startsWith(stem + '_'));
      expect(pair).toHaveLength(2);
      expect(matchesKey(`${CDN}/${pair[1].key}`, pair[0].key)).toBe(false);
    },
  );
});

describe('both pages’ artwork merges into one store', () => {
  it('declares every tile to both rails', () => {
    expect(EVERYTHING_DOG_RAIL.tiles).toHaveLength(20);
    expect(EVERYTHING_CAT_RAIL.tiles).toHaveLength(20);
  });

  /** One store, so a fetch of either page fills its half of the same map. */
  it('shares one store between the two rails', () => {
    expect(EVERYTHING_DOG_RAIL.storeKey).toBe(EVERYTHING_CAT_RAIL.storeKey);
  });

  /** Two different section instances, one per page. */
  it('fetches from two different section instances', () => {
    expect(EVERYTHING_DOG_RAIL.sectionId).not.toBe(
      EVERYTHING_CAT_RAIL.sectionId,
    );
    expect(EVERYTHING_DOG_RAIL.fragment).toBe('everything');
    expect(EVERYTHING_CAT_RAIL.fragment).toBe('everything');
  });
});
