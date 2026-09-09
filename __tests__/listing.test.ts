/**
 * The listing grid's data layer: badges, ratings, sorts and the count.
 *
 * Four things here are worth a test, and they are the four where a wrong answer
 * is a visible falsehood on the screen rather than a crash:
 *
 *   the badge     a metafield holding a JSON list, of which only the FIRST
 *                 value is drawn, coloured from the theme's own map.
 *   the rating    a metafield holding nested JSON, with the theme's >= 1.00
 *                 floor.
 *   the discount  the one sort Shopify cannot do, so the app does it -- and
 *                 gets to be wrong about it.
 *   the sorts     five rows that must be the site's five, in the site's order.
 *
 * The badge colours are checked against `snippets/card-product.liquid` itself
 * rather than against a copy typed out here, so a recolour in the theme fails
 * this suite instead of silently disagreeing with the website.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  BADGE_COLORS,
  BADGE_DEFAULT,
  DEFAULT_SORT,
  SORTS,
  discountFraction,
  parseBadge,
  parseListingProduct,
  parseRating,
  sortById,
  sortByDiscount,
  type ListingProduct,
} from '../src/native/listing';

describe('the badge is the themes first product tag', () => {
  it('reads the first value out of the metafields JSON list', () => {
    expect(parseBadge('["Hot Buys"]')).toEqual({
      label: 'Hot Buys',
      color: '#FF1694',
    });
  });

  /**
   * The theme's loop breaks after the first value, so a product carrying three
   * tags still shows one pill. A card showing two would be this app
   * merchandising differently from the website.
   */
  it('draws only the first of several tags', () => {
    const badge = parseBadge('["New Arrival","Bestsellers","Few Left"]');
    expect(badge?.label).toBe('New Arrival');
    expect(badge?.color).toBe('#32CD32');
  });

  it('colours a tag the theme does not name with the theme default', () => {
    expect(parseBadge('["Vet Approved"]')).toEqual({
      label: 'Vet Approved',
      color: BADGE_DEFAULT,
    });
  });

  it('matches the tag case-insensitively, as the theme downcases it', () => {
    expect(parseBadge('["HOT BUYS"]')?.color).toBe('#FF1694');
    expect(parseBadge('["hot buys"]')?.color).toBe('#FF1694');
  });

  /** No pill at all, rather than an empty one, for every kind of nothing. */
  it.each([
    ['no metafield', undefined],
    ['null', null],
    ['an empty string', ''],
    ['an empty list', '[]'],
    ['a list of blanks', '["  "]'],
    ['unparseable JSON', '["Hot Buys'],
    ['a JSON object', '{"tag":"Hot Buys"}'],
    ['a bare string', 'Hot Buys'],
  ])('yields no badge for %s', (_label, raw) => {
    expect(parseBadge(raw)).toBeNull();
  });

  it('truncates a very long tag to four words, as the theme does', () => {
    expect(parseBadge('["one two three four five six"]')?.label).toBe(
      'one two three four',
    );
  });

  /**
   * The colour map must be the theme's.
   *
   * Parsed out of the `{% case lower_tag %}` block in card-product.liquid: each
   * `{% when 'x' %}` followed by an `assign badge_color = '#y'`. If Zigly
   * recolours "Hot Buys", this test fails rather than the app quietly drawing
   * last month's pink.
   */
  it('carries the colours the theme assigns', () => {
    const liquid = readFileSync(
      join(
        __dirname,
        '..',
        'zigly-website-code',
        'zigly-website',
        'snippets',
        'card-product.liquid',
      ),
      'utf8',
    );
    const block = liquid.slice(
      liquid.indexOf('{% case lower_tag %}'),
      liquid.indexOf('{% endcase %}'),
    );
    expect(block.length).toBeGreaterThan(0);

    const found: Record<string, string> = {};
    const re =
      /\{%\s*when\s*'([^']+)'\s*%\}\s*\{%\s*assign\s+badge_color\s*=\s*'([^']+)'\s*%\}/g;
    for (let m = re.exec(block); m; m = re.exec(block)) {
      found[m[1]] = m[2];
    }

    expect(Object.keys(found).length).toBeGreaterThanOrEqual(6);
    Object.entries(found).forEach(([tag, color]) => {
      expect(BADGE_COLORS[tag].toLowerCase()).toBe(color.toLowerCase());
    });
    // And nothing invented on top of the theme's set.
    expect(Object.keys(BADGE_COLORS).sort()).toEqual(Object.keys(found).sort());
  });
});

