/**
 * Top Pet Brands scrolls by thumb.
 *
 * The rail is a native horizontal scroller in CSS, but it is the one rail on
 * the dashboard whose Swiper is still alive -- the section is *moved* into the
 * reference order, not transplanted, and moving a node leaves its instance
 * attached. A live Swiper holds the touch gesture and answers a drag with a
 * transform the stylesheet pins to `none`, so the finger moved and nothing
 * followed. `brandRail.ts` stands the instance down; these tests hold both
 * halves of that together, because either one alone leaves the rail broken.
 */
import {BRAND_RAIL_SCRIPT} from '../src/webview/brandRail';
import {MOBILE_CSS} from '../src/webview/injectedStyles';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

describe('the brand rail script', () => {
  it('parses', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(BRAND_RAIL_SCRIPT)).not.toThrow();
  });

  it('is part of the injection every navigation carries', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('__ziglyBrandRail');
  });

  it('destroys the instance rather than reconfiguring it', () => {
    // Reconfiguring would put Swiper's drag physics on the one rail whose
    // neighbours all use the platform's, so the gesture would still be the
    // odd one out on the page.
    expect(BRAND_RAIL_SCRIPT).toContain('destroy(true, true)');
  });

  it('cleans styles on the way out', () => {
    // The second argument is load-bearing: Swiper's grid module positions the
    // second row with an inline margin-top on those slides, which is the
    // two-brands-per-column the rail is meant not to show.
    expect(BRAND_RAIL_SCRIPT).not.toContain('destroy(true, false)');
    expect(BRAND_RAIL_SCRIPT).not.toContain('destroy()');
  });

  it('stops autoplay explicitly', () => {
    // autoplay is {delay: 2500, disableOnInteraction: false} -- a timer that
    // outlived its instance would throw once every 2.5s for the whole session.
    expect(BRAND_RAIL_SCRIPT).toContain('autoplay.stop');
  });

  it('sweeps again after a tap inside the section', () => {
    // The theme's tab handler builds a FRESH Swiper on every Popular /
    // Emerging click, so a one-shot destroy lasts until the first tab tap.
    expect(BRAND_RAIL_SCRIPT).toContain("addEventListener('click'");
  });

  it('is scoped to the brand section', () => {
    expect(BRAND_RAIL_SCRIPT).toContain('home_shop_by_brand_section');
  });
});

describe('the stylesheet half', () => {
  it('does not let Swiper touch-action block a sideways thumb', () => {
    // swiper-horizontal sets touch-action: pan-y, which tells the browser to
    // ignore horizontal pans outright.
    expect(MOBILE_CSS).toContain('touch-action: auto');
  });

  it('keeps a horizontal flick out of the page and the back gesture', () => {
    expect(MOBILE_CSS).toContain('overscroll-behavior-x: contain');
  });

  it('hides the dead dots only on a section actually released', () => {
    // If a release ever fails, the dots are the only way to move the rail.
    expect(MOBILE_CSS).toContain("[data-zigly-brand-native='true']");
  });

  it('carries no backtick, which would end the template literal', () => {
    // Two comments added with backticks in them turned the whole stylesheet
    // into a parse error -- and a stylesheet that does not parse is a page
    // that looks completely untouched, with nothing in the log.
    expect(MOBILE_CSS).not.toContain('`');
  });
});
