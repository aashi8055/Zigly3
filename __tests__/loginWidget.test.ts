/**
 * The login widget itself -- the restyle, not the furniture around it.
 *
 * `loginFurniture.test.ts` pins the three rules that must land whether or not
 * the widget is found. This file pins the rest, and it exists because of a bug
 * that cost the whole feature: `present()` looked for `.sotp-popup-wrapper`, and
 * /account/login has no such element. So it returned false on all forty polls,
 * the `zigly-otp` class was never added, and roughly 250 lines of CSS were dead
 * -- with no error anywhere, because the documented fallback (the site's own
 * login page, minus the furniture) is exactly what a not-found widget is
 * supposed to look like. Nothing distinguished "working fallback" from
 * "targeting an element that does not exist".
 *
 * These are string and stylesheet assertions rather than a rendered widget,
 * because SimplyOTP's runtime DOM is not available to a test: jsdom is not a
 * dependency of this project and the widget is a third-party script that only
 * exists on a real page. So what is pinned here is what CAN be pinned off the
 * device -- what the payload targets, what it never does, and that it is safe to
 * run repeatedly. The device is still the only place the restyle can be proven.
 */
import {
  HOST_CLASS,
  INVALID_CLASS,
  LOGIN_HOSTS,
  LOGIN_LABELS,
  LOGIN_POPUP_HOST,
  LOGIN_RESTYLE,
  HIDDEN_FIELD_CLASS,
  MARKETING_CONSENT,
  OTP_READY_CLASS,
  REQUEST_OTP_LABEL,
  SIGNUP_EMAIL,
} from '../src/webview/loginRestyle';

/**
 * The stylesheet the restyle installs, recovered from the payload.
 *
 * Copied from loginFurniture.test.ts rather than shared: these two files pin
 * opposite halves of the same sheet and neither should be able to break the
 * other by editing a helper.
 */
const loginCss = (): string => {
  const line = LOGIN_RESTYLE.split('\n').find(l =>
    l.includes('createTextNode('),
  );
  expect(line).toBeDefined();
  const text = line as string;
  return JSON.parse(
    text.slice(text.indexOf('"'), text.lastIndexOf('"') + 1),
  ) as string;
};

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

/** Rules whose selector list contains `selector` exactly. */
const rulesFor = (selector: string): Rule[] =>
  rules(loginCss()).filter(r => r.selectors.includes(selector));

/** The declarations only. The comments explain what is deliberately not styled. */
const declarations = (): string =>
  loginCss().replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The payload minus the line that carries the stylesheet.
 *
 * The sheet is embedded with JSON.stringify, and CSS attribute selectors --
 * `[class*="sotp"]`, `input[type="tel"]` -- put escaped quotes in it. Those are
 * legitimate. The rule this project has is about escapes in *patterns*, so the
 * script half is what has to be free of them.
 */
const scriptOnly = (): string =>
  LOGIN_RESTYLE.split('\n')
    .filter(l => !l.includes('createTextNode('))
    .join('\n');

