/**
 * The login screen: Zigly's own OTP widget, presented as an app screen.
 *
 * Why this is a restyle and not a native form. Login on zigly.com is SimplyOTP
 * (auth.lucentcommerce.com), and its live config -- read from the login page on
 * 2026-08-22 -- carries `recaptcha_enabled: true` and `fraud_detection: true`.
 * A native screen would therefore have to produce a reCAPTCHA token, which only
 * exists inside a real page running their script, and would have to post to
 * their API using a key lifted out of Zigly's storefront. That is the same
 * objection that kept search off SearchTap and the wishlist off Swym's API, and
 * it is a much worse one here: this is the flow that creates the session
 * everything else in the app depends on. `domSelectors.ts` already states the
 * rule for third-party controls -- restyle, never rebuild -- and nowhere does
 * it apply more than to authentication.
 *
 * So the page does the work and this file makes it look like it belongs:
 *
 *   - the widget's own popup is moved to the body and everything else on the
 *     page is hidden, which turns a modal over a web page into a screen;
 *   - the phone row, the button and the OTP boxes are restyled to the app's
 *     shapes;
 *   - the request button is relabelled "Receive OTP", as the reference app
 *     labels it (the app's own config says "Request OTP").
 *
 * What is deliberately left alone:
 *
 *   - every listener, every request, the reCAPTCHA and the fraud check. Not one
 *     line here calls SimplyOTP's API or synthesises a click on its behalf.
 *   - the consent line. It is a legal notice with links to Zigly's privacy
 *     policy and terms; an app that hid it to match a screenshot would be
 *     removing the thing that makes the tap lawful.
 *
 * And if the widget is not there -- a config change to page view, a script that
 * failed to load -- nothing is hidden and the site's own login page shows as
 * it is. A login screen that fails visibly is recoverable; a blank one is not.
 */

import {LIFT_PAINT_GATE} from './headerBridge';

/** How long to wait for a third-party widget that renders after first paint. */
export const LOGIN_POLL_MS = 250;
export const LOGIN_TRIES = 40;

/** What the reference app calls the button. SimplyOTP's own label differs. */
export const REQUEST_OTP_LABEL = 'Receive OTP';

