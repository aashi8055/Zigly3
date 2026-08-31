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

  it('holds the whole phrase, then erases it', () => {
    const phases = run(one, 9).map(f => f.phase);
    expect(phases).toEqual([
      'typing',
      'typing',
      'typing',
      'typing',
      'holding',
      'erasing',
      'erasing',
      'erasing',
      'typing',
    ]);
  });

  it('never rests on an empty bar', () => {
    // A phrase necessarily starts at nought characters, so an empty frame
    // exists -- but it is the first frame of the next phrase, and it lasts one
    // keystroke. The site instead holds an empty field for a full second, which
    // with no resting label would read as a bar that had lost its text.
    const frames = run(['ab', 'cd'], 24);
    const blanks = frames.filter(f => f.text === '');
    expect(blanks.length).toBeGreaterThan(0);
    for (const blank of blanks) {
      expect(blank.phase).toBe('typing');
      expect(blank.delay).toBe(TYPE_MS);
    }
    // And no frame anywhere waits longer than the hold on a finished phrase.
    for (const frame of frames) {
      expect(frame.delay).toBeLessThanOrEqual(HOLD_MS);
      if (frame.delay === HOLD_MS) {
        expect(frame.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('erases down to one character, then starts the next phrase', () => {
    const texts = run(one, 9).map(f => f.text);
    expect(texts.slice(4)).toEqual(['abc', 'abc', 'ab', 'a', '']);
    // That last '' is the first frame of the NEXT phrase, not a pause.
    expect(run(one, 9)[8].phase).toBe('typing');
  });

  it("uses the site's three durations, one per phase", () => {
    const byPhase = (phase: string) =>
      run(one, 9).find(f => f.phase === phase)?.delay;
    expect(byPhase('typing')).toBe(TYPE_MS);
    expect(byPhase('holding')).toBe(HOLD_MS);
    expect(byPhase('erasing')).toBe(ERASE_MS);
    // Erasing is faster than typing, as it is on the site. A cycle where they
    // matched would look like the app chose its own speed.
    expect(ERASE_MS).toBeLessThan(TYPE_MS);
  });

  it('measures the cadence rather than choosing it', () => {
    // The reader can only measure the per-letter gap; the hold is not something
    // a customer can time against the website.
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

  it('wraps to the first phrase off the end of the list', () => {
    // The hand-off happens on the last erased character, so this is where the
    // wrap lives now rather than in a pause frame.
    expect(nextFrame({phrase: 1, chars: 1, phase: 'erasing'}, ['ab', 'cd'])).toEqual(
      {phrase: 0, chars: 0, phase: 'typing'},
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

describe('the list is exactly the seeds -- nothing less, nothing more', () => {
  /*
   * The reader used to grow this list as it read the site's own search box, and
   * that is what this block now asserts is gone. The phrases arrived one per
   * rotation tick over several seconds, so the bar changed length and content
   * while the customer was looking at it, and what it settled on depended on
   * how long they happened to stay -- so what the header cycles is now fixed.
   *
   * The bridge still SENDS these messages, because it is also what measures the
   * typing cadence. So the assertion that matters is that an incoming phrase
   * changes nothing, not that no message arrives.
   */
  it('ignores a phrase the site was seen typing', () => {
    const seeds = [...SEED_PLACEHOLDERS];
    expect(mergePlaceholders(seeds, ['Search For Something New'])).toEqual(
      SEED_PLACEHOLDERS,
    );
  });

  it('cannot be grown past the seeds by any number of messages', () => {
    const many = Array.from({length: 40}, (_, i) => `Search For Item ${i}`);
    expect(mergePlaceholders(SEED_PLACEHOLDERS, many)).toHaveLength(
      SEED_PLACEHOLDERS.length,
    );
    // Well under the old cap, which is what stops this reading as "the cap
    // still works" when the cap is no longer what holds the list down.
    expect(SEED_PLACEHOLDERS.length).toBeLessThan(MAX_PLACEHOLDERS);
  });

  it('cannot be emptied or replaced by a message either', () => {
    // A bar with no prompt is the failure the seeds exist to prevent.
    expect(mergePlaceholders(SEED_PLACEHOLDERS, [])).toEqual(SEED_PLACEHOLDERS);
    expect(mergePlaceholders(SEED_PLACEHOLDERS, ['Only This'])).toEqual(
      SEED_PLACEHOLDERS,
    );
  });

  it('returns the same array, whatever arrives', () => {
    // Identity matters: a new array on every message would re-run the header's
    // animation effect and restart the phrase mid-word. The bridge is still
    // sending one message per phrase, so this is load-bearing, not incidental.
    const existing = ['Search For Dry Food'];
    expect(mergePlaceholders(existing, ['Search For Grooming Tools'])).toBe(
      existing,
    );
    expect(mergePlaceholders(existing, ['Search For Dry Food'])).toBe(existing);
    expect(mergePlaceholders(existing, 'not an array')).toBe(existing);
    expect(mergePlaceholders(existing, null)).toBe(existing);
  });

  it("is exactly the four seeds, in Zigly's own observed order", () => {
    expect(SEED_PLACEHOLDERS).toEqual([
      'Search For Applod Dog Biscuits',
      'Search For Dry Food',
      'Search For Oral & Dental Care',
      'Search For Grooming Tools',
    ]);
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
  it('takes a figure in range, and replays it faster than the site', () => {
    // The range check is on the MEASUREMENT -- is this a keystroke gap at all
    // -- and the app then chooses how fast to replay it. The two are separate
    // decisions, which is why an in-range figure does not come back unchanged:
    // the site's own ~100ms lands as 70ms, the same scaling TYPE_MS carries.
    // Without this the reader's first report would undo the faster typing on
    // every page load, which is the bug the scaling is here to prevent.
    expect(acceptInterval(100, TYPE_MS)).toBe(70);
    expect(acceptInterval(83.4, TYPE_MS)).toBe(58);
  });

  it('never scales a slow measurement below the floor', () => {
    // 40ms is the fastest gap this accepts as real. A measurement AT the floor
    // must not be scaled under it -- that would be the app inventing a cadence
    // outside the range it just checked against.
    expect(acceptInterval(40, TYPE_MS)).toBe(40);
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
