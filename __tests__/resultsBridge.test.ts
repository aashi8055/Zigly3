/**
 * The bridge that tells the native grid which products a filter selected.
 *
 * Tested the way this project tests every injected script: a very small DOM
 * written out here, and the script evaluated against it through `new Function`
 * with the globals it uses handed in. jsdom is not a dependency of this project
 * and adding one to run four selectors would be the larger change -- the same
 * decision ./facetBridge.test.ts records, and this reuses its shape.
 *
 * The four things worth pinning are the four that would fail silently:
 *
 *   1. It says nothing while the grid is the theme's own. Before a filter, the
 *      native screen's own GraphQL query is already showing those products, so
 *      a report there would make the app re-fetch what it already had.
 *   2. It reports SearchTap's handles in SearchTap's order once SearchTap has
 *      replaced the grid. That order is part of the answer the customer
 *      filtered for.
 *   3. It carries no regular expression. This script reaches the page through a
 *      JavaScript template literal, which eats a lone backslash -- a pattern
 *      written here would arrive mangled, match nothing, and leave the bridge
 *      reporting an empty list for ever while looking perfectly healthy.
 *   4. It is idempotent. Injection runs repeatedly on a single page load, so a
 *      second run must not report a second time.
 */
import {RESULTS_BRIDGE_SCRIPT} from '../src/webview/resultsBridge';

/* -------------------------------------------------------------------------- *
 * A very small DOM -- only what this bridge asks for: class selectors, one
 * attribute test (`a[href]`) and the descendant combinator.
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

  constructor(tag: string, className = '', attrs: Attrs = {}) {
    this.tag = tag.toLowerCase();
    this.className = className;
    this.attrs = attrs;
  }

  add(...children: El[]): El {
    children.forEach(child => {
      child.parentNode = this;
      this.children.push(child);
    });
    return this;
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
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

/**
 * tag, .class, and [attr] / [attr="value"] / [attr*="value"], in any
 * combination.
 *
 * The `*=` (substring) form is here because the bridge relies on it: it reads
 * `a[href*="/products/"]`, which is what lets it anchor on the product LINK
 * rather than on a card wrapper class SearchTap does not give it. A matcher
 * that silently ignored the operator would match every `<a>` on the page and
 * the "ignores a link that is not a product" case would pass for the wrong
 * reason.
 */
const matches = (node: El, simple: string): boolean => {
  const attr = /\[([a-z-]+)(?:(\*?)="([^"]*)")?\]/i.exec(simple);
  const rest = simple.replace(/\[[^\]]*\]/g, '');
  const classes = rest.split('.').slice(1).filter(Boolean);
  const tag = rest.split('.')[0];

  if (tag && node.tag !== tag.toLowerCase()) {
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
    const wanted = attr[3];
    if (wanted !== undefined) {
      // `*=` is a substring test; a bare `=` is equality.
      const hit =
        attr[2] === '*' ? value.indexOf(wanted) !== -1 : value === wanted;
      if (!hit) {
        return false;
      }
    }
  }
  return true;
};

/** A link inside a card. */
const link = (href: string) => new El('a', '', {href});

/**
 * One SearchTap card, with however many links it carries.
 *
 * SHAPED LIKE THE REAL ONE, and the first version of this fixture was not --
 * which is why the bridge shipped reporting nothing and the filter appeared
 * dead on the device. It built `<div class="st-product">` with the links
 * inside, and the bridge read it happily. On the real site there is no such
 * element: `.st-product` is a FLAT SIBLING class in SearchTap's markup (the
 * long note in ../src/webview/productCard records the same trap costing the
 * same kind of bug), and the only two `class="st-product"` in searchtap.js are
 * the autocomplete loading skeleton, whose anchors carry no href at all.
 *
 * So the card here is `.st-product-wrap` -- the true container, the one whose
 * descendants are `.old-price` and `.new-price` -- holding an image box and a
 * details block, each with its own link to the same product. That repetition
 * is real and is what the bridge's dedupe is for.
 */
const stProduct = (...hrefs: string[]): El =>
  new El('div', 'st-product-wrap').add(
    new El('figure', 'st-product-media').add(...hrefs.map(link)),
    new El('div', 'st-product-details').add(
      new El('div', 'st-product-name').add(...hrefs.map(link)),
      new El('div', 'st-product-price'),
    ),
  );

/**
 * Whatever cards are given, inside SearchTap's own results wrapper.
 *
 * The wrapper is not decoration. The bridge scopes its read to an element
 * SEARCHTAP created -- never to the theme's own containers, because the
 * theme's `#product-grid` sits inside those and its handles would then be
 * reported as though a filter had selected them. So a fixture without a
 * SearchTap scope is a page SearchTap has not rendered, and the bridge is
 * right to say nothing about it.
 */
const inStGrid = (...cards: El[]): El =>
  new El('div', 'st-product-wrapper').add(...cards);

