/**
 * The keep-alive page stack.
 *
 * Zigly's pages carry no cache-control, so every avoided mount is a 2 MB page
 * load the user does not wait for. These tests are about exactly that: which
 * WebViews keep existing, and when a `source` is handed out a second time
 * (which is the only thing that causes a reload).
 */
import {
  EMPTY_STACK,
  MAX_LAYERS,
  closeTopPage,
  goToDashboard,
  noteNavigation,
  onDashboard,
  openPage,
  sameDocument,
  visibleLayer,
} from '../src/navigation/pageStack';
import type {PageStack} from '../src/navigation/pageStack';

const ORIGIN = 'https://zigly.com';
const at = (path: string) => ORIGIN + path;

/** The key of whatever is on top; -1 for the dashboard. */
const topKey = (stack: PageStack): number => visibleLayer(stack)?.key ?? -1;

describe('showing a page', () => {
  it('starts on the dashboard with nothing mounted', () => {
    expect(onDashboard(EMPTY_STACK)).toBe(true);
    expect(visibleLayer(EMPTY_STACK)).toBeNull();
    expect(EMPTY_STACK.layers).toHaveLength(0);
  });

  it('mounts one layer and shows it', () => {
    const stack = openPage(EMPTY_STACK, at('/products/a'));
    expect(stack.layers).toHaveLength(1);
    expect(visibleLayer(stack)?.source).toBe(at('/products/a'));
    expect(onDashboard(stack)).toBe(false);
  });

  it('ignores a tap on the page already showing', () => {
    const first = openPage(EMPTY_STACK, at('/products/a'));
    // Same object back: no state change, so React does not even re-render.
    expect(openPage(first, at('/products/a'))).toBe(first);
    expect(openPage(first, at('/products/a/#reviews'))).toBe(first);
  });
});

describe('a visited page is not loaded twice', () => {
  it('keeps the layer mounted after returning to the dashboard', () => {
    let stack = openPage(EMPTY_STACK, at('/products/a'));
    const key = topKey(stack);

    stack = goToDashboard(stack);
    expect(onDashboard(stack)).toBe(true);
    // The WebView is still there, merely covered by the dashboard.
    expect(stack.layers).toHaveLength(1);

    stack = openPage(stack, at('/products/a'));
    // Same key means the same WebView: a paint, not a page load.
    expect(topKey(stack)).toBe(key);
    expect(stack.layers).toHaveLength(1);
  });

  it('keeps the layer mounted after stepping back out of it', () => {
    let stack = openPage(EMPTY_STACK, at('/collections/food'));
    const collection = topKey(stack);
    stack = openPage(stack, at('/products/a'));

    stack = closeTopPage(stack);
    expect(topKey(stack)).toBe(collection);
    // Both the collection and the product it was left for are still mounted.
    expect(stack.layers).toHaveLength(2);

    stack = openPage(stack, at('/products/a'));
    expect(stack.layers).toHaveLength(2);
  });

  it('walks back through several pages without re-mounting any of them', () => {
    let stack = openPage(EMPTY_STACK, at('/collections/food'));
    const first = topKey(stack);
    stack = openPage(stack, at('/products/a'));
    const second = topKey(stack);

    stack = closeTopPage(stack);
    expect(topKey(stack)).toBe(first);
    stack = closeTopPage(stack);
    expect(onDashboard(stack)).toBe(true);
    // Nothing was minted on the way back: no new keys appeared.
    expect(stack.layers.map(layer => layer.key).sort()).toEqual(
      [first, second].sort(),
    );
  });

  it('collapses to a page already in the back stack rather than stacking it twice', () => {
    let stack = openPage(EMPTY_STACK, at('/collections/food'));
    const collection = topKey(stack);
    stack = openPage(stack, at('/products/a'));
    // A link back to the collection from the product: the same behaviour a
    // browser has, and what stops cross-linked pages growing the stack.
    stack = openPage(stack, at('/collections/food'));

    expect(topKey(stack)).toBe(collection);
    expect(stack.history).toHaveLength(1);
  });
});

