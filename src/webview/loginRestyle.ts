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
 *   - the widget's own host is moved to the body and everything else on the
 *     page is hidden, which turns a widget embedded in a theme section into a
 *     screen;
 *   - the phone row, the buttons and the OTP boxes are restyled to the app's
 *     shapes, step by step, because the three steps deliberately do not look
 *     alike: step 1 is a full-width pale-red action, step 2 a small centred
 *     Submit, step 3 a full-width black SIGN UP;
 *   - the widget's own copy is overridden in exactly one place, LOGIN_LABELS.
 *
 * **Which host.** On /account/login the widget is an inline page embed --
 * `#sotp-widget-loader` > `#sotp-widget` > `.olWrapper` > `.ol` -- and there is
 * no `.sotp-popup-wrapper` on that page at all. This file used to look for the
 * popup wrapper only, so `present()` never returned true, the `zigly-otp` class
 * was never added, and every gated rule below was inert: the reported symptom
 * was the site's own login page minus its bar, footer and scroll button, which
 * is exactly the documented fallback. LOGIN_HOSTS is the fix, and it keeps the
 * popup first so the other pages that do render a popup are unaffected.
 *
 * **Which pass.** The poll is bounded (LOGIN_TRIES x LOGIN_POLL_MS = 10s) but
 * the OTP step arrives after an SMS and the signup step after six digits are
 * typed, both well past that. So the poll is only the way in; a coalesced
 * MutationObserver is what keeps the restyle applied for the rest of the
 * session. Same shape as the one in ./facetBridge.ts, and for the same reason.
 *
 * What is deliberately left alone:
 *
 *   - every listener, every request, the reCAPTCHA and the fraud check. Not one
 *     line here calls SimplyOTP's API or synthesises a click on its behalf.
 *   - all validation and all validation copy. The signup step's red border is
 *     drawn from SimplyOTP's own decision -- the app watches for the message it
 *     un-hides and never decides for itself whether an address is valid.
 *   - the consent line. It is a legal notice with links to Zigly's privacy
 *     policy and terms; an app that hid it to match a screenshot would be
 *     removing the thing that makes the tap lawful.
 *   - the resend countdown's number. It comes from the widget's own config, and
 *     that config has no `resend_time` on this store, so it falls back to the
 *     provider's own default. A number typed into this file would be a number
 *     that disagreed with the timer the customer is actually waiting on.
 *
 * And if the widget is not there -- a config change, a script that failed to
 * load -- the site's own login page shows as it is, minus the bar, the footer
 * and the scroll-to-top button, which are chrome on any reading and are hidden
 * unconditionally. A login screen that fails visibly is recoverable; a blank
 * one is not.
 *
 * Style notes for anyone editing this file, both of them project rules:
 *   - No regular expressions. A backslash inside a template literal is eaten
 *     before the page ever sees the script, which has silently shipped a dead
 *     payload in this project before. indexOf, split and character loops only.
 *   - Idempotent throughout. This payload is injected on first load and again
 *     on every load end, and the observer re-runs it on every widget re-render,
 *     so every operation here has to be a no-op on repeat.
 */

import {LIFT_PAINT_GATE} from './headerBridge';

/** How long to wait for a third-party widget that renders after first paint. */
export const LOGIN_POLL_MS = 250;
export const LOGIN_TRIES = 40;

/** What the reference app calls the button. SimplyOTP's own label differs. */
export const REQUEST_OTP_LABEL = 'Receive OTP';

/** The popup embed. First in LOGIN_HOSTS, and the only one that gets `active`. */
export const LOGIN_POPUP_HOST = '.sotp-popup-wrapper';

/**
 * Where the widget lives, in preference order. The first one on the page wins.
 *
 * The popup wrapper stays first because it is the outermost host on the pages
 * that render a popup, and lifting the outermost thing is what makes hiding
 * everything else safe. /account/login renders none of it: there the widget is
 * an inline embed and `#sotp-widget-loader` is the host. The last two are
 * fallbacks for a template that drops a wrapper -- `.olWrapper` is the widget's
 * own shell and is as far in as this can usefully go.
 */
export const LOGIN_HOSTS = [
  LOGIN_POPUP_HOST,
  '#sotp-widget-loader',
  '#sotp-widget',
  '.olWrapper',
];

/**
 * The marketing checkbox on the signup step.
 *
 * State the trade-off plainly, because it is a consent decision and not a
 * styling one: SimplyOTP renders `#marketing` **pre-checked**. Hiding it while
 * leaving it checked means the customer is opted in to marketing with nothing
 * on screen saying so, and no way to decline. That is what is asked for today
 * and it is what ships.
 *
 * `uncheck: true` is the other answer, and it is deliberately one edit: the
 * injected script then clears `checked` before the row is hidden, so the
 * customer is opted out instead of silently in. Nothing else has to change.
 */
export const MARKETING_CONSENT = {hide: true, uncheck: false};

