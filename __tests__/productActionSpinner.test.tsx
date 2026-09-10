/**
 * The spinner in the sticky bar's two buttons.
 *
 * WHAT IT IS FOR. Neither button's work is local or instant. Add to Bag clicks
 * the theme's own button and then re-reads /cart.js to confirm the line landed,
 * retrying for up to ADD_VERIFY_BUDGET_MS on a slow connection; Buy Now hands
 * off to Shiprocket, whose signed, cart-scoped session takes about a second to
 * paint. In both of those windows the only feedback was the press opacity,
 * which ends with the finger -- so a tap on a slow network was
 * indistinguishable from a tap that had done nothing, and the customer pressed
 * again. On a non-idempotent /cart/add.js a second press is a second line in
 * the bag.
 *
 * So these pin three things, and the third is the one that actually protects
 * the cart: the spinner appears in the button that was pressed, the label goes
 * while it spins, and NEITHER button can be pressed while either is working.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, Text} from 'react-native';
import ProductActionBar from '../src/components/ProductActionBar';
import {COLORS} from '../src/constants/appConstants';

const render = (ui: React.ReactElement) => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree as ReactTestRenderer.ReactTestRenderer;
};

const labels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root.findAllByType(Text).map(node => String(node.props.children));

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

const noop = () => {};

const bar = (
  props: Partial<React.ComponentProps<typeof ProductActionBar>> = {},
): React.ReactElement => (
  <ProductActionBar onAddToBag={noop} onBuyNow={noop} {...props} />
);

describe('the bar at rest', () => {
  it('shows both labels and no spinner', () => {
    const tree = render(bar());
    expect(labels(tree)).toEqual(['Add to Bag', 'Buy Now']);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('is pressable', () => {
    const pressed: string[] = [];
    const tree = render(
      bar({
        onAddToBag: () => pressed.push('add'),
        onBuyNow: () => pressed.push('buy'),
      }),
    );
    button(tree, 'Add to Bag').props.onPress();
    button(tree, 'Buy Now').props.onPress();
    expect(pressed).toEqual(['add', 'buy']);
    expect(button(tree, 'Add to Bag').props.disabled).toBe(false);
  });
});

describe('Add to Bag while it is working', () => {
  it('spins in place of its own label', () => {
    const tree = render(bar({addBusy: true}));
    // The word is gone and the spinner has taken its place; Buy Now is
    // untouched, so the bar cannot claim to be doing two things at once.
    expect(labels(tree)).toEqual(['Buy Now']);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it('spins white, so it is visible on the red fill', () => {
    // COLORS.red on a red button is an invisible spinner, which is the same
    // bug as no spinner at all.
    const tree = render(bar({addBusy: true}));
    const spinner = tree.root.findByType(ActivityIndicator);
    expect(spinner.props.color).toBe(COLORS.white);
  });

  it('cannot be pressed again, so one tap is one line in the bag', () => {
    // /cart/add.js is not idempotent: a second press inside the verify window
    // is a second line, not a repeat of the first.
    const tree = render(bar({addBusy: true}));
    expect(button(tree, 'Add to Bag').props.disabled).toBe(true);
    expect(button(tree, 'Add to Bag').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('locks Buy Now too, so an add cannot land in a cart already left behind', () => {
    const tree = render(bar({addBusy: true}));
    const buy = button(tree, 'Buy Now');
    expect(buy.props.disabled).toBe(true);
    // Disabled, but NOT claiming to be busy: it is not doing anything.
    expect(buy.props.accessibilityState).toEqual({disabled: true, busy: false});
  });
});

describe('Buy Now while it is working', () => {
  it('spins in place of its own label, and not in the other button', () => {
    const tree = render(bar({buyBusy: true}));
    expect(labels(tree)).toEqual(['Add to Bag']);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it('spins red, matching its own label on the pale fill', () => {
    const tree = render(bar({buyBusy: true}));
    expect(tree.root.findByType(ActivityIndicator).props.color).toBe(
      COLORS.red,
    );
  });

  it('locks both buttons while Shiprocket is opening', () => {
    const tree = render(bar({buyBusy: true}));
    expect(button(tree, 'Buy Now').props.disabled).toBe(true);
    expect(button(tree, 'Add to Bag').props.disabled).toBe(true);
  });
});
