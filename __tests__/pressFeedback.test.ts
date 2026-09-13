/**
 * Three fixes, one theme: a press that shows nothing has been pressed.
 *
 * Each of these was a control that started real work -- a round trip through a
 * WebView taking up to ADD_VERIFY_BUDGET_MS -- and drew nothing for it beyond
 * the press opacity, which ends with the finger. On a slow connection that
 * reads as a tap that failed, and the customer presses again. On Add to Bag a
 * second press is a second line in the bag.
 *
 *   1. the grid card    ../src/native/ListingCard had no spinner at all, so
 *                       the listing reached from the hamburger menu behaved
 *                       differently from the rails on the dashboard.
 *   2. the checkout     the native grid painted back OVER Shiprocket's iframe,
 *                       which looked like being redirected to the page you
 *                       came from.
 *   3. Submit           ../src/components/OtpScreen took a `busy` prop and
 *                       drew nothing for it.
 *
 * Asserted against the real source, for the reason ./collectionWiring gives:
 * these are wiring facts, and driving the whole screen in a fake DOM would
 * test the harness more than the wiring.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

const src = (...parts: string[]): string =>
  readFileSync(join(__dirname, '..', 'src', ...parts), 'utf8');

const SCREEN = src('screens', 'ZiglyWebViewScreen.tsx');
const LISTING_CARD = src('native', 'ListingCard.tsx');
const COLLECTION = src('native', 'CollectionScreen.tsx');
const OTP = src('components', 'OtpScreen.tsx');

describe('the grid card spins while its add is in flight', () => {
  /**
   * The card is the one component every listing shares, so the spinner has to
   * live on it rather than on one screen's copy of it.
   */
  it('takes a busy prop and draws a spinner for it', () => {
    expect(LISTING_CARD).toContain('busy?: boolean;');
    expect(LISTING_CARD).toContain('busy = false');
    expect(LISTING_CARD).toContain('<ActivityIndicator');
  });

  /**
   * Not tappable while it spins: that is the point of the spinner rather than
   * a side effect of it. A second press inside the verify window is a second
   * line in the bag -- ../src/native/ProductCard's own note.
   */
  it('refuses a second press while it is spinning', () => {
    expect(LISTING_CARD).toContain('disabled={!product.available || busy}');
  });

  /**
   * The label and the spinner must occupy the same box. `minHeight` was a
   * floor the LABEL set, and an ActivityIndicator is a fixed 20dp that does
   * not follow the device's font scale -- so at a large accessibility text
   * size a card mid-add would change height and re-lay out its whole row.
   */
  it('pins the button height, so the swap cannot reflow the row', () => {
    const at = LISTING_CARD.indexOf('  button: {');
    expect(at).toBeGreaterThan(-1);
    // To the next style, not to the first '},': the comment explaining the
    // pin contains one, and slicing there would cut the rule being asserted.
    const block = LISTING_CARD.slice(
      at,
      LISTING_CARD.indexOf('buttonPressed:', at),
    );
    expect(block).toContain('height: 40,');
    /*
     * The RULE, not the word. That comment names `minHeight` to say what this
     * replaced, so testing for the bare word fails on the explanation rather
     * than on the style. A declaration is the word and its colon.
     */
    expect(block).not.toContain('minHeight:');
  });

  /**
   * A spinner that reads as the Sold Out state would be worse than none: the
   * customer would believe the product had gone out of stock under them.
   */
  it('does not dim to the disabled grey while busy', () => {
    expect(LISTING_CARD).toContain('buttonBusy: {opacity: 0.9}');
  });
});

describe('the screen owns which grid card is spinning', () => {
  /**
   * A handle, not an index and not a variant id. The grid reorders under a
   * sort or a filter landing, so an index would move the spinner onto a
   * neighbour; a product carries several variant ids but one handle.
   */
  it('identifies the waiting card by handle, as the rails do', () => {
    expect(COLLECTION).toContain(
      'onAdd: (variantId: number, handle: string) => void;',
    );
    expect(COLLECTION).toContain('addingHandle?: string | null;');
    expect(COLLECTION).toContain('busy={addingHandle === item.handle}');
    expect(SCREEN).toContain('addingHandle={gridAdding}');
  });

  /**
   * Its own state rather than a share with the rails', because the two spin on
   * DIFFERENT WebViews: a rail's add confirms through the dashboard's
   * onMessage, a grid's through the visible layer's.
   */
  it('keeps the grid spin separate from the dashboard one', () => {
    expect(SCREEN).toContain(
      'const [gridAdding, setGridAdding] = useState<string | null>(null);',
    );
    expect(SCREEN).toContain('const clearGridAdding = useCallback');
  });

  /**
   * Every path that ends this spin is a message from inside a WebView, and a
   * message is exactly the thing that can fail to arrive. Without the failsafe
   * a dropped report leaves a card the customer cannot buy from.
   */
  it('arms a failsafe on the same budget the other spinners use', () => {
    const at = SCREEN.indexOf('const addFromGrid');
    const after = SCREEN.indexOf('const openAccountFromMenu', at);
    const block = SCREEN.slice(at, after);
    expect(block).toContain('setGridAdding(handle)');
    expect(block).toContain('ADD_BUSY_CAP_MS');
    // Before the injection, not on the reply: the gap begins at the tap.
    expect(block.indexOf('setGridAdding(handle)')).toBeLessThan(
      block.indexOf('injectInto(layer.key'),
    );
  });

  /**
   * No layer means nothing to inject into, and the injection is the only thing
   * that can report back -- so a spin started here could only ever run to its
   * failsafe.
   */
  it('does not spin when there is no layer to add through', () => {
    const at = SCREEN.indexOf('const addFromGrid');
    const after = SCREEN.indexOf('const openAccountFromMenu', at);
    const block = SCREEN.slice(at, after);
    expect(block).toContain('if (!layer) {');
    expect(block.indexOf('if (!layer) {')).toBeLessThan(
      block.indexOf('setGridAdding(handle)'),
    );
  });

  /**
   * The spin is cleared by the LAYER's handler, because that is the WebView
   * the grid's add was injected into. A failed add clears it too -- otherwise
   * it would run to the cap and stop with no explanation, which reads as an
   * add that worked.
   */
  it('is cleared by the layer that the add was injected into', () => {
    /*
     * THE LAYER'S handler, not the dashboard's. Both parse the same tags, so
     * the tag alone names neither. The two differ in one character of
     * structure: this tag OPENS the layer's chain (`if (data && ...`) and is a
     * later branch of the dashboard's (`} else if (data && ...`), which makes
     * the opening `if` unique to the handler wanted here. `card-probe` is
     * handled only by the layer, so it closes the slice.
     */
    const at = SCREEN.indexOf("if (data && data.tag === 'cart-added') {");
    expect(at).toBeGreaterThan(-1);
    const layerHandler = SCREEN.indexOf(
      "data && data.tag === 'card-probe'",
      at,
    );
    expect(layerHandler).toBeGreaterThan(-1);
    const block = SCREEN.slice(at, layerHandler);
    expect(block).toContain('clearGridAdding()');
    expect(block).toContain("data.tag === 'cart-add-failed'");
  });

  /**
   * ../src/native/CollectionScreen is keyed by handle, so walking to another
   * collection rebuilds it -- but this state would survive that, leaving a
   * fresh grid with a disabled card and the old grid's failsafe armed.
   */
  it('clears the spin when the grid itself changes', () => {
    expect(SCREEN).toContain('  }, [gridHandle, clearGridAdding]);');
  });
});

