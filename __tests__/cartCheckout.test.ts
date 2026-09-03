/**
 * The cart's Checkout press, RUN rather than read.
 *
 * This script has been wrong three times, and every time it was a claim about
 * markup or hosts this project does not control:
 *
 *   1. It navigated to Shopify's /checkout -- the contact-information step,
 *      which is not the checkout this store uses at all.
 *   2. It clicked the first [onclick*="shiprocketCheckoutEvents"] on the cart
 *      page, which was a cart-drawer trigger: an extra page, then a sidebar,
 *      then Shiprocket.
 *   3. Fixing (2) over-filtered. Requiring the onclick to name checkout/buy AND
 *      survive a className test rejected the real control, so a button that had
 *      been working reported itself unavailable.
 *
 *   4. It reported the checkout STARTED the moment it called Shiprocket, a
 *      second before Shiprocket had painted -- so the app uncovered the page
 *      the cart had been sitting over, and the customer got a flash of the
 *      dashboard between the cart and the checkout.
 *
 * Every one of those would have been caught by executing the thing. The tests
 * in ./navigation.test.ts assert this script's TEXT; this one runs it, against
 * the shapes the page has actually been seen to take, and checks what is
 * pressed, what is reported, and WHEN.
 *
 * What this cannot show: that zigly.com's live markup still looks like any of
 * these. Nothing in a test suite can. That is why the script prefers the
 * Shiprocket API over the DOM, reports what it found when it finds nothing,
 * size-checks anything it thinks is a checkout, and never falls through to
 * Shopify's checkout on a guess.
 */
import {CART_CHECKOUT_SCRIPT} from '../src/webview/cartBridge';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 *
 * Only what this script asks for: one attribute-substring selector, plus
 * getAttribute and className. Hand-rolled for the reason ./facetBridge.test.ts
 * gives -- jsdom is not a dependency of this project, and adding one to run a
 * single selector would be the larger change.
 * -------------------------------------------------------------------------- */

interface ElSpec {
  onclick?: string;
  className?: string;
}

class FakeEl {
  onclick: string | null;
  className: string;
  clicks = 0;

  constructor(spec: ElSpec) {
    this.onclick = spec.onclick ?? null;
    this.className = spec.className ?? '';
  }

  getAttribute(name: string): string | null {
    return name === 'onclick' ? this.onclick : null;
  }

  click() {
    this.clicks++;
  }
}

/**
 * A literal newline, so the script and the harness's trailing `return true;`
 * do not end up on one line.
 */
const NEWLINE = String.fromCharCode(10);

/** The viewport the script measures a candidate checkout against. */
const VIEWPORT = {width: 390, height: 844};

/**
 * A node the script's paint check can find and measure.
 *
 * The box is the whole point. Shiprocket's embed leaves a zero-height
 * container in the document from page load, so a check that only asked
 * "is it there?" would report the checkout painted before the tap -- and the
 * flash would be back with a passing test over it. `paints` says which frame,
 * counted from the press, this thing takes up the screen on; `never` models
 * an embed whose markup the selectors do not recognise at all.
 */
class PaintNode {
  constructor(
    readonly selector: string,
    private readonly frame: () => number,
    private readonly paints: number | 'never',
    private readonly box = VIEWPORT,
  ) {}

  getBoundingClientRect() {
    const up = this.paints !== 'never' && this.frame() >= this.paints;
    return up
      ? {width: this.box.width, height: this.box.height}
      : // The container is present and collapsed, which is the state that
        // made presence-only detection wrong.
        {width: 0, height: 0};
  }
}

interface Sent {
  tag: string;
  via?: string;
  [key: string]: unknown;
}

interface RunOpts {
  api?: Record<string, unknown> | null;
  pathname?: string;
  /**
   * Which frame after the press Shiprocket's checkout fills the screen on.
   * `'never'` is an embed the selectors do not match; `'absent'` puts no
   * checkout node in the document at all.
   */
  paints?: number | 'never' | 'absent';
  /** Milliseconds the clock advances per frame the script waits. */
  msPerFrame?: number;
  /** Stop pumping frames after this many, so a bug cannot hang the suite. */
  maxFrames?: number;
}