const LOGIN_CSS = `
/* Nothing below applies until the widget has actually been found: the class is
   added by the script, so a missing widget leaves the page untouched. */

html.zigly-otp, html.zigly-otp body {
  background: #FFFFFF !important;
  overflow-x: hidden !important;
}

/* Everything that is not the widget. The header, the footer, the theme's own
   email-and-password form and the announcement bar are all body-level, and the
   native header above this WebView already carries the way back. Anything of
   SimplyOTP's own -- its popup, its toasts -- is kept. */
html.zigly-otp body > *:not(.sotp-popup-wrapper):not([class*="sotp"]):not([class*="toast"]) {
  display: none !important;
}

/* From modal to screen: no dim, no card, no rounded corners, no scroll lock
   fighting the WebView's own scrolling. */
html.zigly-otp .sotp-popup-wrapper {
  position: static !important;
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: #FFFFFF !important;
  backdrop-filter: none !important;
  inset: auto !important;
  padding: 0 !important;
}
html.zigly-otp .sotp-popup-container,
html.zigly-otp .sotp-popup-content,
html.zigly-otp .sotp-widget,
html.zigly-otp .sotp-form {
  position: static !important;
  transform: none !important;
  width: 100% !important;
  max-width: 420px !important;
  margin: 0 auto !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: #FFFFFF !important;
  max-height: none !important;
  overflow: visible !important;
}
html.zigly-otp .sotp-popup-content {
  padding: 40px 20px 24px !important;
}

/* The modal's illustration, its logo and its close button. This screen is
   reached from the bottom navigation and left by the header's back arrow, so a
   close control inside it would be a second, differently-behaved way out. */
html.zigly-otp .sotp-popup-img-section,
html.zigly-otp .login-img,
html.zigly-otp .sotp-popup-close-btn,
html.zigly-otp .simply-close-btn,
html.zigly-otp .login-description,
html.zigly-otp .input-label {
  display: none !important;
}

/* "Login With OTP". */
html.zigly-otp .login-header {
  display: block !important;
  margin: 0 0 30px !important;
  padding: 0 !important;
  font-size: 21px !important;
  font-weight: 500 !important;
  line-height: 1.3 !important;
  color: #1B1B1B !important;
  text-align: center !important;
}

/* The phone row: one bordered box, the country picker in its own cell.
   Matched by several of SimplyOTP's wrappers because which one is the row
   depends on which fields the shop has enabled. */
html.zigly-otp .mn-container,
html.zigly-otp .input-box-content,
html.zigly-otp .login-inputBox .mobile-no-inner,
html.zigly-otp .login-inputBox .email-no-inner {
  display: flex !important;
  align-items: stretch !important;
  width: 100% !important;
  min-height: 58px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid #9AA7B8 !important;
  border-radius: 9px !important;
  background: #FFFFFF !important;
  overflow: hidden !important;
}
html.zigly-otp .country-selector-main {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  flex: 0 0 auto !important;
  padding: 0 12px !important;
  border-right: 1px solid #9AA7B8 !important;
  background: #FFFFFF !important;
}
html.zigly-otp .country-flag-box,
html.zigly-otp .selected-country {
  border: 0 !important;
  background-color: transparent !important;
}
html.zigly-otp .dial-code {
  color: #1B1B1B !important;
  font-size: 17px !important;
}
html.zigly-otp .olInput,
html.zigly-otp .sotp-widget input[type="tel"],
html.zigly-otp .sotp-widget input[type="text"],
html.zigly-otp .sotp-widget input[type="email"] {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 14px !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  outline: none !important;
  background: transparent !important;
  font-size: 17px !important;
  color: #1B1B1B !important;
}

/* The country list, which is a dropdown over the row rather than a modal. */
html.zigly-otp .country-selector-list {
  top: auto !important;
  max-height: 320px !important;
  border: 1px solid #DDE3EC !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 24px rgba(24, 55, 97, 0.16) !important;
}

/* The action. Pale red ground with red type, as the reference app draws it. */
html.zigly-otp .send-btn,
html.zigly-otp .verify-btn,
html.zigly-otp .update-btn,
html.zigly-otp .otp-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  width: 100% !important;
  min-height: 58px !important;
  margin: 22px 0 0 !important;
  padding: 0 18px !important;
  border: 0 !important;
  border-radius: 9px !important;
  background: #FDECEC !important;
  color: #ED2427 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  text-transform: none !important;
  box-shadow: none !important;
}
html.zigly-otp .send-btn svg,
html.zigly-otp .verify-btn svg,
html.zigly-otp .otp-btn svg {
  /* The widget's white chevron is invisible on a pale ground. */
  display: none !important;
}
html.zigly-otp .button-wrapper {
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* The OTP step. */
html.zigly-otp .otp-input-main,
html.zigly-otp .input-boxes-container {
  display: flex !important;
  justify-content: center !important;
  gap: 10px !important;
  width: 100% !important;
  margin: 4px 0 0 !important;
  padding: 0 !important;
}
html.zigly-otp .otp-input-box {
  width: 48px !important;
  min-height: 58px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid #9AA7B8 !important;
  border-radius: 9px !important;
  background: #FFFFFF !important;
  color: #1B1B1B !important;
  font-size: 20px !important;
  text-align: center !important;
}
html.zigly-otp .verify-box-details,
html.zigly-otp .verify-content,
html.zigly-otp .resend-otp,
html.zigly-otp .resend-otp-text,
html.zigly-otp .edit-phone {
  text-align: center !important;
  font-size: 14px !important;
  color: #5A6472 !important;
}
html.zigly-otp .resend-btn {
  background: transparent !important;
  border: 0 !important;
  color: #ED2427 !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  min-height: 0 !important;
  margin: 6px 0 0 !important;
  padding: 0 !important;
}

/* Errors and consent stay, and stay legible. */
html.zigly-otp .errormessage,
html.zigly-otp .error-container,
html.zigly-otp [class*="error-message"] {
  color: #ED2427 !important;
  font-size: 13px !important;
  text-align: left !important;
}
html.zigly-otp .sotp-consent-wrapper,
html.zigly-otp .consent-text,
html.zigly-otp .consent-links-wrapper {
  margin-top: 18px !important;
  font-size: 12px !important;
  line-height: 1.5 !important;
  color: #767676 !important;
  text-align: center !important;
}
html.zigly-otp .consent-link {
  color: #183761 !important;
  text-decoration: underline !important;
}

/* The other ways in. The account tab is a phone-number flow, as the reference
   app has it, and the theme's email-and-password form is the page this screen
   replaces -- offering it again here would be offering the web experience the
   whole feature exists to avoid. */
html.zigly-otp .center-line,
html.zigly-otp .sotp-default-login-widget,
html.zigly-otp #sotp-default-login,
html.zigly-otp #sotp-default-fp,
html.zigly-otp .forgot-password-btn-container {
  display: none !important;
}

/* SimplyOTP hides its inactive steps with this class; make sure nothing here
   overrides it, or every step would show at once. */
html.zigly-otp .hideBox {
  display: none !important;
}
`;

