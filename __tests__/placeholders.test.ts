/**
 * The rotating search placeholder.
 *
 * Two things are being defended. First the cycle itself: it is the one piece of
 * this app that has to match a timing the customer can hold against the website
 * side by side, so the phases and their durations are asserted against
 * SearchTap's own figures rather than against whatever the code happens to do.
 * Second the boundary: the phrases arrive over a string bridge from a page we do
 * not control, so a non-string, an empty attribute or a paragraph of markup must
 * be dropped rather than drawn into the header.
 */
import {
  ERASE_MS,
  FIRST_FRAME,
  HOLD_MS,
  MAX_PLACEHOLDERS,
  PAUSE_MS,
  SEED_PLACEHOLDERS,
  TYPE_MS,
  acceptInterval,
  cleanPlaceholder,
  frameDelay,
  frameText,
  mergePlaceholders,
  nextFrame,
  type TypeFrame,
} from '../src/search/placeholders';
import {REPORT_SEARCH_PLACEHOLDERS} from '../src/webview/searchBridge';

/** Run the cycle and record what the field reads on every frame. */
const run = (phrases: string[], frames: number) => {
  const seen: {text: string; delay: number; phase: string}[] = [];
  let frame: TypeFrame = FIRST_FRAME;
  for (let i = 0; i < frames; i++) {
    seen.push({
      text: frameText(frame, phrases),
      delay: frameDelay(frame, TYPE_MS),
      phase: frame.phase,
    });
    frame = nextFrame(frame, phrases);
  }
  return seen;
};

describe("the typewriter follows SearchTap's own cycle", () => {
  const one = ['abc'];

  it('types one character per frame', () => {
    const texts = run(one, 4).map(f => f.text);
    expect(texts).toEqual(['', 'a', 'ab', 'abc']);
  });

  it('holds the whole phrase, erases it, then pauses on empty', () => {
    const phases = run(one, 10).map(f => f.phase);
    expect(phases).toEqual([
      'typing',
      'typing',
      'typing',
      'typing',
      'holding',
      'erasing',
      'erasing',
      'erasing',
      'erasing',
      'pausing',
    ]);
  });

  it('erases back to empty before moving on', () => {
    const texts = run(one, 10).map(f => f.text);
    // The tail of the cycle walks the phrase back down to nothing.
    expect(texts.slice(5)).toEqual(['abc', 'ab', 'a', '', '']);
  });

  it("uses the site's four durations, one per phase", () => {
    const byPhase = (phase: string) =>
      run(one, 10).find(f => f.phase === phase)?.delay;
    expect(byPhase('typing')).toBe(TYPE_MS);
    expect(byPhase('holding')).toBe(HOLD_MS);
    expect(byPhase('erasing')).toBe(ERASE_MS);
    expect(byPhase('pausing')).toBe(PAUSE_MS);
    // Erasing is faster than typing, as it is on the site. A cycle where they
    // matched would look like the app chose its own speed.
    expect(ERASE_MS).toBeLessThan(TYPE_MS);
  });

  it('measures the cadence rather than choosing it', () => {
    // The reader can only measure the per-letter gap; the holds are not
    // something a customer can time against the website.
    expect(frameDelay({phrase: 0, chars: 1, phase: 'typing'}, 137)).toBe(137);
    expect(frameDelay({phrase: 0, chars: 3, phase: 'holding'}, 137)).toBe(
      HOLD_MS,
    );
  });

  it('moves to the next phrase and wraps at the end', () => {
    const two = ['ab', 'cd'];
    const texts = run(two, 20).map(f => f.text);
    // First phrase typed and erased, then the second, then back to the first.
    expect(texts).toContain('ab');
    expect(texts).toContain('cd');
    expect(texts.lastIndexOf('cd')).toBeGreaterThan(texts.indexOf('ab'));
    // Twenty frames is more than two full cycles of two two-letter phrases,
    // so the first phrase must have come round again.
    expect(texts.lastIndexOf('a')).toBeGreaterThan(texts.indexOf('cd'));
  });
});

describe('the typewriter survives a list that changes under it', () => {
  it('does not strand itself when the list shrinks', () => {
    // The reader keeps bringing phrases back while the animation is running,
    // so the list the cycle wraps against is not the list it started on. An
    // index left over from a longer list must still read, and must come back
    // into range once the cycle turns over.
    const late: TypeFrame = {phrase: 3, chars: 2, phase: 'typing'};
    expect(frameText(late, ['ab'])).toBe('ab');

    let frame = late;
    for (let i = 0; i < 12; i++) {
      frame = nextFrame(frame, ['ab']);
      expect(frameText(frame, ['ab'])).toBe('ab'.slice(0, frame.chars));
    }
    expect(frame.phrase).toBe(0);
  });

  it('returns to the start of the cycle on an empty list', () => {
    expect(frameText(FIRST_FRAME, [])).toBe('');
    expect(nextFrame({phrase: 2, chars: 5, phase: 'erasing'}, [])).toEqual(
      FIRST_FRAME,
    );
  });

  it('never reads past the end of a phrase', () => {
    // A frame carried over from a longer phrase must clip, not throw.
    expect(frameText({phrase: 0, chars: 99, phase: 'holding'}, ['ab'])).toBe(
      'ab',
    );
  });
});

