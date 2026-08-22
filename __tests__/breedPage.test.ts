/**
 * Book An Appointment, on the Breed-verse pages.
 *
 * The button is Zigly's own and is fixed at `bottom: 9rem` by the theme's
 * mobile media query -- an offset that clears the website's own bottom bar and
 * chat bubble, neither of which exists in the app. Verified on 2026-08-22: the
 * same button is also on /pages/vet-care-page and /pages/grooming-experience-
 * page, which is why nothing here touches the class outright.
 *
 * So the property worth pinning is the scoping, not the offsets: the index
 * hides it, a breed's own page moves it, and every other page that happens to
 * carry the same button is left exactly as the site has it.
 */
import {
  BREED_INDEX_FLAG,
  BREED_INDEX_PATH,
  BREED_PAGE_CSS,
  BREED_PAGE_FLAG,
  BREED_PAGE_SCRIPT,
} from '../src/webview/breedPage';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

/**
 * Run the script against a page, and report the classes it left on <body>.
 *
 * Enough of a DOM for what the script actually touches. Building it by hand
 * rather than reaching for jsdom keeps this a test of the script, and this
 * project's jest environment is node.
 */
const flagsFor = (path: string, headings: string[]): string => {
  const body = {className: 'template-page'};
  const document = {
    body,
    querySelector: (selector: string) =>
      selector === 'h1.hidden-h1' && headings.length > 0 ? {} : null,
    addEventListener: () => {},
  };
  const window = {location: {pathname: path}, console};
  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'document', BREED_PAGE_SCRIPT);
  run(window, document);
  return body.className;
};

const BREED_PAGE = '/pages/beagle';

describe('the appointment button', () => {
  it('is valid JavaScript', () => {
    // A lost escape in an injected template literal makes the WebView execute
    // nothing at all, silently.
    // eslint-disable-next-line no-new-func
    expect(() => new Function(BREED_PAGE_SCRIPT)).not.toThrow();
  });

  it('is not offered on the index, where no breed has been chosen yet', () => {
    expect(flagsFor(BREED_INDEX_PATH, ['Pet Breeds'])).toContain(
      BREED_INDEX_FLAG,
    );
    expect(BREED_PAGE_CSS).toContain(
      `body.${BREED_INDEX_FLAG} .sticky-appointment-btn`,
    );
    expect(BREED_PAGE_CSS).toContain('display: none !important');
  });

  it('sits bottom right on a breed’s own page', () => {
    expect(flagsFor(BREED_PAGE, ['Beagle'])).toContain(BREED_PAGE_FLAG);
    expect(flagsFor(BREED_PAGE, ['Beagle'])).not.toContain(BREED_INDEX_FLAG);

    const rule = BREED_PAGE_CSS.slice(
      BREED_PAGE_CSS.indexOf(`body.${BREED_PAGE_FLAG}`),
    );
    expect(rule).toContain('bottom: 14px !important');
    expect(rule).toContain('right: 14px !important');
    // The theme lifts it to 9rem for the website's own bottom furniture, none
    // of which is in the app; left and top are cleared so neither can fight it.
    expect(rule).toContain('top: auto !important');
    expect(rule).toContain('left: auto !important');
  });

  it('leaves the same button alone on the pages that were not asked about', () => {
    // Vetcare and Grooming carry it too, and have no hidden page heading.
    expect(flagsFor('/pages/vet-care-page', [])).toBe('template-page');
    expect(flagsFor('/pages/grooming-experience-page', [])).toBe(
      'template-page',
    );
    // Which is what the scoping is for: no rule reaches the class on its own.
    expect(BREED_PAGE_CSS).not.toContain('\n.sticky-appointment-btn');
  });

  it('changes nothing about the button but where it is', () => {
    // The colour, the size, the label and the destination are all Zigly's.
    expect(BREED_PAGE_CSS).not.toContain('background');
    expect(BREED_PAGE_CSS).not.toContain('font-size');
    expect(BREED_PAGE_SCRIPT).not.toContain('Book An Appointment');
    expect(BREED_PAGE_SCRIPT).not.toContain('store-locator');
  });

  it('does not stack its flag when the page is re-injected', () => {
    // Every completed navigation re-injects, and the restyle passes repeat it.
    const body = {className: ''};
    const document = {
      body,
      querySelector: () => ({}),
      addEventListener: () => {},
    };
    const window = {location: {pathname: BREED_PAGE}, console};
    // eslint-disable-next-line no-new-func
    const run = new Function('window', 'document', BREED_PAGE_SCRIPT);
    run(window, document);
    run(window, document);
    run(window, document);
    expect(body.className.split(BREED_PAGE_FLAG).length - 1).toBe(1);
  });

  it('rides along with the rest of the injection', () => {
    const script = getInjectionForUrl('https://zigly.com' + BREED_PAGE);
    expect(script).toContain('sticky-appointment-btn');
    expect(script).toContain(BREED_PAGE_FLAG);
    // And never on the money flow, like everything else.
    expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
  });
});
