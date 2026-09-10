/**
 * "Hot Picks of The Week", with a New Arrivals tab.
 *
 * Section six, and the first product rail. Both tabs are Zigly's own curated
 * collections, so the products are the ones Zigly themselves put under these
 * names -- nothing is assembled here and nothing is re-sorted:
 *
 *   Hot Picks of The Week -> /collections/hot-picks-squeaker-toys
 *   New Arrivals          -> /collections/hot-deals
 *
 * Both verified live 2026-09-08: "Hot Picks- Squeaker Toys" and "Hot Deals"
 * return products to the public Storefront token.
 *
 * A CORRECTION CARRIED FORWARD FROM THE WEB VERSION, so it is not re-made.
 * ../webview/hotPicks records that this section used to be filled from the
 * arrival rails on `/pages/dog` and `/pages/zigly-cat`, on the reasoning that
 * the homepage has no "hot picks" section of its own. That was the wrong
 * products under the right heading -- Zigly do publish exactly these two
 * collections. The manifest in ./dashboardSections still carried
 * `home_arrival_section@dog` as this section's fragment, which is that same
 * superseded source; it is corrected there to null, because a collection query
 * has no section fragment behind it.
 *
 * It is also much cheaper. Those two arrival sections are 534 KB and 360 KB of
 * section HTML (DATA-SOURCES.md §3's size table); this is two GraphQL queries
 * of a few KB each, and the second only if the customer taps its tab.
 *
 * THE HEADING REPEATS AS A TAB LABEL, and that is the site's own shape rather
 * than an oversight: ../webview/hotPicks sets the section title to "Hot Picks
 * of The Week" and its first tab to the same string. Kept, because changing it
 * would be this app relabelling a section the customer already knows.
 */
import React, {useMemo} from 'react';
import ProductRail, {type RailTab} from './ProductRail';
import {fetchCollectionProducts} from './products';

/**
 * Zigly's own collections. Handles, not titles: a handle is the stable
 * identifier, and the collection's displayed title ("Hot Picks- Squeaker
 * Toys") is not what the section calls it.
 */
const HOT_HANDLE = 'hot-picks-squeaker-toys';
const NEW_HANDLE = 'hot-deals';

/** Fifteen per tab, matching ../webview/hotPicks' own `CARDS_PER_TAB`. */
const PER_TAB = 15;

/** The section heading, as ../webview/hotPicks renders it. */
export const HOT_PICKS_TITLE = 'Hot Picks of The Week';

type Props = {
  onOpen: (path: string) => void;
  /** See ./ProductRail: the handle rides along so the card can spin. */
  onAdd: (variantId: number, handle: string) => void;
  /** The handle whose add is in flight. Passed straight to ./ProductRail. */
  addingHandle?: string | null;
};

const HotPicks = ({onOpen, onAdd, addingHandle}: Props) => {
  /**
   * The tabs, memoised.
   *
   * ./ProductRail keys its tab content on the label and mounts a tab on first
   * selection; a fresh `tabs` array every render would be a fresh `fetcher`
   * identity too. ./useSectionData holds its callbacks in a ref precisely so
   * that cannot re-fetch, but memoising here means the question does not arise.
   */
  const tabs = useMemo<RailTab[]>(
    () => [
      {
        label: HOT_PICKS_TITLE,
        fetcher: signal =>
          fetchCollectionProducts(HOT_HANDLE, PER_TAB, signal),
      },
      {
        label: 'New Arrivals',
        fetcher: signal =>
          fetchCollectionProducts(NEW_HANDLE, PER_TAB, signal),
      },
    ],
    [],
  );

  return (
    <ProductRail
      title={HOT_PICKS_TITLE}
      tabs={tabs}
      onOpen={onOpen}
      onAdd={onAdd}
      addingHandle={addingHandle}
    />
  );
};

export default HotPicks;
