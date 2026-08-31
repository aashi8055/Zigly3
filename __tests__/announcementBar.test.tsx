/**
 * The announcement strip must never stop travelling.
 *
 * Every case here is a way the scroll used to freeze or jump back to the first
 * offer -- see the header of ../src/components/AnnouncementBar. They are worth
 * pinning because all three are invisible to a typecheck and none of them shows
 * up on a screen that is merely opened and looked at: they need the app to be
 * backgrounded, or a screen to be left and returned to.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Animated, AppState, Text, View} from 'react-native';
import AnnouncementBar from '../src/components/AnnouncementBar';

const OFFERS = ['Free delivery over ₹499', 'Vet consults from ₹199'];

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

/** Give the strip a measured width, which is what starts the loop. */
const measure = (tree: ReactTestRenderer.ReactTestRenderer, width: number) => {
  ReactTestRenderer.act(() => {
    tree.root
      .findAllByType(Text)[0]
      .props.onLayout({nativeEvent: {layout: {width, height: 38}}});
  });
};

const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => String(node.props.children ?? ''))
    .join(' | ');

describe('the announcement bar', () => {
  let loop: jest.SpyInstance;
  let timing: jest.SpyInstance;

  beforeEach(() => {
    // Spy rather than mock: the real implementations still run, so the
    // component's own start/stop bookkeeping is exercised.
    loop = jest.spyOn(Animated, 'loop');
    timing = jest.spyOn(Animated, 'timing');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts travelling once it has been measured', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    expect(loop).not.toHaveBeenCalled();
    measure(tree, 600);
    expect(loop).toHaveBeenCalled();
  });

  it('shows the offers the site reported, and nothing of its own', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    const shown = textOf(tree);
    OFFERS.forEach(offer => expect(shown).toContain(offer));
  });

  /**
   * Failure 1: the OS halts native-driver animations on the way out and does
   * not restart them on the way back, so the strip was frozen for the rest of
   * the session.
   */
  it('restarts the loop when the app comes back to the foreground', () => {
    const handlers: Array<(s: string) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, handler: (s: string) => void) => {
        handlers.push(handler);
        return {remove: () => {}} as never;
      });

    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);
    const before = loop.mock.calls.length;

    ReactTestRenderer.act(() => {
      handlers.forEach(h => h('background'));
      handlers.forEach(h => h('active'));
    });

    expect(loop.mock.calls.length).toBeGreaterThan(before);
  });

  /**
   * iOS passes through 'inactive' for the control centre and the app switcher
   * and returns to 'active' without ever reaching 'background'. Treating only
   * 'background' as leaving would leave the strip frozen on that path.
   */
  it('treats an inactive spell as having left the foreground', () => {
    const handlers: Array<(s: string) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, handler: (s: string) => void) => {
        handlers.push(handler);
        return {remove: () => {}} as never;
      });

    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);
    const before = loop.mock.calls.length;

    ReactTestRenderer.act(() => {
      handlers.forEach(h => h('inactive'));
      handlers.forEach(h => h('active'));
    });

    expect(loop.mock.calls.length).toBeGreaterThan(before);
  });

  /**
   * Failure 2, part one: onLayout fires again for reasons that are not a real
   * change, and each restart snapped the strip to the head of the line.
   */
  it('ignores a re-measure that reports the same width', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);
    const before = loop.mock.calls.length;
    measure(tree, 600);
    measure(tree, 600.4); // sub-pixel noise is the same width
    expect(loop.mock.calls.length).toBe(before);
  });

  /**
   * Failure 2, part two: a restart must pick up the remaining distance at the
   * same speed, not re-run a full-width duration over a part-finished pass --
   * which would make the strip visibly crawl every time the app returned.
   */
  it('resumes at the same speed rather than stretching the pass', () => {
    const handlers: Array<(s: string) => void> = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: string, handler: (s: string) => void) => {
        handlers.push(handler);
        return {remove: () => {}} as never;
      });

    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);

    // Half-way along, as the position listener would have recorded.
    const track = tree.root.findAllByType(Animated.View)[0];
    ReactTestRenderer.act(() => {
      track.props.style
        .flat()
        .find((s: {transform?: unknown}) => s && s.transform)
        .transform[0].translateX.setValue(-300);
    });

    timing.mockClear();
    ReactTestRenderer.act(() => {
      handlers.forEach(h => h('background'));
      handlers.forEach(h => h('active'));
    });

    // 600px at 45px/s is 13333ms; the 300px left is half of that. The resume
    // is the shorter one, and it is what proves the speed is unchanged.
    const durations = timing.mock.calls.map(call => call[1].duration);
    expect(durations).toContain((300 / 45) * 1000);
  });

  /**
   * Failure 3: the screens that hide the bar pass an empty list, and the
   * component used to answer that by unmounting itself -- which destroyed the
   * animated value, so coming back started the line over. It now stays mounted
   * and keeps travelling, at no height.
   */
  it('keeps running, at no height, on the screens that hide it', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);
    const before = loop.mock.calls.length;

    ReactTestRenderer.act(() => {
      tree.update(<AnnouncementBar items={[]} />);
    });

    // Still mounted -- an unmount is the bug.
    const root = tree.root.findAllByType(View)[0];
    const style = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(style.height).toBe(0);

    // And still holding the offers, so nothing re-measures to zero width.
    OFFERS.forEach(offer => expect(textOf(tree)).toContain(offer));

    // No restart was provoked by hiding it.
    expect(loop.mock.calls.length).toBe(before);
  });

  it('does not announce the hidden strip to a screen reader', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    ReactTestRenderer.act(() => {
      tree.update(<AnnouncementBar items={[]} />);
    });
    const root = tree.root.findAllByType(View)[0];
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('comes back to full height when a screen shows it again', () => {
    const tree = render(<AnnouncementBar items={OFFERS} />);
    measure(tree, 600);
    ReactTestRenderer.act(() => {
      tree.update(<AnnouncementBar items={[]} />);
    });
    const before = loop.mock.calls.length;

    ReactTestRenderer.act(() => {
      tree.update(<AnnouncementBar items={OFFERS} />);
    });

    const root = tree.root.findAllByType(View)[0];
    const style = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(style.height).toBe(38);
    // Returning to a screen must not restart the travel either.
    expect(loop.mock.calls.length).toBe(before);
  });
});
