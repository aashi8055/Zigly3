/**
 * The facet bridge, RUN rather than read.
 *
 * The injected scripts in this project are covered two ways already: the
 * payload is parsed (./injection-syntax.test.ts) and its selectors are asserted
 * (./injection.test.ts). Neither executes anything, and this bridge is the one
 * where that gap matters most -- it is the piece that has to agree with markup
 * nobody here controls, and the piece whose failure mode is a sheet that opens
 * empty with no error anywhere.
 *
 * So this builds a stand-in for the part of SearchTap's DOM the bridge reads --
 * the shape verified against assets/searchtap.js and the served collection page
 * on 2026-08-23 -- executes the real script against it, and checks what comes
 * out and what gets clicked.
 *
 * NOTE what this can and cannot show. It proves the traversal: which facets are
 * found, which values are skipped, which checkbox a tap reaches. It cannot
 * prove that Zigly's live markup still looks like this -- nothing in a test
 * suite can. That is why the bridge treats every read as optional and every
 * write as a no-op when its target is missing.
 */
import {
  applySortScript,
  FACET_BRIDGE_SCRIPT,
  toggleFacetScript,
} from '../src/webview/facetBridge';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 *
 * Only what the bridge asks for: class and tag selectors, one attribute test,
 * and the descendant combinator. Written out rather than pulled in, because
 * jsdom is not a dependency of this project and adding one to run six
 * selectors would be the larger change.
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
  checked = false;
  clicks = 0;

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
    return name in this.attrs ? this.attrs[name] : null;
  }

  get textContent(): string {
    return this.text + this.children.map(child => child.textContent).join('');
  }

  /** A checkbox toggles and reports, as a real one does on a programmatic click. */
  click(): void {
    this.clicks += 1;
    if (this.attrs.type === 'checkbox') {
      this.checked = !this.checked;
    }
  }

  descendants(): El[] {
    return this.children.reduce<El[]>(
      (all, child) => all.concat(child, child.descendants()),
      [],
    );
  }

  querySelectorAll(selector: string): El[] {
    // Comma first: a selector list is one union, and document order is what a
    // real querySelector returns for it.
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

/** tag, .class, [attr] and [attr="value"], in any combination. */
const matches = (node: El, simple: string): boolean => {
  const attr = /\[([a-z-]+)(?:="([^"]*)")?\]/i.exec(simple);
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
    if (attr[2] !== undefined && value !== attr[2]) {
      return false;
    }
  }
  return true;
};

/* -------------------------------------------------------------------------- *
 * SearchTap's markup, as verified on 2026-08-23
 * -------------------------------------------------------------------------- */

/** One facet value: a hidden checkbox, its label, and its count beside it. */
const value = (label: string, count: string, on = false): El => {
  const box = new El('input', '!st-hidden', {
    type: 'checkbox',
    value: label,
  });
  box.checked = on;
  return new El('li').add(
    new El('div', 'outer-checkbox').add(
      new El('label', 'st-flex').add(
        box,
        new El('span', 'st-checkbox'),
        new El('div', 'st-filter-label-container').add(
          new El('div', 'filter-label', {}, `${label} `).add(
            new El('span', 'st-product-number', {}, count),
          ),
        ),
      ),
    ),
  );
};

/** One facet: `.st-widget` with a `.st-widget-title` and a list of values. */
const facet = (title: string, values: El[]): El =>
  new El('div', 'st-widget st-head-item').add(
    new El('span', 'st-widget-title', {}, `${title} `).add(
      new El('span').add(new El('i', 'bx-chevron-down bx')),
    ),
    new El('div').add(new El('ul', 'st-widget-body st-filter-items').add(...values)),
  );

/** One sort option: a button carrying its own label as its value. */
const sortOption = (label: string, on = false): El =>
  new El('li').add(
    new El('div', 'ripple-container').add(
      new El('button', on ? 'active-sort st-font-medium' : '', {
        value: label,
      }).add(new El('span', 'sortByValues', {}, label)),
    ),
  );

