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

describe('the app’s furniture on the checkout page', () => {
  /*
   * THE HEADER NOW STAYS, AND THIS PAIR OF TESTS CHANGED SIDES.
   *
   * They used to assert the opposite -- `const showChrome = !inCheckout &&
   * !checkoutEmbedUp` and a `{showChrome ? (` gate over <NativeHeader> -- on
   * the argument that Shiprocket's page should get the whole screen because it
   * carries its own header and its own way back.
   *
   * It does not reliably carry the way back. With no header there was no
   * visible exit from the checkout at all: the only route out was Android's
   * hardware back, which is not a control the layout advertises and not one
   * every customer thinks to reach for. A checkout a customer cannot leave is
   * worse than a checkout with a header they might mistap, so the header is
   * back on every page.
   *
   * The two exclusions that were right are unchanged and are still asserted
   * below: the offer strip and the tab bar. Both now carry their own test of
   * `inCheckout` rather than reading a shared flag.
   */
  it('keeps the header, which is the only visible way out', () => {
    // Drawn unconditionally: no gate of any kind between the strip above it
    // and the element itself.
    const at = SCREEN.indexOf('<NativeHeader');
    expect(at).toBeGreaterThan(-1);
    expect(SCREEN).not.toContain('{showChrome ? (');
    // And no flag left behind for a later edit to re-gate it on.
    expect(SCREEN).not.toContain('const showChrome =');
  });

  it('takes the offer strip off, on both routes into a checkout', () => {
    const at = SCREEN.indexOf('<AnnouncementBar');
    const body = SCREEN.slice(at, SCREEN.indexOf('/>', at));
    // A promotion above a payment page is still the last thing a customer
    // needs. This is the exclusion that used to live in `showChrome`, and it
    // has to carry BOTH tests now that nothing else does -- their embed
    // arrives either as a navigation to their host or as an iframe that
    // changes no url.
    expect(body).toContain('inCheckout ||');
    expect(body).toContain('checkoutEmbedUp ||');
  });

  it('leaves the tab bar off, as it already was', () => {
    // This exclusion predates the header's and is not changed by it -- a tab
    // bar across the foot of a payment page is one mistap from abandoning a
    // basket.
    const at = SCREEN.indexOf('const showNav =');
    expect(SCREEN.slice(at, SCREEN.indexOf(';', at))).toContain('!inCheckout');
  });

  /*
   * THE URL IS NOT ENOUGH, AND THIS IS THE SUBTLE HALF.
   *
   * Shiprocket's embed arrives two ways. A navigation to their own host is
   * seen by isCheckoutUrl, so `inCheckout` covers it. But their checkout can
   * also mount as an IFRAME over the page the customer is already on -- which
   * is the shape ../src/webview/cartBridge was written to detect, every one of
   * its CHECKOUT_SELECTORS being an iframe match. On that path the top-level
   * url never changes, `inCheckout` stays false, and the header and tab bar
   * would sit over a payment flow.
   */
  it('also stands down for their iframe, which changes no url', () => {
    expect(SCREEN).toContain('const [checkoutEmbedUp, setCheckoutEmbedUp]');
    // Set from the bridge's own paint report, not from a url.
    const at = SCREEN.indexOf("data.tag === 'cart-checkout-started'");
    expect(at).toBeGreaterThan(-1);
    expect(SCREEN.slice(at, at + 2000)).toContain('setCheckoutEmbedUp(true)');
  });

  it('is restored by every route out of a checkout', () => {
    // Closing the cart, navigating out of the flow (on the dashboard's WebView
    // and on a page layer), and a checkout that could not open at all.
    expect(callbackBody('closeCart')).toContain('endCheckoutEmbed()');
    expect(
      SCREEN.split('setCheckoutEmbedUp(false)').length - 1,
    ).toBeGreaterThanOrEqual(3);
  });

  it('Buy Now reports the paint too, so it hides the same furniture', () => {
    /*
     * Buy Now used to click and report nothing on success. Nothing else could
     * tell the app their page had arrived -- it is an iframe, so no url
     * changes -- so without this, Buy Now would leave the header stacked over
     * a payment flow while the cart's Checkout did not.
     */
    const actions = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'webview', 'productActions.ts'),
      'utf8',
    );
    expect(actions).toContain("tag: 'cart-checkout-started'");
    // The SAME tag the cart's checkout sends, so the screen has one handler
    // for "Shiprocket is on screen" rather than two that could drift apart.
    expect(actions).toContain("via: 'buy-now'");
    // And watched only after the click, since the watch is for its result.
    const click = actions.indexOf('btn.click();');
    expect(actions.indexOf('watchForCheckout();', click)).toBeGreaterThan(click);
  });

  it('Buy Now’s watch is bounded, so it cannot poll for the page’s life', () => {
    const actions = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'webview', 'productActions.ts'),
      'utf8',
    );
    // If their embed ever changes what it mounts, none of the selectors match
    // and this must stop rather than spin.
    expect(actions).toContain('PAINT_WAIT_MS');
  });
});

