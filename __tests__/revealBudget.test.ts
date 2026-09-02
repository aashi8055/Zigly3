/**
 * The reveal budget.
 *
 * Every gate in this app that decides *when a page may be shown* is a race
 * between two clocks: the page saying "I am ready" and the app saying "I have
 * waited long enough". The whole design depends on the first one winning. When
 * the app's deadline fires first, the reveal happens at the exact moment nobody
 * has said the page is ready -- and what the customer gets is the half-built
 * mobile website, which is the one thing this app exists not to show.
 *
 * That has now been got wrong three separate times, in three different files,
 * each time by changing one number without looking at the one it races:
 *
 *   1. INNER_TRIES 24 (3.6s) against PAGE_COVER_CAP_MS 3000. Recorded in
 *      ../src/webview/readySignal and ../src/components/PageCover.
 *   2. INNER_TRIES then cut to 16 (2.4s) to get under that cap -- which fixed the
 *      ordering and left listings answering before their grid could arrive.
 *   3. HOME_TRIES 66 (9.9s) against SPLASH_READY_GRACE_MS 2500. The same
 *      inversion as (1), on the dashboard, surviving every fix made for inner
 *      pages.
 *
 * The individual files each carry the reasoning. What was missing was one place
 * that reads all the numbers together, so that the *relationship* between them is
 * a test rather than a comment. This is that place.
 *
 * The constants inside the injected scripts are not exported -- they are compiled
 * into a template literal -- so they are read back out of the script text. That is
 * deliberate: it tests the number that actually ships, not a copy of it.
 */
import {
  HOME_COVER_MAX_MS,
  SPLASH_MAX_MS,
  SPLASH_MIN_MS,
  SPLASH_READY_GRACE_MS,
} from '../src/constants/appConstants';
import {PAGE_COVER_CAP_MS} from '../src/components/PageCover';
import {PAINT_GATE_MAX_MS} from '../src/webview/headerBridge';
import {READY_SIGNAL_SCRIPT} from '../src/webview/readySignal';

/**
 * The poll interval and the try-counts, read out of the shipped script.
 *
 * The watcher is a `setInterval` of TICK_MS that counts tries against a cap, so
 * "how long does the dashboard get" is a multiplication, and it is the product
 * that has to be compared against the app's deadlines.
 */
const numbers = (): {
  tick: number;
  home: number;
  inner: number;
  homeStop: number;
  innerStop: number;
} => {
  const tick = READY_SIGNAL_SCRIPT.match(/}, (\d+)\);/);
  const caps = READY_SIGNAL_SCRIPT.match(
    /var cap = home \? (\d+) : (\d+);/,
  );
  const stops = READY_SIGNAL_SCRIPT.match(
    /var stop = home \? (\d+) : (\d+);/,
  );
  if (!tick || !caps || !stops) {
    throw new Error(
      'the ready watcher no longer states its interval, caps and stops in the ' +
        'shape this test reads; update the patterns here rather than deleting ' +
        'the test',
    );
  }
  return {
    tick: Number(tick[1]),
    home: Number(caps[1]),
    inner: Number(caps[2]),
    homeStop: Number(stops[1]),
    innerStop: Number(stops[2]),
  };
};

const HOME_MS = () => numbers().home * numbers().tick;
const INNER_MS = () => numbers().inner * numbers().tick;
const HOME_STOP_MS = () => numbers().homeStop * numbers().tick;

describe('the numbers are readable at all', () => {
  it('finds an interval and both caps in the shipped script', () => {
    const {tick, home, inner} = numbers();
    expect(tick).toBeGreaterThan(0);
    expect(home).toBeGreaterThan(0);
    expect(inner).toBeGreaterThan(0);
    // A sanity floor: a watcher that polls once a second would make every
    // comparison below meaningless.
    expect(tick).toBeLessThanOrEqual(250);
  });
});

describe('the dashboard answers before the splash gives up', () => {
  it('leaves the home watcher room inside the splash grace', () => {
    /*
     * The bug this is here for. The grace was 2500ms and the watcher was allowed
     * 9900ms, so the splash came down over a dashboard that was still assembling
     * on every launch slower than two and a half seconds.
     */
    expect(HOME_MS()).toBeLessThan(SPLASH_READY_GRACE_MS);
  });

  it('leaves enough margin for the answer to cross the bridge', () => {
    // The signal is a postMessage the app then acts on. A deadline that is only
    // a tick away from the answer is not an ordering, it is a coin toss.
    expect(SPLASH_READY_GRACE_MS - HOME_MS()).toBeGreaterThanOrEqual(400);
  });

  it('keeps the grace period below the hard cap it backs up', () => {
    // Otherwise the grace can never fire and the failsafe is the 7s cap, which
    // is a much worse experience for a signal that was only a little late.
    expect(SPLASH_READY_GRACE_MS).toBeLessThan(SPLASH_MAX_MS);
  });
});