describe('where the restyle looks for the widget', () => {
  it('looks for the inline embed as well as the popup', () => {
    // The bug: only the popup was looked for, and /account/login renders the
    // widget inline -- #sotp-widget-loader > #sotp-widget > .olWrapper > .ol.
    expect(LOGIN_HOSTS).toContain('#sotp-widget-loader');
    expect(LOGIN_HOSTS).toContain(LOGIN_POPUP_HOST);
    // And the payload really iterates that list rather than one constant.
    expect(LOGIN_RESTYLE).toContain(JSON.stringify(LOGIN_HOSTS));
  });

  it('prefers the popup, so the pages that have one are unaffected', () => {
    // Lifting the outermost host is what makes hiding everything else safe, so
    // the popup wrapper has to be found before anything nested inside it.
    expect(LOGIN_HOSTS.indexOf(LOGIN_POPUP_HOST)).toBe(0);
    expect(LOGIN_HOSTS.indexOf(LOGIN_POPUP_HOST)).toBeLessThan(
      LOGIN_HOSTS.indexOf('#sotp-widget-loader'),
    );
  });

  it('marks the found host so the CSS can exempt it', () => {
    // The body-child hide used to rely on an incidental [class*="sotp"] match,
    // which the inline embed's id and .olWrapper both fail. An explicit class
    // is what makes the exemption true for every host in the list.
    expect(LOGIN_RESTYLE).toContain(JSON.stringify(HOST_CLASS));
    const hide = rules(loginCss()).find(
      r =>
        r.selectors.some(s => s.startsWith('html.zigly-otp body >')) &&
        /display:\s*none/.test(r.body),
    );
    expect(hide).toBeDefined();
    expect((hide as Rule).selectors[0]).toContain(':not(.' + HOST_CLASS + ')');
  });

  it('only calls the popup "active", because only the popup has that state', () => {
    // The inline embed has no open/closed state to set, and inventing one would
    // be driving the widget rather than restyling it.
    expect(LOGIN_RESTYLE).toContain("if (which === POPUP) {");
    expect(LOGIN_RESTYLE).toContain("classList.add('active')");
  });

  it('still reports "missing" when there is no host at all', () => {
    // The fallback has to keep announcing itself: it looks identical to the bug.
    expect(LOGIN_RESTYLE).toContain("report('missing'");
  });
});

describe('making the inline embed visible', () => {
  it('shows .olWrapper, which the page itself hides', () => {
    // The page's own script sets .olWrapper { display: none } and restores it
    // only under Shopify.designMode, so without this the widget is built inside
    // a hidden element and nothing ever shows it.
    const shows = rulesFor('html.zigly-otp .olWrapper');
    expect(shows).not.toHaveLength(0);
    shows.forEach(r => {
      expect(r.body).toContain('display: block !important');
      expect(r.body).toContain('visibility: visible !important');
    });
  });

  it('neutralises the loader’s reserved 400px band', () => {
    // #sotp-widget-loader carries an inline min-height:400px, which pushes the
    // widget down the screen once the widget has a real height of its own.
    const reset = rulesFor('html.zigly-otp #sotp-widget-loader');
    expect(reset).not.toHaveLength(0);
    reset.forEach(r => expect(r.body).toContain('min-height: 0 !important'));
  });

  it('gives the widget’s own shell the screen treatment', () => {
    const shell = rulesFor('html.zigly-otp .ol');
    expect(shell).not.toHaveLength(0);
    expect(shell.some(r => r.body.includes('max-width: 420px'))).toBe(true);
    expect(shell.some(r => r.body.includes('padding: 40px 20px 24px'))).toBe(
      true,
    );
  });

  it('names no selector that only exists in the legacy template', () => {
    // .verify-box-details and .verify-content are in SimplyOTP's other branch;
    // this store renders modal_view, so rules naming them could never land and
    // reading them would suggest the OTP step had been styled when it had not.
    const css = loginCss();
    expect(css).not.toContain('verify-box-details');
    expect(css).not.toContain('verify-content');
  });
});

