/**
 * The search band's travel.
 *
 * The band is content, not furniture: it leaves with the page on the way down
 * and is drawn back from the top edge on the way up. What is defended here is
 * that it is genuinely *carried* -- every position in between, following the
 * finger -- rather than switched between two states, which is the behaviour
 * this replaced and which read as jumping into place.
 */
import {
  isSettledOff,
  MAX_SCROLL_DELTA,
  nextTravel,
  REVEAL_RATE,
  SEARCH_BAND_H,
} from '../src/search/bandTravel';

/** Walks a list of scroll positions through the reducer, as the screen does. */
const scrollThrough = (ys: number[], from = 0) => {
  let travel = from;
  let previous = ys[0];
  const seen: number[] = [];
  for (const y of ys.slice(1)) {
    travel = nextTravel(travel, previous, y);
    previous = y;
    seen.push(travel);
  }
  return seen;
};

describe('scrolling down carries the band off with the content', () => {
  it('moves it at the same rate as the page, not on a threshold', () => {
    // 1:1 with the scroll -- the band is part of what is scrolling.
    expect(scrollThrough([0, 10, 20, 30])).toEqual([10, 20, 30]);
  });

  it('reaches fully off exactly at its own height', () => {
    expect(nextTravel(0, 0, SEARCH_BAND_H)).toBe(SEARCH_BAND_H);
  });

  it('stops there rather than continuing off into the page', () => {
    // Nothing left to give. Without the clamp a long scroll would build up an
    // offset that the whole of it had to be undone to spend. Stepped in
    // finger-sized deltas, since a single 500px jump is a page change rather
    // than a scroll -- see MAX_SCROLL_DELTA below.
    expect(scrollThrough([0, 100, 200, 300, 400])).toEqual([
      SEARCH_BAND_H,
      SEARCH_BAND_H,
      SEARCH_BAND_H,
      SEARCH_BAND_H,
    ]);
  });
});

describe('scrolling up reveals it from the top edge', () => {
  it('starts revealing on the first upward frame, not at a threshold', () => {
    // The whole point: the reveal begins the moment the finger reverses,
    // part-way down the page, rather than waiting to be near the top.
    const travel = nextTravel(SEARCH_BAND_H, 900, 890);
    expect(travel).toBeLessThan(SEARCH_BAND_H);
    expect(travel).toBeGreaterThan(0);
  });

  it('comes back faster than it left, but still proportionally', () => {
    // Faster, so a flick is enough; proportional, so it is drawn down rather
    // than snapped.
    expect(nextTravel(SEARCH_BAND_H, 900, 890)).toBe(
      SEARCH_BAND_H - 10 * REVEAL_RATE,
    );
  });

  it('is fully back after a flick, without undoing the whole scroll', () => {
    const seen = scrollThrough([900, 880, 860, 840], SEARCH_BAND_H);
    expect(seen[seen.length - 1]).toBe(0);
  });

  it('stops at fully-shown rather than pushing the band below the bar', () => {
    // A negative offset would translate the band DOWN, away from the bar,
    // leaving a gap under it.
    expect(scrollThrough([900, 800, 700], SEARCH_BAND_H)).toEqual([0, 0]);
  });
});

describe('reversing mid-gesture', () => {
  it('picks up from where the band actually is, both ways', () => {
    // Down to half off...
    let travel = nextTravel(0, 0, 32);
    expect(travel).toBe(32);
    // ...up a little, revealing from there...
    travel = nextTravel(travel, 32, 28);
    expect(travel).toBe(32 - 4 * REVEAL_RATE);
    // ...and straight back down again, from wherever that left it.
    expect(nextTravel(travel, 28, 38)).toBe(32 - 4 * REVEAL_RATE + 10);
  });
});

describe('what is not a gesture', () => {
  it('ignores the jump a new document reports', () => {
    // A fresh page reports its scroll against the previous one's. Read as
    // travel, that difference would park the band off screen on a page
    // sitting at the top.
    expect(nextTravel(0, 0, MAX_SCROLL_DELTA + 1)).toBe(0);
    expect(nextTravel(SEARCH_BAND_H, 2000, 0)).toBe(SEARCH_BAND_H);
  });

  it('shows the band whole whenever the page is at the top', () => {
    // Covers the overscroll bounce and a programmatic scrollTo(0), neither of
    // which leaves an upward delta big enough to pull the band back on its
    // own.
    expect(nextTravel(SEARCH_BAND_H, 5, 0)).toBe(0);
    expect(nextTravel(SEARCH_BAND_H, 5, -30)).toBe(0);
  });
});

describe('the settled state, which is what gives the height back', () => {
  it('only closes once the band is genuinely all the way off', () => {
    // It may not flip part-way: that hands the band's layout height back
    // mid-scroll, which is an Android WebView resize during a gesture.
    expect(isSettledOff(false, SEARCH_BAND_H - 1)).toBe(false);
    expect(isSettledOff(false, SEARCH_BAND_H)).toBe(true);
  });

  it('opens again as soon as the band starts coming back', () => {
    // The height has to return before the reveal, or the first frames of it
    // would be clipped to a band with no room.
    expect(isSettledOff(true, SEARCH_BAND_H)).toBe(true);
    expect(isSettledOff(true, SEARCH_BAND_H - 1)).toBe(false);
  });

  it('does not flicker while the band sits at the closed end', () => {
    // A finger resting at the bottom of a page must not toggle it.
    let collapsed = false;
    for (const travel of [SEARCH_BAND_H, SEARCH_BAND_H, SEARCH_BAND_H]) {
      collapsed = isSettledOff(collapsed, travel);
    }
    expect(collapsed).toBe(true);
  });
});
