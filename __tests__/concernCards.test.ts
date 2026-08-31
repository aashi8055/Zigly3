/**
 * Care by Concern: the whole card redirects where "Shop now" redirects.
 *
 * The section is Zigly's own markup, transplanted, and in it only the "Shop
 * now" anchor is tappable -- so the photo, which is the biggest thing on the
 * card, did nothing. concernCards.ts moves the card's contents into an anchor
 * carrying that card's own destination.
 *
 * The script is RUN, not just read, because the two things that can be wrong
 * here are both structural: WHERE the anchor ends up -- an anchor inside an
 * anchor is invalid and the browser unnests it in whatever way it likes -- and
 * whether a second pass stacks a second wrapper, since the whole bundle is
 * re-applied on RESTYLE_DELAYS and runs seven times per page load.
 *
 * The DOM is hand-built rather than jsdom's, following ./facetBridge.test.ts
 * and ./searchBandSection.test.ts: jsdom is not a dependency of this project.
 * It carries only what the script asks for -- an id substring query, class and
 * attribute selectors, createElement, append/remove, and children.
 */
import {CONCERN_CARDS_SCRIPT} from '../src/webview/concernCards';
import {MOBILE_CSS} from '../src/webview/injectedStyles';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 * -------------------------------------------------------------------------- */

class El {
  tag: string;
  id = '';
  className = '';
  nodeType = 1;
  children: El[] = [];
  parentNode: El | null = null;
  attrs: {[k: string]: string} = {};
  style: {[k: string]: string} = {};
  text = '';

  constructor(tag: string) {
    this.tag = tag.toLowerCase();
  }

  /** The script reads textContent to name the link. */
  get textContent(): string {
    return this.children.length
      ? this.children.map(c => c.textContent).join('')
      : this.text;
  }
  set textContent(value: string) {
    this.children = [];
    this.text = value;
  }

  get firstChild(): El | null {
    return this.children.length > 0 ? this.children[0] : null;
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

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
    if (name === 'class') {
      this.className = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'href' && !('href' in this.attrs)) {
      return null;
    }
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  removeAttribute(name: string) {
    delete this.attrs[name];
  }

  /** Every node in this subtree, self first. */
  walk(): El[] {
    return this.children.reduce<El[]>(
      (all, c) => all.concat(c.walk()),
      [this as El],
    );
  }

  private matches(sel: string): boolean {
    // Only the selector shapes the script actually uses.
    if (sel.indexOf(',') !== -1) {
      return sel.split(',').some(part => this.matches(part.trim()));
    }
    // a.shop_now / a[href*="..."] / a[href] / .class / tag
    let tag = sel;
    let cls = '';
    let attr = '';
    const br = sel.indexOf('[');
    if (br !== -1) {
      attr = sel.slice(br + 1, sel.lastIndexOf(']'));
      tag = sel.slice(0, br);
    }
    const dot = tag.indexOf('.');
    if (dot !== -1) {
      cls = tag.slice(dot + 1);
      tag = tag.slice(0, dot);
    }
    if (tag && this.tag !== tag.toLowerCase()) {
      return false;
    }
    if (cls && this.className.split(/\s+/).indexOf(cls) === -1) {
      return false;
    }
    if (attr) {
      // href, or href*="needle"
      const star = attr.indexOf('*=');
      if (star === -1) {
        if (this.getAttribute(attr) === null) {
          return false;
        }
      } else {
        const name = attr.slice(0, star);
        const needle = attr.slice(star + 2).replace(/["']/g, '');
        const value = this.getAttribute(name);
        if (value === null || value.indexOf(needle) === -1) {
          return false;
        }
      }
    }
    return true;
  }

  querySelectorAll(sel: string): El[] {
    // The id-substring form the script uses to find the section.
    const idStar = sel.match(/^\[id\*="(.+)"\]$/);
    if (idStar) {
      return this.walk().filter(
        el => el !== this && el.id.indexOf(idStar[1]) !== -1,
      );
    }
    return this.walk().filter(el => el !== this && el.matches(sel));
  }

  querySelector(sel: string): El | null {
    return this.querySelectorAll(sel)[0] || null;
  }
}

/**
 * Build a tree from a compact spec, rather than parsing HTML -- the stub has no
 * parser, and spelling the tree out is what the other DOM tests here do.
 */
interface Spec {
  tag: string;
  id?: string;
  cls?: string;
  href?: string;
  text?: string;
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
  if (spec.href !== undefined) {
    el.setAttribute('href', spec.href);
  }
  if (spec.text !== undefined) {
    el.textContent = spec.text;
  }
  (spec.kids || []).forEach(kid => el.appendChild(build(kid)));
  return el;
};

/** One concern card: a photo, a heading and a "Shop now". */
const card = (name: string, href: string | undefined, cls = 'shop_now'): Spec => ({
  tag: 'div',
  cls: 'concern-card',
  kids: [
    {tag: 'div', cls: 'img-wrap', kids: [{tag: 'img'}]},
    {tag: 'h3', text: name},
    ...(href === undefined
      ? []
      : [{tag: 'a', cls, href, text: 'Shop now'} as Spec]),
  ],
});

/** The section's shape: a heading row and a grid of cards. */
const section = (id: string, cards: Spec[]): Spec => ({
  tag: 'div',
  id,
  kids: [
    {tag: 'div', cls: 'top-head-wrapper', kids: [{tag: 'h2', text: 'Care by Concern'}]},
    {tag: 'div', cls: 'concern-grid', kids: cards},
  ],
});

const DEFAULT_CARDS = [
  card('Skin & Coat', '/collections/skin-coat'),
  card('Digestive Care', '/collections/digestive-care'),
];

/**
 * Run the real script against a body.
 *
 * MutationObserver is left undefined: every case here has the section on the
 * page already, so the script's own first sweep does the work, and the observer
 * path is the one thing this stub cannot honestly simulate.
 */
const run = (body: El): El => {
  const win: Record<string, unknown> = {};
  const doc = {
    body,
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    querySelector: (sel: string) => body.querySelector(sel),
    createElement: (tag: string) => new El(tag),
  };
  win.document = doc;
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'setTimeout', CONCERN_CARDS_SCRIPT)(
    win,
    doc,
    () => 0,
  );
  return body;
};

/** Run it again on the same body, the way the re-injection schedule does. */
const runAgain = (body: El): El => run(body);

const wrappers = (body: El): El[] =>
  body.querySelectorAll('a.zigly-concern-link');

describe('the concern cards script', () => {
  it('parses', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(CONCERN_CARDS_SCRIPT)).not.toThrow();
  });

  it('is part of the injection every navigation carries', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('__ziglyConcernCards');
  });

