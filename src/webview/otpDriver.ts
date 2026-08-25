/**
 * Driving Zigly's own OTP widget from the native login screens.
 *
 * WHY THIS EXISTS, AND WHY IT IS A SEPARATE FILE FROM ./loginRestyle.ts.
 *
 * Login on zigly.com is SimplyOTP, whose live config carries
 * `recaptcha_enabled: true` and `fraud_detection: true`. A reCAPTCHA token only
 * exists inside a real page running their script, so the request that actually
 * sends an SMS cannot be made from native code -- that is the whole reason
 * ./loginRestyle.ts restyles the widget instead of replacing it, and it has not
 * changed.
 *
 * What changed is the presentation: ../components/LoginScreen and
 * ../components/OtpScreen are native, drawn over the widget's WebView. So the
 * widget is still the thing that sends and verifies -- with its captcha, its
 * fraud check and its session -- but the customer never sees it on those two
 * steps. This file is the bridge: it reads which step the widget is on, and it
 * operates the widget's own real controls when the native screen asks it to.
 *
 * It is a SEPARATE MODULE from ./loginRestyle.ts on purpose, and the separation
 * is enforced by a test. `__tests__/loginWidget.test.ts` asserts that the
 * restyle payload contains no `.click()`, no `.submit()` and no `fetch(`:
 * "drives nothing: no synthesised click, no provider api". That property is
 * worth keeping -- it is what makes the restyle safe to reason about as pure
 * presentation. Driving is this file's job, and this file's alone.
 *
 * WHAT IT NEVER DOES:
 *
 *   - It never calls SimplyOTP's API, and never touches
 *     auth.lucentcommerce.com. Every send, resend and verify is a press of the
 *     widget's own button, so the captcha and the fraud check run exactly as
 *     they do on the website.
 *   - It never decides whether a number or a code is valid. The widget's own
 *     error messages are read and passed up verbatim; nothing here writes one.
 *   - It never sends to a country the widget is not actually set to. If the
 *     country cannot be confirmed in the widget's own selector, the send is
 *     abandoned and reported -- an OTP charged to the wrong country is worse
 *     than a failure the customer can see.
 *
 * Style notes, both project rules:
 *   - No regular expressions, and no backslash anywhere. A backslash inside a
 *     template literal is eaten before the page sees the script, which has
 *     silently shipped a dead payload in this project before. indexOf, split
 *     and character loops only.
 *   - Idempotent. This payload is injected on first load and again on every
 *     load end, so every operation is a no-op on repeat.
 */

/** Which step the widget is showing. Mirrors ./loginRestyle.ts's own `step()`. */
export type LoginPhase =
  | 'unknown'
  | 'phone'
  | 'otp'
  /** The signup form -- a phone number new to the shop. Shown as the WebView. */
  | 'details'
  | 'success'
  /** The widget was not found at all; the site's own form is what shows. */
  | 'missing';

/** Read a phase off a bridge message. Anything unrecognised is 'unknown'. */
export const readPhase = (value: unknown): LoginPhase => {
  switch (value) {
    case 'phone':
    case 'otp':
    case 'details':
    case 'success':
    case 'missing':
      return value;
    default:
      return 'unknown';
  }
};

/**
 * How long a drive keeps looking for the control it needs.
 *
 * The widget rebuilds a step after its own validation and renders the country
 * list only once its cell is tapped, so a control can be a few frames away
 * rather than absent. Bounded, so a genuinely missing control reports instead
 * of retrying for ever.
 */
export const DRIVE_TRIES = 24;
export const DRIVE_POLL_MS = 125;

/**
 * The phone field, in preference order.
 *
 * `.olInput` is the widget's own class; the type and name attributes are the
 * fallbacks for a template that drops it. Scoped to the step by the caller, so
 * the signup step's own disabled phone field can never be written to.
 *
 * Single quotes inside the attribute selectors, which CSS allows either way, for
 * the reason ./loginRestyle.ts gives for the same choice: this string is
 * embedded in the payload with JSON.stringify, and a double quote would come out
 * of that as an escape. The project rule is that no backslash exists in an
 * injected script, so there is none to be eaten -- and a test asserts it.
 */