/** The theme's own server-rendered grid, before SearchTap replaces it. */
const themeGrid = (): El =>
  new El('div', 'product-grid', {id: 'product-grid'}).add(
    new El('div', 'card-wrapper').add(
      link('/collections/applod/products/applod-chicken-pilaf-fresh-dog'),
    ),
    new El('div', 'card-wrapper').add(link('/products/applod-fish-meal')),
  );

/** SearchTap's replacement grid, as it renders after a filter. */
const searchtapGrid = (): El =>
  new El('div', 'st-results').add(
    stProduct(
      '/collections/applod/products/applod-chicken-mash?variant=42',
      '/collections/applod/products/applod-chicken-mash',
    ),
    stProduct('/products/applod-fish-meal#reviews'),
    stProduct('/products/applod-chicken-pilaf-fresh-dog'),
  );

type Posted = {tag: string; handles: string[]};

/**
 * Evaluate the bridge against a DOM and collect what it posted.
 *
 * `MutationObserver: undefined` on purpose -- the script guards its use, and
 * the poll is what this test drives, so the observer would only add a second
 * uncontrolled path to the same reporting function.
 */
const harness = (grid: El, path = '/collections/applod') => {
  const body = new El('body').add(grid);
  const posted: Posted[] = [];
  const polls: (() => void)[] = [];

  const document = {
    body,
    documentElement: body,
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
  };
  const window: Record<string, unknown> = {
    location: {pathname: path},
    ReactNativeWebView: {
      postMessage: (raw: string) => posted.push(JSON.parse(raw) as Posted),
    },
    MutationObserver: undefined,
  };

  const run = (script: string) => {
    // eslint-disable-next-line no-new-func
    new Function(
      'window',
      'document',
      'setInterval',
      'clearInterval',
      script,
    )(
      window,
      document,
      (fn: () => void) => {
        polls.push(fn);
        return 0;
      },
      () => {
        polls.length = 0;
      },
    );
  };

  run(RESULTS_BRIDGE_SCRIPT);
  return {
    posted,
    run,
    body,
    tick: () => polls.forEach(poll => poll()),
  };
};

