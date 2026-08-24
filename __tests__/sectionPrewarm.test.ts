/**
 * The dashboard's sections are asked for while the page is still downloading.
 *
 * `injectedJavaScript` runs at load end, so every section the splash waits on
 * used to begin its round trip only after the whole ~2 MB homepage had arrived.
 * ../src/webview/sectionPrewarm moves that one batched request to
 * document-start, and ../src/webview/pageCache consults its results before
 * queueing anything of its own.
 *
 * The guards matter as much as the behaviour here, because this payload spends
 * the customer's data and runs more than once per page load: a prewarm that
 * fires twice, or fires on every inner page, has spent bytes to save nothing.
 *
 * jsdom is not a dependency of this project (see facetBridge.test.ts), so the
 * script is executed against a hand-rolled environment instead -- which keeps
 * this a test of the script rather than of a DOM implementation.
 */
import {
  buildSectionPrewarmScript,
  SECTION_WARM_SCRIPT,
} from '../src/webview/sectionPrewarm';
import {PAGE_CACHE_SCRIPT, SEEDED_IDS} from '../src/webview/pageCache';

/** The four sections `homeReady` in ../src/webview/readySignal blocks on. */
const CRITICAL = [
  '/|home_category_section',
  '/|coupon_slider',
  '/|home_shop_by_breed_section@dog',
  '/|home_shop_by_breed_section@cat',
];

type Bag = Record<string, any>;

interface Harness {
  /** The page's globals, after the payload has run against them. */
  window: Bag;
  /** Every URL the payload fetched, in order. */
  calls: string[];
  /** Answer the in-flight request with a sections payload, or null to fail it. */
  settle: (body: Record<string, string> | null) => void;
  /** Nodes the payload appended to <head>. */
  appended: Bag[];
  /** Callbacks the payload deferred, so a test can run them on demand. */
  timers: Array<() => void>;
  exec: (src: string) => void;
}

const harness = (path: string): Harness => {
  const calls: string[] = [];
  const appended: Bag[] = [];
  const timers: Array<() => void> = [];
  let answer: (body: Record<string, string> | null) => void = () => {};

  const win: Bag = {location: {pathname: path}};

  const head = {
    appendChild: (node: Bag) => {
      appended.push(node);
    },
  };
  const doc = {head, documentElement: head, createElement: (): Bag => ({})};

  const fetchImpl = (url: string) => {
    calls.push(url);
    return new Promise<Bag>(resolve => {
      answer = body =>
        resolve({ok: body !== null, json: () => Promise.resolve(body)});
    });
  };

  const setTimeoutImpl = (fn: () => void) => {
    timers.push(fn);
    return 0;
  };

  return {
    window: win,
    calls,
    appended,
    timers,
    settle: body => answer(body),
    exec: (src: string) => {
      // The payload is a string of ES5 that expects page globals. Handing them
      // in as parameters runs it exactly as a WebView would, with no DOM
      // implementation in between.
      // eslint-disable-next-line no-new-func
      const run = new Function(
        'window',
        'document',
        'fetch',
        'setTimeout',
        src,
      );
      run(win, doc, fetchImpl, setTimeoutImpl);
    },
  };
};

/** Run one payload against a fresh environment rooted at `path`. */
const runAt = (path: string, src: string): Harness => {
  const h = harness(path);
  h.exec(src);
  return h;
};

/** A harness with the page cache's two fetchers already installed. */
const warmed = (): {h: Harness; asked: string[]; docs: string[]} => {
  const h = harness('/');
  const asked: string[] = [];
  const docs: string[] = [];
  h.window.__ziglyFetchSection = (_path: string, fragment: string) => {
    asked.push(fragment);
    return Promise.resolve(null);
  };
  h.window.__ziglyFetchDoc = (path: string) => {
    docs.push(path);
    return Promise.resolve(null);
  };
  return {h, asked, docs};
};

