/**
 * The probe has to keep up with the card.
 *
 * ../src/webview/cardProbe.ts exists because no string assertion can tell a
 * card rule that matches from one that matches nothing -- only the live page
 * can. That makes the probe's list of parts load-bearing: a SearchTap part
 * styled in productCard.ts but missing from the probe is a rule whose
 * correctness nothing on earth is checking.
 *
 * So this suite compares the two lists and fails when they drift. It also
 * checks the probe against the template-literal rules every injected script in
 * this project lives under.
 */
import {
  CARD_PROBE_SCRIPT,
  SEARCHTAP_CARD_PARTS,
  THEME_CARD_PARTS,
} from '../src/webview/cardProbe';
import {PRODUCT_CARD_CSS} from '../src/webview/productCard';

/**
 * Every class name productCard.ts actually styles, read off its output.
 *
 * Off the generated CSS rather than the source, so a rule added by any route
 * -- a new HIDDEN_ROWS pair, a new furniture block -- is seen.
 */
const styledClasses = (): Set<string> => {
  const out = new Set<string>();
  for (const line of PRODUCT_CARD_CSS.split('\n')) {
    // Selector lines only: a declaration has a colon before any brace.
    if (!line.startsWith('body.zigly-listing')) {
      continue;
    }
    for (const token of line.split(/[\s,{]+/)) {
      if (!token.startsWith('.')) {
        continue;
      }
      // '.atc-wrapper.st-atc' is two class names on one element.
      for (const name of token.split('.')) {
        if (name) {
          out.add(name);
        }
      }
    }
  }
  return out;
};

describe('the probe covers what the card styles', () => {
  it('names every SearchTap part productCard.ts styles', () => {
    const styled = styledClasses();
    const known = new Set<string>([
      ...SEARCHTAP_CARD_PARTS,
      ...THEME_CARD_PARTS,
      // Not card parts: the results row and the theme's card root, both styled
      // but neither a part whose presence tells the engines apart.
      'st-main-content-wrap',
      'atc-wrapper',
      'card-wrapper',
    ]);

    const unprobed = [...styled].filter(name => !known.has(name));
    /*
     * A part styled but not probed is a rule nothing verifies. Add it to
     * SEARCHTAP_CARD_PARTS or THEME_CARD_PARTS in cardProbe.ts -- the point of
     * this failure is that the probe is how a wrong class name is ever found.
     */
    expect(unprobed).toEqual([]);
  });

  it('probes nothing the card does not style', () => {
    // The other direction: a part in the probe that productCard.ts never
    // styles is dead weight, and suggests a rule was removed without the probe
    // being told.
    const styled = styledClasses();
    const unstyled = SEARCHTAP_CARD_PARTS.filter(name => !styled.has(name));
    expect(unstyled).toEqual([]);
  });
});

describe('the probe is a safe injected script', () => {
  it('carries no backtick, which would close its literal early', () => {
    expect(CARD_PROBE_SCRIPT.indexOf(String.fromCharCode(96))).toBe(-1);
  });

  it('carries no backslash, which the template literal would eat', () => {
    expect(CARD_PROBE_SCRIPT.split(String.fromCharCode(92)).length - 1).toBe(0);
  });

  it('is valid javascript in the page', () => {
    expect(
      () =>
        // eslint-disable-next-line no-new-func
        new Function('window', 'document', CARD_PROBE_SCRIPT),
    ).not.toThrow();
  });

  it('changes nothing about the page', () => {
    /*
     * A probe that wrote to the page would be describing a page that no longer
     * exists -- and worse, could itself be the reason a card looks wrong. It
     * reads, and the only thing it assigns is its own accessor on window.
     */
    expect(CARD_PROBE_SCRIPT).not.toContain('.click()');
    expect(CARD_PROBE_SCRIPT).not.toContain('className =');
    expect(CARD_PROBE_SCRIPT).not.toContain('.remove()');
    expect(CARD_PROBE_SCRIPT).not.toContain('appendChild');
    expect(CARD_PROBE_SCRIPT).not.toContain('setAttribute');
  });

  it('reports the body flag every card rule depends on', () => {
    // If this is false on a listing page, the class names are not the problem:
    // no rule in productCard.ts can match anything at all.
    expect(CARD_PROBE_SCRIPT).toContain('zigly-listing');
    expect(CARD_PROBE_SCRIPT).toContain('listingFlag');
  });
});

describe('describing a real card', () => {
  /** The smallest DOM the probe needs: one card, and a body to flag. */
  const run = (root: {className: string; children: string[]}) => {
    const sent: unknown[] = [];
    const el = (className: string) => ({
      className,
      querySelector: (sel: string) =>
        root.children.indexOf(sel.slice(1)) === -1 ? null : el(sel.slice(1)),
      querySelectorAll: () => root.children.map(el),
    });
    const card = el(root.className);
    const body = {className: 'template-collection zigly-listing'};
    const document = {
      body,
      getElementById: () => null,
      head: {lastChild: null},
      querySelectorAll: (sel: string) =>
        sel.indexOf('st-product') !== -1 || sel.indexOf('card-wrapper') !== -1
          ? [card]
          : [],
    };
    const window = {
      location: {pathname: '/collections/x', search: '?sort=price-ascending'},
      ReactNativeWebView: {
        postMessage: (raw: string) => sent.push(JSON.parse(raw)),
      },
    };
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', CARD_PROBE_SCRIPT)(window, document);
    return sent[0] as {
      listingFlag: boolean;
      cardCount: number;
      cards: Array<{engine: string; parts: Record<string, string>}>;
    };
  };

  it('calls a card SearchTap drew when it carries SearchTap parts', () => {
    const out = run({
      className: 'st-product card-wrapper',
      children: ['st-product-name', 'st-product-price', 'st-review'],
    });
    expect(out.listingFlag).toBe(true);
    expect(out.cardCount).toBe(1);
    expect(out.cards[0].engine).toBe('searchtap');
    // On the root, not inside it -- which is the flat-sibling fact that a
    // nested selector gets wrong.
    expect(out.cards[0].parts['st-product']).toBe('root');
    expect(out.cards[0].parts['st-product-name']).toBe('descendant');
  });

  it('reports a part that is absent, which is how a rename is found', () => {
    // The failure this whole file exists for: the card is SearchTap's, but a
    // part productCard.ts styles is not in it. That rule matches nothing.
    const out = run({
      className: 'st-product',
      children: ['st-product-name'],
    });
    expect(out.cards[0].parts['st-review']).toBe('absent');
    expect(out.cards[0].parts['st-swatches']).toBe('absent');
  });
});