const SORTS = [
  'Best selling',
  'Price: Low to High',
  'Price: High to Low',
  'New Release',
  'Discount: High to Low',
];

interface Page {
  body: El;
  posted: unknown[];
  /** Fire the timers the bridge scheduled, oldest first. */
  flush: () => void;
  /** One turn of the bridge's own poll. */
  tick: () => void;
  run: (script: string) => void;
}

/**
 * Build a page and run the bridge in it.
 *
 * `withFacets` false is a collection page as it actually arrives: the theme's
 * grid, SearchTap's pill, and no facets at all until something asks.
 */
const load = (withFacets: boolean, path = '/collections/wet-food'): Page => {
  /*
   * The sidebar exists only once there are facets in it, which is the real
   * behaviour and not a shortcut: `initial-search-filters` renders nothing at
   * all until SearchTap reports a hit count, so its absence is exactly the
   * signal the bridge reads as "the site has not answered yet".
   */
  const sidebar = withFacets ? new El('div', 'st-sidebar st-hidden') : null;
  if (sidebar) {
    sidebar.add(
      facet('Pet type', [value('cat', '(63)'), value('dog', '(22)', true)]),
      facet('Brands', [value('royal canin', '(10)')]),
      // Both of these are called Flavor on this store, and both offer chicken.
      facet('Flavor', [value('chicken', '(27)')]),
      facet('Flavor', [value('chicken', '(20)')]),
      // No counted value: SearchTap's price slider and its out-of-stock
      // toggle, which must not reach a screen drawn as chips.
      facet('Price', []),
      facet('Availability', [
        new El('li').add(
          new El('div', 'outer-checkbox').add(
            new El('label').add(
              new El('input', '!st-hidden', {
                type: 'checkbox',
                value: 'Include Out Of Stock',
              }),
              new El('div', 'filter-label', {}, 'Include Out Of Stock'),
            ),
          ),
        ),
      ]),
    );
  }

  /*
   * The drawer shell is rendered whether or not there are facets in it -- it is
   * v-show, not v-if -- and so is its Apply, which is what the warm-up clicks
   * to put it back down. When there ARE facets it also repeats every value
   * inside a bare .st-widget with no heading, which is the thing that would
   * make every facet appear twice.
   */
  const drawer = new El('div', 'mobilesearch').add(
    new El('span', 'apply-btn', {}, 'Apply'),
  );
  if (withFacets) {
    drawer.add(new El('div', 'st-widget').add(value('cat', '(63)')));
  }

  const pill = new El('div', 'filter_h', {}, 'Filter');
  const body = new El('body').add(
    new El('div', 'sortFilterCon').add(
      new El('div', 'sort_h', {}, 'Best selling'),
      pill,
    ),
    new El('div', 'st-overlay-active').add(
      new El('div', 'st-sorting-wrapper').add(
        new El('ul', 'list').add(
          ...SORTS.map((label, index) => sortOption(label, index === 0)),
        ),
      ),
    ),
  );
  // The sidebar first, then the drawer, as the page has them.
  if (sidebar) {
    body.add(sidebar);
  }
  body.add(drawer);

  const posted: unknown[] = [];
  const timers: Array<() => void> = [];
  const polls: Array<() => void> = [];

  const document = {
    body,
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
  };
  const window: Record<string, unknown> = {
    location: {pathname: path},
    ReactNativeWebView: {
      postMessage: (raw: string) => posted.push(JSON.parse(raw)),
    },
    // Off: the poll and the explicit reads are what this test drives.
    MutationObserver: undefined,
  };

  const run = (script: string) => {
    // eslint-disable-next-line no-new-func
    new Function(
      'window',
      'document',
      'setTimeout',
      'setInterval',
      'clearInterval',
      script,
    )(
      window,
      document,
      (fn: () => void) => {
        timers.push(fn);
        return 0;
      },
      (fn: () => void) => {
        polls.push(fn);
        return 0;
      },
      () => {
        polls.length = 0;
      },
    );
  };

  run(FACET_BRIDGE_SCRIPT);
  return {
    body,
    posted,
    flush: () => {
      while (timers.length) {
        timers.shift()?.();
      }
    },
    tick: () => polls.forEach(poll => poll()),
    run,
  };
};

