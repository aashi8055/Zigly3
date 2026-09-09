/**
 * Telling the collection screens apart by url.
 *
 * Three urls all contain "/collections/" and are three different screens, so
 * the app has to be exact about which is which:
 *
 *   /collections                     the twelve category cards
 *   /collections/applod              a product grid
 *   /collections/applod/products/x   a PRODUCT page -- it carries the prefix
 *                                    only because that is how a card in a grid
 *                                    links to its product
 *
 * The third is the one that has bitten this codebase before: ../src/webview/
 * listingPage records that the listing flag once landed on a product page for
 * exactly this reason, and the app drew Sort and Filter along its foot. So the
 * product exclusion is asserted here rather than assumed.
 */
import {
  collectionHandleOf,
  isCollectionsIndexUrl,
} from '../src/utils/urlUtils';

const ORIGIN = 'https://zigly.com';

describe('the collections index', () => {
  it.each([
    `${ORIGIN}/collections`,
    `${ORIGIN}/collections/`,
    // The market prefix is stripped, as everywhere else in this file's module.
    `${ORIGIN}/en-in/collections`,
  ])('recognises %s', url => {
    expect(isCollectionsIndexUrl(url)).toBe(true);
  });

  it.each([
    `${ORIGIN}/collections/applod`,
    `${ORIGIN}/search?q=food`,
    `${ORIGIN}/`,
    'https://example.com/collections',
  ])('does not claim %s', url => {
    expect(isCollectionsIndexUrl(url)).toBe(false);
  });
});

describe('the collection handle', () => {
  it('reads the handle out of a collection url', () => {
    expect(collectionHandleOf(`${ORIGIN}/collections/applod`)).toBe('applod');
    expect(collectionHandleOf(`${ORIGIN}/collections/applod/`)).toBe('applod');
    expect(
      collectionHandleOf(`${ORIGIN}/collections/dog-cat-walk-essentials`),
    ).toBe('dog-cat-walk-essentials');
  });

  it('reads it past a market prefix', () => {
    expect(collectionHandleOf(`${ORIGIN}/en-in/collections/cat-food`)).toBe(
      'cat-food',
    );
  });

  it('ignores a query and a fragment', () => {
    expect(
      collectionHandleOf(`${ORIGIN}/collections/applod?sort=price`),
    ).toBe('applod');
    expect(collectionHandleOf(`${ORIGIN}/collections/applod#grid`)).toBe(
      'applod',
    );
  });

  /**
   * The one that has gone wrong before: every card in a grid links to
   * `/collections/{collection}/products/{handle}`, so the ordinary way into a
   * product page carries the collection prefix.
   */
  it('refuses a product opened from inside a collection', () => {
    expect(
      collectionHandleOf(`${ORIGIN}/collections/applod/products/some-product`),
    ).toBeNull();
    expect(collectionHandleOf(`${ORIGIN}/products/some-product`)).toBeNull();
  });

  it.each([
    [`${ORIGIN}/collections`, 'the index, which is a different screen'],
    [`${ORIGIN}/collections/`, 'the index with a trailing slash'],
    [`${ORIGIN}/search?q=food`, 'a search, which has no collection behind it'],
    [`${ORIGIN}/pages/dog`, 'a content page'],
    ['https://example.com/collections/applod', 'another host'],
  ])('refuses %s -- %s', url => {
    expect(collectionHandleOf(url)).toBeNull();
  });

  /** Anything that could not be a Shopify handle is refused, not forwarded. */
  it('refuses a segment that is not handle-shaped', () => {
    expect(collectionHandleOf(`${ORIGIN}/collections/-leading-hyphen`)).toBeNull();
    expect(collectionHandleOf(`${ORIGIN}/collections/has_underscore`)).toBeNull();
    expect(collectionHandleOf(`${ORIGIN}/collections/has%20space`)).toBeNull();
  });
});
