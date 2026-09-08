/**
 * The product shape every rail's card is drawn from.
 *
 * Two things here can cost a customer money rather than merely look wrong, and
 * they are most of this suite.
 *
 * THE PRICE UNIT. GraphQL returns decimal strings ("551.0", "351.12"),
 * `/products/{handle}.js` returns integer paise (55100), and ../src/utils/money
 * is written for paise. DATA-SOURCES.md §1 warns that mixing the two is the
 * classic way a Shopify client shows ₹5.51 or ₹55,100 -- a hundredfold error in
 * either direction, on the one number the customer decides on.
 *
 * THE VARIANT ID. ../src/webview/cartBridge's own comment is explicit: "never a
 * guess, and never for a product with more than one variant, where choosing on
 * the customer's behalf could add the wrong size." A card that guessed would
 * put a 3 kg bag in the bag of somebody who wanted 1 kg -- an error that
 * completes successfully, reports success, and is only discovered at checkout.
 *
 * The fixtures are live shapes. Every product below was returned by the
 * Storefront API on 2026-09-08 from /collections/hot-picks-squeaker-toys,
 * including the awkward ones: `351.12` is a real price, and `"0.0"` is what
 * Shopify reports for a compare-at that does not exist.
 */
import {numericId, parseProduct} from '../src/native/products';
import {money, percentOff} from '../src/utils/money';

/** Shape a product node the way the API returns one. */
const node = (over: Record<string, unknown> = {}) => ({
  handle: 'zl-spike-buddy-dog-chew-toy',
  title: 'ZL Spike Buddy Dog Chew Toy',
  availableForSale: true,
  featuredImage: {
    url: 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files/PLNF21795.webp?v=1782898923',
  },
  priceRange: {minVariantPrice: {amount: '551.0'}},
  compareAtPriceRange: {minVariantPrice: {amount: '649.0'}},
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/53172936245564',
          availableForSale: true,
        },
      },
    ],
  },
  ...over,
});

describe('prices cross into paise exactly once', () => {
  /** The live example: ₹551.00 must be 55100 paise, not 551 and not 5510000. */
  it('converts a decimal amount to paise', () => {
    expect(parseProduct(node())!.price).toBe(55100);
  });

  /**
   * A real live price, and the reason the conversion rounds rather than
   * truncating. 351.12 * 100 is 35111.999… in binary floating point.
   */
  it('handles a non-round price without losing a paisa', () => {
    const p = parseProduct(
      node({priceRange: {minVariantPrice: {amount: '351.12'}}}),
    )!;
    expect(p.price).toBe(35112);
    expect(money(p.price)).toBe('₹351.12');
  });

  /** What the customer actually reads, end to end. */
  it('renders whole rupees without decimals, as the site does', () => {
    expect(money(parseProduct(node())!.price)).toBe('₹551');
  });

  it('carries the compare-at price in the same unit', () => {
    const p = parseProduct(node())!;
    expect(p.compareAt).toBe(64900);
    expect(money(p.compareAt!)).toBe('₹649');
    // And the saving the struck price implies is the real one.
    expect(percentOff(p.compareAt!, p.price)).toBe(15);
  });
});

describe('a compare-at price only counts when it is a saving', () => {
  /**
   * Shopify reports "0.0" for products with no compare-at. Treating that as a
   * price would strike through "₹0" beside the real one.
   */
  it('reports no saving for Shopify’s "0.0"', () => {
    expect(
      parseProduct(node({compareAtPriceRange: {minVariantPrice: {amount: '0.0'}}}))!
        .compareAt,
    ).toBeNull();
  });

  it('reports no saving when the field is missing entirely', () => {
    expect(parseProduct(node({compareAtPriceRange: null}))!.compareAt).toBeNull();
  });

  /** Equal is not a saving, and a card must not strike through the same number. */
  it('reports no saving when compare-at equals the price', () => {
    expect(
      parseProduct(
        node({compareAtPriceRange: {minVariantPrice: {amount: '551.0'}}}),
      )!.compareAt,
    ).toBeNull();
  });

  /** A few products carry a compare-at BELOW the sale price. Not a saving. */
  it('reports no saving when compare-at is below the price', () => {
    expect(
      parseProduct(
        node({compareAtPriceRange: {minVariantPrice: {amount: '400.0'}}}),
      )!.compareAt,
    ).toBeNull();
  });
});