const latest = (page: Page) => page.posted[page.posted.length - 1] as {
  tag: string;
  ready: boolean;
  sortLabel: string;
  sortOptions: string[];
  groups: {title: string; options: {label: string; count: number; on: boolean}[]}[];
};

describe('reading the page', () => {
  it('reports every facet the site rendered, once', () => {
    const page = load(true);
    const state = latest(page);
    expect(state.tag).toBe('facets');
    expect(state.ready).toBe(true);
    // Pet type, Brands and the two Flavors. Price has no values; Availability
    // has a value with no count; the drawer's copies have no heading.
    expect(state.groups.map(group => group.title)).toEqual([
      'Pet type',
      'Brands',
      'Flavor',
      'Flavor',
    ]);
  });

  it('never lends an uncounted value the count of another', () => {
    /*
     * The failure this guards: "Include Out Of Stock" carries no count of its
     * own, so a search that climbed as far as the list around it would find the
     * first counted value in the facet and let the toggle through wearing that
     * number. Put it in a facet that HAS counted values and it must still be
     * dropped, while its neighbours survive.
     */
    const page = load(true);
    const mixed = page.body.querySelector('.st-sidebar');
    mixed?.add(
      facet('Availability', [
        value('in stock', '(9)'),
        new El('li').add(
          new El('div', 'outer-checkbox').add(
            new El('label').add(
              new El('input', '!st-hidden', {
                type: 'checkbox',
                value: 'Include Out Of Stock',
              }),
              new El('div', 'filter-label', {}, 'Include Out Of Stock'),
            ),
          ),
        ),
      ]),
    );
    page.run('window.__ziglyFacets.read();');
    const shown = latest(page).groups.find(
      group => group.title === 'Availability',
    );
    expect(shown?.options.map(option => option.label)).toEqual(['in stock']);
  });

  it('reads each value’s label, count and applied state', () => {
    const state = latest(load(true));
    expect(state.groups[0].options).toEqual([
      {label: 'cat', count: 63, on: false},
      {label: 'dog', count: 22, on: true},
    ]);
    expect(state.groups[1].options[0]).toEqual({
      label: 'royal canin',
      count: 10,
      on: false,
    });
  });

  it('reads the sorts in the site’s order, and which is applied', () => {
    const state = latest(load(true));
    expect(state.sortOptions).toEqual(SORTS);
    expect(state.sortLabel).toBe('Best selling');
  });

  it('reports not-ready rather than empty before the facets arrive', () => {
    // The state a collection page is actually in when it opens: the theme's own
    // grid, SearchTap's controls, and no facets until something asks.
    const state = latest(load(false));
    expect(state.ready).toBe(false);
    expect(state.groups).toEqual([]);
    // The sorts are still there: they are rendered without a search.
    expect(state.sortOptions).toEqual(SORTS);
  });

  it('reports ready once it has stopped waiting, so nothing spins for ever', () => {
    /*
     * A listing can genuinely publish no facets, and SearchTap can fail
     * outright. Both look identical to "not yet" from here, so the poll's end
     * is reported as an answer -- the sheet then says there are no filters
     * instead of showing a spinner nothing will ever replace.
     */
    const page = load(false);
    for (let tick = 0; tick <= 61; tick += 1) {
      page.tick();
    }
    expect(latest(page).ready).toBe(true);
    expect(latest(page).groups).toEqual([]);
  });

  it('does nothing at all off a listing page', () => {
    const page = load(true, '/products/a-dog-bed');
    expect(page.posted).toEqual([]);
  });

  it('says nothing twice when nothing has changed', () => {
    const page = load(true);
    const before = page.posted.length;
    page.run('window.__ziglyFacets.read();');
    expect(page.posted).toHaveLength(before);
  });
});

