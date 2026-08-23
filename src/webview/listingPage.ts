/**
 * Mark what shape of page this is, so the CSS written in advance knows.
 *
 * Two flags, both on <body>: `zigly-listing` for a collection or a search
 * result, `zigly-product` for a product page. A stylesheet is injected whole,
 * on every page, before the document is read -- a class is the only way it can
 * tell a grid from a product.
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
 * listing-card fixes in ./injectedStyles are written for a two-column grid of
 * theme cards, and a product page carries the same card markup in its
 * "recently viewed" and recommendation rails -- where those rules would stretch
 * a rail chip to the full width of the page. So the flag must not reach a
 * product page, and `zigly-product` marks the same page for the rules that
 * exist only for it.
 *
 * (An older note here said `.mobile-atc-main` is the site's sticky Add to Bag
 * bar on a product page. It is not: the served PDP was read on 2026-08-24 and
 * every `.mobile-atc-main` on it is the "+ Add" label inside a recommendation
 * card's quick-add button. The sticky bar is `.sticky-bar-container` -- see the
 * product-page block in ./injectedStyles.)
 */
import {LISTING_PATHS} from '../constants/appConstants';

/** The class the listing rules in ./injectedStyles are scoped to. */
export const LISTING_FLAG = 'zigly-listing';

/** The class the product-page rules in ./injectedStyles are scoped to. */
export const PRODUCT_FLAG = 'zigly-product';

/**
 * The listing test, as JavaScript for the page.
 *
 * Shared, and compiled from LISTING_PATHS rather than written out again: this
 * file, ./facetBridge, ./readySignal and `showsSortFilterBar` in
 * ../utils/urlUtils all have to give the same answer, and they used to hold
 * hand-copied versions of it kept in step by a comment. The market prefix is
 * stripped for the reason the app strips it -- see `withoutMarket` there.
 *
 * A product page is excluded ahead of the prefixes, and that is the whole of
 * why this test is not just LISTING_PATHS: every card in a Zigly grid links to
 * `/collections/{collection}/products/{handle}`, so the ordinary way into a
 * product page carries '/collections/' in front of it and answered yes here --
 * the listing flag landed on a product page, and the app drew Sort and Filter
 * along its foot. A bare `/products/{handle}` always answered no, so this makes
 * the two ways to the same page agree.
 *
 * `ziglyIsProduct()` is that same exclusion, named: the two answers cannot
 * drift because the listing test is defined in terms of it.
 *
 * indexOf, not a regular expression: this string reaches the page through a
 * JavaScript template literal, which eats a lone backslash -- see the note in
 * ./facetBridge's `squash`.
 *
 * Defines `ziglyIsListing()` and `ziglyIsProduct()` in whatever scope it is
 * dropped into.
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

  function ziglyIsProduct() {
    return ziglyListingPath().indexOf('/products/') !== -1;
  }

  function ziglyIsListing() {
    var path = ziglyListingPath();
    if (ziglyIsProduct()) { return false; }
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
  var PRODUCT_FLAG = '${PRODUCT_FLAG}';
${LISTING_TEST_JS}
  /* Appended, never assigned over: the theme keys its own layout off the
     classes already on <body> (template-collection, template-product). */
  function flag(name) {
    if (!document.body) { return; }
    if (document.body.className.indexOf(name) === -1) {
      document.body.className = document.body.className + ' ' + name;
    }
  }

  function flagPage() {
    if (ziglyIsListing()) { flag(LISTING_FLAG); }
    if (ziglyIsProduct()) { flag(PRODUCT_FLAG); }
  }

  flagPage();
})();
true;
`;
