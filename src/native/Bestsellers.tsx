/**
 * The Bestsellers rail.
 *
 * Section sixteen, and the largest saving in the whole migration:
 * ../webview/bestsellers reads Shopify's Section Rendering API for the product
 * grid of `/collections/all?sort_by=best-selling`, which is ~585 KB of HTML for
 * 22 cards (~1.4 MB if the page is asked for whole). This is one GraphQL query
 * of a few KB for the same products in the same order.
 *
 * IT ALSO REMOVES THE MOST FRAGILE THING ON THE DASHBOARD. That section id is
 * hardcoded in the web version, and its own comment explains why it has to be:
 * rediscovery matches `[id*=fragment]`, and on a collection page "product-grid"
 * appears in the section's id, in a bare `<ul id="product-grid">`, and in four
 * ids on every card -- over a hundred matches, so "a fragment lookup there
 * would be resolving by document order and hoping". A theme re-save changes
 * that id, and the fallback is the 1.4 MB page. A sort key cannot go stale.
 *
 * THE HEADING IS HONEST, AND THAT WAS ARGUED FOR RATHER THAN ASSUMED. This slot
 * used to hold Zigly's "Pet Parent Favourites" rail, kept under its own name,
 * because relabelling somebody else's curated rail "Bestsellers" would have
 * been this app making a sales claim on Zigly's behalf. Nothing is relabelled
 * now: the products come from Zigly's own best-selling sort, so "Bestsellers"
 * describes how the store ordered them rather than being a claim added to them.
 * Verified live 2026-09-08 that the sort genuinely reorders -- Applod and Royal
 * Canin lead, where an unsorted read opens on Acana alphabetically.
 *
 * STORE-WIDE, DOGS AND CATS MIXED. ../webview/bestsellers again: "Splitting it
 * evenly between the two pets would have been a curated mix wearing a
 * bestseller label, which is the same problem again."
 *
 * ONE THING THE WEB VERSION DOES THAT THIS DELIBERATELY DOES NOT. It moves the
 * site's real product cards across rather than rebuilding them, so each keeps
 * its own `<product-form>` and Add to Bag still posts to Shopify -- and its
 * comment warns that "rebuilding a card from a JSON endpoint would be lighter
 * and would break exactly that." That warning is about a card built inside the
 * WebView, where the form is the only way to reach the cart. A native card has
 * a different route: it reports the variant id up and the screen runs
 * ../webview/cartBridge inside the WebView, which posts to the same
 * `/cart/add.js` with the same session. The concern is real and this is the
 * answer to it, not an oversight.
 */
import React, {useMemo} from 'react';
import ProductRail, {type RailTab} from './ProductRail';
import {fetchBestSellers} from './products';

/**
 * How many cards the rail shows.
 *
 * Twelve, matching ../webview/bestsellers' own `CARD_LIMIT`. The source page
 * carries 22; twelve is what a customer will swipe through on a rail eleven
 * sections down the dashboard.
 */
const LIMIT = 12;

/** The section heading. See the note above on why this one is honest. */
export const BESTSELLERS_TITLE = 'Bestsellers';

type Props = {
  onOpen: (path: string) => void;
  /** See ./ProductRail: the handle rides along so the card can spin. */
  onAdd: (variantId: number, handle: string) => void;
  /** The handle whose add is in flight. Passed straight to ./ProductRail. */
  addingHandle?: string | null;
};

const Bestsellers = ({onOpen, onAdd, addingHandle}: Props) => {
  /**
   * One tab, so ./ProductRail draws no tab row -- a lone tab is a label that
   * states nothing, and the heading above it already says the same thing.
   * Memoised for the reason ./HotPicks gives: a fresh array on every render
   * would be a fresh fetcher identity.
   */
  const tabs = useMemo<RailTab[]>(
    () => [
      {
        label: BESTSELLERS_TITLE,
        fetcher: signal => fetchBestSellers(LIMIT, signal),
      },
    ],
    [],
  );

  return (
    <ProductRail
      title={BESTSELLERS_TITLE}
      tabs={tabs}
      onOpen={onOpen}
      onAdd={onAdd}
      addingHandle={addingHandle}
    />
  );
};

export default Bestsellers;
