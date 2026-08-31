/**
 * The product page redesign: Description under the buy box, and open.
 *
 * ../src/webview/productPage.ts does the one thing on that page CSS cannot.
 * The theme renders Description and "Sub Category Description" in
 * .product-overview-accordion-section, collapsed, and puts that section BELOW
 * the reviews -- read off the live PDP on 2026-08-31. The reference app draws
 * it directly under the buy box, expanded. Sections are top-level siblings of
 * nothing in particular, so `order` cannot move it: the node is moved.
 *
 * The script is RUN, not just read, because everything that can be wrong here
 * is structural: WHERE the section lands, whether a second pass moves it again
 * (the bundle is re-applied on RESTYLE_DELAYS and runs seven times per load --
 * see ./injection.test.ts), and whether a panel the customer closed is
 * reopened under them.
 *
 * The DOM is hand-built rather than jsdom's, following ./concernCards.test.ts:
 * jsdom is not a dependency of this project. The stub carries only what the
 * script asks for -- class and attribute selectors, getAttribute/setAttribute,
 * parentNode/insertBefore, and a click that records itself.
 */
import {
  MOVED_FLAG,
  OPENED_FLAG,
  PRODUCT_PAGE_SCRIPT,
  SINGLE_FLAG,
} from '../src/webview/productPage';
/**
 * The gallery's own numbers, as the theme constructs them.
 *
 * 1.14 is the value read off the live page on 2026-08-31 -- the sliver of the
 * next photo the brief asks to remove -- and it is a Swiper constructor
 * argument, not CSS, which is why the script has to reach the instance.
 */
const THEME_SLIDES_PER_VIEW = 1.14;
import {MOBILE_CSS} from '../src/webview/injectedStyles';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 * -------------------------------------------------------------------------- */

interface Params {
  slidesPerView: number;
  breakpoints: {[k: string]: {slidesPerView: number} | null} | null;
  loop?: boolean;
  rewind?: boolean;
  autoplay?: {delay: number} | false;
  [k: string]: unknown;
}

/**
 * A Swiper, as the widget exposes itself.
 *
 * Modelled on the real one where the script depends on it, and no further:
 *
 *   element.swiper   how an instance somebody else built is reached.
 *   params           the LIVE settings, including the breakpoint map re-read
 *                    on every resize.
 *   passedParams     what the constructor was originally called with. This is
 *                    what a rebuild must be built from, so that nothing about
 *                    the gallery is re-specified by this app.
 *   destroy()        marks itself destroyed and detaches, as the real one does.
 *   update()         re-measures. Setting slidesPerView without calling it
 *                    leaves the old width on screen.
 *
 * `built` records every construction, so a test can prove a rebuild happened
 * once and with which parameters -- the whole question for loop.
 */
const built: Array<{el: El; params: Params}> = [];

class Swiper {
  updates = 0;
  destroyed = false;
  params: Params;
  passedParams: Params;
  el: El;

  constructor(el: El, params: Partial<Params> = {}) {
    const full: Params = {
      slidesPerView: THEME_SLIDES_PER_VIEW,
      breakpoints: {
        '0': {slidesPerView: THEME_SLIDES_PER_VIEW},
        '750': {slidesPerView: THEME_SLIDES_PER_VIEW},
      },
      // The theme's own defaults for a 3+ photo gallery: it loops, and it
      // advances by itself.
      loop: true,
      rewind: false,
      autoplay: {delay: 5000},
      ...params,
    };
    this.params = full;
    /*
     * A SHALLOW copy, exactly as Swiper keeps it -- params and passedParams
     * share their nested objects. That sharing is the trap the script's own
     * pinToOne() rewrites breakpoints to avoid, so the stub has to reproduce it
     * or the test cannot catch it.
     */
    this.passedParams = {...full};
    this.el = el;
    el.swiper = this;
    built.push({el, params: full});
  }

  destroy() {
    this.destroyed = true;
    if (this.el.swiper === this) {
      delete this.el.swiper;
    }
  }

  update() {
    this.updates++;
  }
}

class El {
  tag: string;
  id = '';
  className = '';
  nodeType = 1;
  children: El[] = [];
  parentNode: El | null = null;
  attrs: {[k: string]: string} = {};
  /** Every click the script sent to this element. */
  clicks = 0;
  /** Present only on the slider element, exactly as Swiper attaches it. */
  swiper?: Swiper;

