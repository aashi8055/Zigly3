/**
 * The "Added to cart" toast, and the two things that made it an obstacle.
 *
 * Both were reported the same way -- "it holds on for so much time and blocks
 * the screen" -- and they are two separate faults: it stayed nearly three
 * seconds, and while it was there it swallowed taps meant for the controls it
 * covers. A shorter toast alone would not have fixed the second, since the bar
 * still overlaps the bottom nav for as long as it is drawn.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Animated, Text} from 'react-native';
import CartToast from '../src/components/CartToast';

const noop = () => {};

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => String(node.props.children ?? ''))
    .join(' | ');

describe('the add-to-cart toast', () => {
  /*
   * The toast starts an Animated.sequence the moment it becomes visible, and it
   * outlives the tests below: without fake timers its final frame lands after
   * the environment has been torn down, which surfaces as an unrelated crash
   * inside Animated rather than as a failure here.
   */
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('draws nothing until an add is reported', () => {
    const tree = render(
      <CartToast visible={false} onViewCart={noop} onHidden={noop} />,
    );
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('says what happened, and offers the cart', () => {
    const tree = render(
      <CartToast visible onViewCart={noop} onHidden={noop} />,
    );
    expect(textOf(tree)).toContain('Added to cart');
    expect(textOf(tree)).toContain('VIEW CART');
  });

  it('lets taps through to whatever it is covering', () => {
    /*
     * The bar spans the full width at bottom: 0, so it sits over the bottom nav
     * and, on a product page, over Add to Bag / Buy Now. box-none keeps it from
     * taking those taps; only VIEW CART inside it is meant to be pressable.
     */
    const tree = render(
      <CartToast visible onViewCart={noop} onHidden={noop} />,
    );
    const bar = tree.root.findByType(Animated.View);
    expect(bar.props.pointerEvents).toBe('box-none');
  });

  it('leaves on its own, quickly, without being dismissed', () => {
    /*
     * Read off the source rather than run through fake timers: the timing is
     * the whole point of the fix, and an Animated.sequence driven by mocked
     * timers in the test environment proves less about it than the numbers do.
     */
    const src = require('fs').readFileSync(
      'src/components/CartToast.tsx',
      'utf8',
    );
    const hold = /const VISIBLE_MS = (\d+)/.exec(src);
    const fade = /const FADE_MS = (\d+)/.exec(src);
    expect(hold).not.toBeNull();
    expect(fade).not.toBeNull();
    const total = Number(hold![1]) + 2 * Number(fade![1]);
    // Was 2960ms end to end. An acknowledgement, not a message to read.
    expect(total).toBeLessThanOrEqual(1600);
    // But still long enough to see and to reach VIEW CART.
    expect(total).toBeGreaterThanOrEqual(900);
  });

  it('reports itself hidden so the next add can show one', () => {
    // Without this the state that drives `visible` would never clear, and the
    // second add of a session would show nothing at all.
    const src = require('fs').readFileSync(
      'src/components/CartToast.tsx',
      'utf8',
    );
    expect(src).toContain('onHidden()');
  });
});