describe('the variant id is never a guess', () => {
  it('extracts the number from a Shopify GID', () => {
    expect(numericId('gid://shopify/ProductVariant/53172936245564')).toBe(
      53172936245564,
    );
  });

  it('gives a one-variant product an id the cart bridge can post', () => {
    const p = parseProduct(node())!;
    expect(p.variantId).toBe(53172936245564);
  });

  /**
   * THE FAILURE THIS SUITE EXISTS FOR.
   *
   * A product with choices must yield NO id, so the card sends the customer to
   * the product page instead of adding a size nobody chose.
   */
  it('refuses an id when the product has more than one variant', () => {
    const p = parseProduct(
      node({
        variants: {
          edges: [
            {node: {id: 'gid://shopify/ProductVariant/1', availableForSale: true}},
            {node: {id: 'gid://shopify/ProductVariant/2', availableForSale: true}},
          ],
        },
      }),
    )!;
    expect(p.variantId).toBeNull();
  });

  /** A malformed gid must be null, not NaN: NaN would be posted and fail. */
  it('returns null rather than NaN for anything unexpected', () => {
    expect(numericId('gid://shopify/ProductVariant/not-a-number')).toBeNull();
    expect(numericId('')).toBeNull();
    expect(numericId(undefined)).toBeNull();
    expect(numericId(12345)).toBeNull();
  });

  /** The last segment, so a number elsewhere in the gid cannot be mistaken. */
  it('takes the id from the last path segment', () => {
    expect(numericId('gid://shopify/Product/999/Variant/42')).toBe(42);
  });

  it('gives a product with no variants at all no id', () => {
    expect(parseProduct(node({variants: {edges: []}}))!.variantId).toBeNull();
    expect(parseProduct(node({variants: null}))!.variantId).toBeNull();
  });
});

describe('availability', () => {
  it('marks a sold-out product unavailable', () => {
    expect(parseProduct(node({availableForSale: false}))!.available).toBe(false);
  });

  /**
   * A missing flag is treated as available rather than as sold out: the field
   * is always present in practice, and hiding a buyable product is the worse
   * of the two mistakes.
   */
  it('treats a missing flag as available', () => {
    expect(parseProduct(node({availableForSale: undefined}))!.available).toBe(
      true,
    );
  });
});

describe('a product a card cannot draw is dropped', () => {
  /** Better one fewer card than a card with a blank title or "₹NaN". */
  it('drops a product with no handle, title or price', () => {
    expect(parseProduct(node({handle: ''}))).toBeNull();
    expect(parseProduct(node({title: ''}))).toBeNull();
    expect(parseProduct(node({priceRange: null}))).toBeNull();
    expect(
      parseProduct(node({priceRange: {minVariantPrice: {amount: '0.0'}}})),
    ).toBeNull();
  });

  it('drops a node that is not a product at all', () => {
    expect(parseProduct(null)).toBeNull();
    expect(parseProduct(undefined)).toBeNull();
    expect(parseProduct({} as never)).toBeNull();
  });

  /**
   * An image is NOT required: a product with no photo keeps its place, its
   * price and its button, because dropping it would silently shorten a rail
   * Zigly curated.
   */
  it('keeps a product with no image, reporting the image as null', () => {
    const p = parseProduct(node({featuredImage: null}));
    expect(p).not.toBeNull();
    expect(p!.image).toBeNull();
  });

  /** A stored URL goes to an `<Image source>`, so it must be https. */
  it('refuses an image URL that is not https', () => {
    expect(
      parseProduct(node({featuredImage: {url: 'javascript:alert(1)'}}))!.image,
    ).toBeNull();
    expect(
      parseProduct(node({featuredImage: {url: '//cdn.shopify.com/x.png'}}))!
        .image,
    ).toBeNull();
  });
});

describe('the path a card opens', () => {
  it('is the product page for that handle', () => {
    expect(parseProduct(node())!.path).toBe(
      '/products/zl-spike-buddy-dog-chew-toy',
    );
  });
});
