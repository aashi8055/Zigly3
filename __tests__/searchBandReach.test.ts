/**
 * WHERE THE SEARCH BAND REACHES.
 *
 * The band existed on the dashboard and on WebView shopping pages, and was
 * missing from the two places a customer is most likely to want it: a product
 * page, and a collection's grid. Two different causes, which is why one change
 * could not fix both.
 *
 *   A PRODUCT PAGE was excluded on purpose, on the argument that
 *   ProductActionBar takes the screen's bottom slot. But the bar is at the
 *   FOOT and the band is at the head -- they never contended for the same
 *   space -- so the only effect was that a customer looking at one product had
 *   no way to search for another without going back first.
 *
 *   A COLLECTION GRID is ../native/CollectionScreen, drawn on an opaque layer
 *   over the WebView. The band on every WebView page is injected INTO the page
 *   (../webview/searchBandSection), so on those screens it was built into a
 *   document sitting underneath the native grid -- present, and invisible.
 *   That one needs a native band, from the same component the dashboard uses.
 *
 * These read the screen's own source, as ./header.test.tsx does for the band's
 * height: the conditions being pinned are compile-time decisions in one very
 * large component, and rendering the whole screen to reach them would be a
 * far less direct test of the same three lines.
 */
import fs from 'fs';
import path from 'path';

const SCREEN = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'screens', 'ZiglyWebViewScreen.tsx'),
  'utf8',
);

const COLLECTION = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'native', 'CollectionScreen.tsx'),
  'utf8',
);

const LIST = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'native', 'CollectionList.tsx'),
  'utf8',
);

/**
 * The body of the `showSearchBand` declaration.
 *
 * Read to the next declaration rather than to the first ';': the expression
 * carries a block comment that contains one, and stopping there would return
 * half the condition and pass assertions about terms it had not reached.
 */
const showSearchBand = (): string => {
  const at = SCREEN.indexOf('const showSearchBand =');
  expect(at).toBeGreaterThan(-1);
  const end = SCREEN.indexOf('const nativeSearchBand =', at);
  expect(end).toBeGreaterThan(at);
  return SCREEN.slice(at, end);
};

describe('the injected band on a WebView page', () => {
  it('is no longer withheld from a product page', () => {
    /*
     * The whole of this fix. `!onProductPage` was the one term that kept the
     * band off a PDP; every other exclusion in that expression names a screen
     * drawn OVER the page (the cart, the wishlist, search, the account
     * section) and each of those stays.
     */
    expect(showSearchBand()).not.toContain('!onProductPage');
  });

  it('still stands down under every screen that covers the page', () => {
    const body = showSearchBand();
    // A band drawn under an overlay is a band for a screen nobody is on.
    expect(body).toContain('!showCart');
    expect(body).toContain('!searchOpen');
    expect(body).toContain('!wishlistOpen');
    expect(body).toContain('!onAccountScreen');
  });

  it('stands down where a native screen covers the page', () => {
    /*
     * A collection is a shopping url, so it satisfies `onShopPage` -- but its
     * grid is native and opaque. Without this the app would inject a band
     * nobody can see AND draw a native one, which is two bands to keep in
     * step where the customer sees one.
     */
    expect(showSearchBand()).toContain('!onNativeCollection');
  });

  it('is still confined to the dashboard and shopping pages', () => {
    // Breed and content pages carry only the back arrow and the logo.
    expect(showSearchBand()).toContain('headerUrl === null || onShopPage');
  });
});

describe('the native band on the collection screens', () => {
  it('is built from the same component the dashboard uses', () => {
    const at = SCREEN.indexOf('const nativeSearchBand =');
    expect(at).toBeGreaterThan(-1);
    const body = SCREEN.slice(at, SCREEN.indexOf('/>', at));
    // Same component, same site-read placeholders, same tap -- so all three
    // bands in the app are one field rather than three that agree by luck.
    expect(body).toContain('<SearchBandSection');
    expect(body).toContain('onSearchPress={openSearch}');
    expect(body).toContain('searchPlaceholders={searchPlaceholders}');
  });

  it('is drawn only while a native collection screen is on screen', () => {
    const at = SCREEN.indexOf('const nativeSearchBand =');
    expect(SCREEN.slice(at, at + 80)).toContain('onNativeCollection ?');
  });

  it('is passed to both the grid and the collections index', () => {
    // Both screens are drawn on the same opaque layer, so both need it.
    expect(SCREEN).toContain('searchBand={nativeSearchBand}');
    expect(
      SCREEN.split('searchBand={nativeSearchBand}').length - 1,
    ).toBe(2);
  });

  it('opens the app’s own search screen, not a field in the page', () => {
    // The band is a tap that opens ../components/SearchScreen, exactly as it
    // does on the dashboard and on an injected page. Nothing here searches.
    const at = SCREEN.indexOf('const nativeSearchBand =');
    expect(SCREEN.slice(at, SCREEN.indexOf('/>', at))).toContain('openSearch');
  });
});

describe('the screens that draw it', () => {
  it('the grid takes a band and renders it above the heading', () => {
    expect(COLLECTION).toContain('searchBand?: React.ReactNode');
    // Inside the FlatList's own header, so it scrolls away with the heading
    // rather than being pinned above a scrolling grid.
    const at = COLLECTION.indexOf('ListHeaderComponent=');
    expect(at).toBeGreaterThan(-1);
    const header = COLLECTION.slice(at, at + 900);
    expect(header).toContain('{searchBand}');
    // Above the title, which is the order every other screen has.
    expect(header.indexOf('{searchBand}')).toBeLessThan(
      header.indexOf('styles.title'),
    );
  });

  it('the collections index takes one too, pulled out to the screen edges', () => {
    expect(LIST).toContain('searchBand?: React.ReactNode');
    /*
     * The band's ground is a full-bleed blue and that scroller insets its
     * content, so the band has to cancel the inset -- left in it, the blue
     * would draw as a floating panel with white gutters, which is not how the
     * band looks anywhere else.
     */
    expect(LIST).toContain('bandBleed');
    expect(LIST).toContain('marginHorizontal: -EDGE');
  });

  it('neither screen knows anything about searching', () => {
    /*
     * A node, not a callback: the placeholders and the search screen belong to
     * the screen above, and these two only render what they are handed.
     *
     * Tested on the IMPORTS rather than on the whole text -- a doc comment is
     * free to name the component it is handed, and CollectionScreen's does.
     * What would be wrong is importing it, or reaching for the search screen.
     */
    for (const source of [COLLECTION, LIST]) {
      expect(source).not.toMatch(/^import .*SearchBandSection/m);
      expect(source).not.toMatch(/^import .*NativeHeader/m);
      expect(source).not.toContain('openSearch(');
      expect(source).not.toContain('setSearchOpen');
    }
  });
});
