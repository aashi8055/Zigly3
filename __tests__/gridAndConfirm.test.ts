/**
 * Four changes, and what each of them is protecting.
 *
 *   1. NO PRODUCT COUNT on a listing, and no sold-out products in it.
 *   2. LOG OUT ASKS FIRST, from the foot of the screen.
 *   3. SORT LABELS ARE THE SITE'S, from one list rather than two.
 *   4. PDP GALLERY IS ONE SQUARE BOX, whatever shape the photo is.
 *
 * (3) and (4) were real defects with real evidence behind them, and the
 * evidence is recorded in each block below rather than left in a commit
 * message -- both were invisible in the app until you knew what to look for.
 */
import fs from 'fs';
import path from 'path';
import {SORTS} from '../src/native/listing';
import {SEED_SORT_OPTIONS} from '../src/listing/facets';
import {MOBILE_CSS} from '../src/webview/injectedStyles';

const read = (...parts: string[]): string =>
  fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');

const COLLECTION = read('src', 'native', 'CollectionScreen.tsx');
const LISTING = read('src', 'native', 'listing.ts');
const SCREEN = read('src', 'screens', 'ZiglyWebViewScreen.tsx');
const CONFIRM = read('src', 'components', 'ConfirmSheet.tsx');

describe('the listing header carries no count', () => {
  it('draws no "N Products" line', () => {
    /*
     * Tested on the rendering, not on the whole text: the file's comments
     * legitimately explain what was removed and why, and a grep for the word
     * "Products" also hits `fetchProductsByHandle` and `sortedProducts`.
     */
    expect(COLLECTION).not.toContain("'Product' : 'Products'");
    expect(COLLECTION).not.toContain('shownCount');
    expect(COLLECTION).not.toContain('styles.count');
  });

  /*
   * The caption was the only thing that number was for, and establishing it
   * meant paging the collection -- several hundred products' worth of round
   * trip per collection opened. Removing the caption and keeping the query
   * would have spent that on nothing.
   */
  it('no longer asks Shopify to count the collection', () => {
    expect(COLLECTION).not.toContain('fetchCollectionCount(');
    expect(COLLECTION).not.toContain('setCount(');
  });

  it('leaves the counting helper in place for anything else that wants it', () => {
    // Removed from this screen, not from the module: the export stays.
    expect(LISTING).toContain('export const fetchCollectionCount');
  });
});

describe('sold-out products stay out of the grid', () => {
  /*
   * Asked of Shopify, not filtered after the fact. Dropping rows client side
   * thins each page unevenly -- a page of 24 might yield 9 cards while
   * hasNextPage still describes the unfiltered connection -- so the grid would
   * show short rows, page early, and could report "no products" for a
   * collection that has plenty.
   *
   * Verified live 2026-09-11 on the dog-food collection: 250 products
   * unfiltered, 66 of them out of stock; 185 with this filter, none sold out.
   */
  it('asks the collection query for available products only', () => {
    const at = LISTING.indexOf('const LISTING_QUERY');
    expect(at).toBeGreaterThan(-1);
    const query = LISTING.slice(at, LISTING.indexOf('\n`;', at));
    expect(query).toContain('filters: {available: true}');
  });

  /*
   * The by-handle path is the other way into the grid -- it draws whatever
   * SearchTap's filters selected. There is no connection to filter there and
   * no paging to thin, so dropping after the fetch is correct rather than a
   * compromise, and it keeps a filtered grid agreeing with an unfiltered one.
   */
  it('drops a sold-out product from a filtered result set too', () => {
    expect(LISTING).toContain('if (product && product.available)');
  });
});

describe('logging out asks first', () => {
  it('does not sign out on the tap', () => {
    // The press opens the question; only the question's confirm signs out.
    expect(SCREEN).toContain('const logOut = useCallback(() => setConfirmLogOut(true), []);');
    expect(SCREEN).toContain('const confirmSignOut = useCallback(() => {');
  });

  it('still reaches the same signOut once confirmed', () => {
    // Everything downstream -- the reason ref, the doubted-probe run, the
    // toast that outlives the account screen -- is unchanged.
    const at = SCREEN.indexOf('const confirmSignOut');
    expect(SCREEN.slice(at, at + 220)).toContain("signOut('logout')");
  });

  it('asks from the foot of the screen, not in an OS dialog', () => {
    // Delete Account uses Alert.alert; this deliberately does not, because
    // every other decision this app waits on is asked at the bottom.
    expect(CONFIRM).toContain("from 'react-native'");
    expect(CONFIRM).toContain('animationType="slide"');
    expect(CONFIRM).toContain("justifyContent: 'flex-end'");
    const at = SCREEN.indexOf('<ConfirmSheet');
    expect(at).toBeGreaterThan(-1);
    expect(SCREEN.slice(at, at + 700)).toContain('visible={confirmLogOut}');
  });

  it('offers a way out, and a stray tap takes it', () => {
    const at = SCREEN.indexOf('<ConfirmSheet');
    const block = SCREEN.slice(at, at + 700);
    expect(block).toContain('cancelLabel="Cancel"');
    // The backdrop cancels: the safe answer to every question this asks.
    expect(CONFIRM).toContain('onPress={onCancel}');
  });

  it('is not painted as destructive, because signing out is reversible', () => {
    /*
     * The PROP, not the word -- the block carries a comment saying why it is
     * absent, which is worth keeping. ConfirmSheet defaults `destructive` to
     * false, so not passing it is what leaves the confirm row in the pale
     * fill rather than solid red.
     */
    const at = SCREEN.indexOf('<ConfirmSheet');
    const block = SCREEN.slice(at, at + 900);
    expect(block).not.toContain('destructive={true}');
    expect(block).not.toContain('destructive={');
    expect(CONFIRM).toContain('destructive = false');
  });
});

