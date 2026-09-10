/**
 * WHY CHECKOUT LOOKED LIKE IT WENT BACK TO THE DASHBOARD.
 *
 * Not the checkout. The target.
 *
 * Shiprocket paints into the document whose script started the flow. With no
 * page layer open, the cart's Checkout injected into 'home' -- the dashboard's
 * WebView -- and that WebView is covered for the entire life of the app by
 * ../native/NativeDashboard on an opaque `pageLayer`. So every part worked as
 * written: the flow started, the script confirmed it, the hold expired, the
 * cart came off. What was revealed was the native dashboard, sitting on top of
 * a checkout that had opened perfectly well underneath it.
 *
 * The WebView under that layer is not a blank or a stand-in: it is
 * /pages/dog, a real page of the store carrying Shiprocket's own script and
 * their checkout container -- verified live 2026-09-10 against /pages/dog, a
 * product page and /cart. So nothing needs to be loaded or navigated. The
 * layer above comes down, and the checkout becomes visible.
 *
 * These pin the state machine around that, because getting any one of its four
 * edges wrong reintroduces a variant of the same bug:
 *
 *   - it is armed only when there is no page layer to paint into;
 *   - it is NOT cleared when the hold ends (that is when the checkout becomes
 *     visible -- clearing there drops the dashboard straight back on top);
 *   - it IS cleared when the customer leaves, by any of their own routes;
 *   - the dashboard is parked, never unmounted, so it comes back with its
 *     scroll and its assembled sections intact.
 */
import fs from 'fs';
import path from 'path';

const SCREEN = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'screens', 'ZiglyWebViewScreen.tsx'),
  'utf8',
);

const BRIDGE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'webview', 'cartBridge.ts'),
  'utf8',
);

/** Source of the named function, from its declaration to its dependency list. */
const callbackBody = (name: string): string => {
  const at = SCREEN.indexOf(`const ${name} = useCallback(`);
  expect(at).toBeGreaterThan(-1);
  const end = SCREEN.indexOf('}, [', at);
  expect(end).toBeGreaterThan(at);
  return SCREEN.slice(at, end);
};

describe('the flag that uncovers the checkout', () => {
  it('exists as state, so the layer can react to it', () => {
    expect(SCREEN).toContain('const [checkoutOnDashboard, setCheckoutOnDashboard]');
  });

  it('is armed only when no page layer is there to paint into', () => {
    /*
     * With a page layer showing, Shiprocket paints THERE and the dashboard
     * underneath is irrelevant -- which is why Checkout has always worked when
     * the cart was opened from a product page.
     */
    expect(SCREEN).toContain('if (!showing) {\n                  setCheckoutOnDashboard(true);');
  });

  it('still injects into the visible layer when there is one', () => {
    expect(SCREEN).toContain("showing ? showing.key : 'home',");
  });
});

describe('when the dashboard comes back', () => {
  it('not when the hold ends -- that is when the checkout becomes visible', () => {
    /*
     * THE ONE EDGE MOST EASILY GOT WRONG. `endCheckoutHold` runs the moment
     * cartBridge reports Shiprocket has painted; clearing the flag there would
     * put the native dashboard straight back over the checkout it had just
     * uncovered.
     */
    expect(callbackBody('endCheckoutHold')).not.toContain(
      'setCheckoutOnDashboard',
    );
  });

  it('when the customer closes the cart themselves', () => {
    // Backed out rather than paid: leaving the dashboard parked would show
    // them the bare WebView underneath it.
    expect(callbackBody('closeCart')).toContain('endCheckoutOnDashboard()');
  });

  it('when the WebView navigates out of the checkout flow', () => {
    // Shiprocket's flow navigates this same WebView, so coming home from it is
    // a navigation like any other.
    const at = SCREEN.indexOf('const handleNavStateChange');
    const body = SCREEN.slice(at, SCREEN.indexOf('const handleLoadEnd', at));
    expect(body).toContain('if (!nowInCheckout) {');
    expect(body).toContain('setCheckoutOnDashboard(false)');
  });

  it('when the checkout could not be opened at all', () => {
    // Nothing opened, so there is nothing under the dashboard to reveal.
    const at = SCREEN.indexOf("data.tag === 'cart-checkout-unavailable'");
    expect(at).toBeGreaterThan(-1);
    expect(SCREEN.slice(at, at + 1600)).toContain('endCheckoutOnDashboard()');
  });
});

describe('how the dashboard is hidden', () => {
  it('is parked off screen, not unmounted and not display:none', () => {
    /*
     * The same technique the page layers use for a kept-alive page. The
     * dashboard is expensive to assemble and holds its own scroll position, so
     * it has to come back as it was rather than be rebuilt.
     */
    expect(SCREEN).toContain('checkoutOnDashboard ? styles.parked : null');
    expect(SCREEN).toContain('parked: {transform: [{translateX: 10000}]}');
  });
});

describe('the checkout script itself', () => {
  it('asks the theme’s own container when no onclick control exists', () => {
    /*
     * Fastrr ships NO control in the markup: the theme renders an empty
     * div.shiprocket-headless[data-type="mini-cart"] and their script fills it
     * at runtime (their own comment in snippets/cart-drawer.liquid says so).
     * So every onclick-based pass can come up empty on a page whose checkout
     * works, and the container has to be asked directly.
     */
    expect(BRIDGE).toContain(
      '.shiprocket-headless[data-type="mini-cart"]',
    );
  });

  it('will not click through the store’s prescription gate', () => {
    /*
     * The store blocks checkout pending a prescription upload by putting
     * .is-prescription-blocked on that container (pointer-events: none), and
     * the theme states their click cannot be intercepted in JS. Clicking it
     * from native code would bypass a rule the website enforces.
     */
    expect(BRIDGE).toContain('is-prescription-blocked');
  });

  it('does not offer an empty container as a control', () => {
    // An empty box is Fastrr not having run; clicking it does nothing, silently.
    expect(BRIDGE).toContain('box.children.length > 0');
  });

  it('still never reaches for Shopify’s own checkout', () => {
    // The rule the whole file exists to keep -- landing there would take the
    // customer's money through the wrong flow.
    expect(BRIDGE).not.toContain('name="checkout"');
  });

  it('reports the timezone, which is the one cause the app cannot otherwise see', () => {
    /*
     * theme.liquid only shows Shiprocket's checkout for an India timezone
     * (Asia/Kolkata or Asia/Calcutta) and hides .shiprocket-headless outright
     * otherwise. From the app side that is indistinguishable from "Fastrr has
     * not run yet" and from the prescription gate, and each needs a different
     * fix.
     */
    expect(BRIDGE).toContain('resolvedOptions().timeZone');
    expect(BRIDGE).toContain('timezone: zone');
  });
});
