/**
 * The cart screen, rendered.
 *
 * These are behaviour tests rather than source greps: the cart is the one screen
 * where a mistake costs the customer money, so what matters is what it puts on
 * screen and which quantity it asks Shopify for. Nothing here fakes a cart API —
 * the component is handed the same shape the WebView bridge posts back.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, ScrollView, Text} from 'react-native';
import CartScreen from '../src/components/CartScreen';
import type {CartData, CartLine} from '../src/components/CartScreen';
import EmptyState from '../src/components/EmptyState';
import {REPORT_CART_COUNT} from '../src/webview/headerBridge';

const render = (ui: React.ReactElement) => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree as ReactTestRenderer.ReactTestRenderer;
};

/** Flatten a Text node's children, which may be strings, numbers or arrays. */
const flatten = (children: unknown): string => {
  if (Array.isArray(children)) {
    return children.map(flatten).join('');
  }
  if (children === null || children === undefined || children === false) {
    return '';
  }
  return typeof children === 'object' ? '' : String(children);
};

const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => flatten(node.props.children))
    .join(' | ');

const press = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): void => {
  // By props rather than by type: RN wraps Pressable in memo(forwardRef(...)),
  // so the rendered node's type is not the imported symbol.
  const target = tree.root
    .findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )
    .shift();
  if (!target) {
    throw new Error('no pressable labelled ' + label);
  }
  target.props.onPress();
};

/**
 * A press whose state update is flushed before the next assertion.
 *
 * `press` on its own is enough for the cases that only look at what the
 * callback was handed. It is not enough for the ones about what the screen does
 * NEXT -- going inert while a change is in flight -- because that is a render.
 */
const tap = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): void => {
  ReactTestRenderer.act(() => {
    press(tree, label);
  });
};

/**
 * Let go of the tree.
 *
 * The screen holds a failsafe timer while it is waiting on Shopify, and an
 * unmount is what cancels it. Left running, it fires after Jest has torn the
 * environment down and the re-render throws there instead of here.
 */
const drop = (tree: ReactTestRenderer.ReactTestRenderer): void => {
  ReactTestRenderer.act(() => {
    tree.unmount();
  });
};

const LINE: CartLine = {
  key: '44:abc',
  title: 'Applod Chicken Paste Wet Puppy Food - 85g',
  variant: '85g',
  quantity: 2,
  image: 'https://cdn.shopify.com/s/files/1/0923/applod.jpg',
  url: '/products/applod-chicken-paste',
  price: 7000,
  originalPrice: 8000,
  linePrice: 14000,
  originalLinePrice: 16000,
};

const CART: CartData = {
  itemCount: 2,
  totalPrice: 14000,
  originalTotalPrice: 16000,
  totalDiscount: 2000,
  items: [LINE],
};

const noop = () => {};

const EMPTY: CartData = {
  itemCount: 0,
  totalPrice: 0,
  originalTotalPrice: 0,
  totalDiscount: 0,
  items: [],
};

/** The screen with everything defaulted; pass only what the case is about. */
const screen = (
  props: Partial<React.ComponentProps<typeof CartScreen>> = {},
): React.ReactElement => (
  <CartScreen
    cart={CART}
    onChangeQty={noop}
    onCheckout={noop}
    onOpenItem={noop}
    onContinueShopping={noop}
    {...props}
  />
);

describe('an empty cart', () => {
  it('shows the reference app’s empty-cart screen', () => {
    const tree = render(screen({cart: EMPTY}));
    const text = textOf(tree);
    expect(text).toContain('Your Cart is Empty');
    expect(text).toContain('Start shopping today');
    expect(text).toContain('Continue Shopping');
    // The bare "No items" box belongs to list screens like the wishlist.
    expect(text).not.toContain('No items');
  });

  it('sends Continue Shopping back to the store', () => {
    let left = 0;
    const tree = render(
      screen({
        cart: EMPTY,
        onContinueShopping: () => {
          left += 1;
        },
      }),
    );
    press(tree, 'Continue Shopping');
    expect(left).toBe(1);
  });

  it('offers no checkout to press with nothing to check out', () => {
    const tree = render(screen({cart: EMPTY}));
    expect(textOf(tree)).not.toContain('Checkout');
  });
});

