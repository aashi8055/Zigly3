/**
 * The page ground.
 *
 * The app's ground is a warm off-white and the WebView is the largest surface
 * in it, so the page must carry that colour rather than the theme's white.
 *
 * The reason this needs a test of its own is a rule the store ships as the
 * last thing inside <body>, on every page type -- home, collection, cart,
 * search, account and the content pages:
 *
 *     <style> body {background-color: #ffffff !important;} </style>
 *
 * Our stylesheet is installed in <head>. Against a bare "body" selector the
 * two declarations tie on importance and on specificity (0,0,1), the cascade
 * falls through to source order, and theirs wins by sitting further down the
 * document -- which is exactly how this shipped white the first time. The
 * selector must therefore stay more specific than a bare element, so the
 * cascade is decided before source order is ever reached.
 */
import {MOBILE_CSS} from '../src/webview/injectedStyles';
import {COLORS} from '../src/constants/appConstants';

/** The selector of the rule the store appends to the end of every <body>. */
const SITE_OVERRIDE_SELECTOR = 'body';

type Rule = {selectors: string[]; body: string};

/**
 * Parse the stylesheet into rules.
 *
 * Comments are stripped first: they sit between rules, so without that the
 * selector of the rule after a comment carries the whole comment with it.
 */
const rules = (css: string): Rule[] =>
  (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) ?? []).map(
    rule => {
      const brace = rule.indexOf('{');
      return {
        selectors: rule
          .slice(0, brace)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        body: rule.slice(brace + 1, rule.lastIndexOf('}')).trim(),
      };
    },
  );

/** Every rule whose selector list contains exactly `selector`. */
const rulesFor = (css: string, selector: string): Rule[] =>
  rules(css).filter(r => r.selectors.includes(selector));

/** The declarations any rule makes for `selector`, joined. */
const declarationsFor = (css: string, selector: string): string =>
  rulesFor(css, selector)
    .map(r => r.body)
    .join('\n');

describe('the injected page ground', () => {
  it('paints the ground the native surfaces use, not the theme white', () => {
    expect(rulesFor(MOBILE_CSS, 'html body')).not.toHaveLength(0);
    expect(declarationsFor(MOBILE_CSS, 'html body')).toContain(COLORS.ground);
  });

  it('paints the root as well, so the canvas matches when body is short', () => {
    // A body shorter than the viewport leaves the rest of the canvas painted
    // from html. Both must carry the ground or the page ends in a white band.
    expect(declarationsFor(MOBILE_CSS, 'html')).toContain(COLORS.ground);
  });

  it('marks the ground important, since the site marks its own white so', () => {
    const ground = rulesFor(MOBILE_CSS, 'html body').filter(r =>
      r.body.includes(COLORS.ground),
    );
    expect(ground).not.toHaveLength(0);
    ground.forEach(r => expect(r.body).toContain('!important'));
  });

  it('outranks the white the site appends at the end of every body', () => {
    // Both are !important, so specificity decides and source order is never
    // consulted. Theirs is one element (0,0,1); ours must be more than that.
    const depth = (sel: string) => sel.trim().split(/\s+/).length;
    expect(depth('html body')).toBeGreaterThan(depth(SITE_OVERRIDE_SELECTOR));
  });

  it('never states the ground with a bare "body", which loses that tie', () => {
    // The specific regression: a background rule whose selector list contains
    // exactly `body`. Rules that set other properties may still use it.
    const bareBodyGrounds = rules(MOBILE_CSS).filter(
      r =>
        r.selectors.includes(SITE_OVERRIDE_SELECTOR) &&
        /background(-color)?\s*:/.test(r.body),
    );
    expect(bareBodyGrounds).toEqual([]);
  });

  it('leaves the cards on the ground white, so they keep their edge', () => {
    // The ground is a change of ground only. If this ever fails, the cart
    // lines and product cards have been flattened into their own background.
    const card = declarationsFor(MOBILE_CSS, '#zigly-hot-picks .card-wrapper');
    expect(card).toContain('#FFFFFF');
  });
});