  it('carries no backtick, which would truncate the payload', () => {
    // A backtick anywhere in one of these literals -- a comment included --
    // ends the literal there and silently drops everything after it.
    expect(CONCERN_CARDS_SCRIPT).not.toContain(String.fromCharCode(96));
  });

  it('uses no regex, whose backslashes this build would eat', () => {
    // A backslash inside one of these template literals is consumed at compile
    // time, and the payload then fails to parse -- silently, so nothing in the
    // bundle runs at all. squash() is a character loop for exactly this reason.
    expect(CONCERN_CARDS_SCRIPT).not.toContain('replace(/');
  });

  it('is scoped to the concern section', () => {
    expect(CONCERN_CARDS_SCRIPT).toContain('shop_of_concern');
  });
});

describe('what the card becomes', () => {
  it('gives each card a link to its own Shop now destination', () => {
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_T9kBGJ', DEFAULT_CARDS)]}));
    const links = wrappers(body);
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/collections/skin-coat');
    expect(links[1].getAttribute('href')).toBe('/collections/digestive-care');
  });

  it('puts the photo and the heading inside that link', () => {
    // The whole point: the biggest thing on the card is now tappable.
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]}));
    const wrap = wrappers(body)[0];
    expect(wrap.querySelector('img')).not.toBeNull();
    expect(wrap.querySelector('h3')).not.toBeNull();
  });

  it('does not nest the original anchor inside the new one', () => {
    // Invalid HTML, and the browser unnests it in whatever way it likes --
    // which is how the control the customer already relies on would move.
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]}));
    wrappers(body).forEach(wrap => {
      expect(wrap.querySelector('a')).toBeNull();
    });
  });

  it('leaves the original Shop now a direct child of the card', () => {
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]}));
    const cards = body.querySelectorAll('.concern-card');
    expect(cards.length).toBe(2);
    cards.forEach(c => {
      const shop = c.querySelector('a.shop_now');
      expect(shop).not.toBeNull();
      expect(shop?.parentNode).toBe(c);
    });
  });

  it('names the link by the card heading, not the whole card', () => {
    // A screen reader announcing the photo alt, the heading and the button text
    // as one link name is worse than no label at all.
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]}));
    expect(wrappers(body)[0].getAttribute('aria-label')).toBe('Skin & Coat');
  });

  it('keeps the card a child of the grid', () => {
    // Wrapping the card itself would put the anchor between the card and the
    // grid track it has to remain a child of for the section's layout to hold.
    const body = run(build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]}));
    const grid = body.querySelector('.concern-grid') as El;
    expect(grid.children.length).toBe(2);
    expect(grid.children[0].className).toBe('concern-card');
  });

  it('reads a destination through a renamed class, via the href fallback', () => {
    // The theme's class is not something this app owns. A rename must cost it a
    // plainer selector, not the whole feature.
    const body = run(
      build({
        tag: 'body',
        kids: [section('shop_of_concern_x', [card('Dental', '/collections/dental', 'cta-renamed')])],
      }),
    );
    expect(wrappers(body)[0].getAttribute('href')).toBe('/collections/dental');
  });
});

