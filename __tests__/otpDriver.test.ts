/**
 * The OTP driver -- the half of the login screen that operates the widget.
 *
 * This is the counterpart to loginWidget.test.ts, and the two pin OPPOSITE
 * invariants on purpose. That file asserts the restyle "drives nothing: no
 * synthesised click, no provider api", which is what makes ../src/webview/
 * loginRestyle.ts safe to read as pure presentation. Driving belongs here, so
 * this file asserts that the driver really does click -- and then pins the
 * limits that keep the driving honest:
 *
 *   - it presses the widget's own buttons and never calls SimplyOTP's API, so
 *     the captcha and the fraud check still run;
 *   - it never sends to a country the widget is not actually set to;
 *   - it never writes an error message of its own.
 *
 * String assertions rather than a rendered widget, for the reason loginWidget's
 * header gives: SimplyOTP's runtime DOM does not exist off a device. What can be
 * checked here is what the payload targets, what it refuses to do, and that it
 * is safe to inject repeatedly.
 */
import {
  DRIVE_POLL_MS,
  DRIVE_TRIES,
  OTP_DRIVER,
  driveEditPhone,
  driveResend,
  driveSendOtp,
  driveSubmitOtp,
  readPhase,
} from '../src/webview/otpDriver';

/** Every payload this module can inject, named for the failure messages. */
const PAYLOADS: [string, string][] = [
  ['OTP_DRIVER', OTP_DRIVER],
  ['driveSendOtp', driveSendOtp('91', '9004976917', 'IN')],
  ['driveSubmitOtp', driveSubmitOtp('123456')],
  ['driveResend', driveResend()],
  ['driveEditPhone', driveEditPhone()],
];

describe('reading the widget’s step', () => {
  it('accepts the five real phases and nothing else', () => {
    expect(readPhase('phone')).toBe('phone');
    expect(readPhase('otp')).toBe('otp');
    expect(readPhase('details')).toBe('details');
    expect(readPhase('success')).toBe('success');
    expect(readPhase('missing')).toBe('missing');
  });

  it('reads anything unrecognised as unknown rather than guessing', () => {
    // A phase this app does not know must not become one it does: 'unknown'
    // keeps the native phone screen up, which is the recoverable answer.
    expect(readPhase('verify')).toBe('unknown');
    expect(readPhase('')).toBe('unknown');
    expect(readPhase(undefined)).toBe('unknown');
    expect(readPhase(null)).toBe('unknown');
    expect(readPhase(7)).toBe('unknown');
  });

  it('asks the same questions, in the same order, as the restyle does', () => {
    // Both files decide "which step is this" and they must not disagree --
    // success before details before otp before phone, because a widget mid
    // transition can have two steps in the DOM with only one of them shown.
    const order = ['.success-login-container', '.update-user-box', '.verify-box', '.login-box'];
    let at = -1;
    order.forEach(selector => {
      const found = OTP_DRIVER.indexOf(selector);
      expect(found).toBeGreaterThan(at);
      at = found;
    });
  });

  it('tests visibility with the widget’s own hidden class', () => {
    // SimplyOTP hides an inactive step with hideBox. Ignoring it would report
    // the last step built rather than the one on screen.
    expect(OTP_DRIVER).toContain("selector + ':not(.hideBox)'");
  });
});

