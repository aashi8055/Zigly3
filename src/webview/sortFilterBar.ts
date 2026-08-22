/**
 * Pin Sort and Filter to the bottom on collection pages.
 *
 * The controls are SearchTap's <initial-search-sort> and
 * <initial-search-filters>. They are rendered at runtime, so their wrapper
 * markup cannot be read from the served HTML and cannot be targeted by a class
 * written in advance.
 *
 * Instead we find both custom elements at runtime and pin their nearest common
 * ancestor. That works regardless of what SearchTap names things, and keeps the
 * site's own controls -- tapping Sort or Filter opens Zigly's real panels, with
 * no reimplementation.
 *
 * Safeguards: it only runs on collection pages, only pins an ancestor small
 * enough to plausibly be a toolbar, and does nothing at all if either control
 * is missing.
 */
export const SORT_FILTER_SCRIPT = `
(function () {
  var PINNED = 'zigly-sortfilter-pinned';
  var BAR_ID = 'zigly-sortfilter-bar';
  var BODY_FLAG = 'zigly-has-sortfilter';
  var LISTING_FLAG = 'zigly-listing';
  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /**
   * A listing page: a product grid with Sort and Filter.
   *
   * '/collections/' with the slash on purpose -- bare '/collections' is the
   * collection *list* (the cards module), which has no products to sort.
   * '/search' is included because SearchTap powers that grid too, and the
   * reference app pins the same bar there.
   */
  function isListing() {
    var path = window.location.pathname;
    return path.indexOf('/collections/') === 0 || path.indexOf('/search') === 0;
  }

  /**
   * Marks the page for the listing-card CSS, whether or not the bar itself
   * ever appears -- the card fixes are needed either way, and they must never
   * reach a product page, where .mobile-atc-main is the site's own sticky
   * Add to Bag bar and is supposed to float.
   */
  function flagListing() {
    if (!isListing()) { return; }
    if (document.body.className.indexOf(LISTING_FLAG) === -1) {
      document.body.className = document.body.className + ' ' + LISTING_FLAG;
    }
  }

  /**
   * Move the controls into a bar we own, rather than pinning whatever ancestor
   * happens to contain them.
   *
   * Pinning the common ancestor was too fragile: on a real collection page that
   * ancestor turned out to be page furniture well over the node limit, so
   * nothing was pinned at all and the controls stayed as pills at the top.
   * Relocating the two elements is deterministic. Moving a node preserves its
   * listeners, so they remain SearchTap's own controls -- tapping them opens
   * Zigly's real sort and filter panels.
   */
  /**
   * Move the controls into a bar we own.
   *
   * The page ships <initial-search-filters> and <initial-search-sort> as empty
   * placeholders and a .st-filter-count-sort-wrap holding <initial-toolbox-bar>.
   * SearchTap fills these at runtime, and the visible pills turned out to live
   * in the toolbox wrapper -- which an earlier version never moved, so they
   * stayed at the top of the page.
   *
   * All three are relocated. Moving preserves their listeners, so they remain
   * SearchTap's own controls opening Zigly's real panels.
   */
  /**
   * Every control SearchTap has rendered, wherever it has rendered it.
   *
   * querySelectorAll, not querySelector, and that is the first of the three
   * reasons Sort and Filter were showing up twice -- once at the top of the
   * grid and once in the pinned bar. SearchTap can have more than one of these
   * on the page, and only the first of each was ever moved; the rest stayed
   * where they were.
   */
  function controls() {
    var out = [];
    // Order matters: filter on the left, sort on the right.
    var groups = [
      document.querySelectorAll('initial-search-filters'),
      document.querySelectorAll('initial-search-sort'),
      document.querySelectorAll('.st-filter-count-sort-wrap')
    ];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g].length; i++) { out.push(groups[g][i]); }
    }
    return out;
  }

  function pin() {
    if (!isListing()) { return; }

    var found = controls();
    // Nothing rendered yet.
    if (!found.length) { return; }

    var bar = document.getElementById(BAR_ID);

    /*
     * The second reason for duplicates, and the subtler one. This used to
     * early-out when the bar already had children -- which is exactly the state
     * a re-render leaves behind. SearchTap replaces its controls on every filter
     * change and every page of results, so the bar would be holding the stale
     * nodes it moved earlier while the fresh ones sat at the top of the grid,
     * and the early-out meant they were never collected.
     *
     * So there is no early-out on content. Anything not already inside the bar
     * is moved into it, every time, and a node already there is left alone --
     * re-appending it would be a detach and re-attach, which loses focus and can
     * interrupt SearchTap's own transition.
     */
    var toMove = [];
    for (var i = 0; i < found.length; i++) {
      if (!bar || found[i].parentNode !== bar) { toMove.push(found[i]); }
    }
    if (!toMove.length) { return; }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.className = PINNED;
      document.body.appendChild(bar);
    }
    // Moving preserves listeners, so these stay SearchTap's own controls
    // opening Zigly's real panels.
    for (var m = 0; m < toMove.length; m++) { bar.appendChild(toMove[m]); }

    if (document.body.className.indexOf(BODY_FLAG) === -1) {
      document.body.className = document.body.className + ' ' + BODY_FLAG;
    }
  }

  /**
   * Re-pin the moment SearchTap re-renders, rather than up to half a second
   * later.
   *
   * The third reason for duplicates was timing, and it had two halves. The poll
   * ran every 500ms, so a re-render left controls visible at the top for up to
   * half a second; and it gave up after forty tries, so any re-render after the
   * first twenty seconds of a page's life left them there permanently. A
   * customer who filtered, browsed, then filtered again saw two of each for the
   * rest of that page.
   *
   * An observer has neither problem: it fires in the same task as the render and
   * it does not expire. Coalesced into one callback, because SearchTap replacing
   * a toolbar is many mutation records and each one would otherwise cost a
   * querySelectorAll sweep.
   *
   * The CSS backstop in injectedStyles.ts covers even this: a control outside
   * the bar is hidden, so a duplicate cannot be seen however the timing falls.
   */
  function watch() {
    if (!isListing() || !window.MutationObserver || !document.body) { return; }

    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        try { pin(); } catch (e) { warn('sort/filter pin failed: ' + e); }
      }, 0);
    });

    try {
      observer.observe(document.body, {childList: true, subtree: true});
    } catch (e) {
      warn('sort/filter observer failed: ' + e);
    }
  }

  /*
   * SearchTap renders after first paint, so the first pin has to be retried --
   * the observer only reports changes, and on a fast load the controls may
   * already be in place before it is attached. Bounded, because this is only
   * about the initial appearance; keeping up with re-renders is the observer's
   * job and it never expires.
   */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try { pin(); } catch (e) { warn('sort/filter pin failed: ' + e); }
    if (tries > 40) { clearInterval(timer); }
  }, 500);

  flagListing();
  pin();
  watch();
})();
true;
`;
