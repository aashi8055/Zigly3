/**
 * The cover held over a page layer while it loads.
 *
 * Two things are defended. First that it is a cover and not a skeleton: it makes
 * no claim about the layout arriving behind it, because guessing wrong moves the
 * shapes as the real content lands, which is the judder it exists to remove.
 * Second that it has a deadline -- a cover with no cap is a screen the customer
 * is stuck behind, and the screen that renders it owns that cap.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator} from 'react-native';
import PageCover, {PAGE_COVER_CAP_MS} from '../src/components/PageCover';

const render = () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<PageCover />);
  });
  return tree;
};

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

  it('takes taps, so nothing under it can be pressed mid-load', () => {
    // A tap landing on a control that is about to move is worse than one that
    // does nothing at all.
    const tree = render();
    const root = tree.root.findAll(
      node => node.props.pointerEvents === 'auto' && node.props.accessibilityRole === 'progressbar',
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

  it('clears its timer when the page arrives first', () => {
    // The component is unmounted the moment the layer paints, which is the
    // common case, and its spinner timer must not fire into a dead tree. Not
    // asserted on the timer count: the fade animations schedule their own.
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
    // Long enough to swallow a warmed page outright, short enough that a slow
    // one is shown half-drawn with the back arrow rather than hidden.
    expect(PAGE_COVER_CAP_MS).toBeGreaterThanOrEqual(1000);
    expect(PAGE_COVER_CAP_MS).toBeLessThanOrEqual(4000);
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

  it('covers the layer again when a link inside it navigates', () => {
    // A product opened from a collection navigates the layer it is in, and that
    // second document arrives as unstyled as the first. The cover used to be a
    // one-off per layer, so every page after the first was the website
    // assembling itself in full view.
    const s = src();
    // The layer's own handler, not the dashboard's -- that one has no cover.
    const at = s.indexOf('setLoadingTarget(layer.key);');
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 400)).toContain('unmarkPainted(layer.key)');
  });

  it('reveals a failed page too, rather than hiding it behind a spinner', () => {
    // The header's back arrow is the way out of a broken page, and it is no use
    // under a cover. Located by the layer's own handler, not the first onError
    // in the file -- that one belongs to the dashboard, which has no cover.
    const s = src();
    const at = s.indexOf("warn('page load error:'");
    expect(at).toBeGreaterThan(-1);
    expect(s.slice(at, at + 400)).toContain('markPainted(layer.key)');
  });

  it('reveals after the cap whatever the network does', () => {
    const s = src();
    expect(s).toContain('setTimeout(() => markPainted(key), PAGE_COVER_CAP_MS)');
    // Cancelled if the page paints first, or if the customer leaves.
    expect(s).toContain('return () => clearTimeout(timer);');
  });

  it('covers only a layer that is actually on screen', () => {
    // A parked layer is already invisible; covering it would keep its key out
    // of the painted list for no reason.
    expect(src()).toContain('isVisible && !paintedLayers.includes(layer.key)');
  });

  it('forgets layers that have been evicted', () => {
    // Keys are monotonic so a stale entry is harmless, but the list is read on
    // every render of every layer and would grow all session.
    expect(src()).toContain('const live = new Set(stack.layers.map');
  });
});
