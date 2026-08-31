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
import {Animated, StyleSheet, Text} from 'react-native';
import NativeHeader from '../src/components/NativeHeader';
import {ERASE_MS, HOLD_MS, TYPE_MS} from '../src/search/placeholders';
import {SEARCH_BAND_H} from '../src/webview/searchBandSection';

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

const render = (
  props: Partial<typeof baseProps> & {searchOffset?: Animated.Value} = {},
) => {
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

describe('collapsing the search band', () => {
  const src = () =>
    require('fs').readFileSync('src/components/NativeHeader.tsx', 'utf8');

  it('still gives its height back in one step, never interpolated', () => {
    /*
     * This one has a visible failure mode, so it is pinned.
     *
     * Everything below the header is the WebView, so collapsing the band grows
     * the page view by exactly the band's height, at the bottom. The original
     * bug was animating that height itself over 180ms with
     * useNativeDriver:false -- around eleven layout passes, eleven resizes of
     * an Android WebView mid-scroll, whose renderer cannot keep up: the 64px
     * it has just been given stays un-composited and paints as the app's
     * ground, a blank cream strip above the bottom bar for as long as the
     * animation runs.
     *
     * bandHeight now exists, but it is still only ever one of exactly two
     * numbers (0 or SEARCH_BAND_H), set once per toggle by plain React state
     * -- never an Animated.Value, and never on the outer `View` that owns the
     * band's real layout height. Only the Animated.View one level in, wrapping
     * content that costs nothing to animate, uses Animated at all.
     */
    const s = src();
    expect(s).toContain('setBandHeight(0)');
    expect(s).toContain('setBandHeight(SEARCH_BAND_H)');
    expect(s).toContain('style={[styles.searchBand, { height: bandHeight }]}');
    expect(s).not.toContain('height: bandOpacity');
    expect(s).not.toContain('height: bandLift');
  });

  it('animates only compositor properties, never on the JS thread', () => {
    // opacity and transform cost the WebView nothing under
    // useNativeDriver:true -- they run off the bridge entirely. Reintroducing
    // useNativeDriver:false here is exactly how the original bug came back.
    const s = src();
    const timings = s.match(/Animated\.timing\([^)]*\{[\s\S]*?\}\)/g) || [];
    expect(timings.length).toBeGreaterThan(0);
    for (const call of timings) {
      expect(call).toContain('useNativeDriver: true');
    }
    expect(s).not.toContain('useNativeDriver: false');
  });

  it('still takes its space back, rather than leaving a gap', () => {
    // A translate used INSTEAD OF the height change would leave the page
    // where it was, with a gap where the band had been -- which is the thing
    // the height was chosen for originally. bandLift only nudges the content
    // a few px during the fade; the band's own height still collapses to 0
    // once that fade finishes (see the test above), so no gap is left behind.
    const s = src();
    expect(s).toContain("pointerEvents={searchCollapsed ? 'none' : 'auto'}");
  });

  it('keeps the band mounted at zero height', () => {
    // Unmounting it would take the typewriter's state with it, and the prompt
    // would start again from the first letter every time the page scrolled.
    const tree = render({searchCollapsed: true});
    expect(barLabel(tree.root)).not.toBeNull();
  });
});

