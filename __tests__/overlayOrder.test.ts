/**
 * Two screens that can be open at once, and the keyboard that outlived its own.
 *
 * Source assertions, which is this project's convention for
 * ../src/screens/ZiglyWebViewScreen: it owns eleven WebViews and cannot be
 * rendered in a test. See the same approach in ./account.test.tsx,
 * ./menu.test.tsx and ./loginFlow.test.tsx.
 *
 * WHAT WENT WRONG. The wishlist screen carries the cart icon in its own header,
 * so tapping it left both open -- and the cart is rendered *before* the wishlist
 * in the tree, so the wishlist painted over it. The cart appeared to vanish, and
 * Back (which asked the wishlist first) closed the screen underneath it, leaving
 * the cart standing: "it disappears, and on going back it lands on the cart".
 *
 * Three things have to agree for that to stay fixed, and they are three
 * different mechanisms in three parts of the file -- which is why each is
 * pinned here rather than left to the one that is easiest to see.
 */
const readScreen = (): string =>
  require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

describe('the cart is drawn over the wishlist, not under it', () => {
  const src = readScreen;

  it('renders the cart layer before the wishlist, and lifts it', () => {
    const text = src();
    const cart = text.indexOf('{showCart ? (');
    const wishlist = text.indexOf('{wishlistOpen ? (');
    expect(cart).toBeGreaterThan(-1);
    expect(wishlist).toBeGreaterThan(-1);
    /*
     * The cart really is the earlier sibling. If a later edit moves it below
     * the wishlist the zIndex becomes unnecessary rather than wrong -- but this
     * expectation is what says the lift is still load-bearing, so it should be
     * revisited deliberately rather than silently.
     */
    expect(cart).toBeLessThan(wishlist);
    expect(text).toContain('styles.cartLayer');
    expect(text).toContain('cartLayer: {zIndex: 1, elevation: 1}');
  });

  it('asks the cart before the wishlist in both back handlers', () => {
    const text = src();
    // The hardware handler: refs, because it runs inside a native callback.
    const hardware = text.indexOf('if (showCartRef.current) {');
    const hardwareWishlist = text.indexOf('if (wishlistOpenRef.current) {');
    expect(hardware).toBeGreaterThan(-1);
    expect(hardwareWishlist).toBeGreaterThan(-1);
    expect(hardware).toBeLessThan(hardwareWishlist);

    // The header's arrow, which reads state directly.
    const header = text.indexOf('const handleHeaderBackPress');
    const body = text.slice(header, text.indexOf('\n  const ', header + 20));
    expect(body.indexOf('showCart')).toBeLessThan(body.indexOf('wishlistOpen'));
  });

  it('lights no tab while the cart is over the wishlist', () => {
    // The cart is a screen no tab describes. Testing wishlistOpen first would
    // leave Wishlist lit, pointing at the screen underneath the one on show.
    const text = src();
    const at = text.indexOf('const activeTab: TabKey | null');
    const body = text.slice(at, text.indexOf('})();', at));
    expect(body.indexOf('searchOpen || showCart')).toBeLessThan(
      body.indexOf('if (wishlistOpen)'),
    );
  });
});

describe('the keyboard goes with the search screen', () => {
  const src = readScreen;

  it('dismisses it where every exit already funnels', () => {
    /*
     * Unmounting the TextInput does not lower the keyboard: the input is gone
     * before the OS is told focus was surrendered, so it stayed up over the
     * page the search had just opened until the customer pressed back.
     *
     * closeSearch is the one place worth pinning because all four ways out go
     * through it -- submitting, tapping a suggestion, the back arrow and a tab.
     */
    const text = src();
    const at = text.indexOf('const closeSearch = useCallback');
    expect(at).toBeGreaterThan(-1);
    const body = text.slice(at, text.indexOf('\n  const ', at + 20));
    expect(body).toContain('Keyboard.dismiss();');

    // Imported from react-native, not shadowed by a local of the same name.
    expect(text).toMatch(/import \{[^}]*\bKeyboard,[^}]*\} from 'react-native'/s);
  });

  it('routes the suggestion and submit paths through it', () => {
    // Both exits the bug was reported on: a suggestion tapped, and a search
    // submitted. Neither dismisses the keyboard itself -- they must not need to.
    const text = src();
    for (const name of ['submitSearch', 'openFromSearch']) {
      const at = text.indexOf('const ' + name + ' = useCallback');
      expect(at).toBeGreaterThan(-1);
      const body = text.slice(at, text.indexOf('\n  const ', at + 20));
      expect(body).toContain('closeSearch();');
    }
  });
});