const PHONE_FIELDS =
  "input.olInput, input[type='tel'], input[name='phone']";

/**
 * The shared half of every payload below.
 *
 * Installed once under `window.__ziglyOtp` and re-used, so the repeat
 * injections this screen gets do not stack observers or timers.
 */
const DRIVER_CORE = `
  var ZO = window.__ziglyOtp;
  if (!ZO) {
    ZO = window.__ziglyOtp = {};

    ZO.post = function (payload) {
      try {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (e) {}
    };

    /** The visible element for a selector, or null when the step is hidden. */
    ZO.shown = function (selector) {
      return document.querySelector(selector + ':not(.hideBox)');
    };

    /** Which step the widget is on. Same order of tests as the restyle's. */
    ZO.phase = function () {
      if (ZO.shown('.success-login-container')) { return 'success'; }
      if (ZO.shown('.update-user-box')) { return 'details'; }
      if (ZO.shown('.verify-box')) { return 'otp'; }
      if (ZO.shown('.login-box')) { return 'phone'; }
      return 'unknown';
    };

    /** Report the step, but only when it has actually moved. */
    ZO.lastPhase = '';
    ZO.reportPhase = function () {
      var now = ZO.phase();
      if (now === 'unknown' || now === ZO.lastPhase) { return; }
      ZO.lastPhase = now;
      ZO.post({tag: 'otp-phase', phase: now});
    };

    /**
     * One event, dispatched as the page's own would be.
     *
     * The widget listens on its inputs, and a value assigned in script fires
     * nothing by itself -- so the events it is waiting for are dispatched
     * explicitly. Bubbling, because a delegated listener on a parent is as
     * likely as one on the field.
     */
    ZO.fire = function (el, type, key) {
      try {
        var ev;
        if (key && typeof KeyboardEvent === 'function') {
          ev = new KeyboardEvent(type, {bubbles: true, key: key});
        } else if (typeof Event === 'function') {
          ev = new Event(type, {bubbles: true});
        } else {
          ev = document.createEvent('Event');
          ev.initEvent(type, true, true);
        }
        el.dispatchEvent(ev);
      } catch (e) {}
    };

    /** Set a field the way a person would: focus, value, then the events. */
    ZO.write = function (el, value, key) {
      try { el.focus(); } catch (e) {}
      try { el.value = value; } catch (e) {}
      ZO.fire(el, 'input');
      ZO.fire(el, 'change');
      ZO.fire(el, 'keyup', key);
    };

    /** A node's text, with the whitespace normalised out of it. */
    ZO.text = function (node) {
      var raw = String((node && node.textContent) || '');
      raw = raw.split(String.fromCharCode(160)).join(' ');
      raw = raw.split(String.fromCharCode(10)).join(' ');
      raw = raw.split(String.fromCharCode(9)).join(' ');
      while (raw.indexOf('  ') !== -1) { raw = raw.split('  ').join(' '); }
      return raw.trim();
    };

    /** Digits only, in order. No pattern, per the note at the top of the file. */
    ZO.digits = function (value) {
      var out = '';
      var raw = String(value || '');
      for (var i = 0; i < raw.length; i++) {
        var code = raw.charCodeAt(i);
        if (code >= 48 && code <= 57) { out += raw.charAt(i); }
      }
      return out;
    };

    /** Say why a drive could not finish. The native screen shows this. */
    ZO.fail = function (step, why) {
      ZO.post({tag: 'otp-error', step: step, message: '', why: why});
    };

    /**
     * Run a step until it succeeds, then stop.
     *
     * The callback returns true when it is done, false to be tried again. Bounded
     * -- a control that never appears reports rather than polling for ever.
     */
    ZO.until = function (attempt, onGiveUp) {
      var tries = 0;
      function tick() {
        var done = false;
        try { done = attempt(); } catch (e) { done = false; }
        if (done) { return; }
        tries++;
        if (tries >= ${DRIVE_TRIES}) { onGiveUp(); return; }
        setTimeout(tick, ${DRIVE_POLL_MS});
      }
      tick();
    };

    /**
     * The widget's own verdict on a field, forwarded verbatim.
     *
     * Its error spans carry hideBox until it decides something is wrong, so a
     * span without that class is the provider speaking. Nothing here composes a
     * message: an app that invents "invalid number" over a provider that said
     * something more specific is an app hiding the real answer.
     */
    ZO.lastError = '';
    ZO.reportErrors = function () {
      var spans = document.querySelectorAll(
        '.error-message-phone, .error-email-message, .error-fname-message, ' +
        ".error-lname-message, .errormessage, [class*='error-message']"
      );
      var message = '';
      for (var i = 0; i < spans.length; i++) {
        if (spans[i].classList.contains('hideBox')) { continue; }
        var said = ZO.text(spans[i]);
        if (said) { message = said; break; }
      }
      if (message === ZO.lastError) { return; }
      ZO.lastError = message;
      if (!message) { return; }
      ZO.post({tag: 'otp-error', step: ZO.phase(), message: message, why: ''});
    };

    ZO.sweep = function () {
      ZO.reportPhase();
      ZO.reportErrors();
    };

    /*
     * Watching for the step to change.
     *
     * Attributes as well as childList, which is the difference between this
     * observer and the restyle's: the widget switches step by toggling its own
     * hideBox class, and that is an attribute change with no node added or
     * removed. The restyle watches childList only -- deliberately, because it
     * writes classes and would otherwise feed itself. This file writes no class
     * at all, so it can watch what it actually needs to.
     *
     * Coalesced, because one re-render is many records.
     */
    ZO.pending = false;
    ZO.start = function () {
      ZO.sweep();
      if (ZO.observer || !window.MutationObserver || !document.body) { return; }
      ZO.observer = new MutationObserver(function () {
        if (ZO.pending) { return; }
        ZO.pending = true;
        setTimeout(function () {
          ZO.pending = false;
          ZO.sweep();
        }, 100);
      });
      try {
        ZO.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      } catch (e) {}
    };
  }
`;

