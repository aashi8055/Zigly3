/**
 * Zigly Coins and the six category tiles — the `best_deals` section.
 *
 * Three things here are unlike the sections above it, and each is a way this
 * could go wrong quietly.
 *
 * THE NAME IS MISLEADING. `best_deals` sounds like a product rail and is not
 * one: one banner and six category blocks, no products and no prices.
 * ../src/webview/extraSections carries the same warning. A future rewrite that
 * trusted the name would reach for ../src/native/products and find nothing to
 * use.
 *
 * THE COINS LINK LEAVES ZIGLY.COM, AND HAS A SPACE IN IT. The theme's setting
 * is `https://ziglyprime.erlpaas.com/Login Microsite` -- a real space in a real
 * URL. It must stay in-app (../src/constants/appConstants lists that host as
 * INTERNAL on purpose, because the flow asks for a mobile number and sending it
 * to a browser broke it) and it must be encoded, because a raw space fails in a
 * way that reads as a dead link rather than a malformed one.
 *
 * A MISTYPED ARTWORK KEY LOSES THE WHOLE TILE. These blocks' titles are all
 * blank on the live page, so the words are lettering inside the picture and
 * there is nothing to fall back to -- ../src/native/BestDeals drops a tile whose
 * image did not resolve. Every key is therefore checked against the filename
 * verbatim from `templates/page.dog.json`.
 */
import {
  BEST_DEALS_RAIL,
  BEST_DEALS_TILES,
  COINS_BANNER,
  COINS_LINK,
} from '../src/native/bestDealsData';
import {INTERNAL_HOSTS} from '../src/constants/appConstants';
import {matchesKey} from '../src/native/tileIcons';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** The real image filename for every block, from the theme. */
const FILENAMES: Record<string, string> = {
  '620X540_Dog-Food': '620X540_Dog-Food_a131fa48-2cec-4f77-adfd-6089e07a501b.png',
  '620X540_DogTreats': '620X540_DogTreats_bc659887-fd96-4d5e-b0b0-0f73111bfc38.png',
  '620X540_DogToys': '620X540_DogToys_8b0c08d1-6194-4d03-b29b-fb026c2dd606.png',
  '620X540_Dog-Bowls': '620X540_Dog-Bowls_168b0a86-c7c9-41f9-b58e-6b09587b85a0.png',
  '620X540_WE': '620X540_WE_6a1db07e-8118-405e-b8d1-ef14f77ab0ad.png',
  '620X540_Grooming': '620X540_Grooming_a368f0ff-6798-4e9f-88e7-045982859a8c.png',
  'zigly-coin-mobile-dog': 'zigly-coin-mobile-dog.png',
};

describe('it is not a product section', () => {
  /**
   * Asserted because the name says otherwise and ../src/webview/extraSections
   * warns about it: six category tiles, each linking to a collection.
   */
  it('holds six category tiles and no products', () => {
    expect(BEST_DEALS_TILES).toHaveLength(6);
    for (const tile of BEST_DEALS_TILES) {
      expect(tile.path.startsWith('/collections/')).toBe(true);
      expect(tile.path).not.toContain('/products/');
    }
  });

  it('sends each tile to the collection the theme names', () => {
    const paths = BEST_DEALS_TILES.map(t => t.path);
    expect(paths).toEqual([
      '/collections/dog-food',
      '/collections/dog-treats',
      '/collections/dog-toys',
      '/collections/dog-bowls',
      '/collections/dog-collars-harnesses-leashes',
      '/collections/dog-grooming',
    ]);
  });

  it('resolves the theme’s Liquid references to real paths', () => {
    for (const tile of BEST_DEALS_TILES) {
      expect(tile.path).not.toContain('shopify://');
    }
  });
});

