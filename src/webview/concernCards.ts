/**
 * "Care by Concern": the whole card is the link, not just "Shop now".
 *
 * The section is Zigly's own `shop_of_concern`, transplanted by
 * extraSections.ts. Each card is a concern -- Skin & Coat, Digestive Care and
 * so on -- drawn as a photo, a heading and a "Shop now" anchor underneath. Only
 * that anchor is tappable, so on a phone the card reads as a button whose
 * button is a few words of text at the bottom: the photo is the biggest thing
 * on it and the biggest thing on it does nothing.
 *
 * WHY THIS IS SCRIPT AND NOT CSS. The card has no link of its own to stretch --
 * the anchor is a sibling of the photo, not an ancestor of it. Dawn's usual
 * trick (`a::after { position: absolute; inset: 0 }`, which this app already
 * uses on product cards) needs the anchor to be inside the element being
 * covered, and here the containing block would be the anchor's own row. So the
 * destination has to be read out of the anchor and put on the card, which means
 * touching the DOM.
 *
 * WHAT IT DOES, AND WHAT IT DOES NOT. The card gets the anchor's own href, on a
 * real <a>: the card element is not turned into a click handler that calls
 * `location.assign`, because an anchor is what the WebView's navigation
 * interception, the long-press menu and the platform's own accessibility all
 * already understand. Nothing is invented -- if a card has no "Shop now" to
 * read a destination from, that card is left exactly as it was. The original
 * anchor stays where it is and keeps working; it ends up nested inside the new
 * one, which is invalid HTML if it is written that way, so the card link is
 * built as a wrapper around the card's CONTENTS with the anchor lifted out of
 * it -- see `promote` below.
 *
 * The heading is what names the card to a screen reader, so the new link takes
 * its text as an aria-label rather than letting the reader announce the whole
 * card, photo alt and price included, as one link name.
 */

/** Section-id fragment for Care by Concern. Fragment, because of the theme suffix. */
const CONCERN_SECTION = 'shop_of_concern';

/**
 * How the "Shop now" anchor is found inside a card, in order of preference.
 *
 * The theme's own class first, then the generic fallbacks. Read off the live
 * section rather than guessed at -- but the fallbacks are there because this is
 * a section the app does not own, and a theme edit that renames a class must
 * cost the app a plainer selector, not the whole feature.
 */
const LINK_SELECTORS = [
  'a.shop_now',
  'a.shop-now',
  'a.button',
  'a[href*="/collections/"]',
  'a[href]',
];