/**
 * Install the driver and start reporting.
 *
 * Injected alongside LOGIN_RESTYLE. Safe to run repeatedly: the core above is
 * built once and `start()` only attaches an observer it has not attached.
 */
export const OTP_DRIVER = `
(function () {
  ${DRIVER_CORE}
  ZO.start();
})();
true;
`;

/**
 * Send the OTP: set the country, set the number, press the widget's own button.
 *
 * The country is settled BEFORE the number is written and the button pressed,
 * and the send is abandoned if it cannot be confirmed -- see the note at the top
 * of this file. `dial` is checked against the widget's own `.dial-code`, which
 * is what the widget will actually use, rather than against anything this app
 * believes it selected.
 */
export const driveSendOtp = (dial: string, digits: string): string => `
(function () {
  ${DRIVER_CORE}

  var DIAL = ${JSON.stringify(dial)};
  var DIGITS = ${JSON.stringify(digits)};

  /** Whether the widget is already set to the country we want. */
  function onDial() {
    var cell = document.querySelector('.dial-code, .selected-country');
    if (!cell) { return false; }
    return ZO.digits(ZO.text(cell)) === ZO.digits(DIAL);
  }

  /**
   * The row for a dialling code in the widget's own open list.
   *
   * The innermost element whose text carries the code, so the click lands on
   * the row rather than on the list around it. Which tag the widget uses for a
   * row is its business, so this asks the DOM instead of assuming one.
   */
  function rowFor(list) {
    var all = list.querySelectorAll('*');
    var want = ZO.digits(DIAL);
    var best = null;
    for (var i = 0; i < all.length; i++) {
      // Exact, so '+1' cannot select '+1268'. A row's text is its country name
      // and its code, and the name carries no digits on this widget.
      if (ZO.digits(ZO.text(all[i])) !== want) { continue; }
      // The innermost match, so the click lands on the row and not on the list
      // wrapping it: if the one held so far contains this one, this is deeper.
      if (best === null || best.contains(all[i])) { best = all[i]; }
    }
    return best;
  }

  /** Write the number and press Send. The last thing this function does. */
  function send() {
    var box = ZO.shown('.login-box');
    if (!box) { return false; }
    var input = box.querySelector(${JSON.stringify(PHONE_FIELDS)});
    var button = box.querySelector('.send-btn');
    if (!input || !button) { return false; }
    ZO.write(input, DIGITS);
    button.click();
    return true;
  }

  /**
   * Open the widget's country list, choose ours, then send.
   *
   * Chained rather than run alongside each other: the confirmation has to start
   * after the row has been clicked, or the two loops would poll together and a
   * give-up from the first could report a failure while the second was still
   * going to succeed.
   */
  function pickCountry() {
    ZO.until(
      function () {
        var list = document.querySelector('.country-selector-list');
        if (!list) {
          var cell = document.querySelector('.country-selector-main');
          if (cell) { cell.click(); }
          return false;
        }
        var row = rowFor(list);
        if (!row) { return false; }
        row.click();
        // Confirmed against the widget's own dial cell, not against the click:
        // what matters is the country the widget will actually send to.
        ZO.until(
          function () { return onDial() && send(); },
          function () { ZO.fail('phone', 'country did not change'); }
        );
        return true;
      },
      function () { ZO.fail('phone', 'country not found in the list'); }
    );
  }

  ZO.start();
  if (onDial()) {
    ZO.until(send, function () { ZO.fail('phone', 'send button not found'); });
  } else {
    pickCountry();
  }
})();
true;
`;