describe('it drives -- which is the whole point of this file', () => {
  it('presses the widget’s own buttons', () => {
    // The opposite of loginRestyle's invariant, stated so the difference
    // between the two files cannot be mistaken for an oversight in one of them.
    expect(driveSendOtp('91', '9004976917', 'IN')).toContain('button.click()');
    expect(driveSubmitOtp('123456')).toContain('button.click()');
    expect(driveResend()).toContain('button.click()');
    expect(driveEditPhone()).toContain('link.click()');
  });

  it('names the real controls rather than rebuilding them', () => {
    expect(driveSendOtp('91', '1', 'IN')).toContain(".querySelector('.send-btn')");
    expect(driveSubmitOtp('1')).toContain(".querySelector('.verify-btn')");
    expect(driveSubmitOtp('1')).toContain(".querySelectorAll('.otp-input-box')");
    expect(driveResend()).toContain(".querySelector('.resend-btn')");
    expect(driveEditPhone()).toContain(".querySelector('.edit-phone')");
  });

  it('writes the number into the field the widget actually reads', () => {
    // The widget renders three '.user-name-input' boxes -- mobile, WhatsApp and
    // email -- and reads only '.input-box-content.active .user-name-input',
    // then sends getDialCode() + parseInt(thatValue). Writing into any other
    // one means it reads an empty box, parseInt('') is NaN, it sends '91NaN',
    // and its own validator calls a good number invalid.
    expect(driveSendOtp('91', '9004976917', 'IN')).toContain(
      '.input-box-content.active .user-name-input',
    );
  });

  it('tries the phone selectors in order rather than in document order', () => {
    // querySelector with a comma list returns the first match in the DOM, not
    // the first selector that matched -- which silently defeats a preference
    // list. This is the bug that made a valid Indian number fail, so the
    // ordering is asserted rather than assumed.
    expect(OTP_DRIVER).toContain('ZO.pick');
    expect(driveSendOtp('91', '1', 'IN')).toContain('ZO.pick(box,');
    const order = driveSendOtp('91', '1', 'IN');
    const active = order.indexOf('.input-box-content.active .user-name-input');
    const fallback = order.indexOf('input.olInput');
    expect(active).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(active);
  });

  it('dispatches the events a real edit would, not just a value', () => {
    // A value assigned in script fires nothing, so a widget listening on its
    // own input would never see the number.
    expect(OTP_DRIVER).toContain("ZO.fire(el, 'input')");
    expect(OTP_DRIVER).toContain("ZO.fire(el, 'change')");
    expect(OTP_DRIVER).toContain('bubbles: true');
  });

  it('fills every OTP box, not only the first', () => {
    // The widget tracks the code per box; writing one would submit one digit.
    const script = driveSubmitOtp('123456');
    expect(script).toContain('for (var i = 0; i < boxes.length; i++)');
    expect(script).toContain('ZO.write(boxes[i], digit, digit)');
    // And the press comes after the loop, so nothing can submit early.
    expect(script.indexOf('button.click()')).toBeGreaterThan(
      script.indexOf('ZO.write(boxes[i]'),
    );
  });
});

describe('what it must never do', () => {
  it('never calls the provider, and never posts a form itself', () => {
    // Every send is the widget's own button, so reCAPTCHA and the fraud check
    // run exactly as they do on the website. This is the reason the widget is
    // still here at all.
    PAYLOADS.forEach(([name, script]) => {
      expect(script).not.toContain('lucentcommerce');
      expect(script).not.toContain('fetch(');
      expect(script).not.toContain('XMLHttpRequest');
      expect(script).not.toContain('.submit()');
      expect(name).toBeTruthy();
    });
  });

  it('sends only once the widget’s own country matches', () => {
    const script = driveSendOtp('44', '7700900000', 'GB');
    // The confirmation is read off the widget, not inferred from the click:
    // an OTP charged to the wrong country is worse than a visible failure.
    expect(script).toContain('function onCountry()');
    expect(script).toContain('return onCountry() && send()');
    // And when it cannot be confirmed, it says so instead of sending anyway.
    expect(script).toContain("ZO.fail('phone', 'country did not change')");
  });

  it('confirms the country the way the widget itself resolves it', () => {
    // getDialCode reads data-selected-country off the widget root. It does NOT
    // read '.dial-code' text -- that class is on the ~240 <li> rows only, and
    // the closed cell shows a flag with no text at all. A document-wide query
    // for it therefore returns the FIRST row in the list, Afghanistan, so the
    // check could never pass and every send died as 'country did not change'.
    const script = driveSendOtp('91', '9004976917', 'IN');
    expect(script).toContain('data-selected-country');
    expect(script).not.toContain("'.dial-code, .selected-country'");
  });

  it('matches the row by ISO code, so +1 cannot select +1268', () => {
    // The row carries its own data-country-code, which is exact by
    // construction -- no digit parsing, and no way to confuse two +1 countries.
    const script = driveSendOtp('1', '2025550123', 'US');
    expect(script).toContain("rows[i].getAttribute('data-country-code')");
    expect(script).toContain('=== ISO');
  });

  it('writes no error message of its own', () => {
    // The customer reads SimplyOTP's words. The driver's own `why` is a fault
    // report for the log -- see the onMessage handler in ZiglyWebViewScreen.
    PAYLOADS.forEach(([, script]) => {
      expect(script).not.toContain('Please enter');
      expect(script).not.toContain('Invalid');
      expect(script).not.toContain('is not valid');
    });
    // The message that IS reported is read out of the page.
    expect(OTP_DRIVER).toContain('message: message');
    expect(OTP_DRIVER).toContain("contains('hideBox')");
  });

  it('touches nothing on the signup step', () => {
    // That step is the WebView's own screen: it draws the restyled form the
    // customer fills in, and its phone field is disabled on purpose because it
    // is the number the OTP just went to.
    //
    // `.update-user-box` does appear in every payload -- ZO.phase() has to test
    // for it to know which step is showing. What must not appear is any attempt
    // to WORK it: its own submit button is never named anywhere.
    PAYLOADS.forEach(([name, script]) => {
      expect(script).not.toContain('update-btn');
      expect(name).toBeTruthy();
    });
    // And every write is scoped to the step that owns the field, so the signup
    // step's disabled phone field is not reachable from here.
    expect(driveSendOtp('91', '1', 'IN')).toContain(".shown('.login-box')");
    expect(driveSubmitOtp('1')).toContain(".shown('.verify-box')");
  });

  it('leaves the resend captcha and countdown alone', () => {
    // #hcaptcha-container-resend lives inside .resend-otp, and the countdown is
    // the widget's own: a resend pressed early is its refusal to make, not ours.
    PAYLOADS.forEach(([, script]) => {
      expect(script).not.toContain('hcaptcha');
      expect(script).not.toContain('count-down-otp');
    });
  });

  it('uses no regular expression and no escape at all', () => {
    // The project rule: a backslash inside a template literal is eaten before
    // the page sees the script, which has shipped a dead payload here before.
    // The payloads carry no attribute selector needing a quote, so unlike the
    // restyle there is nothing legitimate to allow for -- the bar is zero.
    PAYLOADS.forEach(([name, script]) => {
      expect(script).not.toContain('\\');
      expect(script).not.toContain('new RegExp');
      expect(script).not.toContain('replace(//');
      expect(name).toBeTruthy();
    });
  });
});