describe('the tab bar on the iframe checkout', () => {
  /*
   * THE EXCLUSION THAT WAS ONLY HALF WIRED.
   *
   * `showNav` excluded `inCheckout` and stopped there. `inCheckout` is
   * `isCheckoutUrl(nav.url)` -- it only sees the checkout that arrives as a
   * NAVIGATION to one of the shiprocket.in / pickrr.com hosts. Shiprocket's
   * embed also mounts as an IFRAME over the page the customer is already on,
   * and on that path the top-level url never changes: `inCheckout` is false
   * for the entire payment flow.
   *
   * So the tab bar sat across the foot of a live checkout, five taps away from
   * abandoning a basket with card details already entered -- which is the
   * failure the note on `checkoutEmbedUp` predicted in as many words ("the
   * header and the tab bar would stay over a payment page"). The header's half
   * of that was deliberately reversed (see above); the tab bar's half was
   * never a decision, just a missing test.
   *
   * The announcement strip has tested both flags all along. These pin the same
   * pair onto the two controls that share the tab bar's slot.
   */
  /*
   * The declaration, to its terminating semicolon.
   *
   * Ends on a `;` that closes a LINE, not on the first `;` in the text: these
   * declarations carry block comments between their clauses, and prose inside
   * one ("goes false on its own;") ended the slice early and cut off the
   * clauses being asserted.
   */
  const flagsIn = (name: string): string => {
    const at = SCREEN.indexOf(`const ${name} =`);
    expect(at).toBeGreaterThan(-1);
    const end = SCREEN.slice(at).search(/;\r?\n/);
    expect(end).toBeGreaterThan(-1);
    return SCREEN.slice(at, at + end);
  };

  it('stands down for their iframe as well as their host', () => {
    expect(flagsIn('showNav')).toContain('!inCheckout');
    expect(flagsIn('showNav')).toContain('!checkoutEmbedUp');
  });

  it('and so does the Sort / Filter bar, which takes the same slot', () => {
    /*
     * Reachable for the same reason and by one route: Buy Now on a listing
     * mounts the iframe without navigating, so `onListing` stays true. Without
     * this the iframe checkout swapped five exits for two.
     */
    expect(flagsIn('showSortFilter')).toContain('!inCheckout');
    expect(flagsIn('showSortFilter')).toContain('!checkoutEmbedUp');
  });

  it('is restored with the embed, by the flag both already reset', () => {
    // No new teardown: `endCheckoutEmbed` and the nav handler clear
    // `checkoutEmbedUp`, and both controls now follow it.
    expect(callbackBody('closeCart')).toContain('endCheckoutEmbed()');
  });
});

describe('the control the header draws on the checkout', () => {
  /*
   * IT WAS THE HAMBURGER, AND THAT WAS THE WORST OF THE THREE OPTIONS.
   *
   * `showBack` tested `headerUrl !== null` first, and `headerUrl` is
   * `showing ? showing.url : null` -- null on the dashboard. Their iframe
   * mounts over the DASHBOARD's WebView whenever the cart's Checkout was
   * tapped with no page layer open, which is what `checkoutOnDashboard`
   * exists for. Every other test in that expression was false there too, so
   * `showBack` was false and the header drew a hamburger over a live payment
   * page: a way *into* the store, offering no route back to the cart, on the
   * one screen whose only needed control is out.
   */
  const showBackExpression = (): string => {
    const at = SCREEN.indexOf('showBack={');
    expect(at).toBeGreaterThan(-1);
    return SCREEN.slice(at, SCREEN.indexOf('onWishlistPress', at));
  };

  it('is a back arrow on both routes into a checkout', () => {
    // Both flags for the reason on `checkoutEmbedUp`: a navigation to their
    // host, or an iframe that changes no url. The hamburger showed on the
    // second, which is the path the cart's Checkout actually takes.
    expect(showBackExpression()).toContain('inCheckout ||');
    expect(showBackExpression()).toContain('checkoutEmbedUp');
  });

  it('draws the arrow, not the hamburger, when showBack is set', () => {
    const header = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'components', 'NativeHeader.tsx'),
      'utf8',
    );
    expect(header).toContain('{showBack ? <BackIcon /> : <HamburgerIcon />}');
    // And the arrow is wired to the back handler rather than the drawer.
    expect(header).toContain('onPress={showBack ? onBackPress : onMenuPress}');
  });
});

