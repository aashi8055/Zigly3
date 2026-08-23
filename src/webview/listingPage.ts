/**
 * Mark a listing page, so the listing CSS knows where it is.
 *
 * WHAT THIS USED TO BE. This file was `sortFilterBar.ts`, and it moved
 * SearchTap's own Sort and Filter controls into a bar it pinned to the foot of
 * the page. The bar is native now (../components/SortFilterBar) and so are both
 * panels, driven through ./facetBridge -- so there is nothing left to move, and
 * the whole of that machinery is gone: no bar element, no MutationObserver
 * chasing re-renders, no body padding to keep the page clear of a floating
 * strip. The native bar takes its own space, which is the version of "does not
 * disturb the page" that needs no CSS in the page at all.
 *
 * What remains is the one thing that was never about the bar: the flag. The
 * listing-card fixes in ./injectedStyles must apply on a collection or search
 * page and must NOT apply on a product page, where `.mobile-atc-main` is the
 * site's own sticky Add to Bag bar and is supposed to float. A class on <body>
 * is how a stylesheet written in advance can tell the difference.
 */

/** The class the listing rules in ./injectedStyles are scoped to. */
export const LISTING_FLAG = 'zigly-listing';

export const LISTING_PAGE_SCRIPT = `
(function () {
  var LISTING_FLAG = '${LISTING_FLAG}';

  /**
   * A listing page: a product grid with sort and filter.
   *
   * '/collections/' with the slash on purpose -- bare '/collections' is the
   * collection *list* (the cards module), which has no products to sort.
   * '/search' is included because SearchTap powers that grid too, and the app
   * shows the same bar there.
   */
  function isListing() {
    var path = window.location.pathname;
    return path.indexOf('/collections/') === 0 || path.indexOf('/search') === 0;
  }

  function flagListing() {
    if (!isListing() || !document.body) { return; }
    if (document.body.className.indexOf(LISTING_FLAG) === -1) {
      document.body.className = document.body.className + ' ' + LISTING_FLAG;
    }
  }

  flagListing();
})();
true;
`;