  constructor(tag: string) {
    this.tag = tag.toLowerCase();
  }

  appendChild(child: El): El {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: El): El {
    const at = this.children.indexOf(child);
    if (at !== -1) {
      this.children.splice(at, 1);
    }
    child.parentNode = null;
    return child;
  }

  /**
   * The real insertBefore, including the part this script depends on: a node
   * already in the tree is MOVED, not copied, so it leaves its old position.
   * `ref` null appends, as the DOM does.
   */
  insertBefore(node: El, ref: El | null): El {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
    node.parentNode = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at === -1) {
      this.children.push(node);
    } else {
      this.children.splice(at, 0, node);
    }
    return node;
  }

  get nextSibling(): El | null {
    if (!this.parentNode) {
      return null;
    }
    const at = this.parentNode.children.indexOf(this);
    return this.parentNode.children[at + 1] || null;
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
    if (name === 'class') {
      this.className = value;
    }
    if (name === 'id') {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'id') {
      return this.id || null;
    }
    if (name === 'class') {
      return this.className || null;
    }
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  /**
   * A click, as the theme's accordion would handle it: the header flips its own
   * aria-expanded and its panel's aria-hidden. Recorded, so a test can tell a
   * press apart from a state that was already right.
   */
  click() {
    this.clicks++;
    if (this.getAttribute('data-accordion-header') === null) {
      return;
    }
    const open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', open ? 'false' : 'true');
    const panel = this.parentNode
      ? this.parentNode.querySelector('[data-accordion-content]')
      : null;
    if (panel) {
      panel.setAttribute('aria-hidden', open ? 'true' : 'false');
    }
  }

  /** Every node in this subtree, self first. */
  walk(): El[] {
    return this.children.reduce<El[]>(
      (all, c) => all.concat(c.walk()),
      [this as El],
    );
  }

  /** The ancestor chain, nearest first -- for descendant selectors. */
  private ancestors(): El[] {
    const out: El[] = [];
    let node = this.parentNode;
    while (node) {
      out.push(node);
      node = node.parentNode;
    }
    return out;
  }

  private matches(sel: string): boolean {
    if (sel.indexOf(',') !== -1) {
      return sel.split(',').some(part => this.matches(part.trim()));
    }
    /*
     * Descendant selectors, right to left -- `.product-slider .main-slider` is
     * the shape the script uses to find the gallery, and the theme's own CSS
     * uses the same one. Without this the stub answers null where a browser
     * matches, which is a test that passes for the wrong reason.
     */
    const parts = sel.trim().split(/\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (!this.matches(last)) {
        return false;
      }
      // Each remaining part must be found somewhere up the chain, in order.
      let chain = this.ancestors();
      for (let i = parts.length - 2; i >= 0; i--) {
        const at = chain.findIndex(a => a.matches(parts[i]));
        if (at === -1) {
          return false;
        }
        chain = chain.slice(at + 1);
      }
      return true;
    }
    // The shapes the script uses: .class, #id, [attr], [attr="value"].
    let head = sel;
    let attr = '';
    const br = sel.indexOf('[');
    if (br !== -1) {
      attr = sel.slice(br + 1, sel.lastIndexOf(']'));
      head = sel.slice(0, br);
    }
    if (head.charAt(0) === '#') {
      if (this.id !== head.slice(1)) {
        return false;
      }
    } else if (head.charAt(0) === '.') {
      if (this.className.split(/\s+/).indexOf(head.slice(1)) === -1) {
        return false;
      }
    } else if (head && this.tag !== head.toLowerCase()) {
      return false;
    }
    if (attr) {
      const eq = attr.indexOf('=');
      if (eq === -1) {
        if (this.getAttribute(attr) === null) {
          return false;
        }
      } else {
        const name = attr.slice(0, eq);
        const want = attr.slice(eq + 1).replace(/["']/g, '');
        if (this.getAttribute(name) !== want) {
          return false;
        }
      }
    }
    return true;
  }

  querySelectorAll(sel: string): El[] {
    return this.walk().filter(el => el !== this && el.matches(sel));
  }

  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] || null;
  }
}

