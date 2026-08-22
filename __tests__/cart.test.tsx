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
  requiresPrescription: false,
};

const CART: CartData = {
  itemCount: 2,
  totalPrice: 14000,
  originalTotalPrice: 16000,
  totalDiscount: 2000,
  items: [LINE],
  requiresPrescription: false,
  prescriptionKey: '',
};

const noop = () => {};

const EMPTY: CartData = {
  itemCount: 0,
  totalPrice: 0,
  originalTotalPrice: 0,
  totalDiscount: 0,
  items: [],
  requiresPrescription: false,
  prescriptionKey: '',
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
    // tell the customer their cart had been emptied.
    const tree = render(
      screen({cart: null}),
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(textOf(tree)).not.toContain('No items');
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

describe('a cart with a prescription medicine', () => {
  const RX_LINE: CartLine = {
    ...LINE,
    key: '55:rx',
    title: 'TEST - Rx Dummy Medicine',
    requiresPrescription: true,
  };
  const RX_CART: CartData = {
    ...CART,
    items: [RX_LINE],
    requiresPrescription: true,
  };

  it('says the step is coming, rather than inventing the control', () => {
    // The upload itself belongs to the site: it stages the file to Zigly's own
    // uploader and tags the cart with the returned key. This screen only has to
    // stop the handoff being a surprise.
    const tree = render(screen({cart: RX_CART}));
    const text = textOf(tree);
    expect(text).toContain('Prescription needed');
    expect(text).toContain('upload a prescription');
    // The doctor consult is free, and saying so is the reason a customer picks
    // it; the site puts "No extra charges" on the same block.
    expect(text).toContain('no extra charge');
  });

  it('reports a prescription already attached to the cart', () => {
    const tree = render(
      screen({cart: {...RX_CART, prescriptionKey: 'rx/2026/abc123'}}),
    );
    const text = textOf(tree);
    expect(text).toContain('Prescription received');
    expect(text).not.toContain('Prescription needed');
  });

  it('stays silent for an ordinary cart', () => {
    expect(textOf(render(screen({cart: CART})))).not.toContain('Prescription');
  });

  it('still hands checkout off, so the site can gate it', () => {
    // The app must not draw its own conclusion about whether the order may
    // proceed -- that is the site's gate, on the site's cart.
    let handed = 0;
    const tree = render(
      screen({
        cart: RX_CART,
        onCheckout: () => {
          handed += 1;
        },
      }),
    );
    press(tree, 'Checkout, 2 items, ₹140');
    expect(handed).toBe(1);
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
