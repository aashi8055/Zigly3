/**
 * The rail card's Add to Bag: a spinner while it waits, and no sold-out cards.
 *
 * TWO CHANGES TO THE SAME BUTTON, on the three rails a customer meets first --
 * Hot Picks of The Week, its New Arrivals tab, and Bestsellers.
 *
 * WHY THE SPINNER. A rail card's add is not local and not instant. It reports a
 * variant id up to ../src/screens/ZiglyWebViewScreen, which injects
 * ../src/webview/cartBridge into the DASHBOARD's WebView -- because the app has
 * one session and it lives in that cookie jar (DATA-SOURCES.md §7) -- and the
 * bridge then re-reads /cart.js to confirm the line landed, retrying for up to
 * ADD_VERIFY_BUDGET_MS. Until now the only feedback in that whole window was
 * the press opacity, which ends with the finger, so a tap on a slow connection
 * was indistinguishable from a tap that had done nothing. The customer presses
 * again, and /cart/add.js is not idempotent: a second press is a second line in
 * the bag. That is the same argument ./productActionSpinner makes for the
 * sticky bar and ./wishlist makes for the wishlist tiles; this is the third
 * surface and the busiest one.
 *
 * THE SPINNER IS PER CARD, which is the half that needs pinning hardest. A
 * shared boolean would spin all twelve buttons on a rail at once, which tells
 * the customer the app is adding twelve products.
 *
 * WHY SOLD-OUT PRODUCTS GO. ../src/native/ProductCard still knows how to draw
 * one and that state is kept for the listing grid -- a collection page the
 * customer navigated to on purpose, which would misreport its own size if it
 * silently shed items. A rail is the opposite: twelve curated cards shown to
 * somebody who did not ask for them, where a dead card spends a slot on
 * something nobody can buy.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, StyleSheet, Text} from 'react-native';
import ProductCard from '../src/native/ProductCard';
import type {Product} from '../src/native/products';
import {fetchBestSellers, fetchCollectionProducts} from '../src/native/products';
import {storefront} from '../src/native/storefront';

jest.mock('../src/native/storefront', () => ({storefront: jest.fn()}));

const asMock = storefront as unknown as jest.Mock;

const render = (ui: React.ReactElement) => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree as ReactTestRenderer.ReactTestRenderer;
};

/** A card product, in the shape ../src/native/products parses one into. */
const product = (over: Partial<Product> = {}): Product => ({
  handle: 'zl-spike-buddy-dog-chew-toy',
  title: 'ZL Spike Buddy Dog Chew Toy',
  path: '/products/zl-spike-buddy-dog-chew-toy',
  price: 55100,
  compareAt: 64900,
  image: 'https://cdn.shopify.com/s/files/1/0923/PLNF21795.webp',
  available: true,
  variantId: 51234567890123,
  ...over,
});

/** The Pressable carrying an accessibility label, not the glyphs inside it. */
const button = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): ReactTestRenderer.ReactTestInstance => {
  const found = tree.root
    .findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )
    .shift();
  if (!found) {
    throw new Error('no button labelled ' + label);
  }
  return found;
};

const labels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root.findAllByType(Text).map(node => String(node.props.children));

const noop = () => {};

const ADD_LABEL = 'Add to Bag, ZL Spike Buddy Dog Chew Toy';

/** A GraphQL node, in the shape the Storefront API returns one. */
const node = (over: Record<string, unknown> = {}) => ({
  handle: 'in-stock-toy',
  title: 'In Stock Toy',
  availableForSale: true,
  featuredImage: {url: 'https://cdn.shopify.com/s/files/1/0923/a.webp'},
  priceRange: {minVariantPrice: {amount: '551.0'}},
  compareAtPriceRange: {minVariantPrice: {amount: '649.0'}},
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/51234567890123',
          availableForSale: true,
        },
      },
    ],
  },
  ...over,
});

/** One sold-out variant, for a product whose every variant is gone. */
const soldOutVariants = {
  edges: [
    {node: {id: 'gid://shopify/ProductVariant/9', availableForSale: false}},
  ],
};

beforeEach(() => {
  asMock.mockReset();
});

