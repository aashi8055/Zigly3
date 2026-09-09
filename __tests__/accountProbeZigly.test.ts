/**
 * The account probe, against Zigly's ACTUAL account page.
 *
 * Every other test of this bridge was written against Dawn's stock markup, and
 * that is exactly why the account screen shipped broken: the probe passed its
 * tests and found nothing on the real site. This file fixes the blind spot by
 * running the real injected script over markup copied from the real theme --
 * `sections/main-account.liquid`, `snippets/user-information.liquid`,
 * `snippets/profile-right-content.liquid` and `snippets/orders-right-content.liquid`.
 *
 * The three faults pinned here, all of which were live:
 *
 *   1. **`isLoginUrl` matched the query string.** A signed-IN url that merely
 *      carries `?return_url=/account/login` was read as signed OUT, which is
 *      what threw the customer back to the login screen after signing in.
 *   2. **The profile read found nothing.** Zigly states the customer in
 *      disabled `<input value>` attributes and a `.user-name` greeting, not in
 *      the mailto/tel/format_address text the stock reader walked.
 *   3. **The orders read found nothing.** Zigly renders `.order-card` divs,
 *      not the `<tr>` rows the stock reader walked.
 *
 * The script is executed rather than string-matched: a test that only greps
 * the payload for a selector proves the selector was typed, not that it finds
 * anything. jsdom is not a dependency of this project (see facetBridge.test.ts
 * for the same decision), so the DOM below is the same hand-rolled shim,
 * widened for the `#id`, `[attr*=]`, `[attr^=]` and `.value` this bridge uses.
 */
import {ACCOUNT_PROBE} from '../src/webview/accountBridge';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 * -------------------------------------------------------------------------- */

interface Attrs {
  [name: string]: string;
}

class El {
  tag: string;
  className: string;
  attrs: Attrs;
  children: El[] = [];
  parentNode: El | null = null;
  text = '';

  constructor(tag: string, className = '', attrs: Attrs = {}, text = '') {
    this.tag = tag.toLowerCase();
    this.className = className;
    this.attrs = attrs;
    this.text = text;
  }

  add(...children: El[]): El {
    children.forEach(child => {
      child.parentNode = this;
      this.children.push(child);
    });
    return this;
  }

  getAttribute(name: string): string | null {
    if (name === 'class') {
      return this.className;
    }
    return name in this.attrs ? this.attrs[name] : null;
  }

  /** A real input exposes its value as a property; the shim mirrors that. */
  get value(): string {
    return this.attrs.value ?? '';
  }

  get nodeType(): number {
    return 1;
  }

  get tagName(): string {
    return this.tag.toUpperCase();
  }

  /** ZA.lines walks childNodes and reads nodeValue off text nodes. */
  get childNodes(): Array<El | {nodeType: number; nodeValue: string}> {
    const out: Array<El | {nodeType: number; nodeValue: string}> = [];
    if (this.text) {
      out.push({nodeType: 3, nodeValue: this.text});
    }
    return out.concat(this.children);
  }

  get textContent(): string {
    return this.text + this.children.map(child => child.textContent).join('');
  }

  descendants(): El[] {
    return this.children.reduce<El[]>(
      (all, child) => all.concat(child, child.descendants()),
      [],
    );
  }

  querySelectorAll(selector: string): El[] {
    if (selector.indexOf(',') !== -1) {
      const union = selector
        .split(',')
        .reduce<El[]>((all, one) => all.concat(this.querySelectorAll(one)), []);
      return this.descendants().filter(node => union.indexOf(node) !== -1);
    }
    const parts = selector.trim().split(/\s+/);
    let pool = this.descendants();
    parts.forEach((part, depth) => {
      pool = pool.filter(node => matches(node, part));
      if (depth < parts.length - 1) {
        pool = pool.reduce<El[]>(
          (all, node) => all.concat(node.descendants()),
          [],
        );
      }
    });
    return pool;
  }