/**
 * Enter the code and press the widget's own Submit.
 *
 * Every box is written and each gets its own events, because the widget tracks
 * the code per box: writing only the first would submit one digit. The button is
 * pressed after the last write, in the same pass, so nothing can submit early.
 */
export const driveSubmitOtp = (code: string): string => `
(function () {
  ${DRIVER_CORE}

  var CODE = ${JSON.stringify(code)};

  ZO.start();
  ZO.until(
    function () {
      var box = ZO.shown('.verify-box');
      if (!box) { return false; }
      var boxes = box.querySelectorAll('.otp-input-box');
      var button = box.querySelector('.verify-btn');
      if (boxes.length === 0 || !button) { return false; }
      for (var i = 0; i < boxes.length; i++) {
        var digit = i < CODE.length ? CODE.charAt(i) : '';
        ZO.write(boxes[i], digit, digit);
      }
      button.click();
      return true;
    },
    function () { ZO.fail('otp', 'otp boxes not found'); }
  );
})();
true;
`;

/**
 * Press Resend.
 *
 * The widget's own button, so its own countdown and its own captcha gate the
 * request -- this app does not decide whether a resend is allowed yet, it only
 * asks. If the button is not there the widget is still counting down, and that
 * is reported rather than worked around.
 */
export const driveResend = (): string => `
(function () {
  ${DRIVER_CORE}

  ZO.start();
  ZO.until(
    function () {
      var box = ZO.shown('.verify-box');
      if (!box) { return false; }
      var button = box.querySelector('.resend-btn');
      if (!button) { return false; }
      button.click();
      return true;
    },
    function () { ZO.fail('otp', 'resend not available yet'); }
  );
})();
true;
`;

/**
 * Go back to the phone step.
 *
 * The widget's own `.edit-phone` control, so its state moves back with the app's
 * -- the native screen has already returned to the phone step, and a widget left
 * on the OTP step would then send the next code against stale state.
 */
export const driveEditPhone = (): string => `
(function () {
  ${DRIVER_CORE}

  ZO.start();
  ZO.until(
    function () {
      var link = document.querySelector('.edit-phone');
      if (!link) { return false; }
      link.click();
      return true;
    },
    function () { ZO.fail('otp', 'edit phone not found'); }
  );
})();
true;
`;