describe('the spinner is in the card that was pressed', () => {
  test('busy swaps the label for an ActivityIndicator', () => {
    const idle = render(
      <ProductCard product={product()} onOpen={noop} onAdd={noop} />,
    );
    expect(labels(idle)).toContain('Add to Bag');
    expect(idle.root.findAllByType(ActivityIndicator)).toHaveLength(0);

    const busy = render(
      <ProductCard product={product()} onOpen={noop} onAdd={noop} busy />,
    );
    /*
     * The label GOES rather than sitting beside the spinner. A button reading
     * "Add to Bag" next to a spinner states two things at once, and the one
     * that matters -- that the tap was received -- is the quieter of them.
     */
    expect(labels(busy)).not.toContain('Add to Bag');
    expect(busy.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  test('the spinning card is not tappable a second time', () => {
    const onAdd = jest.fn();
    const tree = render(
      <ProductCard product={product()} onOpen={noop} onAdd={onAdd} busy />,
    );
    const add = button(tree, ADD_LABEL);
    /*
     * The point of the spinner, not a side effect of it: the add is verified
     * over up to ADD_VERIFY_BUDGET_MS and a second press inside that window is
     * a second line in the bag.
     */
    expect(add.props.disabled).toBe(true);
    expect(add.props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
  });

  test('an idle card still adds, and reports its variant id', () => {
    const onAdd = jest.fn();
    const tree = render(
      <ProductCard product={product()} onOpen={noop} onAdd={onAdd} />,
    );
    const add = button(tree, ADD_LABEL);
    expect(add.props.disabled).toBe(false);
    ReactTestRenderer.act(() => {
      add.props.onPress();
    });
    expect(onAdd).toHaveBeenCalledWith(51234567890123);
  });

  test('busy defaults to false, so a card drawn without it is unchanged', () => {
    const tree = render(
      <ProductCard product={product()} onOpen={noop} onAdd={noop} />,
    );
    expect(button(tree, ADD_LABEL).props.disabled).toBe(false);
  });

  test('the button height is fixed, so the swap cannot reflow the rail', () => {
    /*
     * A label follows the device's font scale and an ActivityIndicator is a
     * fixed 20dp, so a `minHeight` floor would let the button change height
     * mid-add at a large accessibility text size -- shifting every card's
     * button on the rail, on the rail where the customer is aiming at the next
     * one. ../src/components/WishlistScreen pins its own for the same reason.
     */
    const tree = render(
      <ProductCard product={product()} onOpen={noop} onAdd={noop} />,
    );
    /*
     * The style is a FUNCTION on this Pressable -- `({pressed}) => [...]` --
     * so it is called with a resting press state and then flattened, because
     * StyleSheet.create hands back registered ids rather than the objects.
     * Reading `props.style` straight gets a function, and flattening a
     * function gets undefined: both ways this assertion passes by testing
     * nothing, and both were hit writing it.
     */
    const style = button(tree, ADD_LABEL).props.style as (
      state: {pressed: boolean},
    ) => unknown;
    const flat = StyleSheet.flatten(style({pressed: false}) as never) as {
      height?: number;
      minHeight?: number;
    };
    expect(flat.height).toBe(34);
    expect(flat.minHeight).toBeUndefined();
  });
});

describe('sold-out products never reach a rail', () => {
  test('a collection rail drops them and keeps the rest in order', async () => {
    asMock.mockResolvedValue({
      collection: {
        products: {
          edges: [
            {node: node({handle: 'first-in-stock'})},
            {
              node: node({
                handle: 'all-sold-out',
                availableForSale: false,
                variants: soldOutVariants,
              }),
            },
            {node: node({handle: 'second-in-stock'})},
          ],
        },
      },
    });

    const products = await fetchCollectionProducts(
      'hot-picks-squeaker-toys',
      15,
    );
    /*
     * Two of three, and in the collection's own order -- nothing is re-sorted
     * on the way out, which is the rule ../src/native/products states: a rail
     * that ordered by price would be this app merchandising on Zigly's behalf.
     */
    expect(products.map(item => item.handle)).toEqual([
      'first-in-stock',
      'second-in-stock',
    ]);
    expect(products.every(item => item.available)).toBe(true);
  });

  test('the bestsellers rail drops them too', async () => {
    asMock.mockResolvedValue({
      products: {
        edges: [
          {
            node: node({
              handle: 'applod',
              availableForSale: false,
              variants: soldOutVariants,
            }),
          },
          {node: node({handle: 'royal-canin'})},
        ],
      },
    });

    expect((await fetchBestSellers(12)).map(item => item.handle)).toEqual([
      'royal-canin',
    ]);
  });

  test('a product with ONE variant out of stock is kept', async () => {
    /*
     * The line this filter must not cross. `availableForSale` on the PRODUCT is
     * false only when every variant is out; a product whose 3 kg bag is gone
     * and whose 1 kg bag is not is still buyable, and ../src/native/products
     * picks the in-stock variant for its button. Dropping it would hide a
     * product Zigly can sell.
     */
    asMock.mockResolvedValue({
      collection: {
        products: {
          edges: [
            {
              node: node({
                handle: 'one-size-left',
                availableForSale: true,
                variants: {
                  edges: [
                    {
                      node: {
                        id: 'gid://shopify/ProductVariant/1',
                        availableForSale: false,
                      },
                    },
                    {
                      node: {
                        id: 'gid://shopify/ProductVariant/2',
                        availableForSale: true,
                      },
                    },
                  ],
                },
              }),
            },
          ],
        },
      },
    });

    const products = await fetchCollectionProducts('hot-deals', 15);
    expect(products).toHaveLength(1);
    expect(products[0].variantId).toBe(2);
  });
});