describe('the layer count is bounded', () => {
  /** Open n distinct pages, one after another. */
  const descend = (n: number): PageStack => {
    let stack = EMPTY_STACK;
    for (let i = 0; i < n; i++) {
      stack = openPage(stack, at('/products/p' + i));
    }
    return stack;
  };

  it('never holds more than MAX_LAYERS WebViews', () => {
    const stack = descend(MAX_LAYERS + 4);
    expect(stack.layers.length).toBeLessThanOrEqual(MAX_LAYERS);
    // History is not truncated; only the WebViews are.
    expect(stack.history).toHaveLength(MAX_LAYERS + 4);
  });

  it('gives up cache before it gives up a step of Back', () => {
    // /a is visited and left, so it is only cache; the rest are reachable.
    let stack = openPage(EMPTY_STACK, at('/products/a'));
    stack = goToDashboard(stack);
    for (let i = 0; i < MAX_LAYERS; i++) {
      stack = openPage(stack, at('/products/p' + i));
    }
    const sources = stack.layers.map(layer => layer.source);
    expect(sources).not.toContain(at('/products/a'));
    expect(stack.history.every(entry => entry.key !== null)).toBe(true);
  });

  it('reloads a page whose layer was evicted, rather than skipping it', () => {
    let stack = descend(MAX_LAYERS + 1);
    const dropped = stack.history[0];
    expect(dropped.key).toBeNull();

    // Walk all the way back to it.
    for (let i = 0; i < MAX_LAYERS; i++) {
      stack = closeTopPage(stack);
    }
    // Back stopped there instead of falling through to the dashboard...
    expect(onDashboard(stack)).toBe(false);
    // ...on a freshly mounted layer, which is the one place Back costs a load.
    expect(visibleLayer(stack)?.source).toBe(dropped.url);
    expect(stack.history).toHaveLength(1);
  });
});

describe('checkout is never restored from cache', () => {
  it('drops the checkout layer on the way out', () => {
    let stack = openPage(EMPTY_STACK, at('/checkout'));
    expect(stack.layers).toHaveLength(1);

    stack = closeTopPage(stack);
    // A half-finished payment page restored from cache would be showing a
    // session that has moved on.
    expect(stack.layers).toHaveLength(0);
    expect(onDashboard(stack)).toBe(true);
  });

  it('drops it when the logo is tapped as well', () => {
    let stack = openPage(EMPTY_STACK, at('/products/a'));
    stack = openPage(stack, at('/checkouts/c/abc'));

    stack = goToDashboard(stack);
    expect(stack.layers.map(layer => layer.source)).toEqual([
      at('/products/a'),
    ]);
  });
});

describe('following a page that navigates in place', () => {
  it('remembers where it actually is, for the header and for a re-mount', () => {
    let stack = openPage(EMPTY_STACK, at('/collections/food'));
    const key = topKey(stack);

    stack = noteNavigation(stack, key, at('/products/a'), true);
    expect(visibleLayer(stack)?.url).toBe(at('/products/a'));
    // `source` must not follow: reassigning it is what reloads a WebView.
    expect(visibleLayer(stack)?.source).toBe(at('/collections/food'));
    expect(stack.history[0].url).toBe(at('/products/a'));
  });

  it('re-shows that layer for its live url, not the one it was opened with', () => {
    let stack = openPage(EMPTY_STACK, at('/collections/food'));
    const key = topKey(stack);
    stack = noteNavigation(stack, key, at('/products/a'), true);
    stack = goToDashboard(stack);

    stack = openPage(stack, at('/products/a'));
    expect(topKey(stack)).toBe(key);
    expect(stack.layers).toHaveLength(1);
  });

  it('changes nothing when the report repeats', () => {
    const stack = openPage(EMPTY_STACK, at('/products/a'));
    const key = topKey(stack);
    const same = noteNavigation(stack, key, at('/products/a'), false);
    expect(same).toBe(stack);
  });
});

describe('sameDocument', () => {
  it('ignores a fragment and a trailing slash', () => {
    expect(sameDocument(at('/products/a'), at('/products/a/'))).toBe(true);
    expect(sameDocument(at('/products/a'), at('/products/a#reviews'))).toBe(
      true,
    );
  });

  it('does not ignore the query, which selects the page', () => {
    expect(sameDocument(at('/search?q=food'), at('/search?q=toys'))).toBe(
      false,
    );
  });
});