describe('the copy this app overrides', () => {
  it('overrides every string from one table and nowhere else', () => {
    const texts = LOGIN_LABELS.map(l => l.text);
    expect(texts).toContain(REQUEST_OTP_LABEL);
    expect(texts).toContain('Submit');
    expect(texts).toContain('SIGN UP');
    expect(texts).toContain('You will receive OTP on');
    expect(texts).toContain('Edit phone number');
    expect(texts).toContain('Email Id');
    expect(texts).toContain('Phone Number');
  });

  it('states each override once, and says what it replaces and why', () => {
    // One table, one entry per string: two entries writing the same selector is
    // how a relabel starts fighting itself on alternate observer passes.
    const selectors = LOGIN_LABELS.map(l => l.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
    const texts = LOGIN_LABELS.map(l => l.text);
    expect(new Set(texts).size).toBe(texts.length);
    LOGIN_LABELS.forEach(entry => {
      expect(entry.why.length).toBeGreaterThan(0);
      // 'append' has nothing to replace: the widget draws only an svg there.
      if (entry.mode !== 'append') {
        expect(entry.live.length).toBeGreaterThan(0);
      }
    });
  });

  it('rebuilds the "sent on" line without touching the number', () => {
    // The customer's number lives in a span inside that paragraph, so a
    // textContent write on the paragraph would delete it.
    const sentOn = LOGIN_LABELS.find(l => l.mode === 'replace');
    expect(sentOn).toBeDefined();
    expect(LOGIN_RESTYLE).toContain('function retext(');
    expect(LOGIN_RESTYLE).toContain('nodeType !== 3');
    expect(LOGIN_RESTYLE).toContain('.split(live).join(text)');
  });

  it('adds the edit-phone label beside the svg, never over it', () => {
    // The widget's click listener is bound to .edit-phone itself, so the label
    // is appended: appending adds no listener and removes none.
    expect(LOGIN_RESTYLE).toContain('function appendLabel(');
    expect(LOGIN_RESTYLE).toContain("el.querySelector('.' + EDIT_LABEL)");
  });

  it('relabels titles nowhere -- they are hidden, not renamed', () => {
    const selectors = LOGIN_LABELS.map(l => l.selector);
    expect(selectors.some(s => s.includes('login-header'))).toBe(false);
    const hidden = rules(loginCss()).filter(r =>
      /display:\s*none/.test(r.body),
    );
    const all = hidden.flatMap(r => r.selectors).join(' ');
    expect(all).toContain('html.zigly-otp .verify-box .login-header');
    expect(all).toContain('html.zigly-otp .update-user-box .login-header');
  });
});

describe('the three steps do not look alike', () => {
  it('draws Submit small and centred, grey until six digits are in', () => {
    const verify = rulesFor('html.zigly-otp .verify-btn');
    expect(verify).not.toHaveLength(0);
    const bodies = verify.map(r => r.body).join(' ');
    expect(bodies).toContain('width: auto !important');
    expect(bodies).toContain('margin: 16px auto 0 !important');
    // Mid-grey with white type, which is what the reference app draws. The
    // pale chip with grey type this used to be was the most visible thing on
    // the screen that did not match it.
    expect(bodies).toContain('background: #808080 !important');
    expect(bodies).toContain('color: #FFFFFF !important');
    // Smaller than the other two buttons, which is the point of it: the shared
    // geometry block sets 58px and 18px type, and this comes down from both.
    expect(bodies).toContain('min-height: 33px !important');
    expect(bodies).toContain('font-size: 15px !important');
    // Grey by default, the app's filled action colour once ready.
    const ready = rulesFor('html.zigly-otp .verify-btn.' + OTP_READY_CLASS);
    expect(ready).not.toHaveLength(0);
    expect(ready[0].body).toContain('#183761');
  });

  it('overrides the shared geometry rather than sitting under it', () => {
    // .verify-btn and .otp-btn are both on this button at equal specificity,
    // so source order is the whole of what decides. The step-2 rule must stay
    // after the block that sets 58px, 18px type and an 18px inset.
    const css = loginCss();
    const shared = css.indexOf('html.zigly-otp .send-btn,');
    const step2 = css.indexOf('html.zigly-otp .verify-btn {');
    expect(shared).toBeGreaterThan(-1);
    expect(step2).toBeGreaterThan(shared);
  });

  it('sizes the OTP boxes and their gaps as the reference app does', () => {
    // Six boxes and five gaps come to 70% of the screen, and each box is
    // near-square -- not the tall field this drew before.
    const box = rulesFor('html.zigly-otp .otp-input-box');
    expect(box).not.toHaveLength(0);
    expect(box[0].body).toContain('width: 38px !important');
    expect(box[0].body).toContain('min-height: 40px !important');
    const row = rulesFor('html.zigly-otp .otp-input-main');
    expect(row[0].body).toContain('gap: 9px !important');
    // The step's own top offset, and on the step rather than on .ol: .ol is
    // every step, and only this one has been measured.
    const step = rulesFor('html.zigly-otp .verify-box');
    expect(step).not.toHaveLength(0);
    expect(step[0].body).toContain('padding-top: 115px !important');
    expect(rulesFor('html.zigly-otp .ol')[0].body).not.toContain('115px');
  });

  it('counts the boxes rather than assuming six, and blocks nothing', () => {
    // All six OTP boxes carry data-otp-index="0", so the attribute cannot tell
    // them apart -- and the widget validates on the click, so a class is all
    // this may do. Disabling the button would swallow the widget's own toast.
    expect(LOGIN_RESTYLE).toContain('function syncOtpReady(');
    expect(LOGIN_RESTYLE).toContain('filled === boxes.length');
    expect(LOGIN_RESTYLE).not.toContain('disabled = true');
    expect(LOGIN_RESTYLE).not.toContain('preventDefault');
  });

  it('draws SIGN UP full-width black, and the name fields side by side', () => {
    const update = rulesFor('html.zigly-otp .update-btn');
    // Two rules name it: the shared geometry base, and its own colour. The
    // colour has to be the later of the two, or the base would win the tie.
    expect(update.length).toBeGreaterThan(1);
    expect(update.map(r => r.body).join(' ')).toContain('width: 100% !important');
    expect(update[update.length - 1].body).toContain('#111111');
    const names = rulesFor(
      'html.zigly-otp .firstname-lastname-container:not(.hideBox)',
    );
    expect(names).not.toHaveLength(0);
    expect(names[0].body).toContain('display: flex !important');
  });

  it('puts no colour on .otp-btn, which is on two of the three buttons', () => {
    // .otp-btn is on both .verify-btn and .update-btn, so any colour on it
    // would fight both. It may carry geometry and nothing else.
    rulesFor('html.zigly-otp .otp-btn').forEach(r => {
      expect(r.body).not.toContain('background:');
      expect(r.body).not.toContain('color:');
    });
  });

  it('follows SimplyOTP’s verdict on a field instead of forming one', () => {
    // The red border is drawn from the error message the provider un-hides.
    // Nothing here validates an address or rewrites a message.
    expect(LOGIN_RESTYLE).toContain('function syncFieldErrors(');
    expect(LOGIN_RESTYLE).toContain("contains('hideBox')");
    expect(LOGIN_RESTYLE).not.toContain('Please enter a valid');
    expect(LOGIN_RESTYLE).not.toContain('@');
    const invalid = rulesFor('html.zigly-otp .login-inputBox.' + INVALID_CLASS);
    expect(invalid).not.toHaveLength(0);
    expect(invalid[0].body).toContain('border-color: #ED2427');
  });
});

describe('what the restyle must not touch', () => {
  it('writes no resend number of its own', () => {
    // resend_time is absent from this store's config, so the widget falls back
    // to its own default -- 5 seconds, not the 30 in the screenshot. A number
    // typed in here would disagree with the timer the customer is watching.
    expect(LOGIN_RESTYLE).not.toContain('Resend OTP in 30');
    expect(declarations()).not.toContain('30 second');
    // The countdown elements are styled and nothing more: their class names
    // appear in the sheet, and nowhere in the script that could write to them.
    [
      'resend-otp-message',
      'count-down-otp',
      'minute-box',
      'seconds-box',
    ].forEach(name => expect(scriptOnly()).not.toContain(name));
  });

  it('leaves the resend captcha alone', () => {
    // #hcaptcha-container-resend is the first child of .resend-otp, so a
    // ".resend-otp > *" rule would reach into the challenge the resend needs.
    // Against the declarations rather than the whole sheet: the comment above
    // that block names the captcha precisely so nobody reaches for a wildcard.
    expect(declarations()).not.toContain('hcaptcha');
    expect(declarations()).not.toContain('.resend-otp >');
    expect(scriptOnly()).not.toContain('hcaptcha');
  });

  it('never hides the consent notice', () => {
    // It carries the privacy-policy and terms links. Hiding it to match a
    // screenshot would remove the thing that makes the tap lawful.
    const consent = [
      'html.zigly-otp .sotp-consent-wrapper',
      'html.zigly-otp .consent-text',
      'html.zigly-otp .consent-links-wrapper',
      'html.zigly-otp .consent-link',
    ];
    rules(loginCss())
      .filter(r => /display:\s*none/.test(r.body))
      .forEach(r =>
        r.selectors.forEach(s => expect(consent).not.toContain(s)),
      );
  });

  it('drives nothing: no synthesised click, no provider api', () => {
    expect(LOGIN_RESTYLE).not.toContain('.click()');
    expect(LOGIN_RESTYLE).not.toContain('.submit()');
    expect(LOGIN_RESTYLE).not.toContain('lucentcommerce');
    expect(LOGIN_RESTYLE).not.toContain('fetch(');
  });

  it('uses no regular expression, per the project rule', () => {
    // A backslash inside a template literal is eaten before the page sees the
    // script, which has silently shipped a dead payload here before.
    expect(LOGIN_RESTYLE).not.toContain('replace(//');
    expect(LOGIN_RESTYLE).not.toContain('/s+/');
    expect(LOGIN_RESTYLE).not.toContain('[s]+');
    expect(LOGIN_RESTYLE).not.toContain('new RegExp');
    // No escape at all in the script half, so there is none to lose.
    expect(scriptOnly()).not.toContain('\\');
  });
});

describe('the marketing checkbox', () => {
  it('is one constant carrying the trade-off, hidden and still checked', () => {
    // Stated so it cannot be missed: SimplyOTP renders #marketing pre-checked,
    // so hiding the row opts the customer in with nothing on screen saying so.
    expect(MARKETING_CONSENT.hide).toBe(true);
    expect(MARKETING_CONSENT.uncheck).toBe(false);
  });

  it('writes no `checked` while uncheck is false', () => {
    // And flipping the flag is the only edit needed: the payload's write is
    // interpolated from it, so today there is no write in the payload at all.
    expect(MARKETING_CONSENT.uncheck).toBe(false);
    expect(LOGIN_RESTYLE).not.toContain('checked = false');
    expect(LOGIN_RESTYLE).toContain('function uncheckMarketing(');
  });

  it('hides the row by name, not by a wildcard', () => {
    // The point of the block is that it is findable by anyone auditing consent.
    const hide = rulesFor('html.zigly-otp .update-checkbox-wrapper');
    expect(hide).not.toHaveLength(0);
    expect(hide[0].body).toContain('display: none !important');
  });
});

describe('the Email field the app does not ask for', () => {
  it('is one constant, and the field is hidden rather than filled', () => {
    // The account is created against the phone number the OTP proved. What
    // this must never do is invent an address to put in a field it hid.
    expect(SIGNUP_EMAIL.hide).toBe(true);
    expect(scriptOnly()).not.toContain('.value =');
    expect(scriptOnly()).not.toContain('@');
  });

  it('hides the row, its label and its message with one class', () => {
    expect(LOGIN_RESTYLE).toContain('function hideSignupEmail(');
    expect(LOGIN_RESTYLE).toContain(
      "'.input-label.email, .error-email-message'",
    );
    const hide = rulesFor('html.zigly-otp .' + HIDDEN_FIELD_CLASS);
    expect(hide).not.toHaveLength(0);
    expect(hide[0].body).toContain('display: none !important');
  });

  it('is re-applied on every pass, because the step is rebuilt', () => {
    // The signup step arrives long after the poll gives up, and the widget
    // rebuilds it on its own validation. classList.add is the no-op on repeat.
    const sync = LOGIN_RESTYLE.slice(LOGIN_RESTYLE.indexOf('function sync()'));
    expect(sync.slice(0, 200)).toContain('hideSignupEmail();');
    expect(LOGIN_RESTYLE).toContain('classList.add(HIDDEN)');
  });

  it('can only reach the signup step, never the phone step', () => {
    // Step 1 is a phone number and nothing else on this store, and hiding its
    // one input would be a login screen with no way to log in. The hide is
    // scoped to .update-user-box and walks up from the input it found there.
    const fn = LOGIN_RESTYLE.slice(
      LOGIN_RESTYLE.indexOf('function hideSignupEmail('),
      LOGIN_RESTYLE.indexOf('/** Everything that has to be re-applied'),
    );
    expect(fn).toContain("document.querySelector('.update-user-box')");
    expect(fn).not.toContain('.login-box');
    // And it stops climbing before any wrapper that holds another field, so a
    // template that shares one cannot lose the phone with the email.
    expect(fn).toContain('!holdsOther(parent, input)');
  });

  it('keeps the label the flag would need on the way back', () => {
    // SIGNUP_EMAIL.hide is the only edit that brings the row back, so the
    // label it comes back with stays in the table.
    const email = LOGIN_LABELS.find(l => l.selector === '.input-label.email');
    expect(email).toBeDefined();
    expect((email as {text: string}).text).toBe('Email Id');
  });
});

describe('safe to run seven times', () => {
  it('guards the whole payload on one window flag', () => {
    // This screen injects on first load, on every load end, and the observer
    // re-runs the sweep on every widget re-render.
    expect(LOGIN_RESTYLE).toContain('if (window.__ziglyLogin)');
    expect(LOGIN_RESTYLE).toContain('window.__ziglyLogin = {run: run};');
  });

  it('attaches the observer and the input listener inside that guard', () => {
    // Outside it, seven injections would stack seven observers and seven
    // listeners, each doing the same sweep.
    const guard = LOGIN_RESTYLE.indexOf('if (window.__ziglyLogin)');
    const assign = LOGIN_RESTYLE.indexOf('window.__ziglyLogin = {run: run};');
    const observer = LOGIN_RESTYLE.indexOf('new MutationObserver(');
    const listener = LOGIN_RESTYLE.indexOf("addEventListener('input'");
    expect(guard).toBeGreaterThan(-1);
    expect(observer).toBeGreaterThan(guard);
    expect(observer).toBeLessThan(assign);
    expect(listener).toBeGreaterThan(guard);
    expect(listener).toBeLessThan(assign);
  });

  it('coalesces the observer, and watches childList only', () => {
    // One re-render is many mutation records, and watching attributes would let
    // the class writes below feed the observer that triggered them.
    expect(LOGIN_RESTYLE).toContain('{childList: true, subtree: true}');
    expect(LOGIN_RESTYLE).not.toContain('attributes: true');
    expect(LOGIN_RESTYLE).toContain('pending = true');
  });

  it('moves the DOM in exactly one guarded place', () => {
    // Lifting the host is the only structural change this payload makes, and
    // the guard is what makes the repeat passes free.
    expect(LOGIN_RESTYLE).toContain('if (host.parentNode !== document.body)');
    expect(LOGIN_RESTYLE.split('appendChild(host)')).toHaveLength(2);
    expect(LOGIN_RESTYLE).not.toContain('removeChild(host');
    expect(LOGIN_RESTYLE).not.toContain('innerHTML');
  });

  it('writes text only on a change, which is what stops the feedback loop', () => {
    expect(LOGIN_RESTYLE).toContain('if (node.textContent !== text)');
    expect(LOGIN_RESTYLE).toContain('if (next !== value)');
  });
});
