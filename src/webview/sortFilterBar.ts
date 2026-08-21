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
  function pin() {
    if (!isListing()) { return; }

    /*
     * A bar that exists but has been emptied is worse than no bar: SearchTap
     * re-renders its controls on filter changes and on pagination, and when it
     * replaces the nodes we moved, our container is left holding nothing. So
     * the early-out tests for content, not just for the element.
     */
    var existing = document.getElementById(BAR_ID);
    if (existing && existing.children.length > 0) { return; }

    var parts = [];
    var wrap = document.querySelector('.st-filter-count-sort-wrap');
    var filters = document.querySelector('initial-search-filters');
    var sort = document.querySelector('initial-search-sort');

    // Order matters: filter on the left, sort on the right.
    if (filters) { parts.push(filters); }
    if (sort) { parts.push(sort); }
    if (wrap) { parts.push(wrap); }

    // Nothing to move yet: SearchTap has not rendered.
    if (!parts.length) { return; }

    var bar = existing;
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.className = PINNED;
      document.body.appendChild(bar);
    }
    for (var i = 0; i < parts.length; i++) { bar.appendChild(parts[i]); }

    if (document.body.className.indexOf(BODY_FLAG) === -1) {
      document.body.className = document.body.className + ' ' + BODY_FLAG;
    }
  }

  /*
   * SearchTap renders after first paint, so retry rather than assume the
   * controls exist yet. This keeps going for the whole window even after a
   * successful pin, because a filter change re-renders the controls and the
   * bar has to be refilled -- the old version stopped at the first success and
   * left an empty bar behind. Bounded, so it never polls forever.
   */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try { pin(); } catch (e) { warn('sort/filter pin failed: ' + e); }
    if (tries > 40) { clearInterval(timer); }
  }, 500);

  flagListing();
  pin();
})();
true;
`;