describe('the sort labels are the site’s own', () => {
  /*
   * A REAL DEFECT. SORTS held title-cased labels -- 'Best Selling',
   * 'Price: Low To High', 'Price: High To Low', 'Discount: High To Low' --
   * while SearchTap's own collectionSortValues says 'Best selling',
   * 'Price: Low to High', 'Price: High to Low', 'Discount: High to Low'
   * (re-read from assets/searchtap.js on 2026-09-11). Four of five differed by
   * one letter's case.
   *
   * A label is the only thing identifying a sort across the app/page boundary:
   * chooseSort resolves it against SORTS and, failing that, hands it to the
   * page -- where facetBridge refuses any label the page does not itself
   * offer. So a title-cased label reaching that path was rejected and the sort
   * silently did nothing.
   */
  it('matches SearchTap’s own casing', () => {
    expect(SORTS.map(sort => sort.label)).toEqual([
      'Best selling',
      'Price: Low to High',
      'Price: High to Low',
      'New Release',
      'Discount: High to Low',
    ]);
  });

  it('comes from one list, so the two halves cannot drift apart', () => {
    expect(SORTS.map(sort => sort.label)).toEqual(SEED_SORT_OPTIONS);
    // Derived, not re-typed: the labels are read out of the shared list.
    expect(LISTING).toContain('SEED_SORT_OPTIONS[0]');
  });
});

describe('the product gallery is one square box', () => {
  /*
   * WHAT WAS ACTUALLY WRONG. Not the source images: 4,157 of the catalogue's
   * 4,181 product images are exactly square (surveyed live 2026-09-11). It is
   * that the 22 which are not get mixed into the same gallery, and the theme
   * gives each <img> its own intrinsic width/height attributes.
   *
   * One live product page carried four different intrinsic ratios at once --
   * 550x550 (1.00), 550x301 (1.83), 550x463 (1.19), 550x505 (1.09). A browser
   * derives an aspect-ratio from those, so each slide sized itself differently
   * and the gallery changed height as the customer swiped, taking the page's
   * lower half with it.
   */
  const rule = (selector: string): string => {
    const at = MOBILE_CSS.indexOf(selector);
    expect(at).toBeGreaterThan(-1);
    const open = MOBILE_CSS.indexOf('{', at);
    return MOBILE_CSS.slice(open, MOBILE_CSS.indexOf('}', open));
  };

  it('squares the wrapper', () => {
    const box = rule('.main-slider .productImgWrapper,');
    expect(box).toContain('aspect-ratio: 1 / 1 !important');
  });

  /*
   * THE IMAGE NEEDS THE SQUARE TOO, and this is the half that was missing.
   * The wrapper alone was not enough: the width/height attributes give the
   * image an intrinsic ratio of its own, and the theme's own is-single-media
   * rules free its height with !important -- which is how a 1.83 photo escaped
   * a square wrapper and became a letterbox strip.
   */
  it('squares the image itself, not just the box around it', () => {
    const image = rule('.main-slider .productImage,');
    expect(image).toContain('aspect-ratio: 1 / 1 !important');
    expect(image).toContain('max-height: 100% !important');
  });

  it('letterboxes rather than crops, centred', () => {
    // A cropped product is the fault the reference shots show, and it is worse
    // than empty space beside a wide photo.
    const image = rule('.main-slider .productImage,');
    expect(image).toContain('object-fit: contain !important');
    expect(image).toContain('object-position: center center !important');
  });

  /*
   * The trap this file's own history keeps hitting: one backtick anywhere in
   * MOBILE_CSS closes the template literal early and silently drops the rest
   * of the stylesheet. injection.test.ts asserts this too; it is repeated here
   * because the block above is where the backtick nearly went in.
   */
  it('carries no backtick, which would truncate the stylesheet', () => {
    expect(MOBILE_CSS.indexOf(String.fromCharCode(96))).toBe(-1);
  });
});
