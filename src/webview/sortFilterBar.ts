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
  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isCollection() {
    return window.location.pathname.indexOf('/collections/') === 0;
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
    if (!isCollection()) { return; }
    if (document.getElementById(BAR_ID)) { return; }

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

    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = PINNED;
    for (var i = 0; i < parts.length; i++) { bar.appendChild(parts[i]); }

    document.body.appendChild(bar);
    document.body.className = document.body.className + ' ' + BODY_FLAG;
  }

  // SearchTap renders after first paint, so retry briefly rather than assume
  // the controls exist yet. Give up quietly instead of polling forever.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try { pin(); } catch (e) { warn('sort/filter pin failed: ' + e); }
    if (tries > 12 || document.getElementById(BAR_ID)) {
      clearInterval(timer);
    }
  }, 500);

  pin();
})();
true;
`;
