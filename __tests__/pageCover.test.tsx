/**
 * The cover held over a page layer while it loads.
 *
 * What is defended here is the shape of the transition, because that is where
 * every complaint about this app's loading came from. Four properties:
 *
 *   **It has a deadline.** A cover with no cap is a screen the customer is stuck
 *   behind, and the screen that renders it owns that cap.
 *
 *   **It never cuts.** It fades out over the arriving page and only then removes
 *   itself. The old arrangement unmounted it the instant the page was ready,
 *   which put the change on a single frame boundary -- read by the eye as a
 *   flicker rather than as progress.
 *
 *   **It does not blank a page that is already on screen.** A fresh layer has
 *   nothing behind it and must be opaque immediately; a layer navigating in
 *   place has a page underneath, and the cover dissolves in over it.
 *
 *   **It is not shown for every load event.** A fragment jump and a reload of
 *   the page already showing are not navigations the customer needs covering.
 *
 * The placeholder shapes are new, and they contradict the comment that used to
 * sit here. That comment's argument was that a mis-guessed skeleton judders as
 * the real content replaces it -- which was true of a cover that was cut away.
 * It is not true of one that dissolves.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator} from 'react-native';
import PageCover, {PAGE_COVER_CAP_MS} from '../src/components/PageCover';
import type {CoverVariant} from '../src/components/PageCover';
import {coverVariantFor} from '../src/screens/ZiglyWebViewScreen';
import {READY_SIGNAL_SCRIPT} from '../src/webview/readySignal';

/**
 * Every tree rendered here, so each test can be torn down.
 *
 * Not tidiness: the placeholder pulse is an `Animated.loop`, and a loop is only
 * stopped by the effect cleanup that unmounting runs. A tree left mounted keeps
 * animating for the rest of the file.
 */
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

/** The cover's own root: the thing whose opacity is the transition. */
const coverRoot = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => node.props.accessibilityRole === 'progressbar')[0];

const opacityOf = (tree: ReactTestRenderer.ReactTestRenderer): number => {
  const value = styleOf(coverRoot(tree)).opacity as
    | {__getValue: () => number}
    | undefined;
  return value ? value.__getValue() : 1;
};

/** Placeholder blocks, counted by their one distinguishing fill. */
const FILL = 'rgba(24,55,97,0.07)';
const blockCount = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(node => styleOf(node).backgroundColor === FILL).length;

