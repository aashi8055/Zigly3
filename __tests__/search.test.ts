/**
 * Native search.
 *
 * Two things are being defended here. First the money boundary: this is the one
 * endpoint in the app that reports prices as decimal strings ("2807.00") rather
 * than integer paise, and getting that wrong shows ₹28.07 next to a ₹2,807
 * product. Second the payload itself: it arrives over a string bridge from a
 * page we do not control, so a missing field must drop a row, never render half
 * of one.
 *
 * The fixtures below are the shapes the bridge script actually posts, taken
 * from a live probe of /search/suggest.json (see DATA-SOURCES.md).
 */
import {money, paiseFromDecimal, percentOff} from '../src/utils/money';
import {
  MAX_RECENTS,
  absoluteUrl,
  isEmpty,
  parseSuggestions,
  rememberSearch,
} from '../src/search/suggestions';
import {
  MIN_QUERY_LENGTH,
  SUGGEST_DEBOUNCE_MS,
  SUGGEST_LIMIT,
  suggestScript,
} from '../src/webview/searchBridge';

const ORIGIN = 'https://zigly.com';

/** One product row as the bridge script trims it. */
const PRODUCT = {
  id: 10261768405308,
  title: 'Royal Canin Labrador Retriever Adult Dry Dog Food',
  url: '/products/royal-canin-labrador-retriever-adult-dry-dog-food?_pos=1&_psq=dog+food',
  image: 'https://cdn.shopify.com/s/files/1/0923/RoyalCanin.jpg?v=1776938551',
  vendor: 'Royal Canin',
  available: true,
  price: '2807.00',
  compareAt: '3190.00',
};

const REPLY = {
  tag: 'search-suggest',
  token: 3,
  q: 'dog food',
  products: [PRODUCT],
  queries: [
    {text: 'dry dog food', url: '/search?q=dry+dog+food&_pos=1'},
    {text: 'wet dog food', url: '/search?q=wet+dog+food&_pos=2'},
  ],
  collections: [{title: 'Dog Food', url: '/collections/dog-food?_pos=1'}],
};

describe('money has one unit', () => {
  it('converts Shopify decimal strings to paise', () => {
    // The rest of the app speaks integer paise; this endpoint does not.
    expect(paiseFromDecimal('2807.00')).toBe(280700);
    expect(paiseFromDecimal('399.50')).toBe(39950);
    expect(paiseFromDecimal(39900)).toBe(3990000);
  });

  it('survives a pre-formatted or missing price without producing NaN', () => {
    expect(paiseFromDecimal('₹2,807.00')).toBe(280700);
    expect(paiseFromDecimal(undefined)).toBe(0);
    expect(paiseFromDecimal('')).toBe(0);
    expect(paiseFromDecimal('sold out')).toBe(0);
  });

  it('formats as the site does, trimming a trailing .00', () => {
    expect(money(280700)).toBe('₹2807');
    expect(money(39950)).toBe('₹399.50');
  });

  it('reports a discount only when there is one', () => {
    expect(percentOff(319000, 280700)).toBe(12);
    expect(percentOff(280700, 280700)).toBe(0);
    expect(percentOff(0, 280700)).toBe(0);
  });
});

describe('parsing a suggestion reply', () => {
  it('reads the three resource lists', () => {
    const parsed = parseSuggestions(REPLY, ORIGIN);
    expect(parsed.query).toBe('dog food');
    expect(parsed.products).toHaveLength(1);
    expect(parsed.queries.map(q => q.text)).toEqual([
      'dry dog food',
      'wet dog food',
    ]);
    expect(parsed.collections[0].title).toBe('Dog Food');
    expect(isEmpty(parsed)).toBe(false);
  });

  it('converts prices at the boundary and keeps the strikethrough honest', () => {
    const [product] = parseSuggestions(REPLY, ORIGIN).products;
    expect(product.price).toBe(280700);
    expect(product.compareAt).toBe(319000);
    expect(money(product.price)).toBe('₹2807');
  });

  it('drops a compare-at price that is not actually higher', () => {
    // Shopify leaves compare_at set to the same value on plenty of products;
    // striking through an identical price advertises a discount of nothing.
    const parsed = parseSuggestions(
      {...REPLY, products: [{...PRODUCT, compareAt: '2807.00'}]},
      ORIGIN,
    );
    expect(parsed.products[0].compareAt).toBeNull();
  });

  it('absolute-ises the storefront paths, tracking params intact', () => {
    const parsed = parseSuggestions(REPLY, ORIGIN);
    // The params are Shopify's own search analytics; stripping them would
    // quietly stop reporting what the app's users searched for.
    expect(parsed.products[0].url).toBe(ORIGIN + PRODUCT.url);
    expect(parsed.queries[0].url).toBe(ORIGIN + '/search?q=dry+dog+food&_pos=1');
    expect(absoluteUrl(ORIGIN, 'https://other.example/x')).toBe(
      'https://other.example/x',
    );
  });

  it('drops a zero-price row rather than rendering a dead end', () => {
    // The reference app's baseline filter requires discounted_price > 0.
    const parsed = parseSuggestions(
      {...REPLY, products: [{...PRODUCT, price: '0.00'}]},
      ORIGIN,
    );
    expect(parsed.products).toHaveLength(0);
  });

  it('drops a row with no title or no url, and keeps the rest', () => {
    const parsed = parseSuggestions(
      {
        ...REPLY,
        products: [{...PRODUCT, title: ''}, PRODUCT, {...PRODUCT, url: ''}],
      },
      ORIGIN,
    );
    expect(parsed.products).toHaveLength(1);
  });

  it('treats a missing image as no image, not as an empty string', () => {
    const parsed = parseSuggestions(
      {...REPLY, products: [{...PRODUCT, image: null}]},
      ORIGIN,
    );
    // The screen tests for null to draw a placeholder; '' would ask Image to
    // load nothing and log a warning per row.
    expect(parsed.products[0].image).toBeNull();
  });

  it('carries availability through, since the query asks for last not hidden', () => {
    const parsed = parseSuggestions(
      {...REPLY, products: [{...PRODUCT, available: false}]},
      ORIGIN,
    );
    expect(parsed.products[0].available).toBe(false);
  });

  it('returns an empty set for an error reply', () => {
    const parsed = parseSuggestions({tag: 'x', q: 'dog', error: true}, ORIGIN);
    expect(isEmpty(parsed)).toBe(true);
    expect(parsed.query).toBe('dog');
  });

  it('returns an empty set for junk rather than throwing', () => {
    // It is a third-party payload arriving over a string bridge, on a screen
    // the user is typing into.
    expect(isEmpty(parseSuggestions({}, ORIGIN))).toBe(true);
    expect(
      isEmpty(parseSuggestions({products: 'nope', queries: 7}, ORIGIN)),
    ).toBe(true);
    expect(
      isEmpty(parseSuggestions({products: [null, 3, 'x']}, ORIGIN)),
    ).toBe(true);
  });
});

