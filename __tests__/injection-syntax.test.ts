/**
 * Guards against the failure that cost several build cycles: the injected
 * script is assembled from template literals, and a mangled escape sequence
 * (a lost backslash in a regex, an unescaped newline) turns the whole payload
 * into invalid JavaScript. The WebView then silently executes nothing -- no
 * error, no styling, no diagnostics, just a page that looks untouched.
 *
 * `new Function` parses without executing, which is exactly the check we want.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {
  EARLY_HEADER_CSS,
  OPEN_MENU,
  REPORT_ANNOUNCEMENTS,
  REPORT_CART_COUNT,
  searchScript,
} from '../src/webview/headerBridge';
import {
  REPORT_SEARCH_PLACEHOLDERS,
  suggestScript,
} from '../src/webview/searchBridge';
import {
  READ_CART_SCRIPT,
  addToCartScript,
  changeQtyScript,
} from '../src/webview/cartBridge';
import {
  WISHLIST_SCRIPT,
  removeFromWishlistScript,
} from '../src/webview/wishlistBridge';
import {
  ACCOUNT_PROBE,
  ADDRESSES_PROBE,
  COUNTRIES_PROBE,
  LOGOUT_SCRIPT,
} from '../src/webview/accountBridge';
import {LOGIN_RESTYLE} from '../src/webview/loginRestyle';
import {PASSWORD_RESTYLE} from '../src/webview/passwordRestyle';
import {PAGE_PREFETCH_SCRIPT, PREFETCH_SCRIPT} from '../src/webview/prefetch';
import {
  buildSectionPrewarmScript,
  SECTION_WARM_SCRIPT,
} from '../src/webview/sectionPrewarm';
import {seedSectionIdsScript} from '../src/webview/sectionIdStore';
import {
  applySortScript,
  FACET_BRIDGE_SCRIPT,
  READ_FACETS_SCRIPT,
  toggleFacetScript,
} from '../src/webview/facetBridge';

const parses = (src: string): boolean => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
    return true;
  } catch {
    return false;
  }
};

describe('injected script is syntactically valid', () => {
  it.each([
    'https://zigly.com/',
    'https://zigly.com/collections/sale',
    'https://zigly.com/products/a-dog-bed',
    'https://zigly.com/cart',
  ])('parses cleanly for %s', url => {
    const script = getInjectionForUrl(url);
    expect(script).not.toBeNull();
    expect(parses(script as string)).toBe(true);
  });

  it('contains no stray line comment created by a lost regex escape', () => {
    // `/\/+$/` collapsing to `//+$/` silently commented out the rest of the file.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).not.toContain('replace(//');
  });

  it('has no regex mangled by a lost backslash', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // `/\s+/` collapsing to `/s+/` would replace the letter "s" in category
    // names. Neither this nor the comment-forming `//` variant may appear.
    expect(script).not.toContain('/s+/g');
    expect(script).not.toContain('replace(//');
  });

  it('contains no character class flattened by a lost backslash', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // /[\s]/ compiling to /[s]/ has silently corrupted text twice. Any bare
    // [s] or /s+/ in the built script means an escape was eaten again.
    expect(script).not.toContain('[s]+');
    expect(script).not.toContain('/s+/g');
    expect(script).not.toContain('replace(//');
  });
});

/**
 * The same check for the payloads that are injected on their own.
 *
 * `getInjectionForUrl` only assembles the ones that go in on every navigation.
 * The bridges are injected separately -- on a tap, on a probe, on a load -- and
 * were not covered here at all, which is the same silent failure with a smaller
 * blast radius: a mangled escape in one of these means one feature quietly does
 * nothing while the rest of the app looks fine.
 */
describe('every separately injected payload is valid too', () => {
  it.each([
    ['EARLY_HEADER_CSS', EARLY_HEADER_CSS],
    ['REPORT_CART_COUNT', REPORT_CART_COUNT],
    ['REPORT_ANNOUNCEMENTS', REPORT_ANNOUNCEMENTS],
    ['REPORT_SEARCH_PLACEHOLDERS', REPORT_SEARCH_PLACEHOLDERS],
    ['OPEN_MENU', OPEN_MENU],
    ['READ_CART_SCRIPT', READ_CART_SCRIPT],
    ['WISHLIST_SCRIPT', WISHLIST_SCRIPT],
    ['ACCOUNT_PROBE', ACCOUNT_PROBE],
    ['ADDRESSES_PROBE', ADDRESSES_PROBE],
    ['COUNTRIES_PROBE', COUNTRIES_PROBE],
    ['LOGOUT_SCRIPT', LOGOUT_SCRIPT],
    ['LOGIN_RESTYLE', LOGIN_RESTYLE],
    ['PASSWORD_RESTYLE', PASSWORD_RESTYLE],
    ['PREFETCH_SCRIPT', PREFETCH_SCRIPT],
    ['PAGE_PREFETCH_SCRIPT', PAGE_PREFETCH_SCRIPT],
    ['SECTION_WARM_SCRIPT', SECTION_WARM_SCRIPT],
    // Both shapes the prewarm is built in: seeds alone for the payload compiled
    // into the first navigation, and with a learned id laid over the top for the
    // copy re-injected on onLoadStart.
    ['buildSectionPrewarmScript', buildSectionPrewarmScript()],
    [
      'buildSectionPrewarmScript(learned)',
      buildSectionPrewarmScript({"/|coupon_slider": "a'b\\c"}),
    ],
    // Section ids are Shopify-generated, but this payload is built from a map
    // read back off disk, so it is quoted rather than trusted.
    ['seedSectionIdsScript', seedSectionIdsScript({"a'b": "c\\d"})],
    ['FACET_BRIDGE_SCRIPT', FACET_BRIDGE_SCRIPT],
    ['READ_FACETS_SCRIPT', READ_FACETS_SCRIPT],
    // The parameterised ones, with a value that exercises the quoting: an
    // apostrophe and a backslash are what would break a hand-built string.
    ['suggestScript', suggestScript("dog's \\ bed", 1)],
    ['searchScript', searchScript("dog's \\ bed")],
    ['changeQtyScript', changeQtyScript("line's\\key", 0)],
    ['addToCartScript', addToCartScript(123, 1)],
    ['removeFromWishlistScript', removeFromWishlistScript("a'b\\c")],
    // Facet labels are Zigly's own strings, and a facet value with an
    // apostrophe in it is one product away.
    ['toggleFacetScript', toggleFacetScript(3, "Cat's", "rice 'n' oats \\ x")],
    ['applySortScript', applySortScript("Price: 'low' \\ high")],
  ])('%s parses cleanly', (_name, script) => {
    expect(typeof script).toBe('string');
    expect(parses(script as string)).toBe(true);
  });
});