describe('the Zigly Coins banner', () => {
  /**
   * THE ENCODING TEST. The theme's setting carries a literal space; a raw
   * space in a URL is invalid and RN handles it inconsistently.
   */
  it('percent-encodes the space in the Zigly Prime URL', () => {
    expect(COINS_LINK).toBe('https://ziglyprime.erlpaas.com/Login%20Microsite');
    expect(COINS_LINK).not.toContain(' ');
  });

  /**
   * It must stay in-app. ../src/constants/appConstants lists this host as
   * INTERNAL deliberately -- the note there records that treating it as
   * external broke the mobile-number flow.
   */
  it('points at a host the app keeps in-app', () => {
    const host = COINS_LINK.replace('https://', '').split('/')[0];
    expect(host).toBe('ziglyprime.erlpaas.com');
    expect(INTERNAL_HOSTS).toContain(host);
  });

  /** Absolute, not a storefront path: it is the first section to leave the origin. */
  it('is an absolute URL rather than a path', () => {
    expect(COINS_BANNER.link.startsWith('https://')).toBe(true);
    expect(COINS_BANNER.link.startsWith('/')).toBe(false);
  });

  /**
   * The mobile crop, not the desktop one. The theme ships both and picks by
   * media query; on a phone the answer is always the mobile asset.
   */
  it('takes the mobile crop', () => {
    expect(COINS_BANNER.key).toBe('zigly-coin-mobile-dog');
    expect(COINS_BANNER.key).not.toContain('desktop');
  });

  /** And the key must not accidentally match the desktop file beside it. */
  it('does not match the desktop artwork', () => {
    expect(
      matchesKey(`${CDN}/zigly-coin-desktop-dog.png`, COINS_BANNER.key),
    ).toBe(false);
    expect(
      matchesKey(`${CDN}/zigly-coin-mobile-dog.png`, COINS_BANNER.key),
    ).toBe(true);
  });

  /** The banner shows no text of its own, so this is the only name it has. */
  it('carries an accessibility name', () => {
    expect(COINS_BANNER.label).toBe('Zigly Coins');
  });
});

describe('every artwork key matches its real filename', () => {
  /**
   * The check that matters most here: with blank titles on every block, a key
   * that does not match is a tile that silently vanishes from the grid.
   */
  it.each(Object.entries(FILENAMES))('resolves %s', (key, filename) => {
    expect(matchesKey(`${CDN}/${filename}`, key)).toBe(true);
  });

  it('has a filename recorded for every tile the section draws', () => {
    for (const tile of BEST_DEALS_RAIL.tiles) {
      expect(FILENAMES[tile.key]).toBeDefined();
    }
    // Six tiles plus the banner.
    expect(BEST_DEALS_RAIL.tiles).toHaveLength(7);
  });

  /**
   * All six tile filenames share the `620X540_` prefix, so a key truncated to
   * that prefix would claim whichever file came first and give several tiles
   * the same picture -- with no label on any of them to say which was wrong.
   */
  it('does not let one 620X540 key claim another’s file', () => {
    expect(matchesKey(`${CDN}/${FILENAMES['620X540_DogToys']}`, '620X540_Dog-Food')).toBe(
      false,
    );
    expect(
      matchesKey(`${CDN}/${FILENAMES['620X540_DogTreats']}`, '620X540_DogToys'),
    ).toBe(false);
    expect(
      matchesKey(`${CDN}/${FILENAMES['620X540_Dog-Bowls']}`, '620X540_Dog-Food'),
    ).toBe(false);
  });

  it('gives every tile a unique key', () => {
    const keys = BEST_DEALS_RAIL.tiles.map(t => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the section shares one fetch', () => {
  /**
   * The banner and the six tiles come from the same rendered section, so they
   * resolve together -- the banner is declared as a tile purely so
   * ../src/native/tileIcons can pair it alongside the rest.
   */
  it('declares the banner and the tiles in one store', () => {
    expect(BEST_DEALS_RAIL.storeKey).toBe('zigly.bestDealsIcons.v1');
    const keys = BEST_DEALS_RAIL.tiles.map(t => t.key);
    expect(keys).toContain(COINS_BANNER.key);
    for (const tile of BEST_DEALS_TILES) {
      expect(keys).toContain(tile.key);
    }
  });

  it('names the section it is fetched from', () => {
    expect(BEST_DEALS_RAIL.sectionId).toContain('best_deals');
    expect(BEST_DEALS_RAIL.fragment).toBe('best_deals');
  });
});

describe('every tile has an accessibility name', () => {
  /**
   * `best_deal_block_title` is blank on all six blocks, so the visible words
   * are inside the artwork and this is the only description a screen reader
   * gets. An empty one would be a link announcing nothing.
   */
  it('names each tile after what its artwork says', () => {
    const labels = BEST_DEALS_TILES.map(t => t.label);
    expect(labels).toEqual([
      'Dog Food',
      'Dog Treats',
      'Dog Toys',
      'Dog Bowls',
      'Walk Essentials',
      'Grooming',
    ]);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