describe('the page cover', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('covers the layer from the first frame', () => {
    // Opaque immediately, or the half-drawn page shows through the gap.
    const tree = render();
    const cover = tree.root.findAllByType(ActivityIndicator);
    expect(cover).toHaveLength(1);
  });

  it('is fully opaque at once when there is nothing behind it', () => {
    // A freshly mounted layer is the WebView's own blank until its first
    // document paints. Fading in over that would be fading in over nothing.
    expect(opacityOf(render())).toBe(1);
  });

  it('starts transparent over a page that is already on screen', () => {
    /*
     * The other half of the same decision. A product opened from a collection
     * navigates the layer it is in, so there is a real page under the cover at
     * the moment it goes up -- cutting to an opaque ground over it is the
     * "blanking the whole WebView" this exists to avoid, so it dissolves in from
     * nothing instead.
     *
     * The starting value is what is asserted, not the animation: these fades run
     * on the native driver, which under Jest never writes back to the JS value.
     */
    expect(opacityOf(render({crossfade: true}))).toBe(0);
  });

  it('takes taps, so nothing under it can be pressed mid-load', () => {
    // A tap landing on a control that is about to move is worse than one that
    // does nothing at all.
    const tree = render();
    const root = tree.root.findAll(
      node =>
        node.props.pointerEvents === 'auto' &&
        node.props.accessibilityRole === 'progressbar',
    );
    expect(root.length).toBeGreaterThanOrEqual(1);
  });

  it('holds the spinner back, so a fast page does not flash one', () => {
    // A warmed page is often ready inside a couple of hundred milliseconds, and
    // a spinner that appears and vanishes reads as a stutter.
    const tree = render();
    // Nothing scheduled would mean the spinner is shown at once.
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it('fades out over the arriving page rather than being cut away', () => {
    /*
     * The property the whole rewrite is for. It used to be unmounted by its
     * parent the moment the layer was marked painted, so the cover disappeared
     * between two frames -- which the eye reports as a flicker rather than as
     * progress. Here it is still in the tree after being told the page is ready,
     * and it leaves only once the fade has run.
     */
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={true} />);
    });
    /*
     * Still drawn on the tick the page became ready. That is the whole
     * assertion: under the old arrangement the parent stopped rendering it on
     * exactly this tick, so the cover was gone before a single frame of
     * transition had run. How far the fade has got is not checked -- these run
     * on the native driver, which under Jest does not write back to the JS
     * value; that it *finishes* is the test below.
     */
    expect(tree.toJSON()).not.toBeNull();
  });

  it('takes itself out of the tree once it is invisible', () => {
    // A cover that faded to nothing but stayed mounted would keep swallowing
    // nothing forever; worse, it would still be drawn.
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={true} />);
    });
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('comes back when the same layer starts loading something else', () => {
    /*
     * The trap in making the cover fade out. A layer is not remounted when a
     * link inside it is tapped -- that is the whole point of the keep-alive
     * stack -- so a cover that had removed itself after the first page would
     * never return, and every page after the first would be the website
     * assembling itself in full view. Which is the bug the cover was written to
     * fix, reintroduced by the fix to the flicker.
     */
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={true} />);
    });
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(tree.toJSON()).toBeNull();

    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={false} crossfade={true} />);
    });
    expect(tree.toJSON()).not.toBeNull();
    expect(coverRoot(tree).props.pointerEvents).toBe('auto');
  });

  it('holds its spinner back on the second cover too', () => {
    // The delayed reveals are at the end of their last run by then. Not putting
    // them back would flash a spinner instantly on every navigation after the
    // first -- the stutter the delay exists to remove.
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={true} />);
    });
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(2000);
    });
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={false} crossfade={true} />);
    });
    // Delays scheduled again, rather than the spinner being already up.
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });

  it('releases taps the moment the page is ready, not at the end of the fade', () => {
    // The page underneath is finished. A fifth of a second of dead screen after
    // it is visibly there is unresponsiveness the fade would be adding, not
    // hiding.
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.update(<PageCover ready={true} />);
    });
    expect(coverRoot(tree).props.pointerEvents).toBe('none');
  });

  it('clears its timer when the page arrives first', () => {
    // The component may be unmounted with its delays still pending -- the
    // customer leaves before the page lands -- and they must not fire into a
    // dead tree. Not asserted on the timer count: the fades schedule their own.
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.unmount();
    });
    expect(() => {
      ReactTestRenderer.act(() => {
        jest.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });

  it('publishes a cap that is short enough to escape and long enough to help', () => {
    // Short enough that a genuinely slow page is shown half-drawn with the back
    // arrow rather than hidden behind a spinner.
    expect(PAGE_COVER_CAP_MS).toBeGreaterThanOrEqual(1000);
    expect(PAGE_COVER_CAP_MS).toBeLessThanOrEqual(5000);
  });

  it('leaves the page room to answer for itself before the cap fires', () => {
    /*
     * The ordering that caused the bug this cap was blamed for. The page
     * reports itself ready on its own deadline (INNER_TRIES x TICK_MS in
     * ../src/webview/readySignal, ~2.4s); the cap is only for a page whose
     * script never ran. With the cap the shorter of the two -- it was 3000ms
     * against a page deadline of 3600ms -- the cover came off first on every
     * page that took a moment to settle, which is exactly the half-built
     * website the cover exists to hide.
     *
     * Read out of the script rather than restated here, so the two numbers
     * cannot drift apart silently.
     */
    const script = READY_SIGNAL_SCRIPT;
    const tick = Number(/\}, (\d+)\);/.exec(script)?.[1]);
    const cap = Number(/var cap = home \? \d+ : (\d+);/.exec(script)?.[1]);
    expect(tick).toBeGreaterThan(0);
    expect(cap).toBeGreaterThan(0);
    expect(tick * cap).toBeLessThan(PAGE_COVER_CAP_MS);
  });
});

