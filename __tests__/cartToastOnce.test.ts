/**
 * One add, one toast.
 *
 * The reported fault was that adding a single item showed "Added to cart" two
 * or three times. It was not one reporter firing repeatedly -- it was three
 * separate, individually correct reporters watching the same add:
 *
 *   src/webview/cartToast.ts      the theme's cart drawer opening
 *   src/webview/productActions.ts a /cart.js re-read confirming the click
 *   src/webview/cartBridge.ts     a wishlist line's own /cart/add.js reply
 *
 * The fix coalesces them on the native side, and the rule it uses is the
 * subject of this file: a report is a duplicate when it arrives soon after the
 * last one AND does not show the bag holding more than that one did.
 *
 * The rule is re-implemented here rather than imported. It lives inside
 * ZiglyWebViewScreen's component body, which cannot be mounted in this suite
 * without a WebView, and the numbers it depends on ARE imported -- so a change
 * to the retry budget still reaches these tests.
 */
import {ADD_VERIFY_BUDGET_MS} from '../src/webview/productActions';
import {PRODUCT_ADD_TO_BAG_SCRIPT} from '../src/webview/productActions';
import {addToCartScript} from '../src/webview/cartBridge';
import {CART_TOAST_SCRIPT} from '../src/webview/cartToast';

/** The window the screen uses, read off the same constant the screen derives. */
const COALESCE_MS = ADD_VERIFY_BUDGET_MS + 1000;

/**
 * `reportCartAdded`, as a standalone machine.
 *
 * Same two refs and same decision as the screen's callback; `toasts` stands in
 * for setCartToast(true).
 */
const makeReporter = () => {
  let lastAt: number | null = null;
  let lastCount: number | null = null;
  let toasts = 0;
  return {
    report(now: number, count?: number) {
      const withinWindow = lastAt !== null && now - lastAt < COALESCE_MS;
      if (withinWindow) {
        if (lastCount === null) {
          // First number seen for the add already toasted: adopt, stay quiet.
          if (typeof count === 'number') {
            lastCount = count;
          }
          return;
        }
        if (typeof count !== 'number' || count <= lastCount) {
          return;
        }
      }
      lastAt = now;
      lastCount = typeof count === 'number' ? count : null;
      toasts++;
    },
    get toasts() {
      return toasts;
    },
  };
};

describe('coalescing the add-to-cart reports', () => {
  it('shows one toast when a native Add to Bag reports twice', () => {
    /*
     * The exact sequence behind the bug. Tapping the native sticky bar clicks
     * the theme's own button, which opens the drawer -- so cartToast.ts reports
     * at once, with no count, and productActions confirms half a second later
     * with one.
     */
    const r = makeReporter();
    r.report(0); // drawer watcher, countless
    r.report(500, 1); // the verify behind it
    expect(r.toasts).toBe(1);
  });

  it('shows one toast when the confirmation lands after the toast has gone', () => {
    /*
     * The slow-network case, and the reason a plain `setCartToast(true)` was
     * not enough on its own. The toast lives about 1.5s; a verify arriving
     * after that finds the flag already cleared by onHidden, so the naive
     * version replayed the whole animation for an add the customer had already
     * been told about.
     */
    const r = makeReporter();
    r.report(0);
    r.report(3000, 1);
    expect(r.toasts).toBe(1);
  });

  it('still shows a toast for a genuinely different second add', () => {
    /*
     * The fault this rule must not introduce. The window has to outlast the
     * retry budget, which makes it long enough for a real second tap to fall
     * inside it -- so time alone cannot be the test. A second add always leaves
     * the bag holding more, and that is what gets it its toast.
     */
    const r = makeReporter();
    r.report(0, 1);
    r.report(2000, 2);
    expect(r.toasts).toBe(2);
  });

  it('treats a repeat of the same count as the same add, however late', () => {
    const r = makeReporter();
    r.report(0, 3);
    r.report(1200, 3);
    r.report(4000, 3);
    expect(r.toasts).toBe(1);
  });

  it('lets an unrelated add through once the window has passed', () => {
    // Nothing is permanently suppressed: a later add with no count of its own
    // -- a card tap seen only by the drawer watcher -- still speaks up.
    const r = makeReporter();
    r.report(0);
    r.report(COALESCE_MS + 1);
    expect(r.toasts).toBe(2);
  });

  it('toasts the first add of a session whatever it reports', () => {
    // Nothing has been acknowledged yet, so there is no window to fall inside
    // and the report is announced on its own terms.
    const r = makeReporter();
    r.report(0, 0);
    expect(r.toasts).toBe(1);
  });

  it('adopts the first number it sees for an add the watcher reported first', () => {
    /*
     * The ordering a native Add to Bag actually produces: the drawer watcher
     * has no cart read to attach, so the count arrives on the confirmation
     * behind it. That number describes the add already toasted -- it must be
     * taken as the baseline, not read as an increase on top of it.
     */
    const r = makeReporter();
    r.report(0); // watcher, countless
    r.report(500, 4); // the confirmation, carrying the new total
    expect(r.toasts).toBe(1);
    // And the adopted baseline is what the NEXT add is judged against.
    r.report(1500, 4); // another repeat of the same add
    expect(r.toasts).toBe(1);
    r.report(2500, 5); // a real second item
    expect(r.toasts).toBe(2);
  });

  it('outlasts the retry budget the confirmation can take', () => {
    /*
     * The window is derived from productActions' own delays, so adding a retry
     * there widens it here instead of quietly escaping it. If this ever fails,
     * a confirmation can land outside the window and the double toast is back.
     */
    expect(COALESCE_MS).toBeGreaterThan(ADD_VERIFY_BUDGET_MS);
  });
});

describe('what the page sends with an add', () => {
  it('puts the count on the add itself, not only in its own message', () => {
    // Without the number on the add, the screen cannot tell a repeat from a
    // real second add and has to fall back on time alone.
    expect(PRODUCT_ADD_TO_BAG_SCRIPT).toContain("send({tag: 'cart-added', n: after})");
    expect(addToCartScript(1)).toContain("send({tag: 'cart-added', n: cart.item_count || 0})");
  });

  it('still sends cart-count separately, so the badge is never skipped', () => {
    // Suppressing a toast must not suppress the count that travelled with it.
    expect(PRODUCT_ADD_TO_BAG_SCRIPT).toContain("send({tag: 'cart-count', n: after})");
    expect(addToCartScript(1)).toContain("tag: 'cart-count'");
  });

  it('reports an unreadable cart without inventing a count for it', () => {
    // A cart that could not be read is not a cart holding zero -- claiming 0
    // here would make the next real add look like a decrease and swallow it.
    expect(addToCartScript(1)).toContain("send({tag: 'cart-added'})");
  });

  it('leaves the drawer watcher reporting without a count', () => {
    /*
     * cartToast.ts sees a drawer open and nothing else -- it has no cart read
     * to attach. That is why an unnumbered report inside the window is treated
     * as a duplicate rather than as a new add.
     */
    expect(CART_TOAST_SCRIPT).toContain("tag: 'cart-added'");
    expect(CART_TOAST_SCRIPT).not.toContain("tag: 'cart-count'");
  });
});
