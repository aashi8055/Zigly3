/**
 * The login screen's furniture.
 *
 * The site's own bottom bar, footer and scroll-to-top button are chrome, and
 * on this screen all three are wrong: the bar repeats the four destinations
 * the app already draws natively, directly above it; the footer contributes a
 * decorative navy wave across an otherwise empty screen; the button anchors a
 * third thing to a corner that should hold nothing.
 *
 * What these tests really pin is *when* they go. The rest of this stylesheet
 * is gated on the .zigly-otp class, which the script adds only once it has
 * found the OTP widget -- reasonable for rules that style that widget. The
 * furniture is not the widget. It is on screen in the documented fallback where
 * the widget never appears, so its rules, and the ground behind them, cannot
 * wait for it.
 *
 * That fallback is also what a targeting bug looks like, which is why the gated
 * half of the sheet has tests of its own now: see loginWidget.test.ts. This file
 * stays about the three rules that must land either way, plus the one ordering
 * rule the whole sheet depends on.
 */
import {LOGIN_RESTYLE} from '../src/webview/loginRestyle';
import {COLORS} from '../src/constants/appConstants';

/** The stylesheet the restyle installs, recovered from the payload. */
const loginCss = (): string => {
  const line = LOGIN_RESTYLE.split('\n').find(l =>
    l.includes('createTextNode('),
  );
  expect(line).toBeDefined();
  const text = line as string;
  // The line reads: style.appendChild(document.createTextNode("<css>"));
  // so the payload runs from its opening quote to its closing one -- taking
  // it between parentheses would catch appendChild's instead.
  return JSON.parse(
    text.slice(text.indexOf('"'), text.lastIndexOf('"') + 1),
  ) as string;
};

type Rule = {selectors: string[]; body: string};

/** Parse to rules, comments stripped so they do not ride on the next selector. */
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

/** The rules that hide `selector`, whatever else they hide alongside it. */
const hidesOf = (selector: string): Rule[] =>
  rules(loginCss()).filter(
    r => r.selectors.includes(selector) && /display:\s*none/.test(r.body),
  );

const FURNITURE: Array<[string, string]> = [
  ['the site bottom bar', '.fixed-icons'],
  ['the footer, and its wave', '.shopify-section-group-footer-group'],
  ['the scroll-to-top button', '.scrollUpBtn'],
];

describe('the login screen furniture', () => {
  it.each(FURNITURE)('hides %s', (_what, selector) => {
    const hides = hidesOf(selector);
    expect(hides).not.toHaveLength(0);
    // The theme sets display:flex on the bar, so none of this lands politely.
    hides.forEach(r => expect(r.body).toContain('!important'));
  });

  it.each(FURNITURE)('hides %s without waiting for the widget', (_w, sel) => {
    // The regression: every rule in this sheet was once gated on .zigly-otp,
    // so on a page whose OTP popup never arrives the furniture stayed up.
    hidesOf(sel).forEach(r =>
      r.selectors.forEach(s => expect(s).not.toContain('zigly-otp')),
    );
  });

  it('paints the ground without waiting for the widget either', () => {
    // With the footer gone this is most of the screen.
    const ground = rules(loginCss()).filter(
      r => r.selectors.includes('html body') && r.body.includes(COLORS.ground),
    );
    expect(ground).not.toHaveLength(0);
    ground.forEach(r => {
      expect(r.body).toContain('!important');
      r.selectors.forEach(s => expect(s).not.toContain('zigly-otp'));
    });
  });

  it('never states that ground with a bare "body", which loses the tie', () => {
    // The same cascade trap the mobile stylesheet hit: the store appends
    // `body {background-color: #ffffff !important;}` to the end of every page,
    // so a bare `body` ties on importance and specificity, then loses on order.
    const bare = rules(loginCss()).filter(
      r => r.selectors.includes('body') && /background(-color)?:/.test(r.body),
    );
    expect(bare).toEqual([]);
  });

  it('installs the stylesheet before it looks for the widget', () => {
    // Otherwise none of the above reaches the page it most needs to reach:
    // addStyle used to be callable only from inside present().
    const run = LOGIN_RESTYLE.indexOf('function run()');
    expect(run).toBeGreaterThan(-1);
    const install = LOGIN_RESTYLE.indexOf('addStyle();', run);
    const search = LOGIN_RESTYLE.indexOf('if (present())', run);
    expect(install).toBeGreaterThan(-1);
    expect(search).toBeGreaterThan(-1);
    expect(install).toBeLessThan(search);
  });

  it('keeps the hideBox rule last, so no two steps can show at once', () => {
    // SimplyOTP hides its inactive steps with .hideBox, and this rule is the
    // only thing holding that against the display:flex rules above it -- they
    // tie on specificity, so source order decides. Every per-step rule added
    // for the OTP and signup screens sits above it for that reason, and a rule
    // appended after it would put two steps on screen at the same time.
    const parsed = rules(loginCss());
    const last = parsed[parsed.length - 1];
    expect(last.selectors).toEqual(['html.zigly-otp .hideBox']);
    expect(last.body).toContain('display: none !important');
    // And it is stated once: a second copy earlier in the sheet would read as
    // the authoritative one while contributing nothing.
    expect(
      parsed.filter(r => r.selectors.includes('html.zigly-otp .hideBox')),
    ).toHaveLength(1);
  });

  it('hides furniture only -- never the form the customer came for', () => {
    // The fallback has to stay a working login page. Nothing ungated may hide
    // a container the widget or the theme's own form could be living in.
    const allowed = FURNITURE.map(([, selector]) => selector);
    rules(loginCss())
      .filter(
        r =>
          /display:\s*none/.test(r.body) &&
          r.selectors.every(s => !s.includes('zigly-otp')),
      )
      .forEach(r => r.selectors.forEach(s => expect(allowed).toContain(s)));
  });
});