describe('asking the site for its facets', () => {
  it('clicks the site’s own Filter pill, once, when there are none', () => {
    const page = load(false);
    const pill = page.body.querySelector('.filter_h');
    expect(pill?.clicks).toBe(1);
  });

  it('leaves the pill alone when the facets are already there', () => {
    // A search page fetches its facets with its results.
    const page = load(true);
    expect(page.body.querySelector('.filter_h')?.clicks).toBe(0);
  });

  it('puts the drawer it opened back down, through the site’s own Apply', () => {
    // The warm clicks Filter, which on mobile opens SearchTap's drawer and
    // locks the body. The drawer is display:none in this app, so what has to be
    // undone is the lock and the state -- through the site's own control.
    const page = load(false);
    page.body.className = 'zigly-listing st-open-filter-section';
    page.flush();
    expect(page.body.querySelector('.mobilesearch .apply-btn')?.clicks).toBeGreaterThan(
      0,
    );
    expect(page.body.className).not.toContain('st-open-filter-section');
  });
});

describe('applying a filter', () => {
  it('clicks the checkbox in the facet that was tapped', () => {
    const page = load(true);
    page.run(toggleFacetScript(1, 'Brands', 'royal canin'));
    const boxes = page.body.querySelectorAll('input[type="checkbox"]');
    const clicked = boxes.filter(box => box.clicks > 0);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('value')).toBe('royal canin');
  });

  it('tells the two facets called Flavor apart, by position', () => {
    const page = load(true);
    // The second Flavor -- index 3 in the reported list.
    page.run(toggleFacetScript(3, 'Flavor', 'chicken'));
    const flavours = page.body
      .querySelectorAll('input[type="checkbox"]')
      .filter(box => box.getAttribute('value') === 'chicken');
    expect(flavours.map(box => box.clicks)).toEqual([0, 1]);
  });

  it('finds the facet by heading when it has moved', () => {
    // Position is checked against the heading, so a stale index cannot apply
    // the wrong filter -- it falls back to the heading instead.
    const page = load(true);
    page.run(toggleFacetScript(0, 'Brands', 'royal canin'));
    const clicked = page.body
      .querySelectorAll('input[type="checkbox"]')
      .filter(box => box.clicks > 0);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('value')).toBe('royal canin');
  });

  it('clicks nothing when the value is not on the page', () => {
    const page = load(true);
    page.run(toggleFacetScript(0, 'Pet type', 'hamster'));
    const clicked = page.body
      .querySelectorAll('input[type="checkbox"]')
      .filter(box => box.clicks > 0);
    expect(clicked).toEqual([]);
  });

  it('reports the new state after the site has answered', () => {
    const page = load(true);
    page.run(toggleFacetScript(0, 'Pet type', 'cat'));
    page.flush();
    expect(latest(page).groups[0].options[0].on).toBe(true);
  });
});

describe('applying a sort', () => {
  it('clicks the site’s own button for that label', () => {
    const page = load(true);
    page.run(applySortScript('New Release'));
    const clicked = page.body
      .querySelectorAll('.st-sorting-wrapper button[value]')
      .filter(button => button.clicks > 0);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('value')).toBe('New Release');
  });

  it('clicks nothing for a sort the site does not offer', () => {
    const page = load(true);
    page.run(applySortScript('Alphabetical'));
    const clicked = page.body
      .querySelectorAll('button[value]')
      .filter(button => button.clicks > 0);
    expect(clicked).toEqual([]);
  });

  it('does not mistake another button with a value for a sort', () => {
    // An add-to-bag on a product card carries one.
    const page = load(true);
    page.body.add(
      new El('button', 'quick-add__submit', {value: 'New Release'}, 'Add to Bag'),
    );
    page.run(applySortScript('New Release'));
    expect(page.body.querySelector('.quick-add__submit')?.clicks).toBe(0);
  });
});
