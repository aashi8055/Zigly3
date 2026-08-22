/**
 * Book An Appointment.
 *
 * The button is Zigly's own and is fixed at `bottom: 9rem` by the theme's
 * mobile media query -- an offset that clears the website's own bottom bar and
 * chat bubble, neither of which exists in the app. Verified on 2026-08-22 it is
 * on four pages: the Breed-verse index, every breed's own page, Vetcare and
 * Grooming.
 *
 * The index hides it, since no breed has been chosen there yet; the other three
 * pin it bottom right. What these tests hold to is that it stays the site's
 * button -- only its offsets are ours -- and that a page which starts carrying
 * it later is not moved by a rule written before anyone looked at it.
 */
import {
  APPOINTMENT_HIDE_FLAG,
  APPOINTMENT_PIN_FLAG,
  BREED_INDEX_PATH,
  BREED_PAGE_CSS,
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
const flagsFor = (path: string, hasButton: boolean): string => {
  const body = {className: 'template-page'};
  const document = {
    body,
    querySelector: (selector: string) =>
      selector === '.sticky-appointment-btn' && hasButton ? {} : null,
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
    expect(flagsFor(BREED_INDEX_PATH, true)).toContain(
      APPOINTMENT_HIDE_FLAG,
    );
    expect(BREED_PAGE_CSS).toContain(
      `body.${APPOINTMENT_HIDE_FLAG} .sticky-appointment-btn`,
    );
    expect(BREED_PAGE_CSS).toContain('display: none !important');
  });

  it('sits bottom right on a breed’s own page', () => {
    expect(flagsFor(BREED_PAGE, true)).toContain(APPOINTMENT_PIN_FLAG);
    expect(flagsFor(BREED_PAGE, true)).not.toContain(APPOINTMENT_HIDE_FLAG);

    const rule = BREED_PAGE_CSS.slice(
      BREED_PAGE_CSS.indexOf(`body.${APPOINTMENT_PIN_FLAG}`),
    );
    expect(rule).toContain('bottom: 14px !important');
    expect(rule).toContain('right: 14px !important');
    // The theme lifts it to 9rem for the website's own bottom furniture, none
    // of which is in the app; left and top are cleared so neither can fight it.
    expect(rule).toContain('top: auto !important');
    expect(rule).toContain('left: auto !important');
  });

  it('pins it on Vetcare and Grooming, which carry the same button', () => {
    expect(flagsFor('/pages/vet-care-page', true)).toContain(
      APPOINTMENT_PIN_FLAG,
    );
    expect(flagsFor('/pages/grooming-experience-page', true)).toContain(
      APPOINTMENT_PIN_FLAG,
    );
  });

  it('touches no page that does not carry the button', () => {
    expect(flagsFor('/collections/dog-dry-food', false)).toBe('template-page');
    expect(flagsFor('/', false)).toBe('template-page');
    // Which is what the body-class scoping is for: no rule in the stylesheet
    // reaches the site's class on its own.
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
    expect(body.className.split(APPOINTMENT_PIN_FLAG).length - 1).toBe(1);
  });

  it('rides along with the rest of the injection', () => {
    const script = getInjectionForUrl('https://zigly.com' + BREED_PAGE);
    expect(script).toContain('sticky-appointment-btn');
    expect(script).toContain(APPOINTMENT_PIN_FLAG);
    // And never on the money flow, like everything else.
    expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
  });
});
