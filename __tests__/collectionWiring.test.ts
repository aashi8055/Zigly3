/**
 * The decisions that connect the native collection screens to the WebView.
 *
 * The screens themselves are tested elsewhere (./collectionCards, ./listing,
 * ./resultsBridge, ./collectionUrls). What this covers is the wiring: the
 * handful of choices in ../src/screens/ZiglyWebViewScreen and
 * ../src/webview/injectedScripts that decide WHEN a native grid is used, where
 * its sort comes from, and how a filter reaches it. Each one is a place where
 * the app could look right and behave wrongly.
 *
 * Asserted against the real source, because these are wiring facts rather than
 * pure functions -- driving the whole 5,500-line screen in a fake DOM to
 * observe them would test the harness more than the wiring.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {RESULTS_BRIDGE_SCRIPT} from '../src/webview/resultsBridge';
import {SORTS} from '../src/native/listing';

const SCREEN = readFileSync(
  join(__dirname, '..', 'src', 'screens', 'ZiglyWebViewScreen.tsx'),
  'utf8',
);

describe('the results bridge ships with the listing payload', () => {
  /**
   * Without this the native grid can never be filtered: the bridge is what
   * carries SearchTap's answer out of the page, and a filter would apply inside
   * a WebView nobody is looking at while the grid went on showing the
   * unfiltered list.
   */
  it('is injected on a collection page', () => {
    const payload = getInjectionForUrl('https://zigly.com/collections/applod');
    expect(payload).toBeTruthy();
    expect(payload as string).toContain('__ziglyResults');
  });

  it('is injected on a search page, which is also a listing', () => {
    const payload = getInjectionForUrl('https://zigly.com/search?q=food');
    expect(payload as string).toContain('__ziglyResults');
  });

  /**
   * The bridge guards itself with `ziglyIsListing()`, so shipping it on a
   * product page is harmless -- but the payload goes out on every page load and
   * this one is the app's largest, so what it carries is worth pinning.
   */
  it('guards itself rather than relying on where it is sent', () => {
    expect(RESULTS_BRIDGE_SCRIPT).toContain('ziglyIsListing()');
  });
});

describe('the native grid is used on the right pages', () => {
  /**
   * `/search` keeps the WebView's own SearchTap grid: it is a listing with no
   * collection behind it, so there is no handle to query and nothing for the
   * native grid to draw. `collectionHandleOf` returning null is what decides,
   * and the screen must key off that rather than off `onListing`.
   */
  it('decides by collection handle, not by whether it is a listing', () => {
    expect(SCREEN).toContain('const gridHandle =');
    expect(SCREEN).toContain('collectionHandleOf(headerUrl)');
  });

  /** The index and a collection are different screens; both are native. */
  it('draws the card list on the index and the grid on a collection', () => {
    expect(SCREEN).toContain('isCollectionsIndexUrl(headerUrl)');
    expect(SCREEN).toContain('<CollectionList');
    expect(SCREEN).toContain('<CollectionScreen');
  });

  /**
   * Both stand down for the screens drawn over a page. Without this the grid
   * would paint over the cart, the wishlist and the account section -- all of
   * which are later siblings, but each only covers what is behind it.
   */
  it.each([
    'searchOpen',
    'menuOpen',
    'inCheckout',
    'showCart',
    'wishlistOpen',
    'onAccountScreen',
    'showError',
  ])('stands down while %s', flag => {
    const at = SCREEN.indexOf('const onNativeCollection =');
    expect(at).toBeGreaterThan(-1);
    // Past the final term, so the last flag is inside the slice that is
    // searched rather than being its boundary.
    const end = SCREEN.indexOf('!showError;', at) + '!showError;'.length;
    const block = SCREEN.slice(at, end);
    expect(block).toContain(`!${flag}`);
  });

  /**
   * A grid keyed by handle. Two collections can share one page layer -- a
   * collection linked from inside another -- and without the key React reuses
   * the component, which would show the previous collection's products under
   * the new heading until the query returned.
   */
  it('keys the grid by handle so two collections cannot share state', () => {
    const at = SCREEN.indexOf('<CollectionScreen');
    const block = SCREEN.slice(at, at + 600);
    expect(block).toContain('key={gridHandle}');
  });
});