describe('safe to inject repeatedly', () => {
  it('builds its core once, behind one window flag', () => {
    // This screen injects on first load and again on every load end, and each
    // drive carries the core too so it can arrive before either.
    PAYLOADS.forEach(([, script]) => {
      expect(script).toContain('var ZO = window.__ziglyOtp;');
      expect(script).toContain('if (!ZO) {');
      expect(script).toContain('ZO = window.__ziglyOtp = {};');
    });
  });

  it('attaches at most one observer, however often it runs', () => {
    // Seven injections stacking seven observers would mean seven sweeps per
    // widget re-render.
    expect(OTP_DRIVER).toContain('if (ZO.observer ||');
    expect(OTP_DRIVER).toContain('ZO.observer = new MutationObserver(');
  });

  it('coalesces the observer', () => {
    expect(OTP_DRIVER).toContain('if (ZO.pending) { return; }');
    expect(OTP_DRIVER).toContain('ZO.pending = true;');
  });

  it('watches the class attribute, which the restyle deliberately does not', () => {
    // The widget changes step by toggling hideBox -- an attribute change with no
    // node added or removed, so childList alone would miss it. This file writes
    // no class, so it cannot feed the observer that way.
    expect(OTP_DRIVER).toContain('attributes: true');
    expect(OTP_DRIVER).toContain("attributeFilter: ['class']");
    expect(OTP_DRIVER).not.toContain('classList.add');
  });

  it('reports a step only when it has actually moved', () => {
    // The observer fires on every re-render; posting each time would be a
    // message per mutation batch for a value that had not changed.
    expect(OTP_DRIVER).toContain('now === ZO.lastPhase');
    expect(OTP_DRIVER).toContain('message === ZO.lastError');
  });
});

describe('bounded, so a missing control reports rather than spins', () => {
  it('gives up after a stated number of tries', () => {
    expect(DRIVE_TRIES).toBeGreaterThan(0);
    expect(DRIVE_POLL_MS).toBeGreaterThan(0);
    // Long enough for a step the widget rebuilds after its own validation,
    // short enough that a real failure is reported while the customer is still
    // looking at the screen.
    expect(DRIVE_TRIES * DRIVE_POLL_MS).toBeGreaterThanOrEqual(2000);
    expect(DRIVE_TRIES * DRIVE_POLL_MS).toBeLessThanOrEqual(8000);
    expect(OTP_DRIVER).toContain(`tries >= ${DRIVE_TRIES}`);
    expect(OTP_DRIVER).toContain(`setTimeout(tick, ${DRIVE_POLL_MS});`);
  });

  it('every drive has somewhere to report failure to', () => {
    // A drive that quietly finds nothing is a button that does nothing.
    expect(driveSendOtp('91', '1', 'IN')).toContain("ZO.fail('phone'");
    expect(driveSubmitOtp('1')).toContain("ZO.fail('otp'");
    expect(driveResend()).toContain("ZO.fail('otp'");
    expect(driveEditPhone()).toContain("ZO.fail('otp'");
  });

  it('quotes what the customer typed rather than splicing it in', () => {
    // The number and the code reach the page as JSON literals, so a stray
    // quote is a string and never syntax.
    expect(driveSendOtp('91', '900" + x + "', 'IN')).toContain(
      JSON.stringify('900" + x + "'),
    );
    expect(driveSubmitOtp("1'2")).toContain(JSON.stringify("1'2"));
  });
});