/**
 * Injected into the login WebView.
 *
 * Polls, because the widget is built by a script that runs after first paint --
 * the same reason the wishlist bridge polls. Idempotent, so the repeat passes
 * that follow a navigation cost nothing.
 */
export const LOGIN_RESTYLE = `
(function () {
  if (window.__ziglyLogin) { window.__ziglyLogin.run(); return; }

  var STYLE_ID = 'zigly-login-style';
  var LABEL = ${JSON.stringify(REQUEST_OTP_LABEL)};
  var tries = 0;
  var timer = null;

  /** Only on a change: the poll runs many times and each one would post. */
  var last = '';

  function report(state, detail) {
    var key = state + '/' + (detail || '');
    if (key === last) { return; }
    last = key;
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({tag: 'login', state: state, detail: detail || ''})
        );
      }
    } catch (e) {}
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(${JSON.stringify(LOGIN_CSS)}));
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Say "Receive OTP" on the button.
   *
   * Only the label: the button, its listener and everything it posts are the
   * widget's. Re-applied on each pass because the widget re-renders its steps.
   */
  function relabel() {
    var buttons = document.querySelectorAll('.send-btn');
    for (var i = 0; i < buttons.length; i++) {
      var span = buttons[i].querySelector('span');
      var node = span || buttons[i];
      if (node.textContent !== LABEL) { node.textContent = LABEL; }
    }
  }

  /** Which step the widget is showing, for the log. */
  function step() {
    if (document.querySelector('.success-login-container:not(.hideBox)')) {
      return 'success';
    }
    if (document.querySelector('.update-user-box:not(.hideBox)')) {
      return 'details';
    }
    if (document.querySelector('.verify-box:not(.hideBox)')) { return 'otp'; }
    if (document.querySelector('.login-box:not(.hideBox)')) { return 'phone'; }
    return 'unknown';
  }

  function present() {
    var popup = document.querySelector('.sotp-popup-wrapper');
    if (!popup) { return false; }
    addStyle();
    // Body-level, so hiding everything else cannot hide the widget with it.
    if (popup.parentNode !== document.body) {
      document.body.appendChild(popup);
    }
    // The widget's own "open" state. Set rather than clicked: there is nothing
    // to click on a screen that is only ever this.
    popup.classList.add('active');
    document.documentElement.classList.add('zigly-otp');
    relabel();
    return true;
  }

  function run() {
    tries = 0;
    if (timer) { clearInterval(timer); }
    if (present()) {
      report('ready', step());
    }
    timer = setInterval(function () {
      tries++;
      var found = present();
      if (found) {
        report('ready', step());
      }
      // Keep going after the first success: the widget rebuilds its steps as
      // the customer moves through them, and each rebuild needs relabelling.
      if (tries >= ${LOGIN_TRIES}) {
        clearInterval(timer);
        timer = null;
        if (!found) {
          // Nothing hidden, nothing styled: the site's own login page is
          // showing, which is a working screen even if it is not ours.
          report('missing', 'widget not found');
        }
      }
    }, ${LOGIN_POLL_MS});
  }

  window.__ziglyLogin = {run: run};
  run();
})();

/*
 * The paint gate comes off here rather than with the mobile stylesheet: this
 * screen does not get that stylesheet -- it is one modal widget on a blank
 * ground, not a shop page -- so nothing else on this page would ever lift it,
 * and the login form would sit invisible until the gate's own deadline.
 *
 * After run(), which hides the site's own furniture. Before it, the site's
 * login page would be revealed for the beat it takes to run.
 */
${LIFT_PAINT_GATE}
true;
`;