/**
 * The Email field on the signup step.
 *
 * The signup step -- SimplyOTP's `.update-user-box`, the one a customer whose
 * phone number is new to the shop sees after the OTP -- asks for First Name,
 * Last Name, Email and the phone it just verified. The app asks for no email:
 * the account is created against the phone number, which is what the OTP
 * proved, and an address nobody has verified adds a field to the one screen
 * that stands between a customer and a session.
 *
 * State the risk plainly, because it is the same shape as MARKETING_CONSENT's:
 * whether SimplyOTP *requires* that field is its business and not visible from
 * here. Its live config carries `email_enable: false`, which is why step 1 asks
 * for a phone number and nothing else, and the field on this step carries no
 * `required` marker in the markup this app has seen -- but if a future config
 * makes it mandatory, signup would fail against a field the customer cannot
 * see. `hide: false` is the whole of the way back: the row shows again, already
 * labelled and styled, and nothing else has to change.
 *
 * Hidden, never removed, and never filled in: an app that invents an email
 * address for a customer is worse than one that asks for theirs.
 */
export const SIGNUP_EMAIL = {hide: false};

/** Added to whatever the script hides on the app's own account, not SimplyOTP's. */
export const HIDDEN_FIELD_CLASS = 'zigly-hidden-field';

/** How a LOGIN_LABELS entry writes its string. See the table below. */
export type LoginLabelMode = 'text' | 'replace' | 'append';

export type LoginLabel = {
  /** What to find. */
  selector: string;
  /** Which child carries the text, or '' for the element itself. */
  inner: string;
  /** How the write happens. */
  mode: LoginLabelMode;
  /** What SimplyOTP renders. For 'replace', also the string searched for. */
  live: string;
  /** What the app says instead. */
  text: string;
  /** Why the app differs. */
  why: string;
};

/**
 * Every string this app puts over one of SimplyOTP's own. The only place.
 *
 * Nothing else in this file writes text into the widget, and nothing outside
 * this table decides what the widget says. `live` is what SimplyOTP renders
 * today, so a reader can see at a glance what is being overridden and with
 * what:
 *
 *   selector                     | live                | app
 *   -----------------------------|---------------------|----------------------
 *   .send-btn span               | Request OTP         | Receive OTP
 *   .verify-btn span             | Verify OTP          | Submit
 *   .update-btn span             | Update              | SIGN UP
 *   .verify-box .login-descr...  | The OTP is sent on  | You will receive OTP on
 *   .edit-phone                  | (an svg, no text)   | Edit phone number
 *   .input-label.email           | Email               | Email Id
 *   .input-label.mobile          | Phone               | Phone Number
 *
 * `mode` is how the write happens, and the two that are not a plain
 * `textContent` are the two that would break something if they were:
 *
 *   - 'replace' -- the "sent on" line. The number lives in a
 *     `span.mn-container > span.user-details` that may be a child of the same
 *     `<p>`, so setting textContent on the `<p>` would delete the number.
 *     `retext()` rewrites the matching text node and leaves the element alone.
 *   - 'append' -- the edit-phone link. The widget's own `<svg>` lives inside
 *     that element and the click listener is bound to the element itself, so
 *     the label is a `<span>` appended beside the svg. Appending adds no
 *     listener and removes none.
 *
 * Titles are not in here: the screenshots show no title on the OTP or signup
 * steps, so those are hidden in CSS rather than relabelled. Neither is any
 * validation message -- those are SimplyOTP's verdict and stay in its words.
 */
export const LOGIN_LABELS: LoginLabel[] = [
  {
    selector: '.send-btn',
    inner: 'span',
    mode: 'text',
    live: 'Request OTP',
    text: REQUEST_OTP_LABEL,
    why: 'The reference app labels the first action this way.',
  },
  {
    selector: '.verify-btn',
    inner: 'span',
    mode: 'text',
    live: 'Verify OTP',
    text: 'Submit',
    why: 'The reference app draws a small centred Submit, not a named verb.',
  },
  {
    selector: '.update-btn',
    inner: 'span',
    mode: 'text',
    live: 'Update',
    text: 'SIGN UP',
    why: 'This step creates the account, and "Update" reads like editing one.',
  },
  {
    selector: '.verify-box .login-description',
    inner: '',
    mode: 'replace',
    live: 'The OTP is sent on',
    text: 'You will receive OTP on',
    why: 'The reference app words it as what is about to happen.',
  },
  {
    selector: '.edit-phone',
    inner: '',
    mode: 'append',
    live: '',
    text: 'Edit phone number',
    why: 'The screenshot shows a text link where the widget draws only a glyph.',
  },
  {
    selector: '.input-label.email',
    inner: '',
    mode: 'text',
    live: 'Email',
    text: 'Email Id',
    why:
      'The reference app labels it this way on the signup step. The row is ' +
      'hidden while SIGNUP_EMAIL.hide is true, and the label is kept so that ' +
      'flag is still the only edit that brings the field back.',
  },
  {
    selector: '.input-label.mobile',
    inner: '',
    mode: 'text',
    live: 'Phone',
    text: 'Phone Number',
    why: 'The reference app labels it this way on the signup step.',
  },
];