describe('a native screen never paints back over a live checkout', () => {
  /**
   * THE FIX FOR "CHECKOUT TAKES ME BACK TO THE PAGE I WAS ON".
   *
   * Shiprocket's embed arrives two ways: as a navigation to their host, which
   * `inCheckout` sees, or as an IFRAME over the page the customer is already
   * on, which changes no url and sets only `checkoutEmbedUp`. The cart's
   * Checkout is the second shape. Testing `inCheckout` alone let these opaque
   * native screens remount straight over the checkout the moment the cart
   * closed -- so nothing had failed, the checkout was simply behind a screen
   * with no reason to believe it was there.
   */
  it.each([
    ['const onNativeCollection'],
    ['const onNativeBreedVerse'],
    ['const onProductPage'],
  ])('%s stands down for the iframe, not just the navigation', marker => {
    const at = SCREEN.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    const end = SCREEN.indexOf('!showError;', at) + '!showError;'.length;
    const block = SCREEN.slice(at, end);
    expect(block).toContain('!inCheckout');
    expect(block).toContain('!checkoutEmbedUp');
  });

  /**
   * The layer's own handler never recorded the route, so `checkoutCameFrom`
   * stayed null for every checkout that painted into a page layer -- which is
   * both of the routes a customer is most likely to take. Null fell through to
   * the cart branch, so Back out of Buy Now opened a cart they had never been
   * in instead of returning them to the product page.
   */
  it('records which route the layer checkout came by, so Back knows', () => {
    // The layer's copy of the branch, found past the same landmark the test
    // above uses -- the dashboard's is earlier in the file and already had it.
    const at = SCREEN.indexOf(
      "data.tag === 'cart-checkout-started'",
      SCREEN.indexOf(
        "data && data.tag === 'card-probe'",
        SCREEN.indexOf("if (data && data.tag === 'cart-added') {"),
      ),
    );
    expect(at).toBeGreaterThan(-1);
    const block = SCREEN.slice(
      at,
      SCREEN.indexOf("data.tag === 'cart-checkout-unavailable'", at),
    );
    expect(block).toContain('setCheckoutEmbedUp(true)');
    expect(block).toContain("data.via === 'buy-now' ? 'buy-now' : 'cart'");
  });
});

describe('the OTP submit says it is working', () => {
  /**
   * The screen was drawn from a reference screenshot that carries no spinner
   * -- but a screenshot is of a button at rest and says nothing about the
   * second after a press. `busy` was already passed in and already blocked the
   * press; only the drawing was missing.
   */
  it('draws a spinner while a code is being verified', () => {
    expect(OTP).toContain('<ActivityIndicator');
    expect(OTP).toContain('{busy ? (');
    expect(SCREEN).toContain('busy={loginBusy}');
  });

  /**
   * A spinner already says the button is working; fading it at the same time
   * reads as disabled, which is the opposite message.
   */
  it('does not dim itself while it spins', () => {
    expect(OTP).toContain('pressed && !busy && styles.pressed');
  });

  /**
   * "Submit" is wider than a 20dp disc, so without a floor the button would
   * visibly contract under the finger -- which reads as the button being taken
   * away rather than being waited on.
   */
  it('pins a width, so the spinner cannot shrink the button', () => {
    const at = OTP.indexOf('  submit: {');
    expect(at).toBeGreaterThan(-1);
    const block = OTP.slice(at, OTP.indexOf('},', at));
    expect(block).toContain('minWidth:');
  });

  /** Assistive technology hears the wait, rather than only seeing it. */
  it('reports the wait to a screen reader', () => {
    expect(OTP).toContain('accessibilityState={{disabled: busy, busy}}');
  });
});
