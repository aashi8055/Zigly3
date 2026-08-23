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
import {LISTING_PATHS} from '../constants/appConstants';

/** The class the listing rules in ./injectedStyles are scoped to. */
export const LISTING_FLAG = 'zigly-listing';

/**
 * The listing test, as JavaScript for the page.
 *
 * Shared, and compiled from LISTING_PATHS rather than written out again: this
 * file, ./facetBridge and `showsSortFilterBar` in ../utils/urlUtils all have to
 * give the same answer, and they used to hold three hand-copied versions of it
 * kept in step by a comment. The market prefix is stripped for the reason the
 * app strips it -- see `withoutMarket` there.
 *
 * Defines `ziglyIsListing()` in whatever scope it is dropped into.
 */
export const LISTING_TEST_JS = `
  function ziglyListingPath() {
    var path = (window.location.pathname || '/').toLowerCase();
    var first = path.split('/')[1] || '';
    if (first.length === 2 || (first.length === 5 && first.charAt(2) === '-')) {
      path = path.slice(first.length + 1) || '/';
    }
    return path;
  }

  function ziglyIsListing() {
    var path = ziglyListingPath();
    var prefixes = ${JSON.stringify(LISTING_PATHS)};
    for (var i = 0; i < prefixes.length; i++) {
      if (path.indexOf(prefixes[i]) === 0) { return true; }
    }
    return false;
  }
`;

export const LISTING_PAGE_SCRIPT = `
(function () {
  var LISTING_FLAG = '${LISTING_FLAG}';
${LISTING_TEST_JS}
  function flagListing() {
    if (!ziglyIsListing() || !document.body) { return; }
    if (document.body.className.indexOf(LISTING_FLAG) === -1) {
      document.body.className = document.body.className + ' ' + LISTING_FLAG;
    }
  }

  flagListing();
})();
true;
`;
