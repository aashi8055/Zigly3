/**
 * The Bestsellers rail.
 *
 * WHAT THIS REPLACED, AND WHY THE HEADING IS NOW HONEST.
 *
 * This slot used to hold the pet page's `collection_product_section`, which
 * Zigly title "Pet Parent Favourites", transplanted whole and kept under that
 * heading. The reasoning at the time is worth restating because it was right:
 * relabelling somebody else's curated rail "Bestsellers" would have been this
 * app making a sales claim about Zigly's products on Zigly's behalf, which is
 * not ours to make.
 *
 * That objection does not apply here, because nothing is being relabelled. The
 * products are read from Zigly's own best-selling sort --
 * `/collections/all?sort_by=best-selling` -- so "Bestsellers" describes how the
 * store ordered the list, rather than being a claim we added to it. Verified on
 * 2026-08-24 that the sort genuinely reorders: unsorted, /collections/all opens
 * on Acana alphabetically; sorted, it opens on Applod and Royal Canin.
 *
 * Store-wide on purpose. Dog and cat products are mixed, in whatever order they
 * actually sell -- which is the only reading under which the heading is true of
 * the whole store. Splitting it evenly between the two pets would have been a
 * curated mix wearing a bestseller label, which is the same problem again.
 *
 * HOW THE PRODUCTS GET HERE. Real product cards are moved across, never
 * rebuilt: each keeps its own <product-form>, so Add to Bag still posts to
 * Shopify, and each keeps its real product link. The custom element upgrades
 * itself on insertion, which is why the buttons stay live. Rebuilding a card
 * from a JSON endpoint would be lighter and would break exactly that.
 *
 * WHY IT ASKS FOR ONE SECTION RATHER THAN THE PAGE. The whole collection page
 * is ~1.4 MB; the product grid alone, through Shopify's Section Rendering API,
 * is ~585 KB for the same 22 cards in the same order (both measured
 * 2026-08-24). The query string survives into the section render, so the sort
 * survives with it. The whole page is still the fallback, because a
 * theme-generated section id is exactly the kind of thing that changes without
 * notice -- see GRID_SECTION_ID.
 */

/** Zigly's own best-selling sort, store-wide. */
const SOURCE = '/collections/all?sort_by=best-selling';

/**
 * The collection template's product-grid section, read from the live page on
 * 2026-08-24.
 *
 * Hardcoded because it cannot be discovered cheaply: pageCache's rediscovery
 * looks up `[id*=fragment]`, and on a collection page "product-grid" appears in
 * the id of the section, of a bare `<ul id="product-grid">`, AND of four ids on
 * every single card (`title-`, `CardLink-`, `StandardCardNoMediaLink-`,
 * `quick-add-`). That is over a hundred matches, so a fragment lookup there
 * would be resolving by document order and hoping. Hence a known id with a
 * whole-page fallback, rather than a clever selector.
 */
const GRID_SECTION_ID = 'template--26530973090108__product-grid';

/** How many cards the rail shows. The source page carries 22. */
const CARD_LIMIT = 12;

export const BESTSELLERS_SCRIPT = `
(function () {
  if (window.__ziglyBestsellers) { return; }
  window.__ziglyBestsellers = true;

  var SLOT_ID = 'zigly-x-bestsellers';
  var SOURCE = ${JSON.stringify(SOURCE)};
  var GRID_ID = ${JSON.stringify(GRID_SECTION_ID)};
  var LIMIT = ${CARD_LIMIT};
  var CARD_SEL = '.card-wrapper.product-card-wrapper';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  if (!isHome()) { return; }

  /**
   * The slot extraSections.ts reserves, in the reference order.
   *
   * Reserved there rather than anchored from here for the same reason
   * "Everything For" and Instagram are: the position is decided in one place,
   * by declaration order, so no module can end up above or below where the
   * reference puts it depending on which fetch resolved first.
   */
  var slot = document.getElementById(SLOT_ID);
  if (!slot) { warn('no slot for bestsellers'); return; }
  if (slot.firstChild) { return; }

  var section = document.createElement('section');
  section.className = 'zigly-bs';

  var title = document.createElement('h2');
  title.className = 'zigly-bs__title';
  title.textContent = 'Bestsellers';
  section.appendChild(title);

  var rail = document.createElement('div');
  rail.className = 'zigly-bs__rail';
  section.appendChild(rail);

  slot.appendChild(section);

  /**
   * Parse fetched markup into an INERT document.
   *
   * DOMParser rather than assigning innerHTML to a detached div: a parsed
   * document runs no script and starts no image request, and this markup
   * carries 22 products' worth of photographs. Building it in a div would have
   * the page fetch every one of them just to throw ten away.
   */
  function inert(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /** The product grid on its own, if the section id still resolves. */
  function fetchGrid() {
    var url = SOURCE + '&sections=' + encodeURIComponent(GRID_ID);
    return fetch(url, {credentials: 'same-origin'})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        var html = json ? json[GRID_ID] : null;
        if (typeof html !== 'string' || !html) { return null; }
        return inert(html);
      })
      .catch(function () { return null; });
  }

  /**
   * The whole collection page. Heavier, but it cannot go stale, so it is what a
   * changed section id falls back to rather than an empty rail.
   */
  function fetchPage() {
    if (!window.__ziglyFetchDoc) { return Promise.resolve(null); }
    return window.__ziglyFetchDoc(SOURCE).catch(function () { return null; });
  }

  function fill(scope) {
    if (!scope) { return 0; }
    var cards = scope.querySelectorAll(CARD_SEL);
    var added = 0;
    for (var i = 0; i < cards.length && added < LIMIT; i++) {
      var card = document.importNode(cards[i], true);
      // This app deliberately does not run the theme's section scripts, and a
      // card that shipped one would be the exception that starts throwing.
      var scripts = card.querySelectorAll('script');
      for (var s = 0; s < scripts.length; s++) {
        scripts[s].parentNode.removeChild(scripts[s]);
      }
      rail.appendChild(card);
      added++;
    }
    return added;
  }

  /**
   * Only fetch when the rail is close to the viewport -- it sits well below the
   * fold and pulls a page of real product markup, so loading it on sight is
   * what keeps first paint cheap.
   */
  function whenNear(el, run) {
    if (!window.IntersectionObserver) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); run(); return; }
      }
    }, {rootMargin: '700px 0px'});
    io.observe(el);
  }

  whenNear(section, function () {
    fetchGrid()
      .then(function (scope) {
        var added = fill(scope);
        if (added) { return added; }
        // Either the section id has moved or the request failed. Said once,
        // because it is the signal that GRID_SECTION_ID needs re-reading, then
        // the page carries on regardless.
        warn('bestsellers: grid section did not resolve, using the whole page');
        return fetchPage().then(fill);
      })
      .then(function (added) {
        if (!added && section.parentNode) {
          // An empty rail under a heading reads as broken; no rail at all just
          // ends that block, which nothing below it depends on.
          section.parentNode.removeChild(section);
          warn('bestsellers: no cards, section removed');
        }
      })
      .catch(function (e) { warn('bestsellers failed: ' + e); });
  });
})();
true;
`;
