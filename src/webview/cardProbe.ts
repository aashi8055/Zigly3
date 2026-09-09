/**
 * Report what a product card on THIS page is actually made of.
 *
 * WHY THIS EXISTS. Every SearchTap rule in ./productCard.ts is scoped to a
 * class name transcribed out of `assets/searchtap.js` by hand. That
 * transcription is the single point of failure for the whole restyle: if one
 * name is wrong -- a rename on their side, or a class read off a desktop render
 * that a phone never gets -- the rule is still valid CSS, the generated string
 * still contains every name the tests grep for, and it matches NOTHING. The
 * card then reverts to the raw site design the instant a sort is applied, which
 * is exactly the symptom this file was written to diagnose.
 *
 * No test can catch that. `__tests__/productCard.test.ts` asserts on the
 * generated string, and a string assertion proves only that a selector was
 * written -- never that it matches an element. The jsdom harness cannot help
 * either: it has no SearchTap, so there is no real card in it to match against.
 * The only authority is the live page, which is what this reads.
 *
 * WHAT IT DOES. Finds the product cards on the page, reports every class name
 * on each card's root and on each of its descendants, and says which of the
 * class names ./productCard.ts targets were actually found. That answers, in
 * one message, whether the restyle is landing -- and when it is not, it names
 * the class that should have been used instead.
 *
 * Read-only. It sets nothing, clicks nothing and changes no styling; a probe
 * that altered the page would be reporting on a page that no longer exists.
 *
 * No regex and no backtick appears below: this reaches the page through a
 * JavaScript template literal, which eats a lone backslash and would be closed
 * early by a backtick. See ./facetBridge's `squash` and the note in
 * ./injectedStyles.
 */

/**
 * The class names ./productCard.ts targets on SearchTap's card.
 *
 * Kept in step with that file by the test in `__tests__/cardProbe.test.ts`,
 * which fails if productCard.ts styles a SearchTap part this list does not
 * name -- so a rule added there cannot escape the probe that would have caught
 * it being wrong.
 */
export const SEARCHTAP_CARD_PARTS = [
  'st-product',
  'st-product-name',
  'st-product-details',
  'st-product-price',
  'st-price-wrapper',
  'st-brand-wrapper',
  'st-review',
  'st-swatches',
  'st-atc',
  'product-item-discount',
] as const;

/** And on the theme's card, for the same reason. */
export const THEME_CARD_PARTS = [
  'card-wrapper',
  'card-information',
  'card__heading',
  'price',
  'custom_price__container',
  'only-price-align--wrapper',
  'product--brand--wrapper',
  'product--below-content',
  'discount-container',
  'estimate-delivery--date-wrapper',
  'metafield__richtext_value_tag',
  'compare-at-price',
  'price__regular',
  'price__container',
] as const;

/** How many cards to describe in full. Two is enough to see the shape. */
const SAMPLE = 2;