interface Spec {
  tag: string;
  id?: string;
  cls?: string;
  attrs?: {[k: string]: string};
  kids?: Spec[];
}

const build = (spec: Spec): El => {
  const el = new El(spec.tag);
  if (spec.id) {
    el.id = spec.id;
  }
  if (spec.cls) {
    el.className = spec.cls;
  }
  Object.entries(spec.attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  (spec.kids || []).forEach(kid => el.appendChild(build(kid)));
  return el;
};

/* -------------------------------------------------------------------------- *
 * The page, as the live PDP is shaped
 * -------------------------------------------------------------------------- */

/**
 * One collapsed accordion: the theme's header + panel pair.
 *
 * The ids carry the template suffix the real page carries
 * (`AccordionTrigger-Features-template--26530985017660__product_overview_...`),
 * because that suffix is exactly why the script and the CSS both match on a
 * SUBSTRING. A fixture with clean ids would let an equality match pass here and
 * fail on the real page.
 */
const SUFFIX = '-template--123__product_overview_accordion_KfCLAQ';

const accordion = (name: string): Spec => ({
  tag: 'div',
  cls: 'accordion',
  kids: [
    {
      tag: 'button',
      cls: 'accordion-header',
      id: 'AccordionTrigger-' + name + SUFFIX,
      attrs: {'data-accordion-header': '', 'aria-expanded': 'false'},
    },
    {
      tag: 'div',
      cls: 'accordion-content',
      id: 'AccordionContent-' + name + SUFFIX,
      attrs: {'data-accordion-content': '', 'aria-hidden': 'true'},
    },
  ],
});

/** The main product section: gallery column plus the info container. */
const MAIN: Spec = {
  tag: 'section',
  id: 'shopify-section-template--123__main',
  kids: [
    {tag: 'div', cls: 'product-slider', kids: [{tag: 'div', cls: 'main-slider'}]},
    {
      tag: 'section',
      cls: 'product__info-container product__column-sticky',
      kids: [
        {tag: 'div', cls: 'product__title'},
        {tag: 'div', cls: 'price-main-container'},
        {
          tag: 'div',
          cls: 'product__buy-buttons-container',
          kids: [{tag: 'div', cls: 'product-form__quantity'}],
        },
      ],
    },
  ],
};

const REVIEWS: Spec = {
  tag: 'section',
  id: 'shopify-section-template--123__1774252693',
  kids: [{tag: 'div', id: 'judgeme_product_reviews'}],
};

const DESCRIPTION: Spec = {
  tag: 'section',
  id: 'shopify-section-template--123__product_overview_accordion_KfCLAQ',
  cls: 'shopify-section section product-overview-accordion-section',
  kids: [
    {
      tag: 'div',
      cls: 'product-overview-wrapper page-width',
      kids: [
        {
          tag: 'div',
          // The three the theme ships, in the order it ships them: Product
          // Details, Key Features, More Information.
          kids: [
            accordion('Details'),
            accordion('Features'),
            accordion('Information'),
          ],
          cls: 'product-overview-section product__description',
        },
      ],
    },
  ],
};

/**
 * The theme's own order: main, related, reviews, and description LAST -- with
 * a live Swiper on the gallery, built at the theme's own 1.14.
 */
const pdp = (params: Partial<Params> = {}): El => {
  const body = build({
    tag: 'body',
    cls: 'template-product zigly-product',
    kids: [
      MAIN,
      {tag: 'section', id: 'shopify-section-template--123__related-products'},
      REVIEWS,
      DESCRIPTION,
    ],
  });
  const slider = body.querySelector('.main-slider');
  if (slider) {
    // Constructing it attaches it to the element, exactly as the theme's own
    // init does -- that attachment is the point, and is why the instance is
    // not kept here.
    const attached = new Swiper(slider, params);
    expect(slider.swiper).toBe(attached);
  }
  // The gallery's own construction is the theme's, not the script's.
  built.length = 0;
  return body;
};

/**
 * The gallery's CURRENT Swiper -- which is a different object after a rebuild,
 * so this is always re-read from the element rather than captured once.
 */
const gallery = (body: El): Swiper => {
  const slider = body.querySelector('.main-slider');
  expect(slider).not.toBeNull();
  const swiper = (slider as El).swiper;
  expect(swiper).toBeDefined();
  return swiper as Swiper;
};

/** The slider element itself, which survives a rebuild. */
const sliderOf = (body: El): El => {
  const slider = body.querySelector('.main-slider');
  expect(slider).not.toBeNull();
  return slider as El;
};

/** One accordion's header, by its block name. */
const headerNamed = (body: El, name: string): El => {
  const found = body.querySelector(
    '[id=AccordionTrigger-' + name + SUFFIX + ']',
  );
  expect(found).not.toBeNull();
  return found as El;
};

/**
 * Run the real script against a body.
 *
 * readyState is 'complete', so the script's own first sweep runs inline --
 * which is the path every case here exercises. setInterval is a no-op that
 * hands back a token: nothing in these cases needs the retry, and a stub timer
 * that actually fired would make the assertions depend on tick order.
 */
const run = (
  body: El,
  path = '/products/zl-bobo-bear-squeaker-dog-toy',
  /**
   * The Swiper constructor the page offers, so a test can withhold it or hand
   * over one that throws. Defaults to the working stub; `null` means the widget
   * never loaded, which is a case the script has to survive.
   */
  ctor: unknown = Swiper,
): El => {
  const win: Record<string, unknown> = {};
  const doc = {
    body,
    readyState: 'complete',
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    querySelector: (sel: string) => body.querySelector(sel),
    createElement: (tag: string) => new El(tag),
    addEventListener: () => undefined,
  };
  win.document = doc;
  win.location = {pathname: path};
  // The constructor the script rebuilds through. Present on the real page
  // because the theme loaded swiper-bundle.min.js to build the gallery at all.
  if (ctor) {
    win.Swiper = ctor;
  }
  // eslint-disable-next-line no-new-func
  new Function(
    'window',
    'document',
    'setInterval',
    'clearInterval',
    PRODUCT_PAGE_SCRIPT,
  )(win, doc, () => 1, () => undefined);
  return body;
};

/**
 * Run it a second time on the same body, the way the re-injection schedule
 * does -- with a fresh `window`, because each injection is its own evaluation
 * and the module's own guard only stops a re-run inside one.
 */
const runTwice = (body: El, path?: string): El => {
  run(body, path);
  return run(body, path);
};

const descriptionAt = (body: El): number =>
  body.children.findIndex(
    el =>
      el.className.indexOf('product-overview-accordion-section') !== -1,
  );

const mainAt = (body: El): number =>
  body.children.findIndex(el => el.id.indexOf('__main') !== -1);

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

describe('the product page script', () => {
  it('parses', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(PRODUCT_PAGE_SCRIPT)).not.toThrow();
  });

  it('is part of the injection every navigation carries', () => {
    const script = getInjectionForUrl(
      'https://zigly.com/products/zl-bobo-bear-squeaker-dog-toy',
    ) as string;
    expect(script).toContain('__ziglyProductPage');
  });

  it('carries no backtick, which would truncate the payload', () => {
    // A backtick anywhere in one of these literals -- a comment included --
    // ends the literal there and silently drops everything after it.
    expect(PRODUCT_PAGE_SCRIPT).not.toContain(String.fromCharCode(96));
  });

  it('uses no regex, whose backslashes this build would eat', () => {
    expect(PRODUCT_PAGE_SCRIPT).not.toContain('replace(/');
    expect(PRODUCT_PAGE_SCRIPT).not.toContain('match(/');
  });
});