  querySelector(selector: string): El | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

/** tag, #id, .class and [attr], [attr="v"], [attr*="v"], [attr^="v"]. */
const matches = (node: El, simple: string): boolean => {
  const attr = /\[([a-z-]+)(?:([*^]?)="([^"]*)")?\]/i.exec(simple);
  const rest = simple.replace(/\[[^\]]*\]/g, '');
  const id = /#([A-Za-z0-9_-]+)/.exec(rest);
  const noId = rest.replace(/#[A-Za-z0-9_-]+/g, '');
  const classes = noId.split('.').slice(1).filter(Boolean);
  const tag = noId.split('.')[0];

  if (tag && node.tag !== tag.toLowerCase()) {
    return false;
  }
  if (id && node.getAttribute('id') !== id[1]) {
    return false;
  }
  const own = ` ${node.className} `;
  if (classes.some(name => own.indexOf(` ${name} `) === -1)) {
    return false;
  }
  if (attr) {
    const value = node.getAttribute(attr[1]);
    if (value === null) {
      return false;
    }
    if (attr[3] !== undefined) {
      if (attr[2] === '*' && value.indexOf(attr[3]) === -1) {
        return false;
      }
      if (attr[2] === '^' && value.indexOf(attr[3]) !== 0) {
        return false;
      }
      if (attr[2] === '' && value !== attr[3]) {
        return false;
      }
    }
  }
  return true;
};

/* -------------------------------------------------------------------------- *
 * Zigly's real markup
 *
 * Structure and class names copied from the theme; the values are a test
 * customer's. Nothing here is invented shape -- see the file header for which
 * snippet each block comes from.
 * -------------------------------------------------------------------------- */

const el = (tag: string, className = '', attrs: Attrs = {}, text = '') =>
  new El(tag, className, attrs, text);

/** snippets/user-information.liquid -- the sidebar card. */
const userCard = () =>
  el('div', 'user-info-card').add(
    el('div', 'user-info').add(
      el('div', 'user-avatar').add(el('span', 'user-initials', {}, 'LB')),
      el('div', 'user-details').add(
        el('h2', 'user-name', {}, 'Hey, Lux Bhati'),
        el('p', 'user-login-info', {}, 'Logged in via ').add(
          // The MASKED phone. Must never be read as the customer's number.
          el('span', 'masked-phone', {}, '+9198*****21'),
        ),
      ),
    ),
  );

/** snippets/profile-right-content.liquid -- the disabled inputs. */
const profileTab = (over: Partial<Record<string, string>> = {}) =>
  el('div', 'tabcontent profile', {id: 'profile'}).add(
    el('div', 'user-info').add(
      el('div', 'info-field').add(
        el('label', '', {}, 'Full Name'),
        el('input', '', {
          id: 'fullName',
          type: 'text',
          disabled: 'disabled',
          value: over.fullName ?? 'Lux Kumar Bhati',
        }),
      ),
      el('div', 'info-field').add(
        el('label', '', {}, 'Email Address'),
        el('input', '', {
          id: 'email',
          type: 'email',
          disabled: 'disabled',
          value: over.email ?? 'lux@example.com',
        }),
      ),
      el('div', 'info-field').add(
        el('label', '', {}, 'Mobile Number*'),
        el('input', '', {
          id: 'mobileNumber',
          type: 'tel',
          disabled: 'disabled',
          value: over.mobileNumber ?? '9812345621',
        }),
      ),
    ),
  );

/** snippets/orders-right-content.liquid -- one order card. */
const orderCard = (name: string, total: string, status: string) =>
  el('div', 'order-card', {'data-order-status': status}).add(
    el('div', 'order-meta-header-label flex').add(
      el('p', 'order-meta-header-label-text', {}, 'Order Number ').add(
        el('span', 'order-number', {}, name),
      ),
      el('div', 'order-buttons flex').add(
        el('a', 'order-first-product-container no-underline', {
          href: `https://zigly.com/account/orders/tok-${name.slice(1)}#order`,
        }).add(el('p', 'order-details-button', {}, 'Order Details')),
      ),
    ),
    el('div', 'order-botom-container').add(
      el('div', 'order-details total-price').add(
        el('div', 'order-total').add(
          el('p', '', {}, 'TOTAL: ').add(
            el('span', 'total-main-price', {}, total),
          ),
        ),
      ),
    ),
  );

/** The whole account section, as the Section Rendering API returns it. */
const ziglyAccount = (orders: El[] = []) =>
  el('section', 'main-account page-width').add(
    el('div', 'flex customer-account-wrapper').add(
      el('div', 'left-tab tab').add(
        userCard(),
        // Saved Addresses is a TAB, not a route: this is the anchor the stock
        // reader mistook for Dawn's /account/addresses link.
        el('a', 'tablinks no-underline address', {href: '#address'}).add(
          el('p', 'menu-item-title', {}, 'Saved Addresses'),
        ),
        el('div', 'logout-button').add(
          el('a', 'no-underline', {href: '/account/logout'}).add(
            el('p', 'log-out-button', {}, 'LOGOUT'),
          ),
        ),
      ),
      el('div', 'right-content-container').add(
        profileTab(),
        el('div', 'tabcontent order', {id: 'order'}).add(
          el('div', 'order-history-container', {id: 'order-history-container'}).add(
            el('div', 'order-list-container').add(...orders),
          ),
        ),
      ),
    ),
  );

/* -------------------------------------------------------------------------- *
 * Running the real script
 * -------------------------------------------------------------------------- */

interface Reply {
  [key: string]: unknown;
}

/**
 * Execute ACCOUNT_PROBE with a stubbed fetch and DOM, and return what it
 * posted back.
 *
 * `finalUrl` is what `res.url` becomes -- the field the whole signed-in/out
 * verdict turns on, and the one fault 1 lives in.
 */
const runProbe = (root: El, finalUrl: string): {get: () => Reply | null} => {
  let reply: Reply | null = null;

  const win = {
    ReactNativeWebView: {
      postMessage: (json: string) => {
        reply = JSON.parse(json) as Reply;
      },
    },
  } as Record<string, unknown>;

  // The section route answers with JSON whose one string value is the markup.
  // Any markup will do: the DOMParser below ignores it and hands back the tree
  // built above, which is what lets the real selectors run against a real
  // structure without jsdom.
  const fetchStub = () =>
    Promise.resolve({
      url: finalUrl,
      status: 200,
      text: () =>
        Promise.resolve(JSON.stringify({'main-account': '<div>markup</div>'})),
    });

  /**
   * `ZA.parse` calls `new DOMParser()`, so this has to be a constructor.
   *
   * The returned document answers `querySelector` from the root itself as well
   * as its descendants -- a real document would match `.main-account` on the
   * section element, and `ZA.main` depends on that.
   */
  function DOMParserStub(this: Record<string, unknown>) {
    this.parseFromString = () => ({
      querySelector: (selector: string) =>
        matches(root, selector) ? root : root.querySelector(selector),
      querySelectorAll: (selector: string) => root.querySelectorAll(selector),
      body: root,
    });
  }

  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'fetch', 'DOMParser', ACCOUNT_PROBE);
  run(win, fetchStub, DOMParserStub);

