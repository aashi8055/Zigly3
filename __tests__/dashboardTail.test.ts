/**
 * How the dashboard ends.
 *
 * Two separate complaints about the foot of the page, both fixed in the
 * stylesheet:
 *
 *   - the brand-claims strip and the gift-card banner both answered a tap with
 *     a navigation nobody asked for. The strip's anchors carry href="", which
 *     is not an inert link -- it resolves to the current URL, so tapping the
 *     trust markers reloaded the dashboard. The gift-card banner points at
 *     /collections while its own artwork file is named Coming-Soon.
 *   - the footer put its decorative navy wave across the foot of the page and
 *     its link lists under it, below a native bar that already carries those
 *     destinations.
 */
import {MOBILE_CSS} from '../src/webview/injectedStyles';

type Rule = {selectors: string[]; body: string};

const rules = (css: string): Rule[] =>
  (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) ?? []).map(
    rule => {
      const brace = rule.indexOf('{');
      return {
        selectors: rule
          .slice(0, brace)
          .split(',')
          .map(sel => sel.trim())
          .filter(Boolean),
        body: rule.slice(brace + 1, rule.lastIndexOf('}')).trim(),
      };
    },
  );

/** Selectors of every rule that switches pointer events off. */
const untappable = (): string[] =>
  rules(MOBILE_CSS)
    .filter(r => /pointer-events:\s*none/.test(r.body))
    .flatMap(r => r.selectors);

/** Selectors of every rule that hides something outright. */
const hidden = (): string[] =>
  rules(MOBILE_CSS)
    .filter(r => /display:\s*none/.test(r.body))
    .flatMap(r => r.selectors);

describe('the banners that lead nowhere', () => {
  it('makes the brand-claims strip untappable', () => {
    expect(untappable()).toContain('#zigly-x-logos a');
  });

  it('covers the empty-href anchors wherever the strip is rendered', () => {
    // The homepage carries its own copy of the strip alongside the
    // transplanted one, and both wrap the artwork in <a href="">.
    expect(untappable()).toContain('[id*="custom_single_banner"] a[href=""]');
  });

  it('makes the gift-card half of the double banner untappable', () => {
    expect(untappable()).toContain('#zigly-x-double .double-banner-cards-2 a');
  });

  it('leaves the birthday half beside it working', () => {
    // It points at a real collection. Only the gift card is a dead end, and a
    // rule on the section as a whole would have taken both.
    const selectors = untappable();
    expect(selectors).not.toContain('#zigly-x-double a');
    expect(selectors).not.toContain('#zigly-x-double .double-banner-cards-1 a');
    selectors.forEach(sel =>
      expect(sel).not.toMatch(/double-banner-cards-1/),
    );
  });

  it('disables the tap without touching the markup', () => {
    // pointer-events, not display:none and not a stripped href: the theme's
    // own scripts still find the anchors where they left them.
    expect(hidden()).not.toContain('#zigly-x-logos a');
    expect(hidden()).not.toContain('#zigly-x-double .double-banner-cards-2 a');
  });
});

describe('the footer', () => {
  it('is hidden on every page, not only the inner ones', () => {
    expect(hidden()).toContain('footer');
    expect(hidden()).toContain('[id*="__footer"]');
  });

  it('is no longer gated on the inner-page class', () => {
    // The regression this guards: the footer was hidden by
    // `html.zigly-inner-page footer`, which left the dashboard showing the
    // navy wave and the site's link lists under the brand-claims strip.
    hidden()
      .filter(sel => /(^|\s)footer\b|__footer/.test(sel))
      .forEach(sel => expect(sel).not.toContain('zigly-inner-page'));
  });

  it('is hidden rather than removed, so the drawer can still read it', () => {
    // drawerExtras clones the About Us row out of the footer's own links and
    // menuBridge reads the native drawer from that list. display:none leaves
    // the anchors in the DOM for querySelectorAll; removal would drop a row.
    expect(MOBILE_CSS).not.toMatch(/footer[^{}]*\{[^{}]*content:\s*none/);
    const footerRules = rules(MOBILE_CSS).filter(r =>
      r.selectors.includes('footer'),
    );
    expect(footerRules).not.toHaveLength(0);
    footerRules.forEach(r => expect(r.body).toContain('display: none'));
  });
});