describe('where Description ends up', () => {
  it('moves it from below the reviews to directly under the buy box', () => {
    const body = pdp();
    // The theme's order, for the record: description is last.
    expect(descriptionAt(body)).toBe(body.children.length - 1);

    run(body);
    expect(descriptionAt(body)).toBe(mainAt(body) + 1);
  });

  it('leaves the reviews and the recommendations after it', () => {
    // Requirement order: description, then Write a review, then People Also
    // Bought. Both of those come from app blocks further down, so all this has
    // to guarantee is that the description got in front of them.
    const body = run(pdp());
    const reviews = body.children.findIndex(
      el => el.querySelector('#judgeme_product_reviews') !== null,
    );
    expect(descriptionAt(body)).toBeLessThan(reviews);
  });

  it('does not move it twice when the bundle is re-injected', () => {
    /*
     * The bundle runs seven times per page load. A move that re-ran would walk
     * the section down the page one sibling at a time.
     */
    const body = pdp();
    run(body);
    const settled = descriptionAt(body);
    run(body);
    run(body);
    expect(descriptionAt(body)).toBe(settled);
    expect(body.children.length).toBe(4);
  });

  it('marks the section, so the second pass can tell', () => {
    const body = run(pdp());
    const section = body.children[descriptionAt(body)];
    expect(section.getAttribute(MOVED_FLAG)).toBe('true');
  });
});

