/**
 * The dashboard's own reveal.
 *
 * Every other page in this app is covered by `PageCover` and released by its own
 * `page-ready`. The dashboard was the exception: covered by the splash, released
 * by `dashboard-ready`, and that signal was not telling the truth. It fired once
 * the banner and the category rail had images, at which point the app had still
 * to swap the category rail for a different one and land the coupon strip -- so
 * the splash lifted and the top of the store then rearranged itself in full view.
 *
 * Three things are defended here:
 *
 *   **The signal waits for the app's own work, not just the site's.** A rail the
 *   app is about to replace is not a rail that is ready.
 *
 *   **Every slot settles, including the ones that fail.** This is the same
 *   property the paint gate has, for the same reason: a slot that never settles
 *   does not delay the reveal, it holds it to the deadline. A section Zigly has
 *   removed is a final answer.
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
import {READY_SIGNAL_SCRIPT} from '../src/webview/readySignal';
import {HOME_LAYOUT_SCRIPT} from '../src/webview/homeLayout';
import {EXTRA_SECTIONS_SCRIPT} from '../src/webview/extraSections';
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
    const wide = shapes(render({variant: 'home'})).filter(
      node => styleOf(node).aspectRatio === 2,
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

describe('the signal waits for the app’s own work', () => {
  it('is not satisfied by a category rail it is about to replace', () => {
    // The image test passes on the site's own rail immediately; this is the check
    // that waits for the one the app is going to keep.
    expect(READY_SIGNAL_SCRIPT).toContain('if (!settled(cats)) { return false; }');
  });

  it('waits for the coupon strip, the one transplant above the fold', () => {
    expect(READY_SIGNAL_SCRIPT).toContain("getElementById('zigly-x-coupon')");
  });

  it('treats an absent slot as settled, not as pending', () => {
    /*
     * Load bearing. Every one of these sections is one Zigly can remove, and a
     * missing section must not be something the reveal waits for -- that would
     * make deleting a section from the theme hang the app to its deadline.
     */
    expect(READY_SIGNAL_SCRIPT).toContain(
      "return !el || el.getAttribute('data-state') === 'ready';",
    );
  });

  it('still refuses to wait on the sections below the fold', () => {
    // Above-the-fold only, on purpose: waiting for what the customer cannot see
    // yet would make this app slower than the website it replaces.
    for (const below of [
      'zigly-x-bestsellers',
      'zigly-x-instagram',
      'zigly-x-everything',
      'zigly-x-price',
    ]) {
      expect(READY_SIGNAL_SCRIPT).not.toContain(below);
    }
  });
});

describe('every slot settles, including the ones that fail', () => {
  /**
   * The paths out of an async fill, counted in the shipped script.
   *
   * Asserting on the text rather than running it, in the style of the other
   * injection tests: these scripts are template literals with no module boundary
   * to reach into, and what ships is the string.
   */
  it('settles the category rail on success, absence and error', () => {
    expect(HOME_LAYOUT_SCRIPT).toContain("current.setAttribute('data-state', 'loading')");
    // The copy that landed...
    expect(HOME_LAYOUT_SCRIPT).toContain('settle(replacement)');
    // ...the section having been withdrawn, and the request having failed. Both
    // leave the site's own rail on screen, which is a final state.
    expect(HOME_LAYOUT_SCRIPT).toContain('if (!sec) { settle(current); return; }');
    expect(HOME_LAYOUT_SCRIPT).toContain(
      "warn('category swap failed: ' + e); settle(current);",
    );
  });

  it('settles a transplanted slot on success, absence and error', () => {
    expect(EXTRA_SECTIONS_SCRIPT).toContain(
      "slot.setAttribute('data-state', 'loading')",
    );
    expect(EXTRA_SECTIONS_SCRIPT).toContain(
      "try { slot.setAttribute('data-state', 'ready'); } catch (e) {}",
    );
    expect(EXTRA_SECTIONS_SCRIPT).toContain(
      "warn('unavailable: ' + spec.key); settle(); return;",
    );
    expect(EXTRA_SECTIONS_SCRIPT).toContain(
      "warn('failed ' + spec.key + ': ' + e); settle();",
    );
  });

  it('parses, so a mangled escape cannot silently disable any of it', () => {
    for (const script of [
      HOME_LAYOUT_SCRIPT,
      EXTRA_SECTIONS_SCRIPT,
      READY_SIGNAL_SCRIPT,
    ]) {
      expect(() => {
        // eslint-disable-next-line no-new-func
        new Function(script);
      }).not.toThrow();
    }
  });
});