/** Added to the button once every OTP box carries a digit. */
export const OTP_READY_CLASS = 'zigly-otp-ready';
/** Added to a field whose error message SimplyOTP has just un-hidden. */
export const INVALID_CLASS = 'zigly-invalid';
/** Added to whichever of LOGIN_HOSTS was lifted, so the CSS can exempt it. */
export const HOST_CLASS = 'zigly-otp-host';

/**
 * The signup step's error messages, by class.
 *
 * Listed rather than matched with `[class*="error-message"]`, which looks like
 * it covers all four and covers exactly one: "error-email-message" does not
 * contain the substring "error-message". The wildcard is kept at the end for
 * whatever a template change adds.
 *
 * Single quotes inside the attribute selector, which CSS allows either way,
 * because this string is embedded in the payload with JSON.stringify and a
 * double quote would come out as an escape. The project rule is that no escape
 * exists in the injected script, so there is none to be eaten.
 */
const ERROR_SELECTOR =
  '.error-email-message, .error-message-phone, .error-fname-message, ' +
  ".error-lname-message, [class*='error-message']";

const LOGIN_CSS = `
/* ------------------------------------------------------------------
   The site's own furniture. Hidden whether or not the widget is found.

   Deliberately NOT gated on .zigly-otp, unlike everything after it. The
   rules below this block style the OTP widget, so they can wait for it to
   exist; these three are chrome, and the customer sees them either way --
   which is exactly how they came to be reported, on a screen where the
   widget had not been found:

     - .fixed-icons, the site's own bottom bar. It carries the same four
       destinations as the app's native one, so it showed as a second row of
       tabs directly above it. It survives EARLY_HEADER_CSS because that
       hides the <header> element, and this is a sibling of that header
       inside the header section rather than a child of it -- and it is
       position:fixed, so it anchors to the viewport regardless of where the
       section sits. The mobile stylesheet hides it on every shop page; this
       screen does not get that stylesheet.
     - the footer, whose decorative navy wave read as a stray blue band
       across an otherwise empty screen.
     - the scroll-to-top button, the third thing anchored to a corner of a
       screen that should have nothing in its corners.

   Hidden, never removed, for the reason the mobile stylesheet gives for the
   same bar: the theme's scripts mark the active tab in it on navigation, and
   an element they cannot find is how a script starts throwing.

   The login form itself is untouched. If the widget never appears this is
   still the site's own working login page, just without the furniture.
   ------------------------------------------------------------------ */
.fixed-icons,
.shopify-section-group-footer-group,
.scrollUpBtn {
  display: none !important;
}

/* The app ground, on the same terms and for the same reason: with the footer
   gone this is most of the screen, so it cannot wait for the widget either.

   "html body" rather than "body" because the store appends
   <style> body {background-color: #ffffff !important;} </style>
   to the end of every page. A bare body ties it on importance and on
   specificity and loses on source order; two elements settles it before
   source order is reached. Same rule, same reason, as the mobile stylesheet's
   ground -- see injectedStyles.ts. */
html,
html body {
  background-color: #FFFFFF !important;
}

/* Nothing below applies until the widget has actually been found: the class is
   added by the script, so a missing widget leaves the form as the site built
   it. The furniture above is gone by then either way. */

html.zigly-otp, html.zigly-otp body {
  /* Ground is set unconditionally above; this is the widget's own layout. */
  overflow-x: hidden !important;
}

/* Everything that is not the widget. The header, the footer, the theme's own
   email-and-password form and the announcement bar are all body-level, and the
   native header above this WebView already carries the way back. Anything of
   SimplyOTP's own -- its popup, its toasts -- is kept.

   .zigly-otp-host is the host the script lifted, whichever of LOGIN_HOSTS that
   was. It is named explicitly rather than left to the [class*="sotp"] match
   because the inline embed's host is an id with no sotp class on it at all, and
   .olWrapper would not match either. */
html.zigly-otp body > *:not(.zigly-otp-host):not(.sotp-popup-wrapper):not([class*="sotp"]):not([class*="toast"]) {
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

/* And the same for the inline embed's shell, which is how it becomes visible at
   all: the page's own inline script sets .olWrapper { display: none } and only
   restores it under Shopify.designMode, so on a real device the widget is built
   inside a hidden element and nothing ever shows it. An !important declaration
   on a .zigly-otp-qualified selector beats that whether the script wrote a
   stylesheet rule or an inline style, which is why nothing here pokes at the
   element's own style attribute. */
html.zigly-otp .olWrapper {
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
  position: static !important;
  inset: auto !important;
  background: #FFFFFF !important;
}

/* The loader's own reserved band. #sotp-widget-loader carries an inline
   min-height:400px, which is honest while the widget is still being built and
   wrong the moment it has a real height: it pushes the whole widget down the
   screen. An !important declaration beats a non-important inline style. */
html.zigly-otp #sotp-widget-loader,
html.zigly-otp .sotp-widget-loader,
html.zigly-otp #sotp-widget {
  min-height: 0 !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

html.zigly-otp .sotp-popup-container,
html.zigly-otp .sotp-popup-content,
html.zigly-otp .sotp-widget,
html.zigly-otp .sotp-form,
html.zigly-otp .ol {
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
html.zigly-otp .sotp-popup-content,
html.zigly-otp .ol {
  padding: 40px 20px 24px !important;
}

/* The modal's illustration, its logo and its close button. This screen is
   reached from the bottom navigation and left by the header's back arrow, so a
   close control inside it would be a second, differently-behaved way out. */
html.zigly-otp .sotp-popup-img-section,
html.zigly-otp .login-img,
html.zigly-otp .sotp-popup-close-btn,
html.zigly-otp .simply-close-btn {
  display: none !important;
}

/* The widget's supporting copy: hidden by default, shown back per step below.

   Default-hidden rather than default-shown because this file cannot see every
   branch of SimplyOTP's template. A step nobody has screenshotted, showing an
   unstyled paragraph, is the failure this way round avoids -- and the two
   places the screenshots do want copy are un-hidden explicitly, with
   :not(.hideBox) so the widget's own way of hiding a step still wins. */
html.zigly-otp .login-description,
html.zigly-otp .input-label {
  display: none !important;
}

/* No step title on the OTP or the signup step -- neither screenshot has one.
   Step 1 keeps "Login with OTP", styled below.

   .verify-otp-label is the small "OTP" caption over the six boxes, which the
   line above them already says. .input__label is the theme-side floating label
   that renders unconditionally beside the widget's own p.input-label, so with
   the labels shown on the signup step it would read as a second "Email". */
html.zigly-otp .verify-box .login-header,
html.zigly-otp .update-user-box .login-header,
html.zigly-otp .verify-otp-label,
html.zigly-otp .update-user-box .input__label {
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
html.zigly-otp .login-box input[type="email"],
html.zigly-otp .login-box input[name="email"] {
  display: none !important;
}

html.zigly-otp .login-box .input-label.email,
html.zigly-otp .login-box .error-email-message {
  display: none !important;
}
/* The country list, which is a dropdown over the row rather than a modal. */
html.zigly-otp .country-selector-list {
  top: auto !important;
  max-height: 320px !important;
  border: 1px solid #DDE3EC !important;
  border-radius: 10px !important;
  box-shadow: 0 8px 24px rgba(24, 55, 97, 0.16) !important;
}

/* ------------------------------------------------------------------
   The three actions, and why they are four rules and not one.

   They used to share a single pale-red full-width rule, which is right for
   step 1 and wrong for the other two: the reference app draws step 2's
   Submit small and centred, and step 3's SIGN UP full-width black. So this
   is geometry for all of them, then colour and width per step.

   .otp-btn is on BOTH .verify-btn and .update-btn, so it may only ever carry
   geometry here -- any colour on it would fight both of them.
   ------------------------------------------------------------------ */
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
  font-size: 18px !important;
  font-weight: 600 !important;
  text-transform: none !important;
  box-shadow: none !important;
}

/* Step 1. Pale red ground with red type, as the reference app draws it. */
html.zigly-otp .send-btn {
  background: #FDECEC !important;
  color: #ED2427 !important;
}

/* Step 2. A small centred pill, mid-grey with white type until there are six
   digits in the boxes.

   Everything here overrides the shared geometry above -- it is a fifth of the
   screen wide and a little over half the height of the other two buttons, so
   the height, the padding, the type size and the radius all come down with
   it. It stays later in the sheet than that block, which is what lets it win
   on equal specificity.

   Grey with white type, not the pale chip with grey type this drew before:
   the reference app's own screenshot is the source, and the difference was
   the most visible thing on the screen.

   Appearance only. The widget does not disable this button -- its own
   toast_enter_otp string says it validates on the click instead -- so an
   incomplete tap still reaches SimplyOTP and still gets its own toast.
   Nothing here blocks the press. */
html.zigly-otp .verify-btn {
  width: auto !important;
  min-width: 0 !important;
  min-height: 33px !important;
  margin: 16px auto 0 !important;
  padding: 0 14px !important;
  border-radius: 8px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  background: #808080 !important;
  color: #FFFFFF !important;
}
html.zigly-otp .verify-btn.zigly-otp-ready {
  background: #183761 !important;
  color: #FFFFFF !important;
}
/* And if a future version of the widget does disable it, grey wins back. */
html.zigly-otp .verify-btn:disabled,
html.zigly-otp .verify-btn.disabled {
  background: #808080 !important;
  color: #FFFFFF !important;
}

/* Step 3. Full-width black. The caps are in the label, so no text-transform. */
html.zigly-otp .update-btn {
  width: 100% !important;
  margin: 24px 0 0 !important;
  background: #111111 !important;
  color: #FFFFFF !important;
  border-radius: 9px !important;
  min-height: 58px !important;
  letter-spacing: 0.5px !important;
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

/* ------------------------------------------------------------------
   The OTP step.

   Every measurement below is read off the reference app's own OTP screen
   (screenshot, 2026-08-25) rather than chosen: the block sits well down the
   screen, the boxes are near-square, and Submit is a small mid-grey pill with
   white type -- not the pale chip with grey type this used to draw.

   How exact "exact" is. The screenshot arrived rescaled, so the numbers are
   proportions of its width converted to CSS px at the phone's own scale: the
   boxes are 70% of the screen across, the gaps between them a seventh of a
   box, Submit a fifth of the screen. That is accurate to a pixel or so, not
   to the reference app's stylesheet, and a second screenshot at a known
   device width is what would settle the last of it.

   The step's own top offset lives on .verify-box and not on .ol, because .ol
   is every step: only this one has been measured, so only this one moves.
   ------------------------------------------------------------------ */

html.zigly-otp .verify-box {
  padding-top: 115px !important;
}

/* "You will receive OTP on <number>", centred, with the number in bold. Shown
   back against the default hide above. */
html.zigly-otp .verify-box .login-description:not(.hideBox) {
  display: block !important;
  margin: 0 0 6px !important;
  font-size: 15px !important;
  line-height: 1.4 !important;
  color: #5A6472 !important;
  text-align: center !important;
}
html.zigly-otp .verify-box .user-details {
  font-weight: 700 !important;
  color: #1B1B1B !important;
}

/* The way back to step 1. A text link, as the screenshot has it, rather than
   the widget's glyph -- the label is appended by the script, which is why the
   svg goes and the element and its listener stay exactly as they were. */
html.zigly-otp .edit-phone:not(.hideBox) {
  display: block !important;
  margin: 0 0 34px !important;
  font-size: 14px !important;
  color: #5A6472 !important;
  text-align: center !important;
  text-decoration: underline !important;
  cursor: pointer !important;
}
html.zigly-otp .edit-phone svg {
  display: none !important;
}

html.zigly-otp .otp-input-main,
html.zigly-otp .input-boxes-container {
  display: flex !important;
  justify-content: center !important;
  gap: 9px !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}
/* Near-square, and six of them plus their gaps come to 70% of the screen --
   which is where the 38 and the 9 come from. The border is the same one the
   phone row draws, so the two steps agree with each other. */
html.zigly-otp .otp-input-box {
  width: 38px !important;
  min-height: 40px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid #9AA7B8 !important;
  border-radius: 8px !important;
  background: #FFFFFF !important;
  color: #1B1B1B !important;
  font-size: 20px !important;
  text-align: center !important;
}

/* The resend line: styled, never written to.

   Named by class rather than with a ".resend-otp > *" wildcard on purpose --
   #hcaptcha-container-resend is the first child of .resend-otp, and hiding or
   restyling it would be interfering with the challenge the resend needs. The
   digits are the widget's own: p.resend-otp-message carries its own
   {resend_time} substitution and p.count-down-otp the ticking spans. */
html.zigly-otp .resend-otp,
html.zigly-otp .resend-otp-text,
html.zigly-otp .resend-otp-message,
html.zigly-otp .count-down-otp {
  margin: 23px 0 0 !important;
  text-align: center !important;
  font-size: 13.5px !important;
  line-height: 1.5 !important;
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

/* ------------------------------------------------------------------
   The signup step.
   ------------------------------------------------------------------ */

/* First and Last name side by side. The container is the widget's own in this
   store's modal_view branch, so this is a flex direction and nothing more. */
html.zigly-otp .firstname-lastname-container:not(.hideBox) {
  display: flex !important;
  gap: 12px !important;
  width: 100% !important;
}
html.zigly-otp .firstname-wrapper,
html.zigly-otp .lastname-wrapper {
  flex: 1 1 0 !important;
  min-width: 0 !important;
}
html.zigly-otp .verify-box .login-inputBox {
  display: none !important;
}
/* Labels, on this step only. "First Name" and "Last Name" are already the
   widget's own strings; "Email Id" and "Phone Number" come from LOGIN_LABELS. */
html.zigly-otp .update-user-box .input-label:not(.hideBox) {
  display: block !important;
  margin: 14px 0 6px !important;
  font-size: 13px !important;
  color: #5A6472 !important;
  text-align: left !important;
}

/* The invalid-field treatment.

   SimplyOTP decides; this only follows. Its error spans carry hideBox until it
   decides a field is wrong, and the script marks the field above whichever one
   loses that class -- so the red border and the red message are always the
   provider's own verdict, in its own words, and never the app's.

   Recoloured on the inner box as well as on .login-inputBox, because that is
   where the phone-row rule above actually draws the border. */
html.zigly-otp .login-inputBox.zigly-invalid,
html.zigly-otp .login-inputBox.zigly-invalid .input-box-content,
html.zigly-otp .login-inputBox.zigly-invalid .mn-container,
html.zigly-otp .login-inputBox.zigly-invalid .mobile-no-inner,
html.zigly-otp .login-inputBox.zigly-invalid .email-no-inner {
  border-color: #ED2427 !important;
}

/* The phone field, which the widget prefills and disables on this step -- it is
   the number the OTP just went to. Legible rather than greyed out. It also adds
   hideBox to this step's country selector, so nothing here has to hide one: a
   config where it should show would then be broken by this file. */
html.zigly-otp .update-user-box input[name="phone"]:disabled {
  color: #1B1B1B !important;
  opacity: 1 !important;
  background: transparent !important;
}

/* ------------------------------------------------------------------
   The class the script hides a whole field row with.

   One class, added by the script to a field's own wrapper, its label and its
   error message -- not a selector for the field itself, because which element
   wraps it is SimplyOTP's business and the script can walk the DOM where a
   stylesheet would have to guess. Hidden, never removed and never filled in:
   the input is still the widget's own, still empty, still submitted as the
   widget submits it.

   UNCONDITIONAL, and that is the fix for a bug this file shipped with. The
   rule used to be gated on SIGNUP_EMAIL.hide, as if the class existed only for
   the signup step's Email row. It does not: hideLoginEmail below uses the
   same class on step 1, where the widget renders an email input this store
   never asks for. With the flag off, the script went on adding a class that no
   longer had a rule -- so the input stayed hidden by its own selector and its
   bordered wrapper did not, which is the empty box that appeared under the
   number field. A mechanism and a policy are two things; the policy is the
   flag, and it belongs on the script that applies the class, not on the rule
   that makes the class mean anything.
   ------------------------------------------------------------------ */
html.zigly-otp .${HIDDEN_FIELD_CLASS} {
  display: none !important;
}

/* ------------------------------------------------------------------
   The marketing checkbox. Read MARKETING_CONSENT's comment before changing
   this: the row is hidden and the box stays checked, which opts the customer
   in to marketing with nothing on screen saying so.
   ------------------------------------------------------------------ */
${
  MARKETING_CONSENT.hide
    ? `html.zigly-otp .update-checkbox-wrapper {
  display: none !important;
}`
    : '/* MARKETING_CONSENT.hide is false: the row shows as SimplyOTP draws it. */'
}

/* Errors and consent stay, and stay legible. The error classes are listed
   rather than matched on a substring -- "error-email-message" does not contain
   "error-message", so the wildcard alone covered only the phone one. */
html.zigly-otp .errormessage,
html.zigly-otp .error-container,
html.zigly-otp .error-email-message,
html.zigly-otp .error-message-phone,
html.zigly-otp .error-fname-message,
html.zigly-otp .error-lname-message,
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

/* SimplyOTP hides its inactive steps with this class, and this rule is what
   keeps them hidden against every display:flex above it -- so it stays LAST in
   the sheet. Anything appended after it, or given enough specificity to beat
   it, can put two steps on screen at once. The per-step rules above use
   :not(.hideBox) rather than raw specificity for exactly that reason. */
html.zigly-otp .hideBox {
  display: none !important;
}
`;