describe('the section prewarm payload', () => {
  it('parses cleanly, seeded and with learned ids', () => {
    // The payload is a string, so nothing else can catch a syntax error in it.
    /* eslint-disable no-new-func */
    expect(() => new Function(buildSectionPrewarmScript())).not.toThrow();
    expect(
      () => new Function(buildSectionPrewarmScript({'/|coupon_slider': 'x'})),
    ).not.toThrow();
    /* eslint-enable no-new-func */
  });

  it('asks for every section the splash is actually blocked on', () => {
    const src = buildSectionPrewarmScript();
    for (const key of CRITICAL) {
      expect(SEEDED_IDS[key]).toBeTruthy();
      expect(src).toContain(SEEDED_IDS[key]);
    }
  });

  it('spends exactly one round trip on all four', () => {
    // Shopify answers 400 above five section ids per request, so four is one
    // call. A fifth entry is still free; a sixth would silently become two.
    const h = runAt('/', buildSectionPrewarmScript());
    expect(h.calls).toHaveLength(1);
    const url = decodeURIComponent(h.calls[0]);
    for (const key of CRITICAL) {
      expect(url).toContain(SEEDED_IDS[key]);
    }
  });

  it('runs once, however many times it is injected', () => {
    // The payload goes in at document-start AND on onLoadStart, because
    // document-start is unreliable on Android. Whichever lands first must win.
    const h = harness('/');
    const src = buildSectionPrewarmScript();
    h.exec(src);
    h.exec(src);
    h.exec(src);
    expect(h.calls).toHaveLength(1);
  });

  it('spends nothing on a page that has none of these sections', () => {
    for (const path of ['/collections/sale', '/products/a-dog-bed', '/cart']) {
      const h = runAt(path, buildSectionPrewarmScript());
      expect(h.calls).toHaveLength(0);
      expect(h.window.__ziglySectionPrewarm).toBeUndefined();
    }
  });

  it('treats every spelling of the homepage as the homepage', () => {
    for (const path of ['/', '', '/index', '///']) {
      expect(runAt(path, buildSectionPrewarmScript()).calls).toHaveLength(1);
    }
  });

  it('prefers what earlier launches learned over the written-down seed', () => {
    // A seed goes stale the moment Zigly re-saves their theme; the learned map
    // is what ../src/webview/sectionIdStore kept from the last rediscovery.
    const learned = {'/|coupon_slider': 'template--999__coupon_slider_LEARNED'};
    const url = decodeURIComponent(
      runAt('/', buildSectionPrewarmScript(learned)).calls[0],
    );
    expect(url).toContain('coupon_slider_LEARNED');
    expect(url).not.toContain(SEEDED_IDS['/|coupon_slider']);
  });

  it('prefers the id the page was already given over its own', () => {
    // The app injects the learned map separately, and on a reload it can land
    // before this does. Consulting it per lookup is what makes that useful.
    const h = harness('/');
    h.window.__ziglySectionIds = {'/|coupon_slider': 'from_the_page'};
    h.exec(buildSectionPrewarmScript());
    expect(decodeURIComponent(h.calls[0])).toContain('from_the_page');
  });

  it('hands each key its own markup', async () => {
    const h = runAt('/', buildSectionPrewarmScript());
    h.settle({
      [SEEDED_IDS['/|coupon_slider']]: '<section>coupons</section>',
      [SEEDED_IDS['/|home_category_section']]: '<section>cats</section>',
    });
    const store = h.window.__ziglySectionPrewarm;
    await expect(store['/|coupon_slider']).resolves.toBe(
      '<section>coupons</section>',
    );
    await expect(store['/|home_category_section']).resolves.toBe(
      '<section>cats</section>',
    );
  });

  it('resolves a section the response did not carry to null', async () => {
    // A stale id comes back absent. ../src/webview/pageCache reads that as a
    // miss and falls back to rediscovery, which is the self-healing path.
    const h = runAt('/', buildSectionPrewarmScript());
    h.settle({[SEEDED_IDS['/|coupon_slider']]: '<section>coupons</section>'});
    const store = h.window.__ziglySectionPrewarm;
    await expect(store['/|home_shop_by_breed_section@dog']).resolves.toBeNull();
  });

  it('resolves every key to null when the request fails outright', async () => {
    const h = runAt('/', buildSectionPrewarmScript());
    h.settle(null);
    const store = h.window.__ziglySectionPrewarm;
    for (const key of CRITICAL) {
      await expect(store[key]).resolves.toBeNull();
    }
  });

  it('opens the connection to the image CDN up front', () => {
    const h = runAt('/', buildSectionPrewarmScript());
    const link = h.appended.find(n => n.rel === 'preconnect');
    expect(link).toBeDefined();
    expect(link!.href).toBe('https://cdn.shopify.com');
    /*
     * NOT anonymous. The page requests its images, styles and scripts without
     * `crossorigin`, so an anonymous preconnect would open a connection in the
     * CORS pool that none of them reuse -- paying the handshake twice instead
     * of saving it.
     */
    expect(link!.crossOrigin).toBeUndefined();
  });
});

