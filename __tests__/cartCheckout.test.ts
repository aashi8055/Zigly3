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
 * Every one of those would have been caught by executing the thing. The tests
 * in ./navigation.test.ts assert this script's TEXT; this one runs it, against
 * the shapes the page has actually been seen to take, and checks what is
 * pressed and what is reported.
 *
 * What this cannot show: that zigly.com's live markup still looks like any of
 * these. Nothing in a test suite can. That is why the script prefers the
 * Shiprocket API over the DOM, reports what it found when it finds nothing,
 * and never falls through to Shopify's checkout on a guess.
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

interface Sent {
  tag: string;
  via?: string;
  [key: string]: unknown;
}

const run = (
  specs: ElSpec[],
  api: Record<string, unknown> | null = null,
  pathname = '/',
) => {
  const els = specs.map(spec => new FakeEl(spec));
  const sent: Sent[] = [];
  const calls: string[] = [];

  const querySelectorAll = (selector: string): FakeEl[] => {
    const match = /^\[onclick\*="(.+)"\]$/.exec(selector);
    if (!match) {
      throw new Error('unexpected selector: ' + selector);
    }
    return els.filter(el => (el.onclick ?? '').indexOf(match[1]) !== -1);
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
      ReactNativeWebView: {
        postMessage: (raw: string) => {
          sent.push(JSON.parse(raw));
        },
      },
    },
    Object,
    JSON,
    String,
  };

  // eslint-disable-next-line no-new-func
  const fn = new Function(
    ...Object.keys(sandbox),
    CART_CHECKOUT_SCRIPT + '\nreturn true;',
  );
  fn(...Object.values(sandbox));

  return {sent, clicked: els.filter(el => el.clicks > 0), calls};
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
      checkoutCart: () => undefined,
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
      checkoutCart: () => {
        throw new Error('needs an event');
      },
      checkout: () => undefined,
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
    const {sent} = run([], null, '/');
    expect(sent).toHaveLength(1);
    expect(sent[0].tag).toBe('cart-checkout-unavailable');
    expect(sent[0].path).toBe('/');
    expect(sent[0].controls).toBe(0);
  });

  it('reports what it saw when it rejects everything', () => {
    // A bare "unavailable" gives nobody anything to go on.
    const {sent} = run(
      [{onclick: DRAWER, className: 'cart-icon'}],
      null,
      '/cart',
    );
    expect(sent[0].controls).toBe(1);
    const sample = sent[0].sample as Array<{rejected: boolean}>;
    expect(sample[0].rejected).toBe(true);
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
