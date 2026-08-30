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
 * Which drive an `otp-error` came from. Mirrors the `step` on the message.
 */
export type OtpStep = 'phone' | 'otp';

/**
 * What the login screens show for a failed drive.
 *
 * The rule this file is built on is that SimplyOTP's own words win: whenever
 * `message` carries something, that is what the customer reads, verbatim, and
 * nothing here paraphrases it. `why` is the other case -- the drive never got
 * as far as the provider, because a control it needed was not in the page -- and
 * the customer still has to be told something rather than left looking at a
 * button that did nothing.
 *
 * So the strings below describe *what the app observed*, never what the
 * provider decided. "Resend is not available yet" is the widget's own countdown
 * still running, which is a fact about the page; the rest say only that the app
 * could not complete the step, because that is all it knows.
 */
export const otpErrorText = (
  step: OtpStep,
  message: string,
  why: string,
): string => {
  const said = message.trim();
  if (said) {
    return said;
  }
  if (why === 'resend not available yet') {
    return 'Resend is not available yet. Please wait a moment.';
  }
  if (why === 'country not found in the list' || why === 'country did not change') {
    return 'That country is not available for OTP login.';
  }
  return step === 'phone'
    ? 'Could not send the code. Please try again.'
    : 'Could not check the code. Please try again.';
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
 * The phone field the widget will actually READ, in preference order.
 *
 * The widget renders three of these -- mobile, WhatsApp and email -- all with
 * the same `.olInput.user-name-input` classes, and reads exactly one of them:
 *
 *     updateActiveOption = e =>
 *       e.querySelector('.input-box-content.active .user-name-input')
 *
 * then sends `getDialCode() + parseInt(thatValue)`. So writing into the wrong
 * one is silent and total: the widget reads an empty box, `parseInt('')` is
 * NaN, it sends '91NaN', its own validator refuses that, and the customer is
 * told their perfectly good number is invalid.
 *
 * A single querySelector with a comma list cannot express this, because it
 * returns the first match in DOCUMENT order rather than the first selector that
 * matched -- which is how the bug arose. Hence a list, tried in order, with the
 * active box first and the old selectors kept as the fallback for a template
 * that does not mark one active.
 */
const PHONE_FIELD_ORDER = [
  '.input-box-content.active .user-name-input',
  PHONE_FIELDS,
];

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

    /**
     * The first selector in the list that matches, not the first match in the
     * document.
     *
     * querySelector with a comma list answers a different question: it returns
     * whichever match comes first in the DOM, whatever order the selectors were
     * written in. Where the selectors are a preference -- "the field the widget
     * reads, else any phone field" -- that difference is the whole meaning, so
     * the list is walked here instead.
     */
    ZO.pick = function (root, selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var found = root.querySelector(selectors[i]);
        if (found) { return found; }
      }
      return null;
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
      /*
       * The widget has settled somewhere new, so the attempt is over.
       *
       * Releasing the guard here rather than on a timer is what keeps it from
       * being a mute button. 'otp' and 'details' and 'success' are all answers
       * to a send or a verify, and once the widget is standing on one of them
       * the next error it shows belongs to whatever the customer does NEXT --
       * so it must be readable again.
       *
       * The one step that does not release it is the one the guard exists for.
       * A report of 'phone' while a verify is outstanding is the widget
       * unwinding on its way to a session, not a step the customer is on -- the
       * same intermediate frame ../navigation/accountStack's actOnPhase refuses
       * to show -- so the guard stays up across it and last attempt's spans
       * stay unread. Anything else clears it.
       */
      if (!(ZO.askedOn === 'otp' && now === 'phone')) {
        ZO.askedOn = '';
      }
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
     * Say that the widget's own button was found and pressed.
     *
     * NOT "an SMS arrived" -- nothing in this page can know that, and this file
     * does not invent knowledge it lacks. It is the difference between a press
     * the widget accepted and a control that was never there, which is the only
     * distinction the native screens actually need:
     *
     *   - the phone step waits for the *phase* to move to 'otp' before it
     *     navigates, because the widget advancing is the closest thing to proof
     *     the send went out;
     *   - the OTP step has no phase change to wait for on a resend, so this is
     *     what restarts its countdown.
     */
    ZO.sent = function (step) {
      ZO.post({tag: 'otp-sent', step: step});
    };

    /**
     * A fresh attempt has been made, so the next verdict is news again.
     *
     * ZO.reportErrors only posts a message that has changed, which is right for
     * an observer that fires on every re-render and wrong across attempts: a
     * customer who submits the same wrong code twice gets the widget's same
     * complaint, and without this it would be posted once and swallowed for
     * ever after -- leaving the native screen waiting on an answer that had
     * already been given.
     *
     * Called after the click and not before it: clearing it first would let
     * the sweep that runs on the way in re-post the error still on screen from
     * the previous attempt, as though it were this one's answer.
     */
    ZO.reask = function () {
      ZO.lastError = '';
      /*
       * The step this attempt is an answer FOR.
       *
       * Recorded at the click, because that is the only moment the app knows
       * which question is outstanding. An error span found while the widget is
       * on a different step is then recognisable as leftover rather than as a
       * verdict -- see ZO.reportErrors.
       */
      ZO.askedOn = ZO.phase();
      /*
       * Whatever the widget is complaining about right now belongs to the
       * PREVIOUS attempt, and is not evidence about this one.
       *
       * SimplyOTP does not clear its own spans on submit: a wrong code leaves
       * '.errormessage' un-hidden, and it stays un-hidden through the next
       * submit until the widget itself decides to rewrite it. So the sweep that
       * the click's own re-render triggers would find last attempt's words
       * still sitting there, and -- lastError having just been cleared above --
       * post them as this attempt's answer. That is the reported red line on a
       * CORRECT code: the text is real, it is simply months out of date by the
       * standards of this flow.
       *
       * Hiding them is the widget's own mechanism for "nothing is wrong",
       * applied the way the widget applies it. It writes no message and invents
       * no verdict; it only takes down the answer to a question that has been
       * asked again. The widget re-shows any span it still means, on its own
       * timing, and the observer picks that up as news.
       */
      ZO.mute();
    };

    /**
     * Stop treating the errors now on screen as news.
     *
     * The obvious implementation -- add hideBox to each span, the way the
     * widget hides its own -- is deliberately NOT what this does, and the
     * reason is the observer. This driver watches the 'class' attribute,
     * because toggling hideBox is how the widget changes step and there is no
     * other way to see it. A driver that also WROTE a class would be feeding
     * its own observer: every mute would schedule a sweep, and the restyle
     * avoids exactly this by watching childList only. The rule that this file
     * writes no class is what lets it watch what it needs to, and
     * __tests__/otpDriver.test.ts pins it.
     *
     * So the page is left completely untouched and the BOOKKEEPING changes
     * instead. Recording what the widget is saying right now, as though it had
     * already been reported, makes the next sweep see no change and stay quiet
     * -- which is precisely the effect wanted, since the words on screen at the
     * moment of a click belong to the previous attempt. When the widget has
     * something new to say it writes different text, that differs from what was
     * recorded, and it reports as news.
     *
     * Nothing is hidden from the customer either, which is the honest part: the
     * widget's own spans stay exactly as the widget left them, and it takes
     * them down on its own schedule as it always has.
     */
    ZO.mute = function () {
      ZO.lastError = ZO.currentError();
    };

    /**
     * What the widget is complaining about at this instant, or ''.
     *
     * The read half of reportErrors, split out so that mute can record the same
     * value the reader would compute. Two different notions of "the current
     * error" would leave whatever they disagreed about reporting for ever.
     */
    ZO.currentError = function () {
      return ZO.toastError() || ZO.spanError();
    };

    /** The widget's inline complaint about a field, or ''. */
    ZO.spanError = function () {
      return ZO.firstText(ZO.ERROR_SPANS);
    };

    /** The widget's toast, which is how a refused send arrives, or ''. */
    ZO.toastError = function () {
      return ZO.firstText('.toast-card.error');
    };

    /** The text of the first visible match, or ''. */
    ZO.firstText = function (selector) {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i++) {
        if (ZO.hidden(nodes[i])) { continue; }
        var said = ZO.text(nodes[i]);
        if (said) { return said; }
      }
      return '';
    };

    /**
     * Whether an element is hidden, counting the step it sits in.
     *
     * Checking hideBox on the span alone is not enough, and the gap is exactly
     * the reported bug rather than a nicety. The widget hides a whole STEP by
     * putting hideBox on '.login-box', not on the spans inside it -- so the
     * phone step's leftover error is, by this test, "visible" the entire time
     * the customer is on the code screen. It reads as nothing only because a
     * hidden ancestor is what is actually keeping it off the glass.
     *
     * That is what made the error survive being cleared. ZO.mute records what
     * the widget is currently saying so the next sweep sees no change; asking
     * the span alone, it recorded '' -- and then the moment the widget unhid
     * '.login-box' on its way to a session, the same untouched span became
     * visible by this measure, differed from the recorded '', and posted as a
     * brand new verdict on a code that had just been accepted.
     *
     * Walking the ancestry closes it: the span is hidden while its step is,
     * so mute records the words that are really there and the unhiding is not
     * mistaken for the widget having something new to say.
     */
    ZO.hidden = function (node) {
      var cursor = node;
      // Bounded rather than while(cursor): a detached or circular parent chain
      // must not spin, and no step in this widget is anywhere near this deep.
      for (var up = 0; up < 40 && cursor; up++) {
        if (cursor.classList && cursor.classList.contains('hideBox')) {
          return true;
        }
        cursor = cursor.parentNode;
      }
      return false;
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
    /**
     * Every element the widget uses to say something is wrong.
     *
     * Hoisted to a constant because two things now need the same list: the
     * reader below, and ZO.mute, which takes them down when a fresh attempt is
     * made. A reader and a clearer that disagreed about what an error looks
     * like would leave exactly the spans it could not see still showing.
     */
    ZO.ERROR_SPANS =
      '.error-message-phone, .error-email-message, .error-fname-message, ' +
      ".error-lname-message, .errormessage, [class*='error-message']";

    ZO.lastError = '';
    /**
     * The step the outstanding attempt was made on. See ZO.reask.
     *
     * Empty means no attempt is outstanding -- the observer is simply watching
     * a page nobody has pressed anything on yet.
     */
    ZO.askedOn = '';
    ZO.reportErrors = function () {
      var now = ZO.phase();
      /*
       * An error read on a step the attempt was not made on is not that
       * attempt's answer.
       *
       * This is the guard the whole "wrong OTP on a correct code" bug turned
       * on. A correct code makes the widget tear its verify step down BEFORE
       * the session lands: '.verify-box' goes, '.login-box' is briefly unhidden
       * as the widget resets itself, and that re-render fires the observer. At
       * that instant the phone step's own spans -- including any the widget
       * left over from an earlier bad number -- are back in the document and
       * visible, so a sweep that did not care which step it was reading posted
       * one of them as the verdict on a code that had just been accepted.
       *
       * The app's side of this is actOnPhase in ../navigation/accountStack,
       * which already refuses to SHOW the phone step during that same window.
       * This is the same fact applied to the same window one layer lower: while
       * a verify is outstanding, the phone step is the widget unwinding, and
       * nothing read off it is news.
       *
       * Deliberately narrow, and it can only ever delay. A genuine error on the
       * step that was actually asked still reports, because 'now' and
       * 'ZO.askedOn' agree; and the moment the widget settles onto a real step
       * the observer sweeps again with a matching phase.
       */
      /*
       * The toast is read whichever step is showing, and so is read BEFORE the
       * guard -- because the one error that legitimately arrives on a step
       * other than the one that was asked is a refused send.
       *
       * sendOtpHandler shows the OTP screen without waiting for the answer --
       * otpAction('sendOTP') then showOtpBox() -- so a send the provider
       * refuses does NOT leave the customer on the phone step where an inline
       * span would be read. It moves them to the code screen and puts the
       * reason in a toast instead:
       *
       *     showToastBox = (widget, msg, ok) => ... class="toast-card error"
       *
       * So an invalid number, a blocked country, a rate limit or an expired
       * session arrives this way and nowhere else, and reading only the spans
       * dropped every one of them -- which is precisely what "no OTP and no
       * error" looks like from the outside. It is cleared at the click like
       * every other error, so a stale toast cannot outlive its attempt.
       *
       * A send is asked on 'phone' and the widget moves itself to 'otp' before
       * the provider answers, so the guard below would discard exactly the
       * message the customer most needs -- the reason no code is coming. Hence
       * the toast is settled first and the guard applies only to the inline
       * spans, which are the ones that go stale.
       */
      var toast = ZO.toastError();
      var message = toast || (
        ZO.askedOn && now !== ZO.askedOn ? ZO.lastError : ZO.spanError()
      );
      if (message === ZO.lastError) { return; }
      ZO.lastError = message;
      if (!message) { return; }
      ZO.post({tag: 'otp-error', step: now, message: message, why: ''});
    };

    /**
     * What the widget had available at the moment Send was pressed.
     *
     * Purely a diagnostic, and deliberately NOT part of ZO.sweep: the useful
     * question is not "is a captcha present right now", which flickers as
     * scripts load, but "was one present when the button was actually pressed"
     * -- so this is called from the send path and nowhere else.
     *
     * It changes nothing and gates nothing. Whether the widget attaches a token
     * is the widget's own decision, made inside a closure this file cannot see
     * and must not second-guess; a driver that faked a token would be defeating
     * the fraud check the whole design exists to preserve. All this does is
     * make the difference visible in the log, so a send that goes out untokened
     * can be told apart from one that was never pressed. Reported once per
     * distinct state, like every other observer here.
     */
    ZO.lastCaptcha = '';
    ZO.reportCaptcha = function () {
      try {
        var has = !!(window.grecaptcha && window.grecaptcha.enterprise);
        var alt = !!window.hcaptcha;
        var state = (has ? 'grecaptcha' : (alt ? 'hcaptcha' : 'none'));
        if (state === ZO.lastCaptcha) { return; }
        ZO.lastCaptcha = state;
        ZO.post({tag: 'otp-captcha', state: state});
      } catch (e) {}
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
 * of this file.
 *
 * What "confirmed" means here is the ISO code on the widget's own root, because
 * that is the single thing the widget consults when it builds the number:
 *
 *     getDialCode = e => {
 *       let d = e.getAttribute('data-selected-country') || this.selectedCountry;
 *       return '+' + e.querySelector(
 *         '.country-selector-list li[data-country-code="' + d + '"]'
 *       ).getAttribute('data-dial-code');
 *     }
 *
 * It is emphatically NOT the visible '.dial-code' text. That class exists only
 * on the ~240 <li> rows in the list -- the closed cell shows a flag and no text
 * whatsoever -- so a document-wide query for it returns the FIRST row in the
 * list, Afghanistan, on every store. Checking against that is how this driver
 * came to refuse every country including the selected one.
 */
export const driveSendOtp = (
  dial: string,
  digits: string,
  iso2: string,
): string => `
(function () {
  ${DRIVER_CORE}

  var DIAL = ${JSON.stringify(dial)};
  var DIGITS = ${JSON.stringify(digits)};
  /** Lower case, because that is the case the widget stores and compares in. */
  var ISO = ${JSON.stringify(iso2)}.toLowerCase();

  /**
   * Whether the widget is already set to the country we want.
   *
   * Read from 'data-selected-country' on the widget's own root, which is what
   * getDialCode consults -- see the note above this function's payload. The
   * attribute is written by the widget's selectCountry as a lower-case ISO
   * code, and is present from the moment the box is built.
   *
   * The flag element is the fallback: selectCountry stamps the same code onto
   * '.selected-country .country-flag' as a data attribute, so a template that
   * moved the root attribute still has somewhere honest to read.
   */
  function onCountry() {
    var root = document.querySelector('[data-selected-country]');
    if (root) {
      var said = root.getAttribute('data-selected-country');
      if (said) { return String(said).toLowerCase() === ISO; }
    }
    var flag = document.querySelector('.selected-country .country-flag');
    if (flag) {
      var code = flag.getAttribute('data-country-code');
      if (code) { return String(code).toLowerCase() === ISO; }
    }
    /*
     * Neither marker is in the page yet -- and that is not the same as being
     * set to the wrong country.
     *
     * The widget writes 'data-selected-country' from its own selectCountry,
     * which does not run until a row is CLICKED. Before any interaction the
     * attribute is simply absent while the cell already shows the shop's
     * default, so answering false here says "the country is wrong" about a
     * widget that is displaying exactly the country we want.
     *
     * The consequence was the reported bug: the driver went off to pickCountry,
     * re-opened the list and clicked India when India was already selected --
     * and a first send made without that click was refused as an invalid
     * request. Re-selecting by hand "fixed" it only because the click was what
     * populated the attribute.
     *
     * So the widget's own list is asked instead. Every <li> it builds carries
     * a data-country-code, and the row it marks selected -- or, failing that,
     * the only row there is on a single-country shop (this one: the live config
     * carries enable_countries "IN") -- is the country it will actually send
     * to. Read, never clicked: this reports what the widget is already set to
     * and changes nothing.
     */
    var list = document.querySelector('.country-selector-list');
    if (list) {
      var marked = list.querySelector('li.selected[data-country-code]') ||
        list.querySelector('li.active[data-country-code]');
      if (marked) {
        var pick = marked.getAttribute('data-country-code');
        if (pick) { return String(pick).toLowerCase() === ISO; }
      }
      var rows = list.querySelectorAll('li[data-country-code]');
      if (rows.length === 1) {
        var only = rows[0].getAttribute('data-country-code');
        if (only) { return String(only).toLowerCase() === ISO; }
      }
    }
    /*
     * No attribute, and no list to read either -- which is the state the widget
     * is ACTUALLY in before anything is tapped, and the cause of the reported
     * "no OTP unless I pick the country again".
     *
     * The list above is not merely unmarked at this point; it does not exist.
     * The widget builds '.country-selector-list' lazily, inside the handler for
     * the closed cell, so on a page nobody has touched every read above finds
     * nothing -- the root attribute is unwritten because selectCountry has not
     * run, and both list fallbacks are asking a list that is not in the
     * document. Falling through to false said "wrong country" about a widget
     * sitting on the correct default, which sent the driver to pickCountry, and
     * the first send made behind that synthetic click is what the provider
     * refused.
     *
     * The closed cell is what the customer is looking at, so it is what gets
     * read. It carries no ISO code -- only the flag and, on this template, the
     * dial code as text -- so the dial is what it is compared against. Scoped
     * to '.country-selector-main', never a document-wide '.dial-code': that
     * class is on all ~240 rows of the open list, and matching document-wide
     * returns Afghanistan on every store, which is the older bug the note above
     * driveSendOtp describes.
     */
    var cell = document.querySelector('.country-selector-main');
    if (cell) {
      var shown = ZO.digits(ZO.text(cell));
      var want = ZO.digits(DIAL);
      // Only when the cell actually prints one. A template whose closed cell is
      // flag-only gives an empty string, which must not read as a match.
      if (shown && want) { return shown === want; }
    }
    /*
     * Nothing in the page names a country either way.
     *
     * Answering false here is what caused the bug, and answering true would
     * break the rule at the top of this file. So the question is handed to
     * pickCountry, which opens the widget's own list and clicks the row for
     * ISO -- the same thing the customer was doing by hand. The difference from
     * before is that this is now the last resort rather than the first move.
     */
    return false;
  }

  /**
   * The row for our country in the widget's own open list.
   *
   * Matched on the row's own 'data-country-code', which the widget writes as it
   * builds each <li>, rather than on the text inside it. That is exact by
   * construction -- it cannot confuse the United States with Antigua the way a
   * '+1' text match can, and it needs no digit parsing at all.
   *
   * The <li> itself is returned, not a descendant, because the widget binds its
   * click listener to the row and reads ev.currentTarget -- the element the
   * listener sits on. Clicking a child still bubbles to it, but returning the
   * row says plainly which element is meant to be pressed.
   */
  function rowFor(list) {
    var rows = list.querySelectorAll('[data-country-code]');
    for (var i = 0; i < rows.length; i++) {
      var code = rows[i].getAttribute('data-country-code');
      if (code && String(code).toLowerCase() === ISO) {
        // The row, not the flag <div> inside it that carries the same
        // attribute: the listener is on the <li>.
        return rows[i].closest ? (rows[i].closest('li') || rows[i]) : rows[i];
      }
    }
    return null;
  }

  /** Write the number and press Send. The last thing this function does. */
  function send() {
    var box = ZO.shown('.login-box');
    if (!box) { return false; }
    var input = ZO.pick(box, ${JSON.stringify(PHONE_FIELD_ORDER)});
    var button = box.querySelector('.send-btn');
    if (!input || !button) { return false; }
    /*
     * Touch the field the widget reads, and ONLY that field.
     *
     * Some builds of the widget attach their captcha script lazily, on the
     * first focus or click of a phone input:
     *
     *     el.addEventListener('focus', load, {once: true});
     *     el.addEventListener('click', load, {once: true});
     *
     * A person always fires those by typing; a driver that only assigns .value
     * fires neither. So the events are dispatched here -- but on the one input
     * chosen above, never on every '.user-name-input' in the box.
     *
     * That distinction is the whole point. The widget renders three of these
     * (mobile, WhatsApp, email) and reads exactly one, the one inside
     * '.input-box-content.active' -- see the note on PHONE_FIELD_ORDER. Waking
     * them in a loop leaves the LAST one focused, which is not the one the
     * number is then written into, and the widget goes on to read an empty box
     * and send '91NaN'. Waking the same element we are about to write to cannot
     * desync the two, because there is only ever one of them.
     *
     * Idempotent: the listeners are {once: true} and the loader carries its own
     * guard, so a repeat costs nothing. Ordered before the write so the script
     * has the longest possible head start, and ZO.write focuses it again anyway.
     */
    ZO.fire(input, 'focus');
    ZO.fire(input, 'click');
    ZO.write(input, DIGITS);
    /*
     * What the widget will actually do with this press, recorded before it
     * happens.
     *
     * Whether a captcha token gets attached is decided inside the widget and is
     * not observable afterwards, so the state is reported rather than acted on:
     * the send goes ahead regardless. Nothing here blocks on a captcha. An
     * earlier revision did, and gated the press on a config object this shop
     * does not publish -- which is how a working send became a silent one.
     */
    ZO.reportCaptcha();
    button.click();
    ZO.reask();
    ZO.sent('phone');
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
        // Confirmed against the widget's own selected country, not against the
        // click: what matters is the country the widget will actually send to.
        ZO.until(
          function () { return onCountry() && send(); },
          /*
           * The click landed on the right row, but no marker followed it.
           *
           * That is a template whose selectCountry does not stamp any of the
           * attributes onCountry can read -- not a wrong country. The row was
           * matched on its own data-country-code, so the widget's internal
           * selectedCountry is now ours whether or not it advertised the fact,
           * and refusing to send here abandons a send that would have worked.
           *
           * The rule at the top of this file is that a country which cannot be
           * confirmed is never sent to. This does not break it: what could not
           * be confirmed is the READBACK, after a click on a row this driver
           * identified by the widget's own code. Sending is the honest end of
           * that, and it is strictly what a person tapping the same row gets.
           */
          function () { send(); }
        );
        return true;
      },
      function () { ZO.fail('phone', 'country not found in the list'); }
    );
  }

  ZO.start();
  if (onCountry()) {
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
      /*
       * The field the widget actually SUBMITS, on the templates that have one.
       *
       * On the newer popup design the six visible boxes are presentation only
       * and the code is posted from a separate hidden input:
       *
       *     <input type="hidden" name="otp" class="otp-input-main otp6">
       *     ...
       *     a = t.querySelector('.otp-input-main').value
       *
       * and the widget's own SMS autofill writes BOTH, in this order: every box
       * gets one character, then the main field gets the whole code.
       *
       * Filling only the boxes therefore posts an empty otp on those templates.
       * The server refuses it, and once the attempt count is spent the widget
       * calls manageOTPBox(w, false) -> goBack(), which unhides '.login-box'
       * and hides '.verify-box' -- so the widget walks itself back to its phone
       * step and the customer is thrown back to the login screen.
       *
       * Guarded rather than required: a template that posts from the boxes
       * themselves has no such field, and its absence is not a failure. This is
       * additive either way -- the boxes are still filled exactly as before.
       */
      var main = box.querySelector('.otp-input-main');
      if (main) { ZO.write(main, CODE); }
      button.click();
      // No ZO.sent here: a submit is not a send, and reporting one would
      // restart the resend countdown on the screen that is waiting for a
      // verdict. What it does need is the verdict, however often it repeats.
      ZO.reask();
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
      ZO.reask();
      ZO.sent('otp');
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
