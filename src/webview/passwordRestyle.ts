/**
 * The Change Password screen: zigly.com's own password page, restyled.
 *
 * **Why a second payload and not LOGIN_RESTYLE.** The two want opposite things
 * from the same URL. `./loginRestyle.ts` exists to put SimplyOTP's OTP widget on
 * screen and hide everything else on the page -- including, explicitly,
 * `#sotp-default-fp` and `.forgot-password-btn-container`, which is to say the
 * very recover form this screen exists for. Reusing it here would hide the
 * screen's only content and show an OTP widget in its place.
 *
 * **What this screen actually opens.** See CHANGE_PASSWORD_URL in
 * ../constants/appConstants.ts: Shopify's classic customer accounts have no
 * signed-in change-password page, so the destination is the recover form and the
 * destination is UNCONFIRMED. That is a product question, recorded there, and
 * nothing in this file pretends otherwise.
 *
 * **What is styled, and what is deliberately not.** Only what has been verified
 * on a real page:
 *
 *   - the three furniture items, and the ground behind them. Both rules are
 *     lifted from ./loginRestyle.ts lines 50-97, which is where the reasoning
 *     for each of them lives -- the site's own bottom bar duplicates the app's
 *     native one directly above it, the footer contributes a decorative navy
 *     wave, and the scroll-to-top button anchors a third thing to a corner that
 *     should hold nothing. Ungated, because they are chrome either way.
 *   - the OTP widget, hidden. /account/login embeds SimplyOTP, and without this
 *     the customer would get a phone-number login sitting under a password
 *     form on a screen titled Change Password.
 *
 * The recover form itself is NOT styled, and that is a decision rather than an
 * omission: its markup is the theme's, nobody has read it, and this project's
 * rule is that a selector is either verified or absent. Guessing class names
 * here would produce rules that quietly match nothing and a file that claimed
 * to have styled a form it had never seen. When the live markup has been read,
 * the form rules belong in this file, in the shapes the login screen already
 * uses -- 58px min-height, 9px radius, a #9AA7B8 border.
 *
 * Style notes, both project rules and both the same as ./loginRestyle.ts:
 *   - No regular expressions. A backslash inside a template literal is eaten
 *     before the page sees the script.
 *   - Idempotent: this is injected on first load and again on every load end.
 */

import {LIFT_PAINT_GATE} from './headerBridge';

const PASSWORD_CSS = `
/* The site's own furniture, and the ground behind it. Ungated, exactly as on
   the login screen: these are chrome whatever else the page turns out to hold,
   and this screen gets no mobile stylesheet to hide them for it. See
   ./loginRestyle.ts for the full reasoning on each of the three. */
.fixed-icons,
.shopify-section-group-footer-group,
.scrollUpBtn {
  display: none !important;
}

/* "html body" rather than "body": the store appends its own
   "body {background-color: #ffffff !important;}" to the end of every page, and
   a bare body ties on importance and specificity and then loses on source
   order. Two elements settle it before source order is reached. */
html,
html body {
  background-color: #FFFFFF !important;
}

/* The OTP widget. /account/login embeds SimplyOTP, and on this screen that
   would be a phone-number login sitting underneath a password form.

   Hidden, never removed: the widget's own script walks the document looking for
   these, and an element it cannot find is how a third-party script starts
   throwing. */
#sotp-widget-loader,
.sotp-widget,
.sotp-popup-wrapper {
  display: none !important;
}
`;

/**
 * Injected into the Change Password WebView.
 *
 * No poll and no observer, unlike the login payload: there is no third-party
 * widget to wait for here. One stylesheet, installed once, guarded by its own
 * id so the re-injection on load end is free.
 */
export const PASSWORD_RESTYLE = `
(function () {
  var STYLE_ID = 'zigly-password-style';
  try {
    if (document.getElementById(STYLE_ID)) { return; }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(${JSON.stringify(PASSWORD_CSS)}));
    (document.head || document.documentElement).appendChild(style);
  } catch (e) {}
})();

/*
 * The paint gate comes off here for the same reason it does on the login
 * screen: this page does not get the mobile stylesheet, so nothing else on it
 * would ever lift the gate, and the form would sit invisible until the gate's
 * own deadline. After the sheet is in, so the site's own furniture is already
 * gone by the time the page is revealed.
 */
${LIFT_PAINT_GATE}
true;
`;