export const CARD_PROBE_SCRIPT = `
(function () {
  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  var SEARCHTAP = ${JSON.stringify(SEARCHTAP_CARD_PARTS)};
  var THEME = ${JSON.stringify(THEME_CARD_PARTS)};

  /** Class names on one element, as an array. No regex: split on spaces. */
  function classesOf(node) {
    var raw = node && node.className ? String(node.className) : '';
    var parts = raw.split(' ');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i]) { out.push(parts[i]); }
    }
    return out;
  }

  /**
   * Whether a class name is present anywhere in the card, and where.
   *
   * 'root' and 'descendant' are reported separately because that distinction
   * is the one that broke this file's predecessor: SearchTap's parts are FLAT
   * SIBLINGS, so a rule written as '.st-product .st-review' needs st-review to
   * be a DESCENDANT of st-product and matches nothing when it is not.
   */
  function findPart(card, name) {
    if (classesOf(card).indexOf(name) !== -1) { return 'root'; }
    var hit = null;
    try { hit = card.querySelector('.' + name); } catch (e) { return 'absent'; }
    return hit ? 'descendant' : 'absent';
  }

  /**
   * The element carrying a given phrase, and the classes it actually has.
   *
   * WHY BY TEXT. Two rows on this card are hidden by class name and keep
   * coming back -- the offers note survived being named on BOTH cards, which
   * means the class it really carries is one nobody has recorded. A class name
   * cannot be guessed a third time, but the words are on screen, so the words
   * are what this searches for. Whatever it reports IS the selector to use.
   */
  function bearerOf(card, phrase) {
    var wanted = phrase.toLowerCase();
    var all = card.querySelectorAll('*');
    var best = null;
    for (var i = 0; i < all.length; i++) {
      var text = (all[i].textContent || '').toLowerCase();
      if (text.indexOf(wanted) === -1) { continue; }
      // The DEEPEST match: every ancestor contains the phrase too, and the
      // one to hide is the element that carries it and nothing else.
      best = all[i];
    }
    if (!best) { return null; }
    return {
      tag: best.tagName ? String(best.tagName).toLowerCase() : '',
      classes: classesOf(best),
      text: squashText(best.textContent || '')
    };
  }

  /** Collapse whitespace without a regex, as ./facetBridge does. */
  function squashText(value) {
    var s = String(value);
    var out = '';
    var space = false;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code === 32 || code === 9 || code === 10 || code === 13 || code === 160) {
        if (out) { space = true; }
      } else {
        if (space) { out += ' '; space = false; }
        out += s.charAt(i);
      }
    }
    return out.slice(0, 120);
  }

  /**
   * Any rating markup in this card, whether or not it is visible.
   *
   * The candidates are Judge.me's own widget classes and the generic star /
   * rating names Shopify themes use, plus the microdata Shopify emits for
   * aggregate ratings -- which is worth asking for because a theme that hides
   * its stars very often still ships the numbers.
   */
  function ratingIn(card) {
    var CANDIDATES = [
      '.jdgm-widget',
      '.jdgm-prev-badge',
      '.jdgm-star',
      '.rating',
      '.rating-star',
      '.product-rating',
      '.star-rating',
      '.spr-badge',
      '[itemprop="aggregateRating"]',
      '[data-rating]',
      '.st-review'
    ];
    var out = [];
    for (var i = 0; i < CANDIDATES.length; i++) {
      var hit = null;
      try { hit = card.querySelector(CANDIDATES[i]); } catch (e) { continue; }
      if (!hit) { continue; }
      var shown = 'unknown';
      try {
        if (window.getComputedStyle) {
          var cs = window.getComputedStyle(hit);
          shown = cs.display === 'none' || cs.visibility === 'hidden'
            ? 'hidden'
            : 'visible';
        }
      } catch (e) {}
      out.push({
        selector: CANDIDATES[i],
        classes: classesOf(hit),
        visibility: shown,
        text: squashText(hit.textContent || '')
      });
    }
    return out;
  }

  /** Every class name used anywhere inside one card, deduplicated. */
  function vocabulary(card) {
    var seen = {};
    var out = [];
    function take(node) {
      var names = classesOf(node);
      for (var i = 0; i < names.length; i++) {
        if (seen[names[i]]) { continue; }
        seen[names[i]] = 1;
        out.push(names[i]);
      }
    }
    take(card);
    var all = card.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) { take(all[i]); }
    return out;
  }

  /**
   * The product cards on this page.
   *
   * Both roots are asked for, because which one is present is the whole
   * question: the theme's grid before a sort, SearchTap's after one. A page
   * mid-swap can briefly hold both, which is worth seeing rather than hiding.
   */
  function cards() {
    var out = [];
    var roots = document.querySelectorAll(
      '.card-wrapper, .product-card-wrapper, .st-product'
    );
    for (var i = 0; i < roots.length; i++) { out.push(roots[i]); }
    return out;
  }

  /** Which engine drew a card, judged by what it actually contains. */
  function engineOf(card) {
    var searchTap = 0;
    var theme = 0;
    for (var i = 0; i < SEARCHTAP.length; i++) {
      if (findPart(card, SEARCHTAP[i]) !== 'absent') { searchTap++; }
    }
    for (var t = 0; t < THEME.length; t++) {
      if (findPart(card, THEME[t]) !== 'absent') { theme++; }
    }
    if (searchTap > theme) { return 'searchtap'; }
    if (theme > searchTap) { return 'theme'; }
    return 'unknown';
  }

  /** Whether our stylesheet is even on this document, and where in the head. */
  function stylesheet() {
    var node = document.getElementById('zigly-app-styles');
    if (!node) { return {present: false, last: false}; }
    var head = document.head || document.documentElement;
    return {present: true, last: !!head && head.lastChild === node};
  }

  function report() {
    var found = cards();
    var described = [];
    var limit = found.length < ${SAMPLE} ? found.length : ${SAMPLE};
    for (var i = 0; i < limit; i++) {
      var card = found[i];
      var parts = {};
      for (var s = 0; s < SEARCHTAP.length; s++) {
        parts[SEARCHTAP[s]] = findPart(card, SEARCHTAP[s]);
      }
      for (var t = 0; t < THEME.length; t++) {
        parts[THEME[t]] = findPart(card, THEME[t]);
      }
      described.push({
        engine: engineOf(card),
        rootClasses: classesOf(card),
        parts: parts,
        /*
         * The rows that keep coming back, found by their words rather than by
         * a class name that has already been guessed wrong twice. Each entry
         * names the element to hide, or is null when this card does not draw
         * that row at all -- which is itself the answer to "does its card
         * render the offers note".
         */
        bearers: {
          offers: bearerOf(card, 'offers on checkout'),
          add: bearerOf(card, '+ Add'),
          bag: bearerOf(card, 'Add to Bag')
        },
        /*
         * Is there a rating in this card at all -- rendered but hidden, or
         * genuinely absent?
         *
         * This is the question that decides whether the rating is a restyle or
         * a rebuild. Shopify themes very often ship review markup on a card
         * and hide it with the review app's own CSS, and this store runs
         * Judge.me (see DATA-SOURCES.md). If any of these is present the
         * rating can be shown with CSS like everything else here. If none is,
         * no stylesheet can invent one and that part is not a restyle.
         *
         * getComputedStyle is read ONLY here and only to report -- it is the
         * one thing that tells "hidden by CSS" apart from "not in the DOM",
         * which is exactly the distinction being asked about.
         */
        rating: ratingIn(card),
        vocabulary: vocabulary(card)
      });
    }

    /*
     * The body flag every card rule is scoped to. If this is false then no rule
     * in productCard.ts can match whatever the card is made of, and the class
     * names are not the problem at all -- see ./listingPage.
     */
    var body = document.body;
    send({
      tag: 'card-probe',
      url: window.location.pathname + window.location.search,
      listingFlag: !!body && body.className.indexOf('zigly-listing') !== -1,
      productFlag: !!body && body.className.indexOf('zigly-product') !== -1,
      bodyClasses: body ? classesOf(body) : [],
      styles: stylesheet(),
      cardCount: found.length,
      cards: described
    });
  }

  window.__ziglyCardProbe = report;

  /**
   * Report again when the grid is replaced, which is the case that matters.
   *
   * The first report describes the theme's server-rendered grid. The card the
   * customer complains about is the one that arrives AFTER a sort, when
   * SearchTap empties the results row and renders its own -- so a probe that
   * only ran at injection would describe the card that was never the problem.
   *
   * Coalesced, and only when the set of cards has actually changed shape: one
   * re-render is many mutation records, and this must not narrate every
   * keystroke of the site's own work. The signature is deliberately cheap --
   * how many cards, and what the first one's root is made of -- because that
   * is exactly what changes when one engine's grid replaces another's.
   */
  function signature() {
    var found = cards();
    var first = found.length ? classesOf(found[0]).join('.') : '';
    return found.length + '|' + first;
  }

  var lastSignature = signature();
  if (window.MutationObserver && document.body) {
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        var now = signature();
        if (now === lastSignature) { return; }
        lastSignature = now;
        try { report(); } catch (e) {}
      }, 400);
    });
    try {
      observer.observe(document.body, {childList: true, subtree: true});
    } catch (e) {}
  }

  try { report(); } catch (e) {}
})();
true;
`;

/** Ask the page to describe its cards again -- after a sort, say. */
export const READ_CARD_PROBE_SCRIPT = `
(function () {
  try {
    if (window.__ziglyCardProbe) { window.__ziglyCardProbe(); }
  } catch (e) {}
})();
true;
`;
