/**
 * The Bestsellers rail.
 *
 * The heading is the thing under test as much as the markup. This slot held
 * Zigly's "Pet Parent Favourites" rail under Zigly's own heading, deliberately,
 * because relabelling somebody else's curated rail "Bestsellers" would have
 * been this app making a sales claim on their behalf. Calling it Bestsellers is
 * only defensible while the products actually come from the store's own
 * best-selling sort -- so that is asserted here, not just documented.
 */
import {BESTSELLERS_SCRIPT} from '../src/webview/bestsellers';
import {EXTRA_SECTIONS_SCRIPT} from '../src/webview/extraSections';
import {MOBILE_CSS} from '../src/webview/injectedStyles';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

const home = () => getInjectionForUrl('https://zigly.com/') as string;

describe('the bestsellers script', () => {
  it('parses', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(BESTSELLERS_SCRIPT)).not.toThrow();
  });

  it('is part of the injection every navigation carries', () => {
    expect(home()).toContain('__ziglyBestsellers');
  });

  it('reads the store’s own best-selling sort', () => {
    // This is what makes the heading a description of Zigly's ordering rather
    // than a claim this app added. If the source ever stops carrying the sort,
    // the heading has to change with it.
    expect(BESTSELLERS_SCRIPT).toContain('/collections/all?sort_by=best-selling');
  });

  it('shows twelve cards', () => {
    expect(BESTSELLERS_SCRIPT).toContain('var LIMIT = 12;');
  });

  it('moves real product cards rather than rebuilding them', () => {
    // Each card keeps its own <product-form>, so Add to Bag still posts to
    // Shopify. Rebuilding from a JSON endpoint would be lighter and would
    // break exactly that.
    expect(BESTSELLERS_SCRIPT).toContain('.card-wrapper.product-card-wrapper');
    expect(BESTSELLERS_SCRIPT).toContain('document.importNode');
  });

  it('parses fetched markup inertly', () => {
    // DOMParser, not innerHTML on a detached div: the markup carries 22
    // products' worth of photographs, and a div would have the page fetch
    // every one of them just to throw ten away.
    expect(BESTSELLERS_SCRIPT).toContain('new DOMParser()');
  });

  it('asks for one section, and falls back to the whole page', () => {
    // ~585 KB against ~1.4 MB for the same cards in the same order -- but a
    // theme-generated section id changes without notice, so a stale id must
    // degrade to a heavier fetch, never to an empty rail.
    expect(BESTSELLERS_SCRIPT).toContain('&sections=');
    expect(BESTSELLERS_SCRIPT).toContain('__ziglyFetchDoc');
  });

  it('loads only when the rail nears the viewport', () => {
    expect(BESTSELLERS_SCRIPT).toContain('IntersectionObserver');
  });

  it('removes itself rather than showing a heading over nothing', () => {
    expect(BESTSELLERS_SCRIPT).toContain('removeChild(section)');
  });

  it('does nothing away from the dashboard', () => {
    expect(BESTSELLERS_SCRIPT).toContain('isHome()');
    const listing = getInjectionForUrl(
      'https://zigly.com/collections/dog-wet-food',
    ) as string;
    // The guard travels with the script; it is the script that opts out.
    expect(listing).toContain('__ziglyBestsellers');
  });
});

describe('the slot it fills', () => {
  it('is reserved by extraSections, in the reference order', () => {
    // Reserved there so the position is set by declaration order, and no fetch
    // resolving early or late can move the rail up or down the page.
    expect(EXTRA_SECTIONS_SCRIPT).toContain('"slot":"zigly-x-bestsellers"');
  });

  it('no longer transplants Pet Parent Favourites', () => {
    expect(EXTRA_SECTIONS_SCRIPT).not.toContain('collection_product_section');
  });

  it('still sits above Everything For and below the third offer section', () => {
    // The rail took over the exact position its predecessor held; nothing else
    // on the dashboard moved.
    const s = home();
    expect(s.indexOf('"mark":"zigly-x-offer3"')).toBeLessThan(
      s.indexOf('"slot":"zigly-x-bestsellers"'),
    );
    expect(s.indexOf('"slot":"zigly-x-bestsellers"')).toBeLessThan(
      s.indexOf('"slot":"zigly-x-everything"'),
    );
  });
});

describe('the stylesheet half', () => {
  it('lays the rail out as a horizontal scroller', () => {
    expect(MOBILE_CSS).toContain('.zigly-bs__rail');
    expect(MOBILE_CSS).toContain('.zigly-bs__title');
  });

  it('carries no backtick, which would end the template literal', () => {
    // A stylesheet that does not parse is a page that looks completely
    // untouched, with nothing in the log. Asserted on every change to it.
    expect(MOBILE_CSS).not.toContain('`');
  });
});