  /*
   * A getter, not the value.
   *
   * The reply is posted from inside ZA.load's promise chain, which has not run
   * by the time this returns -- so returning `reply` here hands back the null
   * it holds at call time and every assertion reads null however long the test
   * then waits. The getter is read AFTER settle(), which is when the message
   * exists.
   */
  return {get: () => reply};
};

/**
 * Let the promise chain inside the script settle.
 *
 * `ZA.load` is two `.then` hops deep before it calls back, and the reply is
 * posted from inside that callback -- so a single microtask flush lands before
 * the message exists and every assertion reads null. Several turns of the
 * macrotask queue are drained instead, which is enough for both the section
 * path and the page-fallback path that adds a second fetch.
 */
const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  }
};

/* -------------------------------------------------------------------------- *
 * 1. The url test -- the bounce back to login
 * -------------------------------------------------------------------------- */

describe('a url that only mentions the login page', () => {
  /**
   * The reported fault: signed in, then thrown straight back to login.
   *
   * Shopify hangs `return_url` on its customer redirects, and the OTP hand-off
   * lands the customer on /account with the login page named in that
   * parameter. Read as a substring of the whole url, that says "signed out" --
   * and applyAuth believed it, resolveAuth collapsed the section to ['login'],
   * and the customer was back at the login screen seconds after signing in.
   */
  it('is signed IN when the login page is only a return_url', async () => {
    const probe = runProbe(
      ziglyAccount(),
      'https://zigly.com/account?return_url=/account/login',
    );
    await settle();
    expect(probe.get()).not.toBeNull();
    expect((probe.get() as unknown as Reply).state).toBe('signedIn');
  });

  it('is still signed OUT when the login page is the real destination', async () => {
    const probe = runProbe(
      ziglyAccount(),
      'https://zigly.com/account/login?return_url=/account',
    );
    await settle();
    expect((probe.get() as unknown as Reply).state).toBe('signedOut');
  });

  it('is signed in on the plain account page', async () => {
    const probe = runProbe(ziglyAccount(), 'https://zigly.com/account');
    await settle();
    expect((probe.get() as unknown as Reply).state).toBe('signedIn');
  });
});