export const CONCERN_CARDS_SCRIPT = `
(function () {
  if (window.__ziglyConcernCards) { return; }
  window.__ziglyConcernCards = true;

  var SECTION = ${JSON.stringify(CONCERN_SECTION)};
  var LINK_SELECTORS = ${JSON.stringify(LINK_SELECTORS)};
  var DONE = 'data-zigly-concern-link';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /** The concern sections on this page, however the theme suffixed their ids. */
  function hosts() {
    return document.querySelectorAll('[id*="' + SECTION + '"]');
  }

  /** The first anchor in this card that has a usable destination. */
  function findLink(card) {
    for (var i = 0; i < LINK_SELECTORS.length; i++) {
      var found = card.querySelectorAll(LINK_SELECTORS[i]);
      for (var j = 0; j < found.length; j++) {
        var href = found[j].getAttribute('href');
        // A '#' or a bare 'javascript:' is a control, not a destination, and
        // copying one onto the card would make the whole card do nothing
        // loudly instead of quietly.
        if (!href) { continue; }
        if (href.charAt(0) === '#') { continue; }
        if (href.toLowerCase().indexOf('javascript:') === 0) { continue; }
        return found[j];
      }
    }
    return null;
  }

  /**
   * Collapse whitespace and trim.
   *
   * Character by character rather than with a regex: a backslash inside one of
   * these template literals is consumed before the WebView ever sees the
   * script, and the failure mode is that the whole payload is a syntax error
   * and NOTHING in it runs. See the note in couponStrip.ts, which squashes the
   * same way for the same reason.
   */
  function squash(str) {
    var out = '';
    var prevWs = true;
    for (var k = 0; k < str.length; k++) {
      var c = str.charCodeAt(k);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
      else { out += str.charAt(k); prevWs = false; }
    }
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); }
    return out;
  }

  /** The card's own name, for the link's accessible label. */
  function labelFor(card, link) {
    var heading = card.querySelector('h3, h4, h2, .card-title, .concern-title');
    var text = heading ? heading.textContent : '';
    if (!text) { text = link.textContent || ''; }
    return squash(String(text));
  }

  /**
   * Make one card's contents into a link.
   *
   * The card's children are moved into a new <a> INSIDE the card, rather than
   * the card being wrapped in one: wrapping would put the anchor between the
   * card and its parent, and the parent is a flex or grid track whose child the
   * card has to remain for the section's own layout to survive.
   *
   * The existing "Shop now" is moved out of the new anchor first. Two reasons:
   * nested anchors are invalid and the browser will unnest them for us in
   * whatever way it likes, and its own tap should stay its own -- it is the
   * control the customer already knows works.
   */
  function promote(card) {
    if (card.getAttribute(DONE) === 'true') { return false; }

    var link = findLink(card);
    if (!link) { return false; }

    // Both read BEFORE anything moves, so this stays correct however the
    // wrapper ends up nested.
    var href = link.getAttribute('href');
    var label = labelFor(card, link);

    var wrap = document.createElement('a');
    wrap.className = 'zigly-concern-link';
    wrap.setAttribute('href', href);
    if (label) { wrap.setAttribute('aria-label', label); }

    // The original control comes out of the card FIRST, so it is never moved
    // into the wrapper at all -- an anchor inside an anchor is invalid and the
    // browser would unnest it wherever it liked. It goes back on the card
    // afterwards, at the end, which is where the theme draws it.
    if (link.parentNode) { link.parentNode.removeChild(link); }

    while (card.firstChild) { wrap.appendChild(card.firstChild); }
    card.appendChild(wrap);
    card.appendChild(link);

    card.setAttribute(DONE, 'true');
    return true;
  }

  /**
   * The cards inside a section.
   *
   * A card is whatever holds a "Shop now": the section's grid children. Taken
   * as the anchors' own nearest block ancestor rather than by a class name, so
   * the sweep does not depend on the theme's grid class -- which is the one
   * thing here most likely to be renamed.
   */
  function cardsIn(section) {
    var out = [];
    var anchors = section.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      // Walk up from the anchor to the first ancestor that holds more than the
      // anchor's own row -- that element is the card, because a card is the
      // photo AND the text AND the control, while every wrapper between the
      // anchor and it holds only one thing.
      var card = null;
      var node = anchors[i].parentNode;
      while (node && node !== section && node.nodeType === 1) {
        if (node.children && node.children.length > 1) { card = node; break; }
        node = node.parentNode;
      }
      // No such ancestor before the section itself means this anchor is not in
      // a card -- a "View all" in the heading row is the usual case. Skipped
      // rather than promoted: the section is not a card.
      if (!card) { continue; }
      // A card that already holds a promoted link is one this sweep has done.
      if (out.indexOf(card) === -1) { out.push(card); }
    }
    return out;
  }

  /** True once at least one card has actually been promoted. */
  function sweep() {
    var sections = hosts();
    var done = false;
    for (var s = 0; s < sections.length; s++) {
      var cards = cardsIn(sections[s]);
      for (var c = 0; c < cards.length; c++) {
        try {
          if (promote(cards[c])) { done = true; }
        } catch (e) {
          warn('concern card would not promote: ' + e);
        }
      }
    }
    return done;
  }

  /**
   * The section is transplanted asynchronously and lazily -- it is not on the
   * page when this runs. Watched rather than polled for the life of the page,
   * and the callback is coalesced into one task: the dashboard inserts a dozen
   * sections into the body, which is hundreds of mutation records, and a
   * querySelectorAll per record is work during the frames that are scarcest.
   */
  if (!sweep() && window.MutationObserver) {
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        if (sweep()) { try { mo.disconnect(); } catch (e) {} }
      }, 0);
    });
    try {
      mo.observe(document.body, {childList: true, subtree: true});
      // A section that never arrives must not leave an observer on the whole
      // document for the life of the page.
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 20000);
    } catch (e) {}
  }
})();
true;
`;
