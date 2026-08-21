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
import {ActivityIndicator, Text} from 'react-native';
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
};

const CART: CartData = {
  itemCount: 2,
  totalPrice: 14000,
  originalTotalPrice: 16000,
  totalDiscount: 2000,
  items: [LINE],
};

const noop = () => {};

describe('an empty cart', () => {
  it('shows the reference app’s "No items" screen', () => {
    const tree = render(
      <CartScreen
        cart={{
          itemCount: 0,
          totalPrice: 0,
          originalTotalPrice: 0,
          totalDiscount: 0,
          items: [],
        }}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    expect(textOf(tree)).toContain('No items');
  });

  it('offers no checkout button to press', () => {
    const tree = render(
      <CartScreen
        cart={{
          itemCount: 0,
          totalPrice: 0,
          originalTotalPrice: 0,
          totalDiscount: 0,
          items: [],
        }}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    // The reference's empty screen carries no call to action; the header's back
    // arrow is the way out, and it is drawn above this screen.
    expect(textOf(tree)).not.toContain('Checkout');
  });
});

describe('a cart that has not loaded yet', () => {
  it('waits rather than claiming the cart is empty', () => {
    // null means "no answer from /cart.js yet". Showing "No items" there would
    // tell the customer their cart had been emptied.
    const tree = render(
      <CartScreen
        cart={null}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(textOf(tree)).not.toContain('No items');
  });
});

describe('a cart with lines', () => {
  it('draws the line, its price and what it used to cost', () => {
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
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
      <CartScreen
        cart={CART}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    const text = textOf(tree);
    expect(text).toContain('2 Items');
    expect(text).toContain('₹140');
    expect(text).toContain('Checkout');
  });

  it('says Item, singular, for one', () => {
    const tree = render(
      <CartScreen
        cart={{...CART, itemCount: 1}}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    expect(textOf(tree)).toContain('1 Item |');
  });

  it('shows the totals Shopify reports, and no shipping line of its own', () => {
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
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
      <CartScreen
        cart={{
          ...CART,
          totalDiscount: 0,
          originalTotalPrice: 14000,
          items: [{...LINE, originalPrice: 7000, originalLinePrice: 14000}],
        }}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    const text = textOf(tree);
    expect(text).not.toContain('% off');
    expect(text).not.toContain('You saved');
    expect(text).not.toContain('Savings');
  });

  it('invents no merchandising it cannot source', () => {
    // The reference also has a free-shipping meter, free-gift tiers, an upsell
    // rail and a membership card. Their thresholds and product selections live
    // in server config this app cannot read, so they are absent rather than
    // guessed. Coupons are off in-app in the reference too.
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={noop}
        onCheckout={noop}
        onOpenItem={noop}
      />,
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
      <CartScreen
        cart={CART}
        onChangeQty={onChangeQty}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    press(tree, 'Increase quantity');
    expect(changes).toEqual([[LINE.key, 3]]);
  });

  it('asks for one fewer', () => {
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={onChangeQty}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    press(tree, 'Decrease quantity');
    expect(changes).toEqual([[LINE.key, 1]]);
  });

  it('removes by asking for zero, which is how Shopify removes a line', () => {
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={onChangeQty}
        onCheckout={noop}
        onOpenItem={noop}
      />,
    );
    press(tree, 'Remove ' + LINE.title);
    expect(changes).toEqual([[LINE.key, 0]]);
  });

  it('hands checkout off untouched', () => {
    let handed = 0;
    const tree = render(
      <CartScreen
        cart={CART}
        onChangeQty={noop}
        onCheckout={() => {
          handed += 1;
        }}
        onOpenItem={noop}
      />,
    );
    press(
      tree,
      'Checkout, 2 items, ₹140',
    );
    expect(handed).toBe(1);
  });
});

describe('the empty-state glyph', () => {
  it('draws the box from six outline edges and three interior ones', () => {
    // The cube is geometry, not an asset: three bordered rectangles for the
    // hexagon's six sides, three rotated spokes for the interior edges. If a
    // piece is lost the glyph silently stops being a cube.
    const tree = render(<EmptyState label="No items" />);
    const rotated = JSON.stringify(tree.toJSON()).match(/"rotate"/g) ?? [];
    expect(rotated).toHaveLength(6);
    expect(textOf(tree)).toContain('No items');
  });
});