describe('the shape it holds while it waits', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const settled = (variant: CoverVariant) => {
    const tree = render({variant});
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(1000);
    });
    return tree;
  };

  it('stays a bare ground and one spinner where the layout is unknown', () => {
    // A breed page, a content page, checkout. Claiming a shape for these would
    // be inventing one.
    const tree = settled('plain');
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(blockCount(tree)).toBe(0);
  });

  it('promises a grid on a listing, and no spinner beside it', () => {
    // A spinner on top of a skeleton is two loading indicators for one load.
    const tree = settled('grid');
    expect(blockCount(tree)).toBeGreaterThan(4);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('promises a gallery and a buy control on a product', () => {
    const tree = settled('detail');
    expect(blockCount(tree)).toBeGreaterThan(2);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('holds the shapes back longer than the spinner', () => {
    // They are the larger claim of the two, so a page that is ready quickly is
    // covered by a quiet ground and nothing else at all.
    const tree = render({variant: 'grid'});
    expect(jest.getTimerCount()).toBeGreaterThan(0);
    expect(tree.toJSON()).not.toBeNull();
  });
});

describe('choosing the shape from the destination', () => {
  it('reads a product page as a gallery and a buy control', () => {
    expect(coverVariantFor('https://zigly.com/products/dog-food')).toBe(
      'detail',
    );
  });

  it('reads a collection and a search as a card grid', () => {
    expect(coverVariantFor('https://zigly.com/collections/dog-food')).toBe(
      'grid',
    );
    expect(coverVariantFor('https://zigly.com/search?q=treats')).toBe('grid');
  });

  it('does not promise a grid on the all-collections page', () => {
    // That one is a set of category tiles, not a product grid.
    expect(coverVariantFor('https://zigly.com/collections')).toBe('plain');
  });

  it('claims nothing for a page whose shape it cannot know', () => {
    expect(coverVariantFor('https://zigly.com/pages/dog')).toBe('plain');
    expect(coverVariantFor('https://zigly.com/checkouts/abc')).toBe('plain');
    expect(coverVariantFor('')).toBe('plain');
  });

  it('ignores the query and the fragment when reading the path', () => {
    // Otherwise a '?ref=/products/x' in a tracking parameter would decide it.
    expect(coverVariantFor('https://zigly.com/pages/dog?ref=/products/x')).toBe(
      'plain',
    );
  });
});

describe('the screen owns the deadline', () => {
  const src = () =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

  it('reveals when the page reports itself ready, not when it loads', () => {
    /*
     * This was the bug. A load ending is the *document* arriving, not the page:
     * the app's stylesheet is installed by the script that runs at that moment,
     * and a listing page's grid is rendered by SearchTap after first paint. So
     * revealing on load end showed the mobile website for a beat and then it
     * visibly became this app's page. The page says when it is ready -- see
     * ../src/webview/readySignal.
     */
    const s = src();
    const at = s.indexOf("data.tag === 'page-ready'");
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 700)).toContain('markPainted(layer.key)');
  });

  it('reveals a page with no injection to wait for', () => {
    // Checkout is never styled by this app, so nothing there will ever report
    // itself ready -- and the money flow is the worst place to hold a cover.
    const s = src();
    const at = s.indexOf('if (getInjectionForUrl(url) === null)');
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 120)).toContain('markPainted(layer.key)');
  });

  it('covers the layer again when a link inside it navigates elsewhere', () => {
    // A product opened from a collection navigates the layer it is in, and that
    // second document arrives as unstyled as the first. The cover used to be a
    // one-off per layer, so every page after the first was the website
    // assembling itself in full view.
    const s = src();
    // The layer's own handler, not the dashboard's -- the dashboard has its
    // own separate cover, released by its own signal, not this one.
    const at = s.indexOf('setLoadingTarget(layer.key);');
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 1800)).toContain('unmarkPainted(layer.key)');
  });

  it('leaves a page alone when the load is not going anywhere new', () => {
    /*
     * The other half, and the reason the ledger exists. Android reports a
     * fragment jump through onPageStarted exactly as it reports a navigation,
     * and a reload of the page already on screen looks the same again. Covering
     * either one takes away a page the customer is reading and gives back a
     * spinner.
     */
    const s = src();
    // The layer's own onLoadStart: the dashboard's and the login screen's take
    // no argument, so this signature belongs to exactly one handler.
    const at = s.indexOf('onLoadStart={e => {');
    expect(at).toBeGreaterThan(-1);
    const handler = s.slice(at, at + 2200);
    expect(handler).toContain('committedUrls.current.get(layer.key)');
    expect(handler).toContain('!sameDocument(committed, url)');
    // And a url that is not a document at all is not a load to report: the
    // guard comes before the progress bar is even turned on.
    expect(handler.indexOf('isDocumentUrl(url)')).toBeLessThan(
      handler.indexOf('setLoadingTarget(layer.key)'),
    );
  });

  it('records what a layer committed at load end, not while it loads', () => {
    // onNavigationStateChange also runs during a load, so a ledger fed from
    // there would be comparing the incoming url with itself.
    const s = src();
    const at = s.indexOf('committedUrls.current.set(layer.key, url)');
    expect(at).toBeGreaterThan(-1);
    // Inside the layer's onLoadEnd, after the reveal decision.
    expect(s.lastIndexOf('onLoadEnd={e => {', at)).toBeGreaterThan(-1);
  });

  it('covers a layer whose renderer Android has killed', () => {
    // The reload goes to the url already committed, so onLoadStart would read it
    // as a same-document load and leave the page alone -- but there is no page
    // left: what is on screen is a blank.
    const s = src();
    const at = s.indexOf("warn('page render process gone");
    expect(at).toBeGreaterThan(-1);
    const handler = s.slice(at, at + 800);
    expect(handler).toContain('committedUrls.current.delete(layer.key)');
    expect(handler).toContain('unmarkPainted(layer.key)');
  });

  it('reveals a failed page too, rather than hiding it behind a spinner', () => {
    // The header's back arrow is the way out of a broken page, and it is no use
    // under a cover. Located by the layer's own handler, not the first onError
    // in the file -- that one belongs to the dashboard's WebView, which
    // releases its own, separate cover rather than this one.
    const s = src();
    const at = s.indexOf("warn('page load error:'");
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 400)).toContain('markPainted(layer.key)');
  });

  it('reveals after the cap whatever the network does', () => {
    const s = src();
    expect(s).toContain(
      'setTimeout(() => markPainted(key), PAGE_COVER_CAP_MS)',
    );
    // Cancelled if the page paints first, or if the customer leaves.
    expect(s).toContain('return () => clearTimeout(timer);');
  });

  it('hands the cover the layer state instead of unmounting it', () => {
    // The cover cannot fade out if it is taken out of the tree the instant it is
    // no longer wanted. It is mounted for as long as the layer is on screen and
    // told whether the page is ready.
    const s = src();
    // The second of the two: the first is the dashboard's own, standing over
    // its WebView with no layer to read `layer.key` off of.
    const first = s.indexOf('<PageCover');
    expect(first).toBeGreaterThan(-1);
    const at = s.indexOf('<PageCover', first + 1);
    expect(at).toBeGreaterThan(-1);
    const el = s.slice(at, at + 1400);
    expect(el).toContain('ready={paintedLayers.includes(layer.key)}');
    expect(el).toContain('crossfade={committedUrls.current.has(layer.key)}');
    expect(el).toContain('variant={coverVariantFor(');
    // Still only over a layer that is actually on screen: a parked one is
    // already invisible.
    expect(s.lastIndexOf('{isVisible ? (', at)).toBeGreaterThan(-1);
  });

  it('forgets layers that have been evicted', () => {
    // Keys are monotonic so a stale entry is harmless, but the lists are read on
    // every render of every layer and would grow all session.
    const s = src();
    expect(s).toContain('const live = new Set(stack.layers.map');
    expect(s).toContain('committedUrls.current.delete(key)');
  });
});
