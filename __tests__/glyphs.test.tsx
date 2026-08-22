/**
 * The heart.
 *
 * It is the most-seen icon in the app -- the bottom bar, the header, the account
 * screen and every wishlist tile -- and it is the one glyph here that is not
 * ours: the path is lifted verbatim from the `swym-add-to-wishlist` button
 * Zigly's theme renders on every product card. So what is defended here is that
 * it stays *theirs*, drawn once, in both states.
 *
 * It was previously stacked Views -- two circles and a rotated square -- and
 * three separate copies of that construction had drifted apart. The point of
 * these tests is that a fourth copy cannot appear without one of them failing.
 */
import React from 'react';
import ReactTestRenderer, {type ReactTestInstance} from 'react-test-renderer';
import {Path} from 'react-native-svg';
import {HeartOutline, HeartShape} from '../src/components/glyphs';
import NativeHeader from '../src/components/NativeHeader';
import BottomNav from '../src/components/BottomNav';

/**
 * Zigly's own heart, as their product cards ship it.
 *
 * Written out flat here on purpose. The source splits it across string
 * concatenations to stay inside the line limit, so a test that imported the
 * constant would pass even if the pieces were joined wrongly.
 */
const ZIGLY_HEART =
  'M10.3148 1C5.15109 1 0.964844 5.30432 0.964844 10.6137C0.964844 20.2274 12.0148 28.9671 17.9648 31C23.9148 28.9671 34.9648 20.2274 34.9648 10.6137C34.9648 5.30432 30.7786 1 25.6148 1C22.4528 1 19.6563 2.61423 17.9648 5.08495C17.1027 3.82224 15.9573 2.79172 14.6256 2.08066C13.294 1.36959 11.8153 0.998912 10.3148 1Z';

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

/** Every SVG path in the tree. */
const paths = (root: ReactTestInstance) =>
  root.findAllByType(Path).map(node => node.props);

describe('the heart is Zigly’s own drawing', () => {
  it('uses their path, byte for byte, filled', () => {
    const [heart] = paths(render(<HeartShape />).root);
    expect(heart.d).toBe(ZIGLY_HEART);
  });

  it('uses the same path outlined', () => {
    const [heart] = paths(render(<HeartOutline />).root);
    expect(heart.d).toBe(ZIGLY_HEART);
  });

  it('keeps their stroke weight and their round joins', () => {
    // Scaled with the icon rather than pinned to a pixel value, which is what
    // makes a 16px heart and a 22px heart look like one icon at two sizes.
    const [heart] = paths(render(<HeartOutline size={16} />).root);
    expect(heart.strokeWidth).toBeCloseTo(1.26789, 5);
    expect(heart.strokeLinecap).toBe('round');
    expect(heart.strokeLinejoin).toBe('round');
  });
});

describe('filled and outlined differ only in the fill', () => {
  it('fills with the colour when saved', () => {
    const [heart] = paths(render(<HeartShape color="#ED2427" />).root);
    expect(heart.fill).toBe('#ED2427');
    // Stroked as well, so the silhouette matches the outline's exactly and the
    // icon does not appear to change size when one replaces the other.
    expect(heart.stroke).toBe('#ED2427');
  });

  it('does not fill when not saved', () => {
    const [heart] = paths(render(<HeartOutline color="#5A6472" />).root);
    expect(heart.fill).toBe('none');
    expect(heart.stroke).toBe('#5A6472');
  });

  it('ignores the ground colour the old fake stroke needed', () => {
    // Callers still pass it. A real stroke has no use for it, and honouring it
    // would put a filled shape back behind the outline.
    const [heart] = paths(
      render(<HeartOutline color="#1B1B1B" ground="#F7F8FA" />).root,
    );
    expect(heart.fill).toBe('none');
  });
});

describe('there is one heart, not four', () => {
  const headerProps = {
    onMenuPress: () => {},
    onBackPress: () => {},
    onWishlistPress: () => {},
    onCartPress: () => {},
    onLogoPress: () => {},
    onSearchPress: () => {},
    cartCount: 0,
    showSearch: true,
    showWishlist: true,
    showCartIcon: true,
    searchCollapsed: false,
    showBack: false,
    searchPlaceholders: [],
  };

  it('the header draws it as a path, not as stacked Views', () => {
    const drawn = paths(render(<NativeHeader {...headerProps} />).root);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].d).toBe(ZIGLY_HEART);
    // The header's heart is an outline: nothing there is saved yet.
    expect(drawn[0].fill).toBe('none');
  });

  it('the bottom bar draws both states from the same path', () => {
    const drawn = paths(
      render(<BottomNav active="wishlist" onSelect={() => {}} />).root,
    );
    // The brand mark on the home tab, and the wishlist tab.
    expect(drawn.length).toBeGreaterThanOrEqual(2);
    for (const heart of drawn) {
      expect(heart.d).toBe(ZIGLY_HEART);
    }
    // One filled (the red brand mark), one outlined (the tab).
    expect(drawn.some(h => h.fill !== 'none')).toBe(true);
    expect(drawn.some(h => h.fill === 'none')).toBe(true);
  });
});
