/**
 * The Bestsellers rail — the largest saving in the migration, and the one
 * section whose *heading* had to be argued for.
 *
 * WHY THE HEADING IS HONEST, AND WHY THAT IS TESTABLE AT ALL. This slot used to
 * hold Zigly's own "Pet Parent Favourites" rail, kept under its own name,
 * because relabelling somebody else's curated rail "Bestsellers" would have
 * been this app making a sales claim on Zigly's behalf. It is honest now only
 * because the products come from Zigly's own best-selling sort. So the sort key
 * is not an implementation detail here -- it is the thing that makes the word
 * on screen true, and a change to it is a change to what the app claims. That
 * is why there is a test reading the query source.
 *
 * AND WHY IT IS NOT `collection(handle: "all")`. That is Shopify's virtual
 * all-products collection and the Storefront API does not expose it by handle
 * -- verified live: it returns null. A rebuild reaching for it would produce a
 * section that silently drew nothing, looking exactly like a failed fetch.
 *
 * The parse itself is covered by ./products.test.ts; this suite is about the
 * query and the claim.
 */
import * as fs from 'fs';
import {BESTSELLERS_TITLE} from '../src/native/Bestsellers';
import {fetchBestSellers} from '../src/native/products';

/** The query text, read off the module rather than re-typed. */
const querySource = (): string => {
  const source = fs.readFileSync(
    require.resolve('../src/native/products'),
    'utf8',
  );
  const match = /const BEST_SELLING_QUERY = `([\s\S]*?)`;/.exec(source);
  expect(match).not.toBeNull();
  return match![1];
};

describe('the sort is what makes the heading true', () => {
  /**
   * THE TEST THIS SUITE EXISTS FOR. Without `BEST_SELLING` the rail is an
   * arbitrary slice of the catalogue under a word that claims otherwise --
   * which is the objection the web version's own comment records at length.
   */
  it('asks Shopify for the best-selling order', () => {
    expect(querySource()).toContain('sortKey: BEST_SELLING');
  });

  /**
   * Verified live: `collection(handle: "all")` returns null on this store, so
   * a rebuild using it would draw nothing and look like a failed fetch.
   */
  it('does not ask for the virtual "all" collection', () => {
    const query = querySource();
    expect(query).not.toContain('collection(');
    expect(query).toContain('products(');
  });

  /** Nothing is re-sorted or filtered in the app; the store's order stands. */
  it('applies no other sort or filter', () => {
    const query = querySource();
    expect(query).not.toContain('reverse');
    expect(query).not.toContain('query:');
  });

  /**
   * Store-wide, dogs and cats mixed. ../src/webview/bestsellers: "Splitting it
   * evenly between the two pets would have been a curated mix wearing a
   * bestseller label."
   */
  it('reads the whole catalogue rather than one pet’s', () => {
    const query = querySource();
    expect(query).not.toMatch(/dog/i);
    expect(query).not.toMatch(/cat/i);
  });
});

describe('the rail', () => {
  it('is headed "Bestsellers"', () => {
    expect(BESTSELLERS_TITLE).toBe('Bestsellers');
  });

  /**
   * Not the heading it replaced. Recorded so the reasoning survives: "Pet
   * Parent Favourites" is Zigly's name for a different, curated rail, and
   * using it here would be showing one list under another's name.
   */
  it('is not the curated rail it replaced', () => {
    expect(BESTSELLERS_TITLE).not.toBe('Pet Parent Favourites');
  });

  it('exports the fetcher the component uses', () => {
    expect(typeof fetchBestSellers).toBe('function');
  });

  /**
   * The card limit is stated in the component rather than here, but the
   * fetcher must honour whatever it is given -- a hardcoded page size would
   * silently ignore it.
   */
  it('takes the card count as an argument', () => {
    expect(fetchBestSellers.length).toBeGreaterThanOrEqual(1);
    expect(querySource()).toContain('$first: Int!');
    expect(querySource()).toContain('first: $first');
  });
});

describe('the card fields the rail needs', () => {
  /**
   * The query must use the shared fragment, so a Bestsellers card can never be
   * handed a product missing a field the card draws. ../src/native/products
   * defines it once for exactly this reason.
   */
  it('uses the shared CardProduct fragment', () => {
    expect(querySource()).toContain('...CardProduct');
  });

  /**
   * `variants(first: 2)` is what lets a card tell a one-variant product from
   * one with choices -- and the cart bridge must never be handed a guess. The
   * fragment carries it; asserted here because this query is where a
   * hand-written field list would most plausibly have been written instead.
   */
  it('carries the variant cap the cart safety depends on', () => {
    const source = fs.readFileSync(
      require.resolve('../src/native/products'),
      'utf8',
    );
    const fragment = /fragment CardProduct on Product \{([\s\S]*?)\n  \}/.exec(
      source,
    );
    expect(fragment).not.toBeNull();
    expect(fragment![1]).toContain('variants(first: 2)');
  });
});