const run = (specs: ElSpec[], opts: RunOpts = {}) => {
  const {
    api = null,
    pathname = '/',
    paints = 0,
    msPerFrame = 16,
    maxFrames = 2000,
  } = opts;

  const els = specs.map(spec => new FakeEl(spec));
  const sent: Sent[] = [];
  const calls: string[] = [];

  /* The clock and the frame counter the paint check is driven by. */
  let frame = 0;
  let clock = 1_000_000;
  const pending: Array<() => void> = [];

  const checkoutNode =
    paints === 'absent'
      ? null
      : new PaintNode(
          'iframe[src*="shiprocket"]',
          () => frame,
          paints as number | 'never',
        );

  const querySelectorAll = (selector: string): unknown[] => {
    const attr = /^\[onclick\*="(.+)"\]$/.exec(selector);
    if (attr) {
      return els.filter(el => (el.onclick ?? '').indexOf(attr[1]) !== -1);
    }
    /*
     * Anything else is one of the script's paint selectors. Only the one the
     * node claims matches -- the script tries several, and a harness that
     * answered all of them would not notice a script that had stopped looking
     * for what Shiprocket actually mounts.
     */
    if (checkoutNode && selector === checkoutNode.selector) {
      return [checkoutNode];
    }
    return [];
  };

  const wrapped = api
    ? Object.fromEntries(
        Object.entries(api).map(([name, value]) => [
          name,
          (...args: unknown[]) => {
            calls.push(name);
            return (value as (...a: unknown[]) => unknown)(...args);
          },
        ]),
      )
    : null;

  const sandbox: Record<string, unknown> = {
    document: {querySelectorAll},
    location: {pathname},
    window: {
      shiprocketCheckoutEvents: wrapped,
      innerWidth: VIEWPORT.width,
      innerHeight: VIEWPORT.height,
      /*
       * Queued, not run. The script waits a frame at a time for the checkout
       * to appear, and running the callback inline here would recurse until
       * the stack blew rather than letting the clock move.
       */
      requestAnimationFrame: (cb: () => void) => {
        pending.push(cb);
        return pending.length;
      },
      ReactNativeWebView: {
        postMessage: (raw: string) => {
          sent.push(JSON.parse(raw));
        },
      },
    },
    Date: {now: () => clock},
    Object,
    JSON,
    String,
  };

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    ...Object.keys(sandbox),
    CART_CHECKOUT_SCRIPT + NEWLINE + 'return true;',
  );
  fn(...Object.values(sandbox));

  /*
   * Drive the frames the script asked for, advancing the clock as a real
   * device would. `maxFrames` is a harness failsafe and not part of the
   * contract: it exists so that a script which never stops polling fails a
   * test instead of hanging the suite.
   */
  while (pending.length > 0 && frame < maxFrames) {
    const batch = pending.splice(0, pending.length);
    frame++;
    clock += msPerFrame;
    batch.forEach(cb => cb());
  }

  return {
    sent,
    clicked: els.filter(el => el.clicks > 0),
    calls,
    /** Frames the script waited before it reported. */
    frames: frame,
    /** True if it was still polling when the harness gave up. */
    stillPolling: pending.length > 0,
  };
};

const DRAWER = 'shiprocketCheckoutEvents.openCartDrawer(event)';
const CHECKOUT = 'shiprocketCheckoutEvents.checkoutCart(event)';