/* -------------------------------------------------------------------------- *
 * 2. The profile -- read from the disabled inputs
 * -------------------------------------------------------------------------- */

describe("the customer, off Zigly's own page", () => {
  it('reads name, email and phone from the profile fields', async () => {
    const probe = runProbe(ziglyAccount(), 'https://zigly.com/account');
    await settle();
    const got = probe.get() as unknown as Reply;
    expect(got.name).toBe('Lux Kumar Bhati');
    expect(got.email).toBe('lux@example.com');
    expect(got.phone).toBe('9812345621');
  });

  it('never shows the masked sidebar phone as the number', async () => {
    // The card says "+9198*****21". That is not a phone number, and showing it
    // as one would be showing the customer a detail that is not theirs.
    const probe = runProbe(ziglyAccount(), 'https://zigly.com/account');
    await settle();
    expect(String((probe.get() as unknown as Reply).phone)).not.toContain('*');
  });

  it("falls back to the sidebar greeting, without the 'Hey,'", async () => {
    const page = el('section', 'main-account').add(userCard());
    const probe = runProbe(page, 'https://zigly.com/account');
    await settle();
    expect((probe.get() as unknown as Reply).name).toBe('Lux Bhati');
  });

  it('leaves an empty phone field empty rather than inventing one', async () => {
    const page = el('section', 'main-account').add(
      userCard(),
      profileTab({mobileNumber: ''}),
    );
    const probe = runProbe(page, 'https://zigly.com/account');
    await settle();
    expect((probe.get() as unknown as Reply).phone).toBe('');
  });
});

/* -------------------------------------------------------------------------- *
 * 3. The orders -- read from the cards
 * -------------------------------------------------------------------------- */

describe("the orders, off Zigly's own cards", () => {
  it('reads each order card', async () => {
    const page = ziglyAccount([
      orderCard('#1101', '₹1,299', 'fulfilled'),
      orderCard('#1102', '₹450', 'unfulfilled'),
    ]);
    const probe = runProbe(page, 'https://zigly.com/account');
    await settle();
    // The reply names the list `items`, not `orders` -- see ZA.send in the
    // bridge and parseOrders, which reads the same key.
    const orders = (probe.get() as unknown as Reply).items as Array<
      Record<string, string>
    >;
    expect(orders).toHaveLength(2);
    expect(orders[0].name).toBe('#1101');
    expect(orders[0].total).toBe('₹1,299');
    expect(orders[0].fulfillmentStatus).toBe('fulfilled');
    expect(orders[0].url).toContain('/account/orders/tok-1101');
    expect(orders[1].name).toBe('#1102');
  });

  it('reports no orders for a customer with none, without throwing', async () => {
    const probe = runProbe(ziglyAccount([]), 'https://zigly.com/account');
    await settle();
    expect((probe.get() as unknown as Reply).items).toEqual([]);
  });
});