describe('phrases from the page are checked, not trusted', () => {
  it('accepts a real prompt', () => {
    expect(cleanPlaceholder('Search For Dry Food')).toBe('Search For Dry Food');
  });

  it('collapses the whitespace a template left behind', () => {
    expect(cleanPlaceholder('  Search   For\n Dry Food ')).toBe(
      'Search For Dry Food',
    );
  });

  it('drops what is not a string', () => {
    expect(cleanPlaceholder(null)).toBeNull();
    expect(cleanPlaceholder(42)).toBeNull();
    expect(cleanPlaceholder({text: 'Search'})).toBeNull();
  });

  it('drops a label too short to be a prompt and a paragraph too long', () => {
    expect(cleanPlaceholder('Go')).toBeNull();
    expect(cleanPlaceholder('x'.repeat(200))).toBeNull();
  });
});

describe('the list grows towards what the site is showing', () => {
  it('folds new phrases in after the ones already on screen', () => {
    const merged = mergePlaceholders(['Search For Dry Food'], [
      'Search For Grooming Tools',
    ]);
    expect(merged).toEqual([
      'Search For Dry Food',
      'Search For Grooming Tools',
    ]);
  });

  it('folds duplicates regardless of case', () => {
    const merged = mergePlaceholders(['Search For Cat Food'], [
      'search for cat food',
    ]);
    expect(merged).toEqual(['Search For Cat Food']);
  });

  it('returns the same array when nothing new arrived', () => {
    // Identity matters: a new array on every message would re-run the header's
    // animation effect and restart the phrase mid-word.
    const existing = ['Search For Dry Food'];
    expect(mergePlaceholders(existing, ['Search For Dry Food'])).toBe(existing);
    expect(mergePlaceholders(existing, 'not an array')).toBe(existing);
    expect(mergePlaceholders(existing, null)).toBe(existing);
  });

  it('stops growing at the cap', () => {
    const many = Array.from({length: 40}, (_, i) => `Search For Item ${i}`);
    expect(mergePlaceholders([], many)).toHaveLength(MAX_PLACEHOLDERS);
  });

  it('starts from Zigly copy, not from a blank bar', () => {
    expect(SEED_PLACEHOLDERS.length).toBeGreaterThan(0);
    // Three of these are verbatim from the site's own bundle.
    expect(SEED_PLACEHOLDERS).toContain('Search For Dry Food');
    expect(SEED_PLACEHOLDERS).toContain('Search For Oral & Dental Care');
    expect(SEED_PLACEHOLDERS).toContain('Search For Grooming Tools');
    for (const seed of SEED_PLACEHOLDERS) {
      expect(cleanPlaceholder(seed)).toBe(seed);
    }
  });
});

describe('a measured cadence is accepted only if it is plausible', () => {
  it('takes a figure in range', () => {
    expect(acceptInterval(100, TYPE_MS)).toBe(100);
    expect(acceptInterval(83.4, TYPE_MS)).toBe(83);
  });

  it('ignores a figure that cannot be a keystroke gap', () => {
    // A page backgrounded mid-phrase reports nonsense. Ignored rather than
    // clamped: a clamped figure is a speed the site does not actually use.
    expect(acceptInterval(4, TYPE_MS)).toBe(TYPE_MS);
    expect(acceptInterval(30000, TYPE_MS)).toBe(TYPE_MS);
    expect(acceptInterval(null, TYPE_MS)).toBe(TYPE_MS);
    expect(acceptInterval(NaN, TYPE_MS)).toBe(TYPE_MS);
    expect(acceptInterval(Infinity, TYPE_MS)).toBe(TYPE_MS);
  });
});

describe('the reader watches the site rather than asking it', () => {
  const script = REPORT_SEARCH_PLACEHOLDERS;

  // The payload parsing is checked in injection-syntax.test.ts, which covers
  // every injected script in one place -- a mangled escape there is silent.

  it('observes the one attribute SearchTap animates', () => {
    expect(script).toContain('MutationObserver');
    expect(script).toContain("attributeFilter: ['placeholder']");
    expect(script).toContain('.st-search-bar input');
  });

  it('does not patch or call anything of the site’s', () => {
    // Same rule as everywhere else in this app: read the page, never rewire it.
    expect(script).not.toContain('dynamicPlaceholder');
    expect(script).not.toContain('window.fetch =');
    expect(script).not.toContain('.click()');
    expect(script).not.toContain('setAttribute(\'placeholder\'');
  });

  it('reports a phrase only once it has stopped growing', () => {
    // SearchTap types up to the full string then erases, so the longest value
    // seen before the first shrink is the phrase.
    expect(script).toContain('now.length > prev.length');
    expect(script).toContain('now.length < prev.length');
    expect(script).toContain('longest');
  });

  it('stops looking rather than polling forever', () => {
    // An observer left waiting for an element that is not coming is a leak.
    expect(script).toContain('clearInterval(poll)');
  });

  it('writes no phrase of its own', () => {
    expect(script).not.toContain('Search For');
  });
});