describe('pressing Checkout', () => {
  it('calls the Shiprocket API in preference to touching the DOM', () => {
    /*
     * The closest thing to Buy Now there is: nothing to find, nothing to open,
     * no drawer that could appear. The PDP control calls
     * shiprocketCheckoutEvents.buyProduct(event), so the global IS the API and
     * a DOM control is only ever a wrapper around it.
     */
    const {sent, clicked, calls} = run([{onclick: CHECKOUT}], {
      api: {checkoutCart: () => undefined},
    });
    expect(calls).toEqual(['checkoutCart']);
    expect(sent[0].tag).toBe('cart-checkout-started');
    expect(sent[0].via).toBe('checkoutCart');
    // The control was there, and was deliberately left alone.
    expect(clicked).toHaveLength(0);
  });

  it('moves on when an API method throws instead of giving up', () => {
    // A method that throws on a missing argument is not proof the next will.
    const {sent, calls} = run([], {
      api: {
        checkoutCart: () => {
          throw new Error('needs an event');
        },
        checkout: () => undefined,
      },
    });
    expect(calls).toEqual(['checkoutCart', 'checkout']);
    expect(sent[0].via).toBe('checkout');
  });

  it('presses the store checkout control when there is no API', () => {
    const {sent, clicked} = run([{onclick: CHECKOUT, className: 'btn'}]);
    expect(clicked).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-started');
    expect(sent[0].via).toBe('control');
  });

  it('never presses a cart-drawer trigger', () => {
    /*
     * Regression (2): the element that gave the customer a page, then a
     * sidebar, then Shiprocket. It is the only one here, so the right outcome
     * is to press nothing rather than to press it.
     */
    const {sent, clicked} = run([{onclick: DRAWER, className: 'cart-icon'}]);
    expect(clicked).toHaveLength(0);
    expect(sent[0].tag).toBe('cart-checkout-unavailable');
  });

  it('prefers the checkout control over a drawer trigger beside it', () => {
    // The cart page carries both, so DOM order must not decide it.
    const {clicked} = run([
      {onclick: DRAWER, className: 'cart-icon'},
      {onclick: CHECKOUT, className: 'checkout-btn'},
    ]);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].onclick).toContain('checkoutCart');
  });

  it('still presses a checkout button that sits inside the drawer', () => {
    /*
     * Regression (3), and why the press stopped working: the store's real
     * checkout button can live inside the cart drawer and carry a drawer-ish
     * class. Judging it by that class rejected the very control being looked
     * for. What an element DOES is in its handler; what it sits inside is not
     * evidence about it.
     */
    const {sent, clicked} = run([
      {onclick: CHECKOUT, className: 'drawer__footer cart-drawer__checkout'},
    ]);
    expect(clicked).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-started');
  });

  it('reports unavailable when the embed is absent', () => {
    /*
     * The dashboard: Shiprocket renders on cart and product pages, so a press
     * there finds nothing. The customer is told rather than left with a tap
     * that visibly did nothing.
     */
    const {sent} = run([], {pathname: '/', paints: 'absent'});
    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-unavailable');
    expect(sent[0].path).toBe('/');
    expect(sent[0].controls).toBe(0);
  });

  it('reports what it saw when it rejects everything', () => {
    // A bare "unavailable" gives nobody anything to go on.
    const {sent} = run([{onclick: DRAWER, className: 'cart-icon'}], {
      pathname: '/cart',
      paints: 'absent',
    });
    expect(sent[0].controls).toBe(1);
    const sample = sent[0].sample as Array<{rejected: boolean}>;
    expect(sample[0].rejected).toBe(true);
  });

  /* ------------------------------------------------------------------ *
   * Regression (4): WHEN it reports
   * ------------------------------------------------------------------ */

  it('waits for Shiprocket to paint before reporting started', () => {
    /*
     * The bug this section exists for. The app takes the native cart off the
     * screen on 'cart-checkout-started', and the cart is an overlay over a
     * live WebView -- so reporting on the CALL uncovered the page underneath
     * for as long as Shiprocket took to arrive, and the customer got a flash
     * of the dashboard between the two screens they asked for.
     *
     * 30 frames is about half a second at 60Hz, which is the order of the
     * real gap: Shiprocket's session is signed and cart-scoped, so opening it
     * is a network round trip.
     */
    const {sent, frames} = run([], {
      api: {checkoutCart: () => undefined},
      paints: 30,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-started');
    expect(sent[0].painted).toBe(true);
    // It did not answer on the call, and it did not keep waiting once the
    // checkout was up.
    expect(frames).toBeGreaterThanOrEqual(30);
    expect(frames).toBeLessThan(40);
  });

  it('reports as soon as the checkout is up, not on a fixed delay', () => {
    /*
     * The wait must be a wait FOR something, not a sleep. A fixed delay would
     * make every checkout feel a fixed amount slower, including the warm ones
     * -- and the whole reason to hold the cart up is that holding it is free
     * when the thing underneath is not ready yet.
     */
    const {sent, frames} = run([], {
      api: {checkoutCart: () => undefined},
      paints: 1,
    });
    expect(sent[0].painted).toBe(true);
    expect(frames).toBeLessThanOrEqual(2);
  });

  it('ignores the collapsed container Shiprocket leaves in the page', () => {
    /*
     * Presence is not paint. Shiprocket's embed leaves a zero-height
     * container in the document from page load, so a check that only asked
     * whether the node existed would report painted on the very first frame
     * -- and the flash would be back with a green test over it. `'never'` is
     * that node: found by the selector, never taking up the screen.
     */
    const {sent} = run([], {
      api: {checkoutCart: () => undefined},
      paints: 'never',
    });
    expect(sent[0].painted).toBe(false);
  });

  it('gives up waiting rather than holding the cart up forever', () => {
    /*
     * The failsafe, and it is the important half. If Shiprocket ever changes
     * what it mounts, no selector matches, and a wait with no end would leave
     * the customer behind a cart whose Checkout button spins -- a worse
     * failure than the flash. So it reports anyway, `painted: false`, and the
     * app uncovers: exactly the old behaviour on the one path where the new
     * one cannot tell what is happening.
     */
    const {sent, frames, stillPolling} = run([], {
      api: {checkoutCart: () => undefined},
      paints: 'never',
    });
    expect(stillPolling).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-started');
    // Bounded by the script's own 4s cap, at 16ms a frame.
    expect(frames).toBeLessThanOrEqual(4000 / 16 + 2);
  });

  it('reports exactly once', () => {
    // The app closes an overlay on this message. A second one would close
    // whatever the customer had opened after it.
    const {sent} = run([{onclick: CHECKOUT}], {paints: 5});
    expect(sent).toHaveLength(1);
  });

  it('waits after pressing a control, not only after an API call', () => {
    // Both routes into Shiprocket have the same gap, so both must wait.
    const {sent, clicked, frames} = run([{onclick: CHECKOUT}], {paints: 20});
    expect(clicked).toHaveLength(1);
    expect(sent[0].via).toBe('control');
    expect(sent[0].painted).toBe(true);
    expect(frames).toBeGreaterThanOrEqual(20);
  });

  it('does not wait at all when there was nothing to press', () => {
    /*
     * 'cart-checkout-unavailable' leaves the cart UP -- the customer keeps it
     * and is told. There is nothing coming to wait for, so making them wait
     * four seconds to be told so would be the one case where this hold costs
     * something.
     */
    const {sent, frames} = run([], {paints: 'absent'});
    expect(sent[0].tag).toBe('cart-checkout-unavailable');
    expect(frames).toBe(0);
  });

  it('never reaches for the Shopify checkout', () => {
    /*
     * Deliberate, and why regression (1) cannot come back: landing on Shopify's
     * flow would hide a broken Shiprocket integration behind a checkout that
     * takes the customer's money through the wrong path.
     */
    expect(CART_CHECKOUT_SCRIPT).not.toContain('/checkout');
    expect(CART_CHECKOUT_SCRIPT).not.toContain('name="checkout"');
    expect(CART_CHECKOUT_SCRIPT).not.toContain('location.href');
  });
});
