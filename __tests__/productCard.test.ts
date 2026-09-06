/**
 * One product card, everywhere the app draws one.
 *
 * The reported fault was that the card styling "impacts sort and filter" -- the
 * controls were looking for the elements they see on the web and getting
 * something else rendered. The cause is in src/webview/productCard.ts's header:
 * a listing page draws TWO different card components, and the trim was written
 * for one of them.
 *
 * What these tests hold down is the property the hand-written CSS could not
 * have: that a rule cannot half-apply. Every surface, both components, no
 * exceptions -- and nothing that the sort and filter bridge needs is touched.
 */
import {
  CARD_SURFACES,
  PRODUCT_CARD_CSS,
} from '../src/webview/productCard';
import {FACET_BRIDGE_SCRIPT} from '../src/webview/facetBridge';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

/** Every selector in the block, one per entry, braces and commas stripped. */
const selectors = (): string[] => {
  const out: string[] = [];
  let inComment = false;
  for (const raw of PRODUCT_CARD_CSS.split('\n')) {
    const line = raw.trim();
    if (inComment) {
      if (line.indexOf('*/') !== -1) {
        inComment = false;
      }
      continue;
    }
    if (line.indexOf('/*') === 0) {
      if (line.indexOf('*/') === -1) {
        inComment = true;
      }
      continue;
    }
    if (line.endsWith(',')) {
      out.push(line.slice(0, -1).trim());
    } else if (line.endsWith('{')) {
      out.push(line.slice(0, -1).trim());
    }
  }
  return out;
};

