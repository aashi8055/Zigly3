/**
 * "Find the Best Deals!" — the six price tiles.
 *
 * The simplest section in the dashboard and the one with the most inviting
 * mistakes, all three of which are things a tidy-minded rewrite would do:
 *
 * 1. RENDER THE DISABLED BLOCKS. The theme has thirteen and six are enabled.
 *    The seven disabled ones are unfinished drafts: three carry the subheading
 *    "Lorem Ipsum", one prices at "₹999.00" where the live tiles use "₹999",
 *    and every one links to "/" instead of a collection. Shopify never renders
 *    a disabled block; a rebuild that read `block_order` wholesale would put
 *    placeholder copy on the dashboard, linking to the homepage.
 *
 * 2. PARSE THE PRICE. "₹599" is a string the merchant typed, and there is no
 *    product behind it -- the figure is a threshold in a collection's name.
 *    Running it through ../src/utils/money would be inventing a number, and
 *    would break the moment one reads "₹999.00" as the disabled blocks do.
 *
 * 3. "CORRECT" THE FIRST HANDLE. Five tiles link to `dog-under-N` and the
 *    first to `dogs-under-599` -- plural. That is the merchant's own naming and
 *    both resolve; making them uniform would 404 the ₹599 tile.
 */
import {
  PRICE_TILES,
  PRICE_TILES_TITLE,
} from '../src/native/priceTilesData';

describe('only the enabled blocks', () => {
  /**
   * THE FAILURE THIS SUITE EXISTS FOR. Six, not thirteen.
   */
  it('draws the six enabled tiles and none of the seven disabled ones', () => {
    expect(PRICE_TILES).toHaveLength(6);
  });

  /** The disabled drafts' tells, each stated so a regression names itself. */
  it('carries no "Lorem Ipsum" placeholder copy', () => {
    const text = JSON.stringify(PRICE_TILES);
    expect(text).not.toContain('Lorem');
    expect(text).not.toContain('Ipsum');
  });

  it('sends no tile to the homepage', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.path).not.toBe('/');
      expect(tile.path.startsWith('/collections/')).toBe(true);
    }
  });

  /** The disabled blocks use "₹999.00"; every live one is a whole rupee. */
  it('uses the live tiles’ price format, not the drafts’', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.price).not.toContain('.00');
    }
  });
});

describe('the prices are the merchant’s strings', () => {
  it('keeps the currency symbol the merchant typed', () => {
    expect(PRICE_TILES.map(t => t.price)).toEqual([
      '₹599',
      '₹999',
      '₹1499',
      '₹2499',
      '₹3499',
      '₹5999',
    ]);
  });

  /**
   * Stated as a type, because the temptation is to store a number and format
   * it. There is no product behind these figures and no paise to convert.
   */
  it('stores the price as text rather than a number', () => {
    for (const tile of PRICE_TILES) {
      expect(typeof tile.price).toBe('string');
    }
  });

  it('says "Under" above every price, as the theme does', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.heading).toBe('Under');
    }
  });
});

describe('the collection handles are the merchant’s', () => {
  /**
   * The first is plural and the rest singular. Both resolve on the live store;
   * making them uniform would break the ₹599 tile.
   */
  it('keeps the plural handle on the ₹599 tile', () => {
    const first = PRICE_TILES[0];
    expect(first.price).toBe('₹599');
    expect(first.path).toBe('/collections/dogs-under-599');
    expect(first.path).not.toBe('/collections/dog-under-599');
  });

  it('keeps the singular handle on the other five', () => {
    for (const tile of PRICE_TILES.slice(1)) {
      expect(tile.path).toMatch(/^\/collections\/dog-under-\d+$/);
    }
  });

  it('resolves the theme’s Liquid references to real paths', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.path).not.toContain('shopify://');
    }
  });

  it('sends no two tiles to the same collection', () => {
    const paths = PRICE_TILES.map(t => t.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  /** The threshold in the handle must match the price on the tile. */
  it('matches each tile’s price to its collection’s threshold', () => {
    for (const tile of PRICE_TILES) {
      const inPrice = tile.price.replace(/[^0-9]/g, '');
      const inPath = tile.path.replace(/[^0-9]/g, '');
      expect(inPath).toBe(inPrice);
    }
  });
});

describe('the colours are the merchant’s', () => {
  /**
   * Six distinct pastels. This is the one place in the migration where the app
   * takes a colour from theme data rather than from appConstants, so it is
   * worth pinning that they arrive intact.
   */
  it('gives each tile its own background', () => {
    const backgrounds = PRICE_TILES.map(t => t.background);
    expect(backgrounds).toEqual([
      '#f3b75c',
      '#8eb8fa',
      '#b7e394',
      '#ffa2cb',
      '#c791e1',
      '#b8e3f8',
    ]);
    expect(new Set(backgrounds).size).toBe(6);
  });

  /**
   * Taken from the block rather than assumed, because a merchant who darkens a
   * background will change this alongside it.
   */
  it('carries the block’s own text colour', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.text).toBe('#000000');
    }
  });

  it('states every colour as a hex value the styles can use', () => {
    for (const tile of PRICE_TILES) {
      expect(tile.background).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tile.text).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('the heading', () => {
  it('is the theme’s own shop_by_price_heading', () => {
    expect(PRICE_TILES_TITLE).toBe('Find the Best Deals!');
  });
});
