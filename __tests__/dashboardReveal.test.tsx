/**
 * The dashboard's own reveal.
 *
 * WHAT THIS FILE DEFENDED HAS HALVED, AND THE HALF THAT WENT IS WORTH RECORDING
 * rather than quietly deleting.
 *
 * The dashboard used to be assembled inside the WebView, so its reveal was a
 * negotiation with the page: `dashboard-ready` fired once the banner and the
 * category rail had images, and it was not telling the truth -- the app had
 * still to swap that rail for a different one and land the coupon strip, so the
 * splash lifted and the top of the store rearranged itself in full view. Two
 * describes here defended the fix: that the signal waited for the app's own
 * work and not just the site's, and that every slot settled even when its
 * section failed.
 *
 * ../src/native/NativeDashboard draws those sections as components now, and the
 * modules that built them in the page -- `homeLayout`, `extraSections` and
 * eleven others -- are deleted. There is no in-page assembly left to wait for,
 * and the splash no longer waits on `dashboard-ready` at all: it lifts on the
 * native list's first layout (`handleDashboardPainted`, guarded in
 * ./splash.test.tsx). Both of those describes tested deleted machinery, so they
 * are gone with it.
 *
 * WHAT REMAINS IS STILL LOAD-BEARING: the cover itself. `PageCover` continues to
 * draw the dashboard's shape -- and the failsafe behind the native layout signal
 * still dissolves into it -- so which shape a destination claims, and the fact
 * that the wait is shapes rather than a spinner, are properties nothing else
 * checks.
 *
 *   **The wait has a shape.** A logo held for five seconds reads as stuck, so it
 *   becomes the outline of the dashboard.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator} from 'react-native';
import PageCover from '../src/components/PageCover';
import {FILL} from '../src/components/Skeleton';
import {coverVariantFor} from '../src/screens/ZiglyWebViewScreen';
import {START_URL, ZIGLY_ORIGIN} from '../src/constants/appConstants';

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  while (trees.length) {
    const tree = trees.pop();
    ReactTestRenderer.act(() => {
      tree?.unmount();
    });
  }
});

const render = (props: Record<string, unknown> = {}) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<PageCover {...props} />);
  });
  trees.push(tree);
  return tree;
};

/** Flatten whatever a style prop happens to be into one object. */
const styleOf = (node: {props: {style?: unknown}}): Record<string, unknown> => {
  const raw = node.props.style;
  const parts = Array.isArray(raw) ? raw.flat(Infinity) : [raw];
  return Object.assign({}, ...parts.filter(Boolean));
};

/** Every placeholder shape on the tree, found by its fill. */
const shapes = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' && styleOf(node).backgroundColor === FILL,
    {deep: true},
  );

describe('which shape the dashboard gets', () => {
  it('claims the home shape for the dashboard itself', () => {
    expect(coverVariantFor(START_URL)).toBe('home');
    expect(coverVariantFor(ZIGLY_ORIGIN)).toBe('home');
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/`)).toBe('home');
    // Query and fragment are not a different page.
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/?utm_source=x`)).toBe('home');
  });

  it('does not hand the dashboard shape to a layer with no destination', () => {
    /*
     * The near-miss. isHomeUrl('') resolves its path to '/', so an unguarded
     * check would dress a layer that has not been told where it is going in the
     * dashboard's clothes.
     */
    expect(coverVariantFor('')).toBe('plain');
  });

  it('leaves the destinations that have no shape alone', () => {
    // Deliberate, and recorded at coverVariantFor: the all-collections page and
    // the breed index are tiles, not a product grid. A shape the page will not
    // draw is worse than no shape.
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/collections`)).toBe('plain');
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/pages/pet-breeds`)).toBe('plain');
    // ...while the ones that do keep theirs.
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/collections/dog-food`)).toBe('grid');
    expect(coverVariantFor(`${ZIGLY_ORIGIN}/products/a-toy`)).toBe('detail');
  });
});

describe('the dashboard placeholder', () => {
  it('is shapes rather than a spinner', () => {
    const tree = render({variant: 'home'});
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(shapes(tree).length).toBeGreaterThan(8);
  });

  it('opens on a rail of circles, which is what the dashboard opens on', () => {
    // Fully round, and there are several of them: the category rail sits directly
    // under the search bar and is the first thing tapped.
    const round = shapes(render({variant: 'home'})).filter(
      node => styleOf(node).borderRadius === 999,
    );
    expect(round.length).toBeGreaterThanOrEqual(5);
  });

  it('carries one banner, not a column of them', () => {
    // The banner is the single largest shape on the screen; two would read as a
    // layout this app does not have.
    //
    // 1.5, not 2: the placeholder reserves the ratio Zigly's mobile banners are
    // actually cut to (600x400). It reserved 2:1 and ../src/native/BannerCarousel
    // drew at 2:1 citing this block as its reason -- so the two agreed with each
    // other and not with the artwork, and every banner was cropped by a quarter
    // of its height. Corrected in both together; this is the guard.
    const wide = shapes(render({variant: 'home'})).filter(
      node => styleOf(node).aspectRatio === 1.5,
    );
    expect(wide).toHaveLength(1);
  });

  it('still draws generic lines, never a spinner, for a destination with no shape to claim', () => {
    // A spinner reads as a website's own loading indicator, so 'plain' gets a
    // paragraph of generic lines instead -- a placeholder that promises
    // nothing specific, but is still a placeholder rather than a spinner.
    const tree = render({variant: 'plain'});
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(shapes(tree).length).toBeGreaterThan(0);
  });
});