describe('the product card, as one definition', () => {
  it('scopes every selector to a surface the app owns', () => {
    /*
     * The whole safety of this block. An unscoped `.card-wrapper` rule would
     * reach a product page's recommendation rails -- where a two-column grid
     * rule stretches a rail chip across the page -- and SearchTap's
     * autocomplete card, which is drawn on every page of the site.
     */
    const all = selectors();
    expect(all.length).toBeGreaterThan(20);
    for (const selector of all) {
      expect(CARD_SURFACES.some(scope => selector.startsWith(scope))).toBe(
        true,
      );
    }
  });

  it('covers every surface for every rule', () => {
    /*
     * The fault this file replaces: some hand-written blocks named all three
     * surfaces, some named one, so the same product wore a different card
     * depending on the page. Each surface should appear the same number of
     * times as every other -- which is what a generated cross product
     * guarantees and a hand-written list did not.
     */
    const counts = CARD_SURFACES.map(
      scope => selectors().filter(s => s.startsWith(scope)).length,
    );
    for (const count of counts) {
      expect(count).toBe(counts[0]);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('trims both card components, not just the theme’s', () => {
    /*
     * The bug in one assertion. SearchTap's card carries `card-wrapper` on its
     * ROOT, so a `.card-wrapper .product--brand--wrapper` rule looks like it
     * covers both -- but none of the theme's inner class names exist inside it,
     * so the rule matched nothing and the card reverted to the raw site design
     * the moment a sort was applied.
     */
    const pairs: Array<[string, string]> = [
      ['.product--brand--wrapper', '.st-brand-wrapper'],
      ['.discount-container', '.product-item-discount'],
    ];
    for (const [theme, searchTap] of pairs) {
      expect(PRODUCT_CARD_CSS).toContain(theme);
      expect(PRODUCT_CARD_CSS).toContain(searchTap);
    }
  });

  it('releases the height each card reserves, in its own dialect', () => {
    /*
     * Hiding a row takes its text but not the space the card holds open for
     * it, and the two components reserve that space differently -- the theme
     * with min-heights and a fixed 75px price row, SearchTap with compiled
     * Tailwind utilities. A hide-only port leaves the card its old height with
     * the title floating in the middle of it.
     */
    // The theme's.
    expect(PRODUCT_CARD_CSS).toContain('.only-price-align--wrapper');
    expect(PRODUCT_CARD_CSS).toContain('.custom_price__container');
    // SearchTap's. mt-auto is the one that matters: it pins the price block to
    // the card's foot, so height freed above it becomes a gap unless released.
    expect(PRODUCT_CARD_CSS).toContain('.st-product-price');
    expect(PRODUCT_CARD_CSS).toContain('margin-top: 0 !important');
    expect(PRODUCT_CARD_CSS).toContain('.st-product-name');
  });

  it('sets each element’s layout in one rule, not two', () => {
    /*
     * ./injectedStyles.ts's own warning, applied here: "two rules for one
     * property in one file is how a value drifts". .st-product-price carries
     * both a released height and a reversed flex direction, and an earlier
     * draft of this file set them in two separate blocks.
     */
    const heads = selectors().filter(s => s.endsWith('.st-product-price'));
    // Once per surface, and once only.
    expect(heads.length).toBe(CARD_SURFACES.length);
  });

  it('never states a font, which is the site’s to decide', () => {
    // The trim is about what a card SHOWS and how tall it is. The title's
    // weight, size and colour stay whatever the store renders.
    expect(PRODUCT_CARD_CSS).not.toContain('font-weight');
    expect(PRODUCT_CARD_CSS).not.toContain('font-size');
    expect(PRODUCT_CARD_CSS).not.toContain('font-family');
  });
});

describe('what the card block must not break', () => {
  it('hides nothing the sort and filter bridge reads or clicks', () => {
    /*
     * The reported symptom was that the styling impacted sort and filter, so
     * this is the assertion that matters most. ../src/webview/facetBridge
     * reads SearchTap's facets and clicks its own controls; if a rule here hid
     * one of them, the sheet would come up empty or a tap would go nowhere.
     *
     * `.st-overlay-active` in particular: it is the UNCONDITIONAL root of
     * SearchTap's sorting dropdown and contains every sort button, not the
     * dimming overlay an older comment claimed. display:none on it is the
     * exact trap ./injectedStyles.ts warns about.
     */
    for (const driven of [
      '.st-widget',
      '.st-widget-title',
      '.st-product-number',
      '.st-sorting-wrapper',
      '.st-overlay-active',
      '.filter_h',
      '.sort_h',
      '.apply-btn',
    ]) {
      expect(PRODUCT_CARD_CSS).not.toContain(driven);
    }
  });

  it('leaves the controls the bridge drives in the bridge’s hands', () => {
    // A sanity check on the pairing: these ARE the selectors facetBridge uses,
    // so the assertion above is testing the real list rather than a stale one.
    for (const driven of ['.st-widget', '.st-product-number', '.filter_h']) {
      expect(FACET_BRIDGE_SCRIPT).toContain(driven);
    }
  });

  it('keeps every price the customer buys on', () => {
    /*
     * Nothing carrying a number is hidden. The sale price and the struck
     * compare-at price beside it both stay on both cards -- the trim takes the
     * SECOND, redundant statement of a saving, never the figures themselves.
     *
     * Only the selectors of rules that actually hide something are examined.
     * Naming `.price` in a rule that RELEASES its reserved height is the
     * opposite of hiding it, and an earlier version of this test read those as
     * failures by taking everything before the last `display: none`.
     */
    const hiding: string[] = [];
    let pending: string[] = [];
    for (const raw of PRODUCT_CARD_CSS.split('\n')) {
      const line = raw.trim();
      if (line.endsWith(',')) {
        pending.push(line.slice(0, -1).trim());
      } else if (line.endsWith('{')) {
        pending.push(line.slice(0, -1).trim());
      } else if (line.indexOf('display: none') !== -1) {
        for (const head of pending) {
          hiding.push(head);
        }
        pending = [];
      } else if (line === '}') {
        pending = [];
      }
    }
    expect(hiding.length).toBeGreaterThan(0);
    for (const head of hiding) {
      expect(head).not.toContain('.price');
      expect(head).not.toContain('.st-price');
      expect(head).not.toContain('compare-at');
    }
  });

  it('does not reach a product page', () => {
    /*
     * A PDP draws the same card markup in its recommendation rails, and
     * SearchTap's autocomplete draws its card on every page of the site. None
     * of the four scopes exists there: the listing flag is set on listing paths
     * only, and the other three name sections this app builds on the dashboard.
     */
    const pdp = getInjectionForUrl('https://zigly.com/products/x') as string;
    for (const selector of selectors()) {
      expect(pdp).not.toContain(`\n${selector} {`);
    }
  });

  it('ships on a listing page, where both grids appear', () => {
    const listing = getInjectionForUrl(
      'https://zigly.com/collections/x',
    ) as string;
    expect(listing).toContain('.st-product .st-brand-wrapper');
    expect(listing).toContain('.card-wrapper .product--brand--wrapper');
  });

  it('ships on the dashboard, where the rails appear', () => {
    /*
     * Hot Picks, the transplanted sections and the bestsellers rail are all
     * built on the dashboard, and all three draw the theme's card. The
     * bestsellers rail is the surface that was missing from every hand-written
     * block -- it builds its section with a CLASS, `zigly-bs`, and no id, so
     * the id-shaped scope this file first guessed at matched nothing there.
     */
    const home = getInjectionForUrl('https://zigly.com/') as string;
    expect(home).toContain('#zigly-hot-picks .card-wrapper');
    expect(home).toContain('.zigly-bs .card-wrapper');
    /*
     * The attribute scope appears with its quotes escaped: the stylesheet is
     * embedded in a JavaScript string literal, so every `"` in the CSS reaches
     * the page as `\"`. Asserted in the form it actually ships in rather than
     * the form it is written in.
     */
    expect(home).toContain('[id^=\\"zigly-x-\\"] .card-wrapper');
  });
});
