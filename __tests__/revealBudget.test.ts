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
const numbers = (): {tick: number; home: number; inner: number} => {
  const tick = READY_SIGNAL_SCRIPT.match(/}, (\d+)\);/);
  const caps = READY_SIGNAL_SCRIPT.match(
    /var cap = home \? (\d+) : (\d+);/,
  );
  if (!tick || !caps) {
    throw new Error(
      'the ready watcher no longer states its interval and caps in the shape ' +
        'this test reads; update the patterns here rather than deleting the test',
    );
  }
  return {
    tick: Number(tick[1]),
    home: Number(caps[1]),
    inner: Number(caps[2]),
  };
};

const HOME_MS = () => numbers().home * numbers().tick;
const INNER_MS = () => numbers().inner * numbers().tick;

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
    ] as const;

    const values = ladder.map(([, ms]) => ms);
    const sorted = [...values].sort((a, b) => a - b);
    expect(ladder.map(([name]) => name)).toEqual(
      sorted.map(ms => ladder.find(([, v]) => v === ms)![0]),
    );
  });
});
