/**
 * The header's search bar.
 *
 * The cycle itself is covered in placeholders.test.ts; what is defended here is
 * the wiring, which is the part that fails quietly. A typewriter whose timer is
 * armed from a stale frame stops after one letter, one whose effect re-runs on a
 * fresh array restarts mid-word, and one that keeps firing while the band is
 * closed spends frames drawing something nobody can see.
 */
import React from 'react';
import ReactTestRenderer, {type ReactTestInstance} from 'react-test-renderer';
import {Text} from 'react-native';
import NativeHeader from '../src/components/NativeHeader';
import {ERASE_MS, HOLD_MS, TYPE_MS} from '../src/search/placeholders';

const noop = () => {};

const baseProps = {
  onMenuPress: noop,
  onBackPress: noop,
  onWishlistPress: noop,
  onCartPress: noop,
  onLogoPress: noop,
  onSearchPress: noop,
  cartCount: 0,
  showSearch: true,
  showWishlist: false,
  showCartIcon: true,
  searchCollapsed: false,
  showBack: false,
  searchPlaceholders: ['Search For Dry Food'],
};

/**
 * What the search bar reads, or null when the band is not drawn.
 *
 * Found by the accessibility flags rather than by matching the text, so it
 * still works for a prompt that looks nothing like the real ones.
 */
const barLabel = (root: ReactTestInstance): string | null => {
  const node = root
    .findAllByType(Text)
    .find(candidate => candidate.props.accessibilityElementsHidden === true);
  if (!node) {
    return null;
  }
  return typeof node.props.children === 'string' ? node.props.children : '';
};

const render = (props: Partial<typeof baseProps> = {}) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<NativeHeader {...baseProps} {...props} />);
  });
  return tree;
};

/**
 * Advance the clock one frame at a time.
 *
 * One `act` per frame, deliberately: the next timeout is armed by an effect, and
 * effects only run when React commits, so a single long `advanceTimersByTime`
 * would fire the one timer that already existed and stop there.
 */
const tick = (frames: number, ms: number) => {
  for (let i = 0; i < frames; i++) {
    ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(ms);
    });
  }
};

describe('the search bar types its prompt out', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows only the phrase being typed, never a static label', () => {
    // The cycle starts with nothing typed and the first character lands one
    // frame later. There is no "Search For" resting text to fall back to.
    const tree = render();
    expect(barLabel(tree.root)).toBe('');
    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('S');
  });

  it('adds one letter per tick, at the site’s cadence', () => {
    const tree = render();

    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('S');

    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Se');

    // Keeps going rather than stopping after one letter, which is what a timer
    // armed from a stale frame would do.
    tick(4, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Search');
  });

  it('waits the full interval before each letter', () => {
    const tree = render();
    tick(1, TYPE_MS - 1);
    expect(barLabel(tree.root)).toBe('');
    tick(1, 1);
    expect(barLabel(tree.root)).toBe('S');
  });

  it('holds the finished phrase, then erases it faster than it typed', () => {
    const phrase = 'Search For Dry Food';
    const tree = render();

    // One frame per character, then one more to settle into the hold.
    tick(phrase.length + 1, TYPE_MS);
    expect(barLabel(tree.root)).toBe(phrase);

    // Still whole a millisecond short of the hold, so the hold is a real pause
    // and not a frame that happens to redraw the same text.
    tick(1, HOLD_MS - 1);
    expect(barLabel(tree.root)).toBe(phrase);

    // The hold ends on the frame that turns to erasing; the first character
    // comes off on the one after it, at the erase cadence.
    tick(1, 1);
    expect(barLabel(tree.root)).toBe(phrase);

    tick(1, ERASE_MS);
    expect(barLabel(tree.root)).toBe(phrase.slice(0, -1));
  });

  it('starts the next phrase the instant the last one is erased', () => {
    // No second of empty bar between phrases, which is what the site does and
    // what this deliberately does not.
    const tree = render({searchPlaceholders: ['ab', 'xy']});

    tick(3, TYPE_MS); // 'a', 'ab', then into the hold
    expect(barLabel(tree.root)).toBe('ab');

    tick(1, HOLD_MS); // hold ends, erasing begins
    tick(1, ERASE_MS); // 'a'
    expect(barLabel(tree.root)).toBe('a');

    tick(1, ERASE_MS); // erased, and already on the next phrase
    expect(barLabel(tree.root)).toBe('');
    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('x');
  });

  it('moves on to the next prompt and comes back to the first', () => {
    const tree = render({searchPlaceholders: ['Ab', 'Cd']});
    const seen = new Set<string>();

    // Two full cycles of two two-letter phrases, frame by frame.
    for (let i = 0; i < 40; i++) {
      tick(1, HOLD_MS);
      const label = barLabel(tree.root);
      if (label) {
        seen.add(label);
      }
    }

    expect(seen).toContain('Ab');
    expect(seen).toContain('Cd');
  });
});

describe('the typewriter costs nothing when it cannot be seen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not run while the band is collapsed', () => {
    const tree = render({searchCollapsed: true});
    tick(50, TYPE_MS);
    expect(barLabel(tree.root)).toBe('');
  });

  it('does not run when the band is not drawn at all', () => {
    const tree = render({showSearch: false});
    tick(50, TYPE_MS);
    // No band, so no label to find.
    expect(barLabel(tree.root)).toBeNull();
  });

  it('does not run before any prompt has been read', () => {
    // Only reachable if the seed list were emptied; the bar simply stays blank
    // rather than falling back to a label.
    const tree = render({searchPlaceholders: []});
    tick(50, TYPE_MS);
    expect(barLabel(tree.root)).toBe('');
  });

  it('stops when the band closes and picks up where it left off', () => {
    const tree = render();
    tick(3, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Sea');

    ReactTestRenderer.act(() => {
      tree.update(<NativeHeader {...baseProps} searchCollapsed={true} />);
    });
    tick(20, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Sea');

    ReactTestRenderer.act(() => {
      tree.update(<NativeHeader {...baseProps} searchCollapsed={false} />);
    });
    // Resumes rather than starting the phrase over.
    expect(barLabel(tree.root)).toBe('Sea');
    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Sear');
  });

  it('does not restart mid-word when the prompt list is unchanged', () => {
    // The reader posts a message per phrase, and mergePlaceholders returns the
    // same array when nothing is new. If it did not, this effect would re-run
    // and the phrase would start again from "S".
    const tree = render();
    tick(4, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Sear');

    ReactTestRenderer.act(() => {
      tree.update(<NativeHeader {...baseProps} cartCount={3} />);
    });
    expect(barLabel(tree.root)).toBe('Sear');
    tick(1, TYPE_MS);
    expect(barLabel(tree.root)).toBe('Searc');
  });
});

describe('the prompt is not announced letter by letter', () => {
  it('hides the animating label from assistive tech', () => {
    // The button carries its own label; a screen reader reading a half-typed
    // prompt is noise.
    const tree = render();
    const label = tree.root
      .findAllByType(Text)
      .find(node => node.props.accessibilityElementsHidden === true);
    expect(label).toBeDefined();
    expect(label?.props.importantForAccessibility).toBe('no');
    expect(label?.props.numberOfLines).toBe(1);
  });
});
