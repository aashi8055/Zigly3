/**
 * How far the search band has been carried off by the page's scroll.
 *
 * The band is not sticky. It belongs to the page's content, so scrolling down
 * moves it off the top edge at the rate everything else on the page moves, and
 * scrolling up draws it back down from that edge -- rather than the band
 * flipping between "there" and "gone" once a threshold is crossed, which is
 * what made it read as jumping into place.
 *
 * The arithmetic lives here, apart from the screen, because it is the part with
 * the interesting cases -- a reversal mid-gesture, a page change reporting its
 * scroll against the previous document's, an overscroll bounce past the top --
 * and none of those are reachable through a 3,700-line WebView screen.
 */

/**
 * The band's height, and so the full distance it can travel.
 *
 * Mirrored from NativeHeader's own SEARCH_BAND_H rather than imported: the
 * header owns the band's layout, this owns the distance. header.test.tsx holds
 * the two to each other.
 */
export const SEARCH_BAND_H = 64;

/**
 * How much faster the band comes back than it leaves.
 *
 * Pulling it back at exactly the scroll's rate would mean a long scroll down
 * has to be fully undone before search is reachable again. At this rate a short
 * flick up is enough -- which is what "reveal on scroll up" is asking for --
 * while the reveal is still proportional to the gesture, so the band is drawn
 * down from the edge rather than snapped into place.
 */
export const REVEAL_RATE = 2.5;

/**
 * Past this, a scroll event is a page change rather than a finger.
 *
 * A fresh document reports its scroll position against the previous one's, and
 * that difference is not travel: read as one it would park the band off screen
 * on a page that is sitting at the top.
 */
export const MAX_SCROLL_DELTA = 200;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * The band's new offset, given where the page was and where it now is.
 *
 * Returns `travel` unchanged when the event carries no gesture, so the caller
 * can skip the write.
 */
export const nextTravel = (
  travel: number,
  previousY: number,
  y: number,
): number => {
  const delta = y - previousY;

  // A page change, not a finger; see MAX_SCROLL_DELTA.
  if (Math.abs(delta) > MAX_SCROLL_DELTA) {
    return travel;
  }

  /*
   * The top of the page always shows the band whole. Without this an
   * overscroll bounce, or a programmatic scrollTo(0), could leave it parked
   * off screen with the page already at the top and no further scrolling up
   * available to bring it back.
   */
  if (y <= 0) {
    return 0;
  }

  return clamp(
    travel + (delta > 0 ? delta : delta * REVEAL_RATE),
    0,
    SEARCH_BAND_H,
  );
};

/**
 * Whether the band should be treated as settled-off at this offset.
 *
 * Separate from the offset because it is what hands the band's *layout* height
 * back, and that may only change when the band is genuinely all the way off --
 * a relayout part-way through a scroll is the Android WebView resize the
 * header's height snap exists to avoid. Hysteresis of a pixel at the closed
 * end keeps a rounding error mid-gesture from toggling it.
 */
export const isSettledOff = (collapsed: boolean, travel: number): boolean => {
  if (!collapsed && travel >= SEARCH_BAND_H) {
    return true;
  }
  if (collapsed && travel <= SEARCH_BAND_H - 1) {
    return false;
  }
  return collapsed;
};