describe('the results bridge does not fall into the template-literal trap', () => {
  /**
   * A regex literal here would arrive at the page with its backslashes eaten,
   * match nothing, and leave the bridge silent for ever -- the failure mode
   * that looks exactly like a healthy bridge on a collection with no filters.
   */
  it('carries no regular expression', () => {
    expect(RESULTS_BRIDGE_SCRIPT).not.toMatch(/new RegExp/);
    expect(RESULTS_BRIDGE_SCRIPT).not.toMatch(/\.match\(/);
  });

  /**
   * A raw backtick closes the injected literal early and drops the rest of the
   * payload. The source escapes the few it needs in comments; what must not
   * reach the page is an unescaped one.
   */
  it('emits no backtick at all', () => {
    expect(RESULTS_BRIDGE_SCRIPT.includes('`')).toBe(false);
  });
});

describe('the results bridge reports SearchTaps answer', () => {
  it('says nothing while the grid is the themes own', () => {
    const {posted, tick} = harness(themeGrid());
    tick();
    // Already covered by the screen's own GraphQL query; a report here would
    // make the app re-fetch what it already had.
    expect(posted).toEqual([]);
  });

  it('reports the handles in SearchTaps order', () => {
    const {posted} = harness(searchtapGrid());
    expect(posted).toEqual([
      {
        tag: 'results',
        handles: [
          'applod-chicken-mash',
          'applod-fish-meal',
          'applod-chicken-pilaf-fresh-dog',
        ],
      },
    ]);
  });

  it('strips the collection prefix, the query and the fragment', () => {
    const {posted} = harness(
      inStGrid(
        stProduct('/collections/x/products/handle-one?variant=9'),
        stProduct('/products/handle-two#tab'),
        stProduct('https://zigly.com/products/handle-three'),
      ),
    );
    expect(posted[0].handles).toEqual([
      'handle-one',
      'handle-two',
      'handle-three',
    ]);
  });

  /** A card links to its product from the photo, the title and the quick-add. */
  it('reports a product once however many times its card links to it', () => {
    const {posted} = harness(
      inStGrid(
        stProduct('/products/only-one', '/products/only-one'),
        stProduct('/products/only-one'),
      ),
    );
    expect(posted[0].handles).toEqual(['only-one']);
  });

  it('ignores a card whose link is not a product', () => {
    const {posted} = harness(
      inStGrid(
        stProduct('/pages/about'),
        stProduct('/products/real-one'),
      ),
    );
    expect(posted[0].handles).toEqual(['real-one']);
  });

  it('reports again only when the answer changed', () => {
    const {posted, tick} = harness(searchtapGrid());
    expect(posted.length).toBe(1);
    tick();
    tick();
    // Same grid, so nothing new to say.
    expect(posted.length).toBe(1);
  });
});

describe('the real sequence a customer drives', () => {
  /**
   * THE WHOLE JOURNEY, in the order the device performs it.
   *
   * This is the case the unit tests above each cover one slice of, and the one
   * that was actually broken: the page loads showing the theme's grid, the
   * customer applies a filter, SearchTap REPLACES the grid, and only then is
   * there an answer to report. A bridge that is silent at step 1 and speaks at
   * step 3 is the whole contract.
   */
  it('stays silent on the themes grid, then reports once SearchTap replaces it', () => {
    const {posted, body, tick} = harness(themeGrid());

    // 1. Page as served: the theme's own grid. The native screen's own query
    //    already covers this, so the bridge must not report it.
    expect(posted).toEqual([]);
    tick();
    expect(posted).toEqual([]);

    // 2. The customer taps a chip. SearchTap replaces the grid -- it does not
    //    fill the theme's, which is why the bridge re-looks-up its root on
    //    every read rather than caching a node.
    body.children.length = 0;
    body.add(
      inStGrid(
        stProduct('/collections/applod/products/kept-one?variant=7'),
        stProduct('/products/kept-two'),
      ),
    );

    // 3. The poll finds it and posts the filtered set, in SearchTap's order.
    tick();
    expect(posted.length).toBe(1);
    expect(posted[0].handles).toEqual(['kept-one', 'kept-two']);

    // 4. Tapping a second chip narrows it again: a new answer, so a new report.
    body.children.length = 0;
    body.add(inStGrid(stProduct('/products/kept-two')));
    tick();
    expect(posted.length).toBe(2);
    expect(posted[1].handles).toEqual(['kept-two']);

    // 5. And an unchanged grid is not re-reported, however often it is read.
    tick();
    tick();
    expect(posted.length).toBe(2);
  });
});

describe('the bridge does not treat .st-product as a card', () => {
  /**
   * THE BUG THIS FILE SHIPPED WITH, pinned so it cannot come back.
   *
   * The first version asked for `.st-product` and then for a link inside each
   * match. Nothing was ever reported and the filter looked dead on the device.
   * `.st-product` is a flat sibling class in SearchTap's markup -- the same
   * trap ../src/webview/productCard documents at length -- so a link is never
   * *inside* it, and the only two `class="st-product"` in searchtap.js belong
   * to the autocomplete loading skeleton, whose anchors have no href.
   *
   * A page shaped the way that skeleton is must therefore report nothing,
   * rather than being mistaken for a rendered result set.
   */
  it('says nothing for a bare .st-product with no link inside it', () => {
    const {posted} = harness(
      new El('div', 'st-product-wrapper').add(
        // The skeleton's shape: the class, an anchor, and no href anywhere.
        new El('div', 'st-product').add(
          new El('figure', 'st-product-media').add(new El('a', '')),
        ),
      ),
    );
    expect(posted).toEqual([]);
  });

  /**
   * And the positive half: the real card reports even though its links are
   * nested two levels down and never children of a `.st-product`.
   */
  it('reads the real cards links, which are not children of .st-product', () => {
    const {posted} = harness(inStGrid(stProduct('/products/nested-deep')));
    expect(posted[0].handles).toEqual(['nested-deep']);
  });

  /**
   * The theme's own containers are never a scope: `#product-grid` sits inside
   * them, so scoping there would report the server-rendered grid as a filter
   * result -- which is the one thing this bridge exists to distinguish.
   */
  it('does not scope itself to the themes own collection wrapper', () => {
    /*
     * The scope LIST, not the whole script: the comment above it names the
     * rejected selector on purpose, to say why it must not come back, and a
     * bare `not.toContain` over the file would forbid explaining the decision.
     */
    const at = RESULTS_BRIDGE_SCRIPT.indexOf('var scopes = [');
    expect(at).toBeGreaterThan(-1);
    const list = RESULTS_BRIDGE_SCRIPT.slice(
      at,
      RESULTS_BRIDGE_SCRIPT.indexOf(']', at),
    );
    expect(list).not.toContain('st-collection-content');
    expect(list).not.toContain('product-grid');
    // And it still scopes to something SearchTap itself creates.
    expect(list).toContain('st-product-wrapper');
  });
});

describe('the results bridge stays off the pages it is not for', () => {
  /** A product page carries the same card markup in its recommendation rails. */
  it('does not run on a product page', () => {
    const {posted, tick} = harness(
      searchtapGrid(),
      '/collections/applod/products/some-product',
    );
    tick();
    expect(posted).toEqual([]);
  });

  it('runs on a search results page, which is also a listing', () => {
    const {posted} = harness(searchtapGrid(), '/search');
    expect(posted.length).toBe(1);
  });

  /** Injection runs several times per page load; a second run must be a no-op. */
  it('installs once however many times it is injected', () => {
    const {posted, run} = harness(searchtapGrid());
    for (let i = 0; i < 7; i++) {
      run(RESULTS_BRIDGE_SCRIPT);
    }
    expect(posted.length).toBe(1);
  });
});