describe('recent searches', () => {
  it('puts the newest first', () => {
    expect(rememberSearch(['toys'], 'dog food')).toEqual(['dog food', 'toys']);
  });

  it('does not keep the same search twice, whatever the case', () => {
    expect(rememberSearch(['Dog Food', 'toys'], 'dog food')).toEqual([
      'dog food',
      'toys',
    ]);
  });

  it('ignores a blank query', () => {
    const recents = ['toys'];
    expect(rememberSearch(recents, '   ')).toBe(recents);
  });

  it('caps the list', () => {
    let recents: string[] = [];
    for (let i = 0; i < MAX_RECENTS + 5; i++) {
      recents = rememberSearch(recents, 'term' + i);
    }
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0]).toBe('term' + (MAX_RECENTS + 4));
  });
});

describe('the suggestion request', () => {
  const script = suggestScript('dog food', 7);

  it('asks Shopify predictive search, not SearchTap', () => {
    // The site's own search is SearchTap, but its token is a credential taken
    // from Zigly's app: rotatable without notice, and their quota. This
    // endpoint is same-origin and keyless.
    expect(script).toContain('/search/suggest.json');
    expect(script).not.toContain('searchtap');
    expect(script).toContain("credentials: 'same-origin'");
  });

  it('requests all three resource types within Shopify limits', () => {
    expect(script).toContain('resources[type]=product,query,collection');
    expect(script).toContain("'&resources[limit]=' + " + SUGGEST_LIMIT);
    expect(SUGGEST_LIMIT).toBeLessThanOrEqual(10);
  });

  it('keeps out-of-stock products last rather than hiding them', () => {
    // Hiding them would make the app's catalogue look smaller than the site's.
    expect(script).toContain('resources[options][unavailable_products]=last');
  });

  it('echoes the token so a stale reply can be discarded', () => {
    expect(script).toContain('var token = 7;');
    expect(script).toContain("payload.tag = 'search-suggest'");
  });

  it('encodes the query rather than pasting it into the source', () => {
    const nasty = suggestScript('"; alert(1); //', 1);
    expect(nasty).toContain('var q = "\\"; alert(1); //";');
    expect(nasty).toContain('encodeURIComponent(q)');
  });

  it('parses as valid JavaScript and returns a value to the bridge', () => {
    // A mangled payload executes nothing at all, silently. Android also warns
    // when an injected script evaluates to undefined.
    // eslint-disable-next-line no-new-func
    expect(() => new Function(script)).not.toThrow();
    expect(script.trimEnd().endsWith('true;')).toBe(true);
  });

  it('waits long enough that a fast typist makes one request', () => {
    // The debounce is what bounds the request count; the minimum length only
    // decides how early suggesting starts. It was lowered to 1 so a single
    // letter already suggests, which is a product call, not a request-rate one.
    expect(SUGGEST_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
    expect(MIN_QUERY_LENGTH).toBeGreaterThanOrEqual(1);
  });
});

describe('the search screen is wired to the site, not to a second engine', () => {
  const src = require('fs').readFileSync(
    'src/screens/ZiglyWebViewScreen.tsx',
    'utf8',
  );

  it('hands submitted searches to the site, which is SearchTap-rendered', () => {
    // That page carries Zigly's real ranking, facets and sort. Reimplementing
    // them natively would mean keeping 16 facets and 5 sort orders in step
    // with whatever their merchandisers change.
    expect(src).toContain('showPage(`${ZIGLY_ORIGIN}/search?q=');
  });

  it('discards replies to keystrokes already typed past', () => {
    expect(src).toContain('data.token === searchToken.current');
  });

  it('opens the screen from the header instead of typing in the bar', () => {
    expect(src).toContain('onSearchPress={openSearch}');
    const header = require('fs').readFileSync(
      'src/components/NativeHeader.tsx',
      'utf8',
    );
    // A field in the header could only submit; there is nowhere to put
    // suggestions under a 52px bar.
    expect(header).not.toContain('TextInput');
  });
});
