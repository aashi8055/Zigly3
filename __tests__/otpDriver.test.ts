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
  otpErrorText,
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
    const order = driveSendOtp('91', '1', 'IN');
    expect(order).toContain('ZO.pick(box,');
    // The order that matters is the one inside the selector list handed to
    // ZO.pick, not the first mention of either string anywhere in the payload
    // -- ZO.wakeCaptcha names 'input.olInput.user-name-input' earlier, for an
    // unrelated reason. So the list itself is what gets measured.
    const list = order.slice(order.indexOf('ZO.pick(box,'));
    const active = list.indexOf('.input-box-content.active .user-name-input');
    const fallback = list.indexOf('input.olInput,');
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

  it('fills the hidden field the widget actually submits', () => {
    // The six visible boxes are presentation only on the new popup design: the
    // code is posted from '.otp-input-main', and the widget's own SMS autofill
    // writes both. Filling only the boxes posts an empty otp, the server
    // refuses it, and the widget then walks itself back to its phone step via
    // manageOTPBox -> goBack -- which is why Submit bounced to the login
    // screen. The write comes before the press, like every other field here.
    const script = driveSubmitOtp('123456');
    expect(script).toContain(".querySelector('.otp-input-main')");
    expect(script).toContain('ZO.write(main, CODE)');
    expect(script.indexOf('ZO.write(main, CODE)')).toBeGreaterThan(
      script.indexOf('ZO.write(boxes[i]'),
    );
    expect(script.indexOf('button.click()')).toBeGreaterThan(
      script.indexOf('ZO.write(main, CODE)'),
    );
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
    // A country that is not in the widget's list at all is still refused -- the
    // send is never made against a country this driver could not find.
    expect(script).toContain("ZO.fail('phone', 'country not found in the list')");
  });

  it('treats an unmarked default as the country it is showing', () => {
    // The reported bug. The widget writes 'data-selected-country' from its own
    // selectCountry, which does not run until a row is CLICKED -- so before any
    // interaction the attribute is absent while the cell already displays the
    // shop's default. Reading that as "wrong country" sent the driver off to
    // re-pick India when India was already selected, and the send made without
    // that click came back as an invalid request.
    //
    // So the widget's own list is consulted: the row it marks selected, or the
    // only row there is on a single-country shop (this one -- the live config
    // carries enable_countries "IN"). Read, never clicked.
    const script = driveSendOtp('91', '9004976917', 'IN');
    expect(script).toContain("li.selected[data-country-code]");
    expect(script).toContain('rows.length === 1');
    // Still a read: nothing in that fallback presses anything.
    const start = script.indexOf('var list = document.querySelector');
    const end = script.indexOf('function rowFor');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(script.slice(start, end)).not.toContain('.click()');
  });

  it('sends after clicking the right row even if no marker follows', () => {
    // A template whose selectCountry stamps none of the attributes onCountry
    // can read is not a wrong country: the row was matched on the widget's own
    // data-country-code, so its internal selectedCountry is ours whether or not
    // it advertised the fact. Failing here abandoned a send that would have
    // worked, which is the other half of the reported bug.
    const script = driveSendOtp('91', '9004976917', 'IN');
    expect(script).toContain('function () { send(); }');
    // The old give-up is gone; nothing reports the country as unchanged after a
    // click that landed on the correct row.
    expect(script).not.toContain("'country did not change'");
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

  it('never gates the send on a captcha it cannot actually observe', () => {
    // A revision of this file held the press until `captchaReady()` said yes,
    // and that function's last resort read
    // `window.simplyOtp.otp_widgets.recaptcha_enabled` -- a global this shop
    // does not publish and that nothing in this repo has ever observed. Whether
    // the widget attaches a token is decided inside its own closure and is not
    // visible from here, so a gate built on it can only ever guess. It guessed
    // wrong and no OTP was sent at all.
    //
    // The rule that replaces it: the send path may OBSERVE a captcha, never
    // wait on one. The widget decides; this file presses the button.
    const script = driveSendOtp('91', '9004976917', 'IN');
    expect(script).not.toContain('captchaReady');
    expect(script).not.toContain('simplyOtp');
    expect(OTP_DRIVER).not.toContain('simplyOtp');
    // Once the number is written, nothing may bail out before the press: the
    // guard above it is the honest one (no field, no button -- retry), and a
    // second `return false` after it is how the captcha gate stopped the send.
    const written = script.indexOf('ZO.write(input, DIGITS)');
    const pressed = script.indexOf('button.click()');
    expect(written).toBeGreaterThan(-1);
    expect(pressed).toBeGreaterThan(written);
    expect(script.slice(written, pressed)).not.toContain('return false');
  });

  it('wakes the lazy captcha on the ONE field it also writes to', () => {
    // Some builds attach the captcha script on first focus/click of a phone
    // input, which a driver that only assigns .value never fires. So the events
    // are dispatched -- but on the single field chosen by ZO.pick, never in a
    // loop over every '.user-name-input'.
    //
    // That is the whole distinction. The widget renders three of these and
    // reads only the one inside '.input-box-content.active'; waking them in a
    // loop leaves the LAST one focused rather than the one the number goes
    // into, so the widget reads an empty box and sends '91NaN'. Waking exactly
    // the element we then write to cannot desync the two.
    const script = driveSendOtp('91', '9004976917', 'IN');
    expect(script).toContain("ZO.fire(input, 'focus')");
    expect(script).toContain("ZO.fire(input, 'click')");
    // No loop over the sibling fields, which is the bug being locked out.
    expect(script).not.toContain('fields[i]');
    expect(script).not.toContain('wakeCaptcha');
    // Woken before the value is written, so the script has the head start.
    expect(script.indexOf("ZO.fire(input, 'focus')")).toBeLessThan(
      script.indexOf('ZO.write(input, DIGITS)'),
    );
  });

  it('reports the captcha state at the press, and only there', () => {
    // A diagnostic, not a decision: it tells a send that went out untokened
    // apart from one that was never pressed. Kept out of ZO.sweep on purpose --
    // the useful question is what was available when the button was pressed,
    // not what flickers past as scripts load.
    const script = driveSendOtp('91', '1', 'IN');
    expect(OTP_DRIVER).toContain('ZO.reportCaptcha');
    expect(OTP_DRIVER).toContain("tag: 'otp-captcha'");
    expect(OTP_DRIVER).not.toContain('ZO.reportCaptcha();\n    };');
    // Observed just before the press it describes.
    expect(script.indexOf('ZO.reportCaptcha()')).toBeLessThan(
      script.indexOf('button.click()'),
    );
  });

  it('observes exactly what the widget itself would use', () => {
    // Same names, same order: grecaptcha.enterprise, else hcaptcha. Reporting
    // on something the widget would not have used would describe a send that
    // never happened.
    expect(OTP_DRIVER).toContain('window.grecaptcha.enterprise');
    expect(OTP_DRIVER).toContain('window.hcaptcha');
  });

  it('still names the control when a send genuinely cannot be made', () => {
    // The honest failure that remains: the button was not in the page at all.
    // No captcha wording, because the driver no longer claims to know that.
    const script = driveSendOtp('91', '1', 'IN');
    expect(script).toContain("ZO.fail('phone', 'send button not found')");
    expect(script).not.toContain('captcha not ready');
    expect(otpErrorText('phone', '', 'send button not found')).toBe(
      'Could not send the code. Please try again.',
    );
  });

  it('reads the toast the widget complains through', () => {
    // sendOtpHandler shows the OTP screen unconditionally -- otpAction() then
    // showOtpBox(), with no wait for the answer -- so a refused send does not
    // leave the customer on the phone step to read an inline span. The reason
    // arrives as a toast instead, and reading only the spans is what made a
    // failed send look like silence.
    expect(OTP_DRIVER).toContain('.toast-card.error');
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
    //
    // What is forbidden is TOUCHING those elements -- the container and the
    // countdown. Reading `window.hcaptcha` is the opposite: it is how the
    // driver knows to WAIT for the captcha rather than press Send without one
    // (see the captchaReady tests above), so the bare word is not the test.
    PAYLOADS.forEach(([, script]) => {
      expect(script).not.toContain('hcaptcha-container');
      expect(script).not.toContain('#hcaptcha');
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
    // Long enough for the slowest thing actually waited on -- Google's
    // reCAPTCHA script, fetched from the network the first time the phone field
    // is touched, which is seconds on mobile data rather than frames. Still
    // comfortably inside the native watchdog (OTP_SEND_TIMEOUT_MS, 25s), so a
    // send that never lands is still reported while the customer is looking.
    expect(DRIVE_TRIES * DRIVE_POLL_MS).toBeGreaterThanOrEqual(2000);
    expect(DRIVE_TRIES * DRIVE_POLL_MS).toBeLessThanOrEqual(20000);
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