describe('and Back, from inside their iframe', () => {
  /*
   * WHY IT NEEDS ITS OWN RULE. Their checkout is a cross-origin iframe --
   * the theme's snippets/sr-checkout.liquid sets `checkoutBuyer =
   * 'https://fastrr-boost-ui.pickrr.com/'`, and assets/fastrr-boost-ui.css
   * draws `.headless-payment-iframe` fixed over the whole viewport at
   * z-index 2147483648. It mounts WITHOUT a navigation, so there is no
   * history entry to step back through.
   *
   * Both Back paths used to fall through to `webRef.goBack()`, which on that
   * page either steps the WebView off the page the iframe is mounted in or
   * does nothing at all -- and either way leaves the app believing a checkout
   * is still up.
   */
  it('takes the embed down rather than stepping history', () => {
    expect(SCREEN).toContain('const leaveCheckoutEmbed = useCallback');
    const at = SCREEN.indexOf('const leaveCheckoutEmbed = useCallback');
    const body = SCREEN.slice(at, SCREEN.indexOf('}, [', at));
    // Their page comes off screen on both routes.
    expect(body).toContain('endCheckoutEmbed()');
    // Reports whether it acted, so a caller with no checkout falls through.
    expect(body).toContain('return false;');
    expect(body).toContain('return true;');
  });

  it('reads a ref, so the installed-once hardware handler sees it', () => {
    /*
     * The hardware handler subscribes in an effect and reads every other "is
     * this open?" through a ref. A handler closed over a stale `false` would
     * let Back leave the app from the middle of a payment flow.
     */
    expect(SCREEN).toContain('const checkoutEmbedUpRef = useRef(false)');
    expect(SCREEN).toContain('checkoutEmbedUpRef.current = checkoutEmbedUp;');
  });

  it('answers before the page-layer and history rules, on both paths', () => {
    // The iframe is drawn over whatever layer it mounted in and changes no
    // url, so every rule after it is blind to the checkout being on screen.
    const header = callbackBody('handleHeaderBackPress');
    expect(header.indexOf('leaveCheckoutEmbed()')).toBeGreaterThan(-1);
    expect(header.indexOf('leaveCheckoutEmbed()')).toBeLessThan(
      header.indexOf('stepBack()'),
    );

    const hardware = SCREEN.slice(
      SCREEN.indexOf('const onBack = '),
      SCREEN.indexOf("'hardwareBackPress'"),
    );
    expect(hardware.indexOf('leaveCheckoutEmbed()')).toBeGreaterThan(-1);
    expect(hardware.indexOf('leaveCheckoutEmbed()')).toBeLessThan(
      hardware.indexOf('canGoBackRef.current'),
    );
  });

  /*
   * AND THIS PAIR REPLACED AN ASSERTION THAT WAS BACKWARDS.
   *
   * It used to assert `openCart` was NOT called, on the argument that backing
   * out of a payment page means leaving the flow. That argument ignored what
   * is actually underneath the iframe: on the cart's route the checkout paints
   * into the DASHBOARD's WebView (it only does so when no page layer was open
   * to paint into), so clearing the flags revealed the dashboard and Back
   * skipped the cart entirely -- dropping the customer at home, several steps
   * from where they were, which is not what Back means anywhere else.
   */
  const leaveBody = (): string => {
    const at = SCREEN.indexOf('const leaveCheckoutEmbed = useCallback');
    expect(at).toBeGreaterThan(-1);
    return SCREEN.slice(at, SCREEN.indexOf('\n  }, [', at));
  };

  it('returns to the cart, not to the dashboard', () => {
    // Reopened rather than uncovered: the cart is closed as their page paints
    // (`releaseCheckoutHold`), so by the time Back is pressed it is gone.
    expect(leaveBody()).toContain('openCart()');
  });

  it('re-reads the cart on the way back, in case checkout changed it', () => {
    // `openCart` clears its copy and asks the bridge, so an abandoned checkout
    // cannot leave a stale cart on screen.
    const at = SCREEN.indexOf('const openCart = useCallback');
    expect(at).toBeGreaterThan(-1);
    expect(SCREEN.slice(at, SCREEN.indexOf('}, [', at))).toContain(
      'READ_CART_SCRIPT',
    );
  });

  it('leaves the product page underneath when Buy Now opened it', () => {
    /*
     * The other route, and it needs no reopening: Buy Now mounts the iframe
     * over the layer the customer was reading, nothing was closed on the way
     * in, and `checkoutOnDashboard` is never armed there.
     */
    expect(leaveBody()).toContain("if (from === 'buy-now') {");
  });

  it('knows which route it came by, since no url says so', () => {
    expect(SCREEN).toContain(
      "const checkoutCameFrom = useRef<'cart' | 'buy-now' | null>(null)",
    );
    /*
     * Tested for 'buy-now' rather than for 'cart'. The cart's own Checkout
     * reports the Shiprocket method it called, or 'control' -- never the
     * literal 'cart' -- so an unrecognised `via` must fall to the cart, whose
     * exit reopens something, not to the route that assumes a layer is still
     * there.
     */
    expect(SCREEN).toContain("data.via === 'buy-now' ? 'buy-now' : 'cart'");
  });

  it('does not unpark the dashboard mid-exit on the cart route', () => {
    /*
     * The cart is an overlay over the PARKED dashboard. Unparking it while
     * reopening the cart would put the native dashboard between the cart and
     * the WebView; `closeCart` unparks it, which is when the customer actually
     * leaves.
     */
    expect(leaveBody()).not.toContain('endCheckoutOnDashboard()');
    expect(callbackBody('closeCart')).toContain('endCheckoutOnDashboard()');
  });
});