describe('the rating comes out of the reviews metafield', () => {
  it('reads the average from the rating JSON', () => {
    expect(
      parseRating('{"scale_min":"1.0","scale_max":"5.0","value":"4.72"}'),
    ).toBe(4.72);
  });

  /** The theme prints a rating only at 1.00 or above; below that is noise. */
  it('drops an average below the themes 1.00 floor', () => {
    expect(
      parseRating('{"scale_min":"1.0","scale_max":"5.0","value":"0.4"}'),
    ).toBeNull();
  });

  it.each([
    ['no metafield', undefined],
    ['an empty string', ''],
    ['unparseable JSON', '{"value":'],
    ['a missing value', '{"scale_max":"5.0"}'],
    ['a non-numeric value', '{"value":"good"}'],
  ])('yields no rating for %s', (_label, raw) => {
    expect(parseRating(raw)).toBeNull();
  });
});

/** A card, with only the fields a given test cares about set. */
const card = (over: Partial<ListingProduct> = {}): ListingProduct => ({
  handle: 'h',
  title: 'T',
  path: '/products/h',
  price: 10000,
  compareAt: null,
  image: null,
  available: true,
  variantId: 1,
  badge: null,
  rating: null,
  ratingCount: 0,
  ...over,
});

describe('discount high to low is the sort the app has to do itself', () => {
  it('is a fraction of the compare-at, not a rupee amount', () => {
    // 100 off 150 is a deeper discount than 200 off 5000, though it is less
    // money -- ordering by the amount would float every big bag to the top.
    const toy = card({price: 5000, compareAt: 15000});
    const bag = card({price: 480000, compareAt: 500000});
    expect(discountFraction(toy)).toBeGreaterThan(discountFraction(bag));
    expect(sortByDiscount([bag, toy])[0]).toBe(toy);
  });

  it('treats a product with no saving as zero, and sorts it last', () => {
    const plain = card({compareAt: null});
    const cheap = card({price: 9000, compareAt: 10000});
    expect(discountFraction(plain)).toBe(0);
    expect(sortByDiscount([plain, cheap])).toEqual([cheap, plain]);
  });

  /** Shopify reports "0.0" for no compare-at, and some sit below the price. */
  it('ignores a compare-at at or below the sale price', () => {
    expect(discountFraction(card({price: 10000, compareAt: 10000}))).toBe(0);
    expect(discountFraction(card({price: 10000, compareAt: 9000}))).toBe(0);
  });

  it('leaves the input array alone', () => {
    const first = card({handle: 'a', price: 9000, compareAt: 10000});
    const second = card({handle: 'b', price: 5000, compareAt: 20000});
    const input = [first, second];
    sortByDiscount(input);
    expect(input).toEqual([first, second]);
  });

  /** Equal discounts keep the collection's own order rather than shuffling. */
  it('is stable across equal discounts', () => {
    const a = card({handle: 'a', price: 5000, compareAt: 10000});
    const b = card({handle: 'b', price: 10000, compareAt: 20000});
    const c = card({handle: 'c', price: 2000, compareAt: 4000});
    expect(sortByDiscount([a, b, c]).map(p => p.handle)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('the sort sheet is the sites five sorts', () => {
  it('lists them in the sites own order and wording', () => {
    expect(SORTS.map(sort => sort.label)).toEqual([
      'Best Selling',
      'Price: Low To High',
      'Price: High To Low',
      'New Release',
      'Discount: High To Low',
    ]);
  });

  it('defaults to Best Selling, as the site does', () => {
    expect(DEFAULT_SORT).toBe('best-selling');
    expect(sortById(DEFAULT_SORT).label).toBe('Best Selling');
  });

  /**
   * Exactly one sort has no Shopify key, and it must be the discount one.
   *
   * If a future edit gave `discount` a key, the app would ask Shopify for a
   * sort it does not have; if it took the key off another, that sort would
   * silently become a client-side reorder of one loaded page.
   */
  it('has one app-computed sort, and it is the discount', () => {
    const computed = SORTS.filter(sort => sort.key === null);
    expect(computed.map(sort => sort.id)).toEqual(['discount']);
  });

  it('separates the two price directions by reverse alone', () => {
    const asc = sortById('price-asc');
    const desc = sortById('price-desc');
    expect(asc.key).toBe('PRICE');
    expect(desc.key).toBe('PRICE');
    expect(asc.reverse).toBe(false);
    expect(desc.reverse).toBe(true);
  });

  it('falls back to the first sort for an unknown id', () => {
    expect(sortById('nonsense' as never).id).toBe('best-selling');
  });
});

describe('a product node becomes a card', () => {
  const node = {
    handle: 'applod-chicken',
    title: 'Applod Chicken & Vegetables',
    availableForSale: true,
    featuredImage: {url: 'https://cdn.shopify.com/x.jpg?v=1'},
    priceRange: {minVariantPrice: {amount: '199.0'}},
    compareAtPriceRange: {minVariantPrice: {amount: '249.0'}},
    productTags: {value: '["Hot Buys"]'},
    reviewRating: {value: '{"scale_max":"5.0","value":"4.72"}'},
    reviewCount: {value: '18'},
    variants: {
      edges: [
        {node: {id: 'gid://shopify/ProductVariant/52663223583036', availableForSale: true}},
      ],
    },
  };

  it('carries every field the card draws', () => {
    const product = parseListingProduct(node);
    expect(product).toEqual({
      handle: 'applod-chicken',
      title: 'Applod Chicken & Vegetables',
      path: '/products/applod-chicken',
      // Paise, converted once at this edge -- see the module note.
      price: 19900,
      compareAt: 24900,
      image: 'https://cdn.shopify.com/x.jpg?v=1',
      available: true,
      variantId: 52663223583036,
      badge: {label: 'Hot Buys', color: '#FF1694'},
      rating: 4.72,
      ratingCount: 18,
    });
  });

  /** Shopify reports "0.0" for products with no compare-at price. */
  it('reports no saving when the compare-at is not above the price', () => {
    expect(
      parseListingProduct({
        ...node,
        compareAtPriceRange: {minVariantPrice: {amount: '0.0'}},
      })?.compareAt,
    ).toBeNull();
    expect(
      parseListingProduct({
        ...node,
        compareAtPriceRange: {minVariantPrice: {amount: '199.0'}},
      })?.compareAt,
    ).toBeNull();
  });

  /** The Add to Bag button must not post a sold-out variant. */
  it('picks the first in-stock variant for the add button', () => {
    const product = parseListingProduct({
      ...node,
      variants: {
        edges: [
          {node: {id: 'gid://shopify/ProductVariant/1', availableForSale: false}},
          {node: {id: 'gid://shopify/ProductVariant/2', availableForSale: true}},
        ],
      },
    });
    expect(product?.variantId).toBe(2);
  });

  it('falls back to the first variant when every one is sold out', () => {
    const product = parseListingProduct({
      ...node,
      variants: {
        edges: [
          {node: {id: 'gid://shopify/ProductVariant/1', availableForSale: false}},
          {node: {id: 'gid://shopify/ProductVariant/2', availableForSale: false}},
        ],
      },
    });
    expect(product?.variantId).toBe(1);
  });

  it('leaves badge and rating null for a product carrying neither', () => {
    const product = parseListingProduct({
      ...node,
      productTags: null,
      reviewRating: null,
      reviewCount: null,
    });
    expect(product?.badge).toBeNull();
    expect(product?.rating).toBeNull();
    expect(product?.ratingCount).toBe(0);
  });

  /** A card with a blank title or "₹NaN" is worse than one fewer card. */
  it.each([
    ['no handle', {handle: ''}],
    ['no title', {title: ''}],
    ['no price', {priceRange: {minVariantPrice: {amount: '0.0'}}}],
  ])('refuses a node with %s', (_label, over) => {
    expect(parseListingProduct({...node, ...over})).toBeNull();
  });

  it('refuses a non-https image rather than loading it', () => {
    expect(
      parseListingProduct({
        ...node,
        featuredImage: {url: 'javascript:alert(1)'},
      })?.image,
    ).toBeNull();
  });
});