describe('sort on a native grid is the apps own', () => {
  /**
   * The sheet must offer ../native/listing's five rather than the page's list.
   * SearchTap reports its options only once it has rendered, so a sheet opened
   * quickly on a slow connection was empty -- and, more importantly, a sort
   * applied to the page would sort a grid nobody is looking at.
   */
  it('offers the modules five sorts when a grid is showing', () => {
    const at = SCREEN.indexOf('<SortSheet');
    const block = SCREEN.slice(at, at + 700);
    expect(block).toContain('gridHandle !== null');
    expect(block).toContain('SORTS.map');
    // And still the page's list on /search, which is not native.
    expect(block).toContain('facets.sortOptions');
  });

  it('ticks the grids own sort rather than the pages', () => {
    const at = SCREEN.indexOf('<SortSheet');
    const block = SCREEN.slice(at, at + 700);
    expect(block).toContain('sortById(gridSort).label');
  });

  /**
   * The sheet hands back a LABEL, so every label it shows must be one
   * `chooseSort` can resolve -- otherwise a tap falls through to the page and
   * sorts the WebView instead of the grid.
   */
  it('can resolve every label the sheet shows, and they are distinct', () => {
    const labels = SORTS.map(option => option.label);
    labels.forEach(label => {
      expect(SORTS.find(option => option.label === label)).toBeDefined();
    });
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('records the choice against the layer rather than globally', () => {
    expect(SCREEN).toContain('setGridSortByKey(prev => ({...prev, [key]: native.id}))');
  });
});

describe('a filter reaches the grid, and coming off reaches it too', () => {
  it('stores the reported handles against the layer', () => {
    expect(SCREEN).toContain("data.tag === 'results'");
    expect(SCREEN).toContain('setResultsByKey');
  });

  /**
   * Non-strings out: these go on to become a GraphQL query.
   *
   * Anchored to the end of the branch rather than to a character count. This
   * used to slice a fixed 1600 characters from the tag test, which put the
   * assertion inside the comment block whenever that comment grew -- a test
   * that failed on documentation. `setResultsByKey` is the write this branch
   * exists to make, so the filter must appear before it.
   */
  it('keeps only string handles from the page', () => {
    const at = SCREEN.indexOf("data.tag === 'results'");
    const block = SCREEN.slice(at, SCREEN.indexOf('setResultsByKey', at));
    expect(block).toContain("typeof h === 'string'");
  });

  /**
   * AND THE LATE REPORTS CANNOT PUT THE FILTER BACK.
   *
   * `toggleFacet` drops the entry on the frame the last chip comes off, and
   * that alone was not enough: ../src/webview/facetBridge re-reports 300ms and
   * 1200ms after every toggle, and those two reports landed after the delete
   * and restored the entry -- pinning the grid to a handle list with no paging
   * for a collection with no filter on it. The delete was real and lasted
   * 300ms.
   *
   * So the branch accepts handles only while the app's own record says a
   * filter is applied. Read through a ref because this handler closes over the
   * render that created it. See ../__tests__/lastFilterOff.test.ts for the
   * behaviour; this only pins that the screen still asks the question.
   */
  it('ignores a reported grid when nothing is applied', () => {
    const at = SCREEN.indexOf("data.tag === 'results'");
    const block = SCREEN.slice(at, SCREEN.indexOf('setResultsByKey', at));
    expect(block).toContain('selectedCount(');
    expect(block).toContain('facetsByKeyRef.current[layer.key]');
    expect(block).toContain('applied > 0');
  });

  /** The ref must actually track the state, or the gate reads a stale map. */
  it('keeps the ref in step with the facet state', () => {
    expect(SCREEN).toContain('facetsByKeyRef.current = facetsByKey;');
  });

  /**
   * THE CASE THE BRIDGE CANNOT REPORT. SearchTap's grid is still SearchTap's
   * after the last chip is cleared, so the bridge reports the unfiltered set as
   * though it were an answer -- and the grid would go on drawing a fixed list
   * of handles with no paging. The screen clears the entry from its own
   * optimistic state, which is what knows a filter came off.
   */
  it('clears the filter when the last chip comes off', () => {
    const at = SCREEN.indexOf('const toggleFacet');
    const block = SCREEN.slice(at, SCREEN.indexOf('useEffect', at));
    expect(block).toContain('anyOn');
    expect(block).toContain('delete without[key]');
  });

  /** Per layer, so a collection kept alive behind a product keeps its filters. */
  it('keeps the filter per page layer', () => {
    expect(SCREEN).toContain('resultsByKey');
    expect(SCREEN).toContain('gridResults');
  });

  /**
   * Both new maps are dropped when their layer is evicted, or the screen leaks
   * one entry -- one of them a list of handles -- per collection visited in a
   * session.
   */
  it('drops both maps with their layer', () => {
    expect(SCREEN).toContain('setGridSortByKey(prev => dropStaleKeys(prev, live))');
    expect(SCREEN).toContain('setResultsByKey(prev => dropStaleKeys(prev, live))');
  });
});

describe('the cart still belongs to the WebView', () => {
  /**
   * DATA-SOURCES.md §7: the app has one session and it lives in the WebView's
   * cookie jar, so a native fetch would write to a different cart than the one
   * the customer is shopping. The grid's add must go through the visible LAYER
   * -- the collection page under it -- and not through 'home', which is the
   * dashboard's own WebView and a different document.
   */
  it('adds through the layer under the grid, not the dashboard', () => {
    const at = SCREEN.indexOf('const addFromGrid');
    expect(at).toBeGreaterThan(-1);
    /*
     * To the END OF THE FUNCTION, not a fixed number of characters.
     *
     * This used to slice 700, which was enough only while the body was four
     * lines long. Adding the card's spinner to it -- the state, its failsafe,
     * and the notes on why the spin starts before the injection -- pushed the
     * injection itself past that window, and the test failed over the SIZE of
     * the function rather than anything it does. The next comment would have
     * done it again.
     *
     * `openAccountFromMenu` is the declaration that follows addFromGrid, so
     * the slice is the whole of that function and nothing after it -- which is
     * what the three assertions below were always meant to be read against.
     * Named, in the style of the other slices in this file, rather than
     * matched on indentation: a marker that is a real identifier fails loudly
     * if it is ever moved, instead of silently slicing the wrong block.
     */
    const after = SCREEN.indexOf('const openAccountFromMenu', at);
    const block = SCREEN.slice(at, after === -1 ? SCREEN.length : after);
    expect(block).toContain('visibleLayer(stackRef.current)');
    expect(block).toContain('addToCartScript(variantId)');
    expect(block).not.toContain("injectInto('home'");
  });
});