describe('opening Product Details, and only that', () => {
  it('expands Product Details by pressing its own header', () => {
    const body = run(pdp());
    const details = headerNamed(body, 'Details');
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(details.clicks).toBe(1);
  });

  it('unhides its panel, which is what the customer actually sees', () => {
    // Asserted through aria-hidden rather than through the click count: the
    // point is the panel, and the click is only how we get there.
    const body = run(pdp());
    const panel = body.querySelector(
      '[id=AccordionContent-Details' + SUFFIX + ']',
    );
    expect(panel).not.toBeNull();
    expect((panel as El).getAttribute('aria-hidden')).toBe('false');
  });

  it('never touches Key Features or More Information', () => {
    /*
     * They are hidden by the stylesheet, so a click here would be the script
     * animating a panel nobody can see -- and, on a browser without :has(),
     * expanding a block the fallback rules leave partly on the page.
     */
    const body = run(pdp());
    ['Features', 'Information'].forEach(name => {
      const header = headerNamed(body, name);
      expect(header.clicks).toBe(0);
      expect(header.getAttribute('aria-expanded')).toBe('false');
      // Not marked either: the sweep skipped it before it got that far.
      expect(header.getAttribute(OPENED_FLAG)).toBeNull();
    });
  });

  it('never presses a header the theme already shipped open', () => {
    // A click on an expanded accordion CLOSES it, which would hide the very
    // thing this is here to show.
    const body = pdp();
    headerNamed(body, 'Details').setAttribute('aria-expanded', 'true');
    run(body);
    const details = headerNamed(body, 'Details');
    expect(details.clicks).toBe(0);
    expect(details.getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves a panel the customer closed closed', () => {
    /*
     * The re-injection schedule is what makes this a real case: without the
     * marker, every re-run would reopen Description a moment after the customer
     * collapsed it, and it would read as a page fighting back.
     */
    const body = run(pdp());
    const header = headerNamed(body, 'Details');
    header.click(); // the customer collapses it again
    expect(header.getAttribute('aria-expanded')).toBe('false');

    run(body);
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });

  it('marks the header it opened', () => {
    const body = run(pdp());
    expect(headerNamed(body, 'Details').getAttribute(OPENED_FLAG)).toBe('true');
  });
});

describe('one whole photo per swipe', () => {
  it('pins the gallery to a single slide', () => {
    // The theme builds it at 1.14 -- the 0.14 is the peeking second photo.
    const body = pdp();
    expect(gallery(body).params.slidesPerView).toBe(THEME_SLIDES_PER_VIEW);
    run(body);
    expect(gallery(body).params.slidesPerView).toBe(1);
  });

  it('pins the breakpoints too, so a rotation does not bring the peek back', () => {
    /*
     * Swiper re-reads its breakpoint map on resize and on orientation change.
     * Setting only the live value would look fixed until the phone turned.
     */
    const body = run(pdp());
    const points = gallery(body).params.breakpoints as {
      [k: string]: {slidesPerView: number};
    };
    expect(Object.keys(points).length).toBeGreaterThan(0);
    Object.keys(points).forEach(key => {
      expect(points[key].slidesPerView).toBe(1);
    });
  });

  it('does not need a rebuild when the gallery already stops', () => {
    // One photo, or a theme that changed its mind: the cheap path is enough,
    // and tearing a working instance down for nothing would be the bug.
    const body = pdp({loop: false, rewind: false, autoplay: false});
    const before = gallery(body);
    run(body);
    expect(built.length).toBe(0);
    expect(before.destroyed).toBe(false);
    expect(before.params.slidesPerView).toBe(1);
    expect(before.updates).toBeGreaterThan(0);
  });
});

describe('swipe to the end, then swipe back', () => {
  /*
   * The brief: the gallery must STOP at the last photo, not wrap round to the
   * first. The theme ships all three ways of not stopping -- loop for 3+
   * photos, rewind for exactly 2, and autoplay on top of either.
   *
   * loop cannot be assigned away: Swiper builds the track from it, clones and
   * all, so the instance has to be rebuilt. These are the tests that prove the
   * rebuild happened and that it was built from the THEME's parameters.
   */
  it('rebuilds the looping gallery without the loop', () => {
    const body = pdp({loop: true});
    const original = gallery(body);
    run(body);

    expect(original.destroyed).toBe(true);
    expect(built.length).toBe(1);
    expect(built[0].params.loop).toBe(false);
    expect(gallery(body).params.loop).toBe(false);
  });

  it('turns off rewind, the two-photo version of the same wrap', () => {
    // rewind and loop are mutually exclusive in Swiper, so a stale rewind left
    // on would simply take over from the loop that was just removed.
    const body = pdp({loop: false, rewind: true, autoplay: false});
    run(body);
    expect(built.length).toBe(1);
    expect(built[0].params.rewind).toBe(false);
    expect(built[0].params.loop).toBe(false);
  });

  it('stops the gallery advancing on its own', () => {
    const body = pdp({loop: false, rewind: false, autoplay: {delay: 5000}});
    run(body);
    expect(built.length).toBe(1);
    expect(built[0].params.autoplay).toBe(false);
  });

  it("rebuilds from the theme's own parameters, re-specifying nothing", () => {
    /*
     * The standing rule for this app: the gallery stays Zigly's. Only the four
     * settings the redesign is about may differ from what the theme passed --
     * everything else must come through untouched, including settings this app
     * has never heard of.
     */
    const body = pdp({loop: true, speed: 500, zoom: true, grabCursor: true});
    run(body);
    const rebuilt = built[0].params;
    expect(rebuilt.speed).toBe(500);
    expect(rebuilt.zoom).toBe(true);
    expect(rebuilt.grabCursor).toBe(true);
  });

  it('leaves swiping itself alone', () => {
    // "Swipe to the end then swipe back" is still swiping. Touch handling and
    // the track's transform are the widget's business.
    const body = pdp({loop: true, allowTouchMove: true});
    run(body);
    expect(built[0].params.allowTouchMove).toBe(true);
    expect(PRODUCT_PAGE_SCRIPT).not.toContain('allowTouchMove =');
  });

  it('pins the count on the rebuilt instance, not just the old one', () => {
    const body = pdp({loop: true});
    run(body);
    expect(built[0].params.slidesPerView).toBe(1);
    const points = built[0].params.breakpoints as {
      [k: string]: {slidesPerView: number};
    };
    Object.keys(points).forEach(key => {
      expect(points[key].slidesPerView).toBe(1);
    });
  });

  it('rebuilds once, however many times the bundle is re-injected', () => {
    /*
     * The injection runs seven times per page load and the sweep retries within
     * each run. A rebuild per pass would destroy a working gallery over and
     * over, and every destroy resets the photo the customer was looking at.
     */
    const body = pdp({loop: true});
    run(body);
    run(body);
    run(body);
    expect(built.length).toBe(1);
    expect(sliderOf(body).getAttribute(SINGLE_FLAG)).toBe('true');
  });
});

describe('when the gallery cannot be rebuilt', () => {
  it('survives a slider with no Swiper on it', () => {
    // The widget failing to load must cost the fix, not the page.
    const body = pdp();
    delete sliderOf(body).swiper;
    expect(() => run(body)).not.toThrow();
  });

  it('survives a Swiper with no breakpoints', () => {
    const body = pdp({loop: false, rewind: false, autoplay: false});
    const swiper = gallery(body);
    swiper.params.breakpoints = null;
    expect(() => run(body)).not.toThrow();
    expect(swiper.params.slidesPerView).toBe(1);
  });

  it('keeps the gallery it has when the constructor is missing', () => {
    /*
     * No constructor means nothing safe to rebuild from -- so the loop stays,
     * and the gallery keeps working. Destroying it anyway would leave a static
     * stack of full-width photos, which is far worse than one that wraps.
     */
    const body = pdp({loop: true});
    const original = gallery(body);
    expect(() => run(body, undefined, null)).not.toThrow();

    expect(original.destroyed).toBe(false);
    // The count is still worth having: one whole photo that wraps beats 1.14.
    expect(original.params.slidesPerView).toBe(1);
  });

  it('puts a gallery back if the rebuild throws', () => {
    /*
     * destroy() has already run by this point, so a rebuild that throws would
     * otherwise leave the page with no gallery at all -- every photo stacked at
     * full width. The originals go back in.
     */
    const body = pdp({loop: true});
    let calls = 0;
    class Failing extends Swiper {
      constructor(el: El, params: Partial<Params> = {}) {
        super(el, params);
        calls++;
        // Fail the first construction (the fixed one), allow the recovery.
        if (calls === 1) {
          throw new Error('rebuild failed');
        }
      }
    }
    expect(() => run(body, undefined, Failing)).not.toThrow();

    // Two attempts: the fixed parameters, then the theme's originals.
    expect(calls).toBe(2);
    // ...and the page has a gallery again, on the theme's own settings.
    expect(gallery(body).params.loop).toBe(true);
  });
});

describe('what it refuses to do', () => {
  it('does nothing at all off a product page', () => {
    // The bundle is injected on every navigation; the flag rules are scoped to
    // body.zigly-product and this script must scope itself the same way.
    const body = pdp();
    run(body, '/collections/dog-toys');
    expect(descriptionAt(body)).toBe(body.children.length - 1);
    expect(body.querySelectorAll('[data-accordion-header]')[0].clicks).toBe(0);
    // The listing's own rails are Swipers too, and must keep their peek.
    expect(gallery(body).params.slidesPerView).toBe(THEME_SLIDES_PER_VIEW);
  });

  it('leaves a page with no description section exactly as it was', () => {
    // A template this has not seen must cost the reorder, not the page.
    const body = build({tag: 'body', kids: [MAIN, REVIEWS]});
    expect(() => run(body)).not.toThrow();
    expect(body.children.length).toBe(2);
    expect(body.children[0].id).toContain('__main');
  });

  it('leaves the description where it is when there is no buy box to anchor to', () => {
    const body = build({tag: 'body', kids: [REVIEWS, DESCRIPTION]});
    run(body);
    expect(descriptionAt(body)).toBe(1);
  });

  it('adds nothing to the page and removes nothing from it', () => {
    /*
     * The standing rule: the data is the site's, the view is ours. This script
     * is one insertBefore and some clicks -- no node it created, none it
     * deleted.
     */
    const body = pdp();
    const before = body.walk().length;
    runTwice(body);
    expect(body.walk().length).toBe(before);
  });
});

describe('the stylesheet that does the rest', () => {
  /*
   * The layout requirements are CSS, and the CSS is a compiled string, so these
   * assertions are what stop a rule being dropped silently. Each one names the
   * requirement it serves.
   */
  it('shows one image at a time, by clipping and full-width slides', () => {
    expect(MOBILE_CSS).toContain(
      'body.zigly-product .product-slider .main-slider {',
    );
    expect(MOBILE_CSS).toContain(
      'body.zigly-product .product-slider .main-slider .swiper-slide {',
    );
  });

  it('shows it much bigger: a square, contained, at the full column width', () => {
    const at = MOBILE_CSS.indexOf(
      'body.zigly-product .product-slider .main-slider .productImage',
    );
    expect(at).toBeGreaterThan(-1);
    const rule = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at));
    expect(rule).toContain('width: 100% !important');
    expect(rule).toContain('object-fit: contain !important');
    expect(MOBILE_CSS).toContain('aspect-ratio: 1 / 1 !important');
  });

  it('never freezes the swiper it is restyling', () => {
    /*
     * The theme changes slides by transforming .swiper-wrapper. A rule against
     * that transform would leave the gallery stuck on the first photo -- and the
     * dots would then be lying about there being a second one.
     */
    // Only the rules this block writes: every selector in the stylesheet that
    // is scoped to the product page's gallery, and nothing else.
    const scoped = MOBILE_CSS.split('\n')
      .filter(line => line.indexOf('body.zigly-product .product-slider') === 0)
      .join('\n');
    expect(scoped).not.toBe('');
    expect(scoped).not.toContain('.swiper-wrapper');
    // ...and no rule anywhere in the block stops the track moving.
    const start = MOBILE_CSS.indexOf('body.zigly-product .product-slider');
    const end = MOBILE_CSS.indexOf('body.zigly-product .product__info-container');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(MOBILE_CSS.slice(start, end)).not.toContain('transform:');
  });

  it('keeps the pagination dots, the only sign a second photo exists', () => {
    // The thumbnails are hidden and the peeking neighbour is clipped, so the
    // dots are all that is left. A rule hiding them would be the bug.
    expect(MOBILE_CSS).not.toContain(
      'body.zigly-product .product-media-pagination {\n  display: none',
    );
  });

  it('clears the tail between the price and the quantity', () => {
    const at = MOBILE_CSS.indexOf(
      'body.zigly-product .product__info-container .product-extra-offer',
    );
    expect(at).toBeGreaterThan(-1);
    const block = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at));
    expect(block).toContain('.pdp_pincode_container');
    expect(block).toContain('display: none !important');
  });

  it('keeps the variant chooser, without which Add to Bag cannot succeed', () => {
    /*
     * The native bar presses the theme's own submit. A product with sizes
     * refuses that submit until a size is chosen, so hiding the chooser would
     * make Add to Bag fail with a message the customer could not act on.
     */
    expect(MOBILE_CSS).not.toContain('body.zigly-product .product-variant-selects');
    expect(MOBILE_CSS).not.toContain('body.zigly-product variant-selects');
  });

  it('keeps the shipping note the reference draws under the price', () => {
    expect(MOBILE_CSS).not.toContain('body.zigly-product .product__tax');
  });

  it('lays the quantity row out as label-left, stepper-right', () => {
    const at = MOBILE_CSS.indexOf('body.zigly-product .product-form__quantity');
    expect(at).toBeGreaterThan(-1);
    const rule = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at));
    expect(rule).toContain('justify-content: space-between !important');
  });

  it('drops Key Features and More Information', () => {
    // Matched on the block name inside the id, never on position: an nth-child
    // rule would hide the description the moment the blocks were reordered.
    ['Features', 'Information'].forEach(name => {
      expect(MOBILE_CSS).toContain('AccordionTrigger-' + name + '-');
      expect(MOBILE_CSS).toContain('AccordionContent-' + name + '-');
    });
  });

  it('keeps Product Details, which is the one the brief expands', () => {
    // The mirror of the rule above: if this ever appears in a hiding rule, the
    // page has lost the description it was redesigned to show.
    expect(MOBILE_CSS).not.toContain('AccordionTrigger-Details-');
    expect(MOBILE_CSS).not.toContain('AccordionContent-Details-');
  });

  it('removes Frequently Bought Together', () => {
    // Selleasy's block, high in the info column.
    const at = MOBILE_CSS.indexOf('body.zigly-product .lb-widget-bl');
    expect(at).toBeGreaterThan(-1);
    expect(MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at))).toContain(
      'display: none !important',
    );
  });

  it("keeps People Also Bought, which is the theme's own rail", () => {
    /*
     * Got wrong once: that rail is <product-recommendations> in the
     * related-products section, NOT the Selleasy block hidden above. Hiding
     * .product-recommendation-wrapper would take the reference's last section
     * off the page.
     */
    expect(MOBILE_CSS).toContain(
      'body.zigly-product .product-recommendation-wrapper',
    );
    const at = MOBILE_CSS.indexOf(
      'body.zigly-product .product-recommendation-wrapper',
    );
    expect(MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at))).not.toContain(
      'display: none',
    );
    expect(MOBILE_CSS).toContain('body.zigly-product #judgeme_product_reviews');
  });

  it('does not reserve height for a widget that may never fill', () => {
    // Both are app blocks, absent from the first parse. A min-height would
    // leave a hole on a page where one failed to load.
    const at = MOBILE_CSS.indexOf('body.zigly-product #judgeme_product_reviews');
    const rule = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf('}', at));
    expect(rule).not.toContain('min-height');
  });
});