describe('what it refuses to do', () => {
  it('leaves a card with no destination exactly as it was', () => {
    // Nothing is invented. A card the theme ships without a link stays a card.
    const body = run(
      build({tag: 'body', kids: [section('shop_of_concern_x', [card('No Link Here', undefined)])]}),
    );
    expect(wrappers(body).length).toBe(0);
    expect(body.querySelector('h3')?.textContent).toBe('No Link Here');
  });

  it('ignores an anchor that is a control, not a destination', () => {
    // A '#' href copied onto the card would make the whole card do nothing
    // loudly instead of quietly.
    const body = run(
      build({tag: 'body', kids: [section('shop_of_concern_x', [card('Hash Only', '#')])]}),
    );
    expect(wrappers(body).length).toBe(0);
  });

  it('ignores a javascript: href', () => {
    // The literal is the point of the test -- it is the input the script must
    // refuse to copy onto the card -- so the lint rule that objects to seeing
    // one is disabled here rather than the case being written around.
    // eslint-disable-next-line no-script-url
    const scripted = 'javascript:void(0)';
    const body = run(
      build({
        tag: 'body',
        kids: [section('shop_of_concern_x', [card('Script', scripted)])],
      }),
    );
    expect(wrappers(body).length).toBe(0);
  });

  it('touches nothing outside a concern section', () => {
    const body = run(
      build({tag: 'body', kids: [section('home_arrival_section', DEFAULT_CARDS)]}),
    );
    expect(wrappers(body).length).toBe(0);
  });
});

describe('the seven passes', () => {
  it('does not stack a second wrapper on a card it already did', () => {
    // The whole bundle is re-applied on RESTYLE_DELAYS, so every pass has to
    // end with the page in the same shape.
    const body = build({tag: 'body', kids: [section('shop_of_concern_x', DEFAULT_CARDS)]});
    run(body);
    runAgain(body);
    runAgain(body);
    expect(wrappers(body).length).toBe(2);
    expect(wrappers(body)[0].querySelector('a.zigly-concern-link')).toBeNull();
  });

  it('promotes a section that only arrives on a later pass', () => {
    // The section is transplanted lazily -- it is genuinely not on the page
    // when the first pass runs.
    const body = build({tag: 'body', kids: [{tag: 'div', id: 'MainContent'}]});
    run(body);
    expect(wrappers(body).length).toBe(0);

    body.appendChild(build(section('shop_of_concern_x', DEFAULT_CARDS)));
    runAgain(body);
    expect(wrappers(body).length).toBe(2);
  });
});

describe('the stylesheet half', () => {
  it('makes the wrapper fill the card without restyling it', () => {
    expect(MOBILE_CSS).toContain('.zigly-concern-link');
    expect(MOBILE_CSS).toContain('text-decoration: none');
  });

  it('does not use display:contents, which takes no clicks', () => {
    // A display:contents element generates no box, so it is not hit-testable --
    // the card would be untappable outside the button again, which is the bug.
    const from = MOBILE_CSS.indexOf('.zigly-concern-link {');
    expect(from).toBeGreaterThan(-1);
    const rule = MOBILE_CSS.slice(from, MOBILE_CSS.indexOf('}', from));
    expect(rule).not.toContain('display: contents');
    expect(rule).toContain('display: block');
  });
});
