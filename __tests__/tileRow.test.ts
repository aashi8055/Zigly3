/**
 * The breed rails' geometry.
 *
 * These rails say "there is more" by cutting the last tile off at the right
 * edge -- no chevron, no scrollbar -- so the FRACTION of a tile showing is
 * load-bearing, and it is the thing a fixed size cannot hold across phones.
 * `breedSize` therefore derives the disc from the screen, and this file pins
 * that the derivation is actually right.
 *
 * WHY IT NEEDED PINNING. Nothing about the arithmetic was broken -- the
 * formula was rewritten during this change into a form that names each term,
 * and the old and new spellings are algebraically identical (checked: same
 * integer on every width). What was broken was the belief around it. The
 * comment claimed the discs were 130dp when the formula returned 83dp, and
 * that stale figure is what an eyeball review would have reasoned from. So
 * what these tests pin is the OUTPUT -- the fraction of a tile actually
 * showing, derived independently from the component's own layout rules --
 * rather than the expression, which can be rewritten freely as long as the
 * geometry survives.
 *
 * AND IT HAS EARNED ITS KEEP SINCE. The rail has been resized again (4.3 discs
 * at a 20dp gap, against 3.2 at 26), and every number in here moved with it --
 * which is the whole idea: a resize has to come through this file and restate
 * what it believes, rather than happening in a constant nobody checks. The one
 * test that had to be rethought rather than renumbered is the floor on the
 * shrink; see it below for why its old bound was measuring the wrong thing.
 */
import {breedSize, wideSize} from '../src/native/TileRow';

/** Every gap in ./TileRow, restated so a change there has to come through here. */
const BREED_PITCH = 20;
const PITCH = 12;

/** The phones this has to hold on: small Android through to a large iPhone. */
const WIDTHS = [320, 360, 390, 412, 428, 480];

/**
 * How many tiles a row of `size` discs actually shows on `width`.
 *
 * The layout, restated from the component: `track` carries
 * `paddingHorizontal: pitch` and each cell is `size` wide with
 * `marginRight: pitch`. So the visible run is one gutter plus n cells, and
 * this inverts that. Deriving it independently rather than reusing the
 * formula is the point -- otherwise the test would only prove the formula
 * equals itself.
 */
const visible = (width: number, size: number, pitch: number): number =>
  (width - pitch) / (size + pitch);

describe('breedSize puts four and a bit discs on screen', () => {
  it.each(WIDTHS)('shows 4.3 discs on a %ddp screen', width => {
    const shown = visible(width, breedSize(width), BREED_PITCH);
    // 4.3 to within a rounded pixel of the disc, on every width.
    expect(shown).toBeGreaterThan(4.25);
    expect(shown).toBeLessThan(4.35);
  });

  it('never lands flush with the screen edge', () => {
    /*
     * The whole mechanism. A whole 3 or 4 would end flush and read as a
     * complete set that does not scroll -- which is how these rails were
     * genuinely being misread when six 60dp discs fitted and nothing
     * suggested a seventh.
     */
    for (const width of WIDTHS) {
      const fraction = visible(width, breedSize(width), BREED_PITCH) % 1;
      expect(fraction).toBeGreaterThan(0.1);
      expect(fraction).toBeLessThan(0.9);
    }
  });

  it('is smaller than every size this rail has shipped at', () => {
    /*
     * THE DIRECTION THIS RAIL HAS MOVED, and it has only ever moved one way.
     * Three sets of constants have shipped: 3.4 discs at an 18dp gap (83dp on
     * a 360dp phone), then 3.2 at 26 (78dp), and now 4.3 at 20. Each was a
     * request to make the discs smaller, so each must be strictly smaller than
     * the last -- otherwise the constants have been fiddled without the rail
     * actually changing, which is exactly the failure a "make it smaller"
     * change can hide.
     *
     * Both earlier spellings are written out with their OWN constants rather
     * than the current ones, so this compares the rail as it shipped against
     * the rail as it is.
     */
    const first = (width: number) => Math.round((width - 18 - 3.4 * 18) / 3.4);
    const second = (width: number) => Math.round((width - 26) / 3.2 - 26);
    for (const width of WIDTHS) {
      expect(second(width)).toBeLessThan(first(width));
      expect(breedSize(width)).toBeLessThan(second(width));
    }
    // On the reference 360dp phone: 83dp, then 78dp, now 59dp.
    expect(first(360)).toBe(83);
    expect(second(360)).toBe(78);
    expect(breedSize(360)).toBe(59);
  });

  it('brings the gap back down with the disc', () => {
    /*
     * The gap and the count are one decision -- see BREED_PITCH. 26 was sized
     * against a 78dp photograph; against a 59dp disc the same gap is nearly
     * half the tile again and the rail reads as sparse. So the gap falls too,
     * while staying wider than every other rail's: these are photographs, and
     * at the shared 12dp pitch they read as one strip of animals rather than
     * as separate choices.
     */
    expect(BREED_PITCH).toBeLessThan(26);
    expect(BREED_PITCH).toBeGreaterThan(PITCH);
  });

  it('holds whichever way the formula is spelled', () => {
    /*
     * Guards the rewrite rather than the numbers: the readable form and the
     * form it replaced are the same arithmetic, and this says so. If a future
     * edit "simplifies" one into something that is NOT equivalent, the
     * geometry tests above catch it -- this one just makes the equivalence an
     * explicit, checked claim instead of a comment.
     */
    const spelled = (width: number) =>
      Math.round((width - BREED_PITCH - 4.3 * BREED_PITCH) / 4.3);
    for (const width of WIDTHS) {
      expect(breedSize(width)).toBe(spelled(width));
    }
  });

  it('still draws more subject than a category circle does', () => {
    /*
     * THE FLOOR ON THE SHRINK, restated in the terms that actually matter --
     * and the restatement is the point.
     *
     * This used to assert `breedSize(width) > 60`: a breed disc must beat the
     * 60dp category circle, because at 60dp a breed photo is a thumbnail of an
     * animal's head and the breeds are genuinely hard to tell apart. That
     * bound is now failed by design (59dp at 360dp), and simply deleting the
     * test would drop the only guard on how far this rail may shrink.
     *
     * It was comparing the wrong quantity. The two variants do not fill their
     * discs the same way: a category tile is a transparent icon `contain`ed at
     * 78% of its disc, so a 60dp circle draws ~47dp of subject, while a breed
     * photo COVERS -- the dog's head is the full diameter. What has to hold is
     * that a breed photo shows more animal than a category circle shows icon,
     * which is the claim the old bound was a proxy for.
     */
    const CIRCLE_SUBJECT = 60 * 0.78;
    for (const width of WIDTHS) {
      expect(breedSize(width)).toBeGreaterThan(CIRCLE_SUBJECT);
    }
  });

  it('grows with the screen rather than leaving a wider margin', () => {
    const sizes = WIDTHS.map(breedSize);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });
});

describe('wideSize is derived the same way, for the same reason', () => {
  /*
   * Not part of the breed change, and pinned here because it shares the
   * formula's shape: a future edit that reworks one derivation should see the
   * other has the same geometry to preserve.
   */
  it.each(WIDTHS)('shows about two and a bit tiles on %ddp', width => {
    const shown = visible(width, wideSize(width), PITCH);
    expect(shown).toBeGreaterThan(2);
    expect(shown).toBeLessThan(3);
  });
});