describe('an inner page answers before its cover gives up', () => {
  it('leaves the page watcher room inside the cover cap', () => {
    expect(INNER_MS()).toBeLessThan(PAGE_COVER_CAP_MS);
  });

  it('leaves the same margin the original arrangement had', () => {
    expect(PAGE_COVER_CAP_MS - INNER_MS()).toBeGreaterThanOrEqual(400);
  });

  it('gives a listing long enough to be more than an empty column', () => {
    /*
     * Past its deadline the watcher reports ready for any page that is merely
     * STYLED, grid or no grid -- so this number is also the deadline at which a
     * collection may be revealed as the site's own empty column. At 2.4s that was
     * routinely too early on a slow connection.
     *
     * Not a precise threshold, and it is not pretending to be: it is a floor that
     * fails if anyone cuts this number again without reading the paragraph above.
     */
    expect(INNER_MS()).toBeGreaterThanOrEqual(3000);
  });

  it('gives up before the app does, unstyled included', () => {
    // The hard stop only exists so a page nobody is waiting for stops polling;
    // it must therefore sit past the cover cap, not before it.
    const stop = READY_SIGNAL_SCRIPT.match(/var stop = home \? \d+ : (\d+);/);
    expect(stop).not.toBeNull();
    expect(Number(stop![1]) * numbers().tick).toBeGreaterThan(PAGE_COVER_CAP_MS);
  });
});

describe('the document-level gate sits inside the native one', () => {
  it('lifts before the cover it is underneath', () => {
    // Already asserted in paintGate.test.ts; repeated here so this file is a
    // complete statement of the budget rather than most of one.
    expect(PAINT_GATE_MAX_MS).toBeLessThan(PAGE_COVER_CAP_MS);
  });
});

describe('the dashboard never volunteers an unstyled reveal', () => {
  /*
   * The bug this is here for, and it is the dashboard's copy of the one
   * INNER_MAX_TRIES already prevents on every other page.
   *
   * The watcher's loop reports ready when `done || (tries > cap && styled()) ||
   * tries > stop`. Only the middle branch is guarded by `styled()`; the third
   * fires whatever the page looks like. `stop` for home used to BE HOME_TRIES,
   * so the guarded branch and the unguarded one came due on the very same tick
   * -- which means the guard could never actually hold anything back. Any
   * dashboard still assembling at 5.4s announced itself ready while it was
   * still the unstyled mobile website, and `dashboard-ready` retires the splash
   * and clears the dashboard's cover at once. That is the raw site on screen,
   * which is the single thing this whole budget exists to prevent.
   */
  it('gives home a hard stop later than the cap it guards', () => {
    expect(HOME_STOP_MS()).toBeGreaterThan(HOME_MS());
  });

  it('leaves the give-up case to the app cover, not to the page', () => {
    /*
     * The property that actually matters. Past its hard stop the page reveals
     * itself unstyled, so that moment must land AFTER the app's own cover has
     * already lifted on its own clock -- exactly the arrangement inner pages
     * have against PAGE_COVER_CAP_MS.
     */
    expect(HOME_STOP_MS()).toBeGreaterThan(HOME_COVER_MAX_MS);
  });

  it('holds the same line for inner pages', () => {
    // Stated here too so this file is the whole rule, not half of it.
    expect(numbers().innerStop * numbers().tick).toBeGreaterThan(
      PAGE_COVER_CAP_MS,
    );
  });
});

describe('the dashboard cover outlasts the splash it stands behind', () => {
  it('gives up only after the splash has exhausted its own failsafe', () => {
    /*
     * The bug this is here for. The splash's own failsafe (grace, then the
     * hard cap) is a guess standing in for `dashboard-ready`, and it can fire
     * before that signal does on a slow network. If the dashboard's cover gave
     * up on the same clock, or an earlier one, the splash would dissolve into
     * a cover that was already gone -- handing the customer the half-built
     * mobile website, which is the exact failure this cover exists to hide.
     */
    expect(HOME_COVER_MAX_MS).toBeGreaterThan(SPLASH_MAX_MS);
  });

  it('leaves enough margin that this is an ordering, not a coin toss', () => {
    expect(HOME_COVER_MAX_MS - SPLASH_MAX_MS).toBeGreaterThanOrEqual(1000);
  });
});

describe('the whole budget, in order', () => {
  it('reads low to high with no inversions', () => {
    /*
     * One assertion for the shape of the thing. If this fails and none of the
     * tests above do, a NEW number has been added out of order.
     */
    const ladder = [
      ['splash floor', SPLASH_MIN_MS],
      ['paint gate self-lift', PAINT_GATE_MAX_MS],
      ['inner page answers', INNER_MS()],
      ['cover cap', PAGE_COVER_CAP_MS],
      ['dashboard answers', HOME_MS()],
      ['splash grace', SPLASH_READY_GRACE_MS],
      ['splash hard cap', SPLASH_MAX_MS],
      ['dashboard cover hard cap', HOME_COVER_MAX_MS],
      ['dashboard watcher hard stop', HOME_STOP_MS()],
    ] as const;

    const values = ladder.map(([, ms]) => ms);
    const sorted = [...values].sort((a, b) => a - b);
    expect(ladder.map(([name]) => name)).toEqual(
      sorted.map(ms => ladder.find(([, v]) => v === ms)![0]),
    );
  });
});