describe('pageCache reads the prewarm before it reaches for the network', () => {
  it('consults the store', () => {
    expect(PAGE_CACHE_SCRIPT).toContain('__ziglySectionPrewarm');
  });

  it('clears the dead entry before retrying, so a miss cannot recurse for ever', () => {
    // The fallback calls __ziglyFetchSection again. If the prewarm entry were
    // left in place, that call would find the same resolved-null promise and
    // recurse without end.
    const cleared = PAGE_CACHE_SCRIPT.indexOf(
      'delete window.__ziglySectionPrewarm',
    );
    const retried = PAGE_CACHE_SCRIPT.indexOf(
      'return window.__ziglyFetchSection(path, fragment);',
    );
    expect(cleared).toBeGreaterThan(-1);
    expect(retried).toBeGreaterThan(cleared);
  });
});

describe('the deferred-section warm', () => {
  it('parses cleanly', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(SECTION_WARM_SCRIPT)).not.toThrow();
  });

  it('runs once per page view', () => {
    expect(SECTION_WARM_SCRIPT).toContain('__ziglySectionWarm');
  });

  it('waits, so it never competes with the dashboard settling', () => {
    const {h} = warmed();
    h.exec(SECTION_WARM_SCRIPT);
    expect(h.timers).toHaveLength(1);
  });

  it('does nothing at all if the fetcher is not installed', () => {
    // Injected on `dashboard-ready`, which cannot happen before the payload
    // that defines the fetcher has run -- but a guard costs nothing and the
    // alternative is a thrown error inside the page.
    const h = runAt('/', SECTION_WARM_SCRIPT);
    expect(h.timers).toHaveLength(0);
  });

  it('warms through the page cache, so it cannot double fetch', () => {
    // ../src/webview/pageCache batches and de-duplicates by key; going around
    // it would refetch everything the dashboard had already asked for.
    const {h, asked} = warmed();
    h.exec(SECTION_WARM_SCRIPT);
    h.timers[0]();
    expect(asked).toContain('offer_section#1');
    expect(asked).toContain('everything@dog');
    expect(asked).toContain('explore_product@cat');
  });

  it('warms nothing the splash already waited for', () => {
    // Those four are prewarmed at document-start and are in the page's own
    // cache long before this runs; asking again would be a wasted request.
    const {h, asked} = warmed();
    h.exec(SECTION_WARM_SCRIPT);
    h.timers[0]();
    expect(asked).not.toContain('coupon_slider');
    expect(asked).not.toContain('home_category_section');
    expect(asked).not.toContain('home_shop_by_breed_section@dog');
  });

  it('warms the whole-page fetches too, but strictly after the sections', () => {
    // Each of these is a collection page rather than a 32 KB section, so they
    // must not compete with the batch that covers far more of the scroll.
    const {h, asked, docs} = warmed();
    h.exec(SECTION_WARM_SCRIPT);
    h.timers[0]();
    expect(asked.length).toBeGreaterThan(0);
    expect(docs).toHaveLength(0);

    // The pages come in their own later tick.
    expect(h.timers).toHaveLength(2);
    h.timers[1]();
    expect(docs).toEqual([
      '/collections/hot-picks-squeaker-toys',
      '/collections/hot-deals',
    ]);
  });

  it('skips the page warm when the document fetcher is absent', () => {
    const {h, docs} = warmed();
    delete h.window.__ziglyFetchDoc;
    h.exec(SECTION_WARM_SCRIPT);
    h.timers[0]();
    h.timers[1]();
    expect(docs).toHaveLength(0);
  });

  it('warms no section the dashboard does not place', () => {
    // video_swiper is seeded but deliberately unused: extraSections moves
    // custom_video_text_banner instead. Warming it would spend a request on
    // markup nobody inserts.
    expect(SECTION_WARM_SCRIPT).not.toContain('video_swiper');
  });

  it('only ever calls the fetcher -- it never places anything', () => {
    // Placement stays with the modules that own each slot; this is a network
    // warm and nothing else.
    expect(SECTION_WARM_SCRIPT).not.toContain('appendChild');
    expect(SECTION_WARM_SCRIPT).not.toContain('insertBefore');
  });
});