describe('the band travels with the scroll rather than toggling', () => {
  const src = () =>
    require('fs').readFileSync('src/components/NativeHeader.tsx', 'utf8');

  /** The band's inner animated view -- the one carrying the travel. */
  const bandStyle = (root: ReactTestInstance) => {
    const inner = root
      .findAllByType(Animated.View)
      .find(v => {
        const flat = StyleSheet.flatten(v.props.style) || {};
        return flat.paddingHorizontal === 14 && flat.paddingVertical === 10;
      });
    return inner ? StyleSheet.flatten(inner.props.style) : null;
  };

  /** What an interpolated Animated.Value currently resolves to. */
  const valueOf = (node: unknown): number =>
    (node as {__getValue: () => number}).__getValue();

  it('follows the offset continuously, not in two steps', () => {
    /*
     * The point of the whole change. A band that is either fully there or
     * fully gone reads as snapping into place; this one has to be at every
     * position in between, at whatever fraction of the travel the scroll has
     * reached.
     */
    const offset = new Animated.Value(0);
    const tree = render({searchOffset: offset});

    const seen: number[] = [];
    for (const y of [0, 16, 32, 48, 64]) {
      ReactTestRenderer.act(() => offset.setValue(y));
      const style = bandStyle(tree.root);
      seen.push(valueOf(style!.transform[0].translateY));
    }

    // Distinct, monotonic, and spanning the band's full height -- i.e. it is
    // being carried, not switched.
    expect(seen).toEqual([0, -16, -32, -48, -64]);
  });

  it('clamps at both ends, so overscroll cannot push it out of place', () => {
    // Past the band's height there is nothing further to give; above the top
    // of the page a negative offset would otherwise push the band DOWN, away
    // from the bar, leaving a gap under it.
    const offset = new Animated.Value(0);
    const tree = render({searchOffset: offset});

    ReactTestRenderer.act(() => offset.setValue(500));
    expect(valueOf(bandStyle(tree.root)!.transform[0].translateY)).toBe(-64);

    ReactTestRenderer.act(() => offset.setValue(-500));
    expect(valueOf(bandStyle(tree.root)!.transform[0].translateY)).toBe(0);
  });

  it('leaves rigidly, without dissolving on the way', () => {
    /*
     * The field used to fade over the first half of the travel, so that it was
     * gone before its top edge met the bar. That is furniture behaviour: a
     * section does not dissolve as it scrolls, it slides under and is clipped.
     * An opacity here at all would bring the dissolve back.
     */
    const offset = new Animated.Value(0);
    const tree = render({searchOffset: offset});

    for (const y of [0, 32, 64]) {
      ReactTestRenderer.act(() => offset.setValue(y));
      expect(bandStyle(tree.root)!.opacity).toBeUndefined();
    }
  });

  it('carries its blue background with it, at the same rate', () => {
    /*
     * The blue used to be painted on the box that owns the layout height, so
     * it stayed at full height while the field slid off under the finger and
     * then vanished in one frame when the scroll settled. Paint and field are
     * one section: they travel together or the band comes apart mid-scroll.
     */
    const offset = new Animated.Value(0);
    const tree = render({searchOffset: offset});

    const paint = tree.root
      .findAllByType(Animated.View)
      .map(v => StyleSheet.flatten(v.props.style) || {})
      .find(flat => flat.backgroundColor === '#BFD3EE');
    expect(paint).toBeTruthy();

    for (const y of [16, 40, 64]) {
      ReactTestRenderer.act(() => offset.setValue(y));
      expect(valueOf(paint!.transform[0].translateY)).toBe(
        valueOf(bandStyle(tree.root)!.transform[0].translateY),
      );
    }
  });

  it('does not run a timing against an offset the scroll is driving', () => {
    /*
     * A timing on top of a scroll-driven value is the abrupt behaviour this
     * change removes: the finger puts the band somewhere and an animation
     * immediately starts pulling it somewhere else. The timings are for the
     * fallback only -- callers that pass no offset at all.
     */
    const s = src();
    expect(s).toContain('if (!searchOffset)');
    // And the value the timings drive is never the supplied offset.
    expect(s).not.toMatch(/Animated\.timing\(\s*travel/);
    expect(s).not.toMatch(/Animated\.timing\(\s*searchOffset/);
  });

  it('still snaps its layout height, never interpolating it', () => {
    // The travel is a transform. Height is still the one-step change the
    // WebView-resize fix requires -- see the suite above.
    const s = src();
    expect(s).toContain('style={[styles.searchBand, { height: bandHeight }]}');
    const heightSets = s.match(/setBandHeight\([^)]*\)/g) || [];
    // Both ends of the snap, or the loop below would pass on an empty list.
    expect(heightSets.length).toBeGreaterThanOrEqual(2);
    for (const call of heightSets) {
      expect(call).toMatch(/setBandHeight\((0|SEARCH_BAND_H)\)/);
    }
  });

  it('lays the band out at the height the page section uses', () => {
    /*
     * The band that ships is the injected section in
     * ../src/webview/searchBandSection; this native one is what shows on a
     * page where that injection has not landed. The two are deliberately not
     * imported from one another, so this is what stops them drifting -- and a
     * drift is visible, because the same customer can see both.
     */
    const s = src();
    const declared = s.match(/const SEARCH_BAND_H = (\d+);/);
    expect(declared).not.toBeNull();
    expect(Number(declared![1])).toBe(SEARCH_BAND_H);
  });

  it('still transitions smoothly for callers that pass no offset', () => {
    // The drawer collapses the band without any scroll behind it. Those
    // callers keep the timed fallback, so it eases rather than jumping.
    const s = src();
    expect(s).toContain('const travel = searchOffset ?? fallback;');
    expect(s).toContain('Animated.timing(fallback');
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