describe('a cart that has not loaded yet', () => {
  it('waits rather than claiming the cart is empty', () => {
    // null means "no answer from /cart.js yet". Showing "No items" there would
    // tell the customer their cart had been emptied. It waits behind a
    // skeleton now, not a spinner -- a spinner is the one shape this app
    // must never draw, because it reads as a website's own loading widget.
    const tree = render(
      screen({cart: null}),
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(textOf(tree)).not.toContain('No items');
    expect(textOf(tree)).not.toContain('Your Cart is Empty');
  });
});

describe('a cart with lines', () => {
  it('draws the line, its price and what it used to cost', () => {
    const tree = render(
      screen({cart: CART}),
    );
    const text = textOf(tree);
    expect(text).toContain(LINE.title);
    expect(text).toContain('₹70');
    expect(text).toContain('₹80');
    // 8000 -> 7000 paise is 12.5%, rounded.
    expect(text).toContain('13% off');
    expect(text).toContain('85g');
  });

  it('reports the live item count and total on the sticky bar', () => {
    const tree = render(
      screen({cart: CART}),
    );
    const text = textOf(tree);
    expect(text).toContain('2 Items');
    expect(text).toContain('₹140');
    expect(text).toContain('Checkout');
  });

  it('says Item, singular, for one', () => {
    const tree = render(
      screen({cart: {...CART, itemCount: 1}}),
    );
    expect(textOf(tree)).toContain('1 Item |');
  });

  it('shows the totals Shopify reports, and no shipping line of its own', () => {
    const tree = render(
      screen({cart: CART}),
    );
    const text = textOf(tree);
    expect(text).toContain('Cart Total');
    expect(text).toContain('Total Payable');
    expect(text).toContain('Savings');
    // Shipping is quoted by Shopify's checkout once it knows the address; a
    // number invented here is one the customer will not be charged.
    expect(text).not.toContain('Shipping');
    expect(text).not.toContain('Delivery');
  });

  it('hides the strikethrough when there is no discount to show', () => {
    const tree = render(
      screen({cart: {
          ...CART,
          totalDiscount: 0,
          originalTotalPrice: 14000,
          items: [{...LINE, originalPrice: 7000, originalLinePrice: 14000}],
        }}),
    );
    const text = textOf(tree);
    expect(text).not.toContain('% off');
    expect(text).not.toContain('You saved');
    expect(text).not.toContain('Savings');
  });

  it('keeps the savings line pinned, not scrolled away with the items', () => {
    // The reference holds it above the checkout bar while the items move behind
    // it, so the saving is on screen at the moment the customer decides.
    const tree = render(screen());
    const inList = tree.root
      .findByType(ScrollView)
      .findAllByType(Text)
      .map(node => flatten(node.props.children))
      .join(' | ');
    expect(textOf(tree)).toContain('on this order');
    expect(inList).not.toContain('on this order');
    // Same for the bar itself.
    expect(inList).not.toContain('Checkout');
  });

  it('invents no merchandising it cannot source', () => {
    // The reference also has a free-shipping meter, free-gift tiers, an upsell
    // rail and a membership card. Their thresholds and product selections live
    // in server config this app cannot read, so they are absent rather than
    // guessed. Coupons are off in-app in the reference too.
    const tree = render(
      screen({cart: CART}),
    );
    const text = textOf(tree);
    for (const invented of [
      'Free shipping',
      'free gift',
      'Frequently bought',
      'Membership',
      'Apply Coupon',
      'coupon',
    ]) {
      expect(text.toLowerCase()).not.toContain(invented.toLowerCase());
    }
  });
});

describe('changing a line', () => {
  const changes: Array<[string, number]> = [];
  const onChangeQty = (key: string, quantity: number) => {
    changes.push([key, quantity]);
  };

  beforeEach(() => {
    changes.length = 0;
  });

  it('asks Shopify for one more, rather than doing its own arithmetic', () => {
    const tree = render(
      screen({cart: CART, onChangeQty: onChangeQty}),
    );
    press(tree, 'Increase quantity');
    expect(changes).toEqual([[LINE.key, 3]]);
  });

  it('asks for one fewer', () => {
    const tree = render(
      screen({cart: CART, onChangeQty: onChangeQty}),
    );
    press(tree, 'Decrease quantity');
    expect(changes).toEqual([[LINE.key, 1]]);
  });

  it('removes by asking for zero, which is how Shopify removes a line', () => {
    const tree = render(
      screen({cart: CART, onChangeQty: onChangeQty}),
    );
    press(tree, 'Remove ' + LINE.title);
    expect(changes).toEqual([[LINE.key, 0]]);
  });

  it('will not send a second change against a quantity it has not confirmed', () => {
    /*
     * The bug this closes: qty 3, tap minus twice quickly. Both taps read the
     * same `line.quantity`, so both asked Shopify for 2 -- the second one a
     * no-op -- and the number stopped at 2 while the customer had asked for 1.
     * It read as the count being stuck.
     *
     * One change is in flight at a time, and it is released by the next cart
     * that arrives, so the quantity every request is computed from is one
     * Shopify has confirmed.
     */
    const tree = render(screen({cart: CART, onChangeQty: onChangeQty}));
    tap(tree, 'Decrease quantity');
    tap(tree, 'Decrease quantity');
    tap(tree, 'Increase quantity');
    tap(tree, 'Remove ' + LINE.title);
    expect(changes).toEqual([[LINE.key, 1]]);
    drop(tree);
  });

  it('takes the next change once Shopify has answered', () => {
    // A new cart object is what every reply from /cart.js produces, including
    // the re-read after a change that failed -- so it is the one release, and
    // the screen cannot be left waiting on something already back.
    const tree = render(screen({cart: CART, onChangeQty: onChangeQty}));
    tap(tree, 'Decrease quantity');
    const answered: CartData = {
      ...CART,
      itemCount: 1,
      items: [{...LINE, quantity: 1}],
    };
    ReactTestRenderer.act(() => {
      tree.update(screen({cart: answered, onChangeQty: onChangeQty}));
    });
    tap(tree, 'Decrease quantity');
    expect(changes).toEqual([
      [LINE.key, 1],
      [LINE.key, 0],
    ]);
    drop(tree);
  });

  it('says which line it is waiting on', () => {
    const tree = render(screen({cart: CART, onChangeQty: onChangeQty}));
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    tap(tree, 'Decrease quantity');
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    drop(tree);
  });

  it('hands checkout off untouched', () => {
    let handed = 0;
    const tree = render(
      screen({cart: CART, onCheckout: () => {
          handed += 1;
        }}),
    );
    press(
      tree,
      'Checkout, 2 items, ₹140',
    );
    expect(handed).toBe(1);
  });
});

describe('the badge count', () => {
  /*
   * The header badge used to be scraped out of `.cart-count-bubble`, and this
   * theme has no such element: the served home, collection and product pages
   * were read on 2026-08-24 and `#cart-icon-bubble` holds a bag glyph and the
   * word "Bag", nothing more. So the scrape found nothing, reported 0, and did
   * it on every completed navigation -- wiping a count that add-to-bag had just
   * reported correctly from /cart.js.
   */
  it('reads the cart rather than a header element that does not exist', () => {
    expect(REPORT_CART_COUNT).toContain("fetch('/cart.js'");
    expect(REPORT_CART_COUNT).toContain('item_count');
    expect(REPORT_CART_COUNT).not.toContain('cart-count-bubble');
  });

  it('says nothing when the read fails, rather than saying zero', () => {
    // A cart that could not be read is not an empty cart, and the badge it
    // already shows is a better answer than 0.
    const posts = REPORT_CART_COUNT.slice(
      REPORT_CART_COUNT.indexOf('function read()'),
      REPORT_CART_COUNT.indexOf('var timer'),
    );
    expect(posts).toContain('if (!cart) { return; }');
    expect(posts).not.toContain('n: 0');
  });

  it('installs its listeners once, however often it is injected', () => {
    // It is injected on every completed navigation. Each pass used to add
    // another MutationObserver, and each observer now costs a request.
    expect(REPORT_CART_COUNT).toContain('if (window.__ziglyReadCartCount)');
    expect(REPORT_CART_COUNT).toContain('window.__ziglyReadCartCount = schedule');
  });

  it('watches the drawer, not the whole document', () => {
    // The old fallback was `document.querySelector('cart-drawer') ||
    // document.body`, and on the dashboard -- which transplants sections into
    // the body for ten seconds after load -- that fired continuously.
    expect(REPORT_CART_COUNT).toContain("querySelector('cart-drawer')");
    expect(REPORT_CART_COUNT).not.toContain('|| document.body');
    // The theme's own add-to-bag announces itself; no need to infer it.
    expect(REPORT_CART_COUNT).toContain("'cart:updated'");
    expect(REPORT_CART_COUNT).toContain("'cart:refresh'");
  });
});

describe('the empty-state glyph', () => {
  it('draws the box from six outline edges and three interior ones', () => {
    // The cube is geometry, not an asset: three bordered rectangles for the
    // hexagon's six sides, three rotated spokes for the interior edges. If a
    // piece is lost the glyph silently stops being a cube.
    const tree = render(<EmptyState title="No items" />);
    const rotated = JSON.stringify(tree.toJSON()).match(/"rotate"/g) ?? [];
    expect(rotated).toHaveLength(6);
    expect(textOf(tree)).toContain('No items');
  });
});
