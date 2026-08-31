/**
 * One add-to-cart colour, across three renderers.
 *
 * The same action is drawn by three different things in this app, and a
 * customer moves between all of them in one session:
 *
 *   - the native sticky bar on a product page (ProductActionBar),
 *   - the site's own button on every product card -- Hot Picks, Bestsellers,
 *     the transplanted rails, the listing grid -- restyled by injectedStyles,
 *   - SearchTap's replacement card, which appears the moment a filter is
 *     applied and carries the theme's class names on the parts that matter.
 *
 * Add to Bag used to be #1B1B1B with white text on the native bar while the
 * cards kept whatever the theme painted, so the same button was two or three
 * different colours depending on where you met it. BUTTON_FILL is the single
 * decision; this file is what stops the two halves drifting, because the
 * injected stylesheet is a CSS string and cannot import the token.
 */
import {BUTTON_FILL, COLORS} from '../src/constants/appConstants';
import {MOBILE_CSS} from '../src/webview/injectedStyles';

/**
 * The colour rule for the card button.
 *
 * Found by the DECLARATION, not by the selector: `.quick-add__submit` is styled
 * by several rules in this stylesheet (shape, position, display) and the first
 * match is not the one that paints it. Anchoring on the fill is what makes this
 * point at the right block.
 */
const colourRule = (): string => {
  const at = MOBILE_CSS.indexOf('background: ' + BUTTON_FILL + ' !important');
  expect(at).toBeGreaterThan(-1);
  const open = MOBILE_CSS.lastIndexOf('{', at);
  return MOBILE_CSS.slice(open, MOBILE_CSS.indexOf('}', at));
};

/** The selector list immediately above that rule. */
const colourSelectors = (): string => {
  const at = MOBILE_CSS.indexOf('background: ' + BUTTON_FILL + ' !important');
  const open = MOBILE_CSS.lastIndexOf('{', at);
  // Back to the end of the preceding rule or comment, so only this rule's own
  // selector list is returned.
  const prev = Math.max(
    MOBILE_CSS.lastIndexOf('}', open),
    MOBILE_CSS.lastIndexOf('*/', open),
  );
  return MOBILE_CSS.slice(prev + 1, open);
};

describe('the token', () => {
  it('is the pale fill Buy Now already used', () => {
    expect(BUTTON_FILL).toBe('#FDE8E8');
  });

  it('is a colour, not a name that could be anything', () => {
    expect(BUTTON_FILL).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('the injected stylesheet agrees with the token', () => {
  /*
   * The stylesheet carries the literal because it is a compiled CSS string, so
   * these two assertions are the whole reason this file exists: changing
   * BUTTON_FILL without changing the CSS is a silent split, and the split is
   * invisible until someone opens a product page and a listing side by side.
   */
  it('paints the card button with the same fill', () => {
    const rule = colourRule();
    expect(rule).toContain('background: ' + BUTTON_FILL + ' !important');
    expect(rule).toContain('background-color: ' + BUTTON_FILL + ' !important');
  });

  it('labels it in the same red', () => {
    const rule = colourRule();
    expect(rule).toContain('color: ' + COLORS.red + ' !important');
  });

  it('clears a gradient the fill would otherwise sit under', () => {
    // A background-color alone loses to a background-image, and the theme
    // paints some of these buttons with a gradient.
    const rule = colourRule();
    expect(rule).toContain('background-image: none !important');
  });

  it("clears the theme's border pseudo-elements", () => {
    // .quick-add__submit draws its border and focus ring with ::before and
    // ::after at inset:1px. Left painted, they put a dark edge over the pale
    // fill, which reads as a stray outline rather than a restyled button.
    expect(MOBILE_CSS).toContain('body.zigly-listing .quick-add__submit::before');
    expect(MOBILE_CSS).toContain('body.zigly-listing .quick-add__submit::after');
  });

  it('covers the rails as well as the listing grid', () => {
    // Three surfaces, one rule. Hot Picks by id, the transplanted slots by
    // prefix, the listing by body class.
    const selectors = colourSelectors();
    expect(selectors).toContain('#zigly-hot-picks .quick-add__submit');
    expect(selectors).toContain('[id^="zigly-x-"] .quick-add__submit');
    expect(selectors).toContain('body.zigly-listing .quick-add__submit');
  });

  it('does not restyle what the button says or does', () => {
    // Presentation only, which is the standing rule for everything in this
    // stylesheet: no content, no display:none on the control, nothing that
    // could stop the theme's own product-form submitting.
    const rule = colourRule();
    // Property names checked at the start of a declaration, not as bare
    // substrings: 'content:' is inside 'justify-content:', and 'display: none'
    // would have to be matched against a rule that legitimately sets
    // 'display: flex'.
    const properties = rule
      .split(';')
      .map(part => part.trim().split(':')[0].trim())
      .filter(Boolean);
    expect(properties).not.toContain('content');
    expect(properties).not.toContain('pointer-events');
    expect(rule).not.toContain('display: none');
  });
});