/**
 * Injected into the login WebView.
 *
 * Polls, because the widget is built by a script that runs after first paint --
 * the same reason the wishlist bridge polls -- and then observes, because the
 * steps that matter arrive long after any bounded poll has given up. Idempotent
 * throughout, so the repeat passes that follow a navigation cost nothing.
 */
export const LOGIN_RESTYLE = `
(function () {
  if (window.__ziglyLogin) { window.__ziglyLogin.run(); return; }

  var STYLE_ID = 'zigly-login-style';
  var HOSTS = ${JSON.stringify(LOGIN_HOSTS)};
  var POPUP = ${JSON.stringify(LOGIN_POPUP_HOST)};
  var HOST_CLASS = ${JSON.stringify(HOST_CLASS)};
  var READY = ${JSON.stringify(OTP_READY_CLASS)};
  var INVALID = ${JSON.stringify(INVALID_CLASS)};
  var ERRORS = ${JSON.stringify(ERROR_SELECTOR)};
  var EDIT_LABEL = 'zigly-edit-label';
  var HIDDEN = ${JSON.stringify(HIDDEN_FIELD_CLASS)};
  var HIDE_EMAIL = ${JSON.stringify(SIGNUP_EMAIL.hide)};
  var EMAIL_FIELD = 'input[type="email"], input[name="email"]';
  var EMAIL_EXTRAS = '.input-label.email, .error-email-message';
  var LABELS = ${JSON.stringify(
    LOGIN_LABELS.map(entry => ({
      selector: entry.selector,
      inner: entry.inner,
      mode: entry.mode,
      live: entry.live,
      text: entry.text,
    })),
  )};
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

  /** Write only on a change: an unconditional write would feed the observer. */
  function writeText(node, text) {
    if (node.textContent !== text) { node.textContent = text; }
  }

  /**
   * Swap one phrase inside an element without touching its children.
   *
   * The "sent on" line holds the customer's number in a span, so setting
   * textContent on the paragraph would delete the number. This rewrites the
   * matching text node only. split/join rather than a pattern: this file has no
   * regular expressions in it, and a template literal eats the backslash.
   */
  function retext(el, live, text) {
    var kids = el.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node.nodeType !== 3) { continue; }
      var value = node.nodeValue || '';
      if (value.indexOf(live) === -1) { continue; }
      var next = value.split(live).join(text);
      if (next !== value) { node.nodeValue = next; }
    }
  }

  /**
   * A text label beside the widget's own svg, added once.
   *
   * Appended rather than written over: the svg is the widget's and the click
   * listener is on the element itself, so appending adds no listener and
   * removes none. Guarded, so the observer's next pass does not add a second.
   */
  function appendLabel(el, text) {
    var existing = el.querySelector('.' + EDIT_LABEL);
    if (existing) { writeText(existing, text); return; }
    var span = document.createElement('span');
    span.className = EDIT_LABEL;
    span.textContent = text;
    el.appendChild(span);
  }

  /** Every string in LOGIN_LABELS, applied. The only copy this app overrides. */
  function relabel() {
    for (var i = 0; i < LABELS.length; i++) {
      var entry = LABELS[i];
      var found = document.querySelectorAll(entry.selector);
      for (var j = 0; j < found.length; j++) {
        var el = found[j];
        if (entry.mode === 'append') {
          appendLabel(el, entry.text);
        } else if (entry.mode === 'replace') {
          retext(el, entry.live, entry.text);
        } else {
          var inner = entry.inner ? el.querySelector(entry.inner) : null;
          writeText(inner || el, entry.text);
        }
      }
    }
  }

  /**
   * Grey Submit until every OTP box carries a digit.
   *
   * Appearance only -- one class, no disabling, nothing swallowed. Counted
   * rather than compared against six: all six boxes carry data-otp-index="0",
   * so that attribute cannot tell them apart, and the count is the widget's
   * own answer to how many there are.
   */
  function syncOtpReady() {
    var boxes = document.querySelectorAll('.otp-input-box');
    var filled = 0;
    for (var i = 0; i < boxes.length; i++) {
      var value = boxes[i].value || '';
      if (value.length > 0) { filled++; }
    }
    var ready = boxes.length > 0 && filled === boxes.length;
    var buttons = document.querySelectorAll('.verify-btn');
    for (var j = 0; j < buttons.length; j++) {
      if (ready) { buttons[j].classList.add(READY); }
      else { buttons[j].classList.remove(READY); }
    }
  }

  /** The field a message belongs to: the nearest .login-inputBox before it. */
  function nearestBox(el) {
    var sib = el.previousElementSibling;
    while (sib) {
      if (sib.classList && sib.classList.contains('login-inputBox')) {
        return sib;
      }
      sib = sib.previousElementSibling;
    }
    return null;
  }

  /**
   * Follow SimplyOTP's own verdict on a field.
   *
   * Its error spans carry hideBox until it decides the field is wrong, so a
   * span without that class is the provider saying so. Nothing here validates
   * anything or rewrites a message. Two passes, so a field with two messages
   * cannot have one of them undo the other.
   */
  function syncFieldErrors() {
    var spans = document.querySelectorAll(ERRORS);
    var flagged = [];
    var i;
    var box;
    for (i = 0; i < spans.length; i++) {
      if (spans[i].classList.contains('hideBox')) { continue; }
      box = nearestBox(spans[i]);
      if (box && flagged.indexOf(box) === -1) { flagged.push(box); }
    }
    for (i = 0; i < spans.length; i++) {
      box = nearestBox(spans[i]);
      if (!box) { continue; }
      if (flagged.indexOf(box) > -1) { box.classList.add(INVALID); }
      else { box.classList.remove(INVALID); }
    }
  }

  /** See MARKETING_CONSENT. One flag decides whether this does anything. */
  function uncheckMarketing() {${
    MARKETING_CONSENT.uncheck
      ? `
    var box = document.getElementById('marketing');
    if (box) { box.checked = false; }`
      : `
    // MARKETING_CONSENT.uncheck is false: the box is left as SimplyOTP set it,
    // which is pre-checked. Flipping that flag is the only edit needed.`
  }
  }

  /** True if this element holds any field other than the one passed in. */
  function holdsOther(el, keep) {
    var fields = el.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] !== keep) { return true; }
    }
    return false;
  }

  /**
   * The Email row on the signup step, hidden. See SIGNUP_EMAIL.
   *
   * The row is found by walking up from the widget's own input and stopping
   * before the first ancestor that holds another field, so the worst this can
   * do on a template nobody here has seen is hide too little: a store where
   * the email and the phone share a wrapper stops the walk at the smaller one
   * and keeps the phone. Scoped to .update-user-box, so step 1 -- which on
   * this store is the phone and nothing else -- cannot be reached by it.
   *
   * The label and the error message are the widget's siblings of that row
   * rather than its children, so they are named. Class only: nothing is
   * removed, nothing is disabled and no value is written, which leaves the
   * field exactly as SimplyOTP submits it.
   */
  function hideSignupEmail() {
    if (!HIDE_EMAIL) { return; }
    var box = document.querySelector('.update-user-box');
    if (!box) { return; }
    var input = box.querySelector(EMAIL_FIELD);
    if (input) {
      var target = input;
      var parent = target.parentNode;
      while (parent && parent !== box && parent.nodeType === 1 &&
             !holdsOther(parent, input)) {
        target = parent;
        parent = target.parentNode;
      }
      if (target.classList) { target.classList.add(HIDDEN); }
    }
    var extras = box.querySelectorAll(EMAIL_EXTRAS);
    for (var i = 0; i < extras.length; i++) {
      extras[i].classList.add(HIDDEN);
    }
  }
    function hideLoginEmail() {
  var box = document.querySelector('.login-box');
  if (!box) { return; }

  var input = box.querySelector(
    'input[type="email"], input[name="email"]'
  );

  if (input) {
    var target = input;
    var parent = target.parentNode;

    while (
      parent &&
      parent !== box &&
      parent.nodeType === 1 &&
      !holdsOther(parent, input)
    ) {
      target = parent;
      parent = target.parentNode;
    }

    if (target.classList) {
      target.classList.add(HIDDEN);
    }
  }

  var extras = box.querySelectorAll(
    '.input-label.email, .error-email-message'
  );

  for (var i = 0; i < extras.length; i++) {
    extras[i].classList.add(HIDDEN);
  }
}

  /** Everything that has to be re-applied when the widget rebuilds a step. */
  function sync() {
    relabel();
    uncheckMarketing();
    hideSignupEmail();
    hideLoginEmail();
    syncOtpReady();
    syncFieldErrors();
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
    var host = null;
    var which = '';
    for (var i = 0; i < HOSTS.length; i++) {
      var found = document.querySelector(HOSTS[i]);
      if (found) { host = found; which = HOSTS[i]; break; }
    }
    if (!host) { return false; }
    addStyle();
    // How the CSS tells the lifted host apart from everything it hides.
    host.classList.add(HOST_CLASS);
    // Body-level, so hiding everything else cannot hide the widget with it.
    if (host.parentNode !== document.body) {
      document.body.appendChild(host);
    }
    // The popup's own "open" state, and only the popup's: the inline embed on
    // /account/login has no such state, and marking it active would be
    // inventing one. Set rather than clicked -- there is nothing to click on a
    // screen that is only ever this.
    if (which === POPUP) { host.classList.add('active'); }
    document.documentElement.classList.add('zigly-otp');
    sync();
    return true;
  }

  /** One look for the widget, and one re-application if it is there. */
  function pass() {
    if (present()) {
      report('ready', step());
      return true;
    }
    return false;
  }

  function run() {
    tries = 0;
    if (timer) { clearInterval(timer); }
    // Before the first look for the widget, not after finding it: the sheet
    // opens with rules that hide the site's own bar and footer, and those
    // have to land on the screens where the widget never turns up too.
    addStyle();
    if (present()) {
      report('ready', step());
    }
    timer = setInterval(function () {
      tries++;
      var found = pass();
      if (tries >= ${LOGIN_TRIES}) {
        clearInterval(timer);
        timer = null;
        if (!found) {
          // The site's own login form is showing, unstyled by us but stripped
          // of its bar and footer: a working screen even if it is not ours.
          report('missing', 'widget not found');
        }
      }
    }, ${LOGIN_POLL_MS});
  }

  /*
   * Past the poll, which is where this used to stop.
   *
   * The poll is ten seconds. The OTP step arrives after an SMS and the signup
   * step after six digits are typed, so both are outside it -- relabelling and
   * the Submit state would simply never have reached them. Coalesced, because
   * one re-render is many mutation records and each would otherwise cost a full
   * sweep. Same shape as ./facetBridge.ts.
   *
   * Attached inside the __ziglyLogin guard above, so the repeat injections this
   * screen gets do not stack an observer each. It watches childList only, and
   * every write below is a class or a compared textContent, so it cannot feed
   * itself.
   */
  if (window.MutationObserver && document.body) {
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        pass();
      }, 120);
    });
    try {
      observer.observe(document.body, {childList: true, subtree: true});
    } catch (e) {}
  }

  /*
   * And the keystrokes, which are not DOM changes at all: typing into an OTP
   * box mutates a value, not a node, so the observer never sees it. Delegated
   * once, on the document, and it does nothing but count the boxes and toggle
   * one class -- it adds no listener to the widget's own inputs and swallows
   * nothing.
   */
  try {
    document.addEventListener('input', syncOtpReady, true);
  } catch (e) {}

  window.__ziglyLogin = {run: run};
  run();
})();

/*
 * The paint gate comes off here rather than with the mobile stylesheet: this
 * screen does not get that stylesheet -- it is one widget on a blank ground,
 * not a shop page -- so nothing else on this page would ever lift it, and the
 * login form would sit invisible until the gate's own deadline.
 *
 * After run(), which hides the site's own furniture. Before it, the site's
 * login page would be revealed for the beat it takes to run.
 */
${LIFT_PAINT_GATE}
true;
`;
