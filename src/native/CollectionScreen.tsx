/**
 * A collection's product grid, natively.
 *
 * WHAT THIS REPLACES. A WebView on `/collections/{handle}` running SearchTap's
 * Vue grid, restyled by some five hundred lines of ../webview/injectedStyles.
 * What the customer saw was the site's DOM with the app's CSS over it; this is
 * the app's own view of the same catalogue.
 *
 * THE SHAPE, from the reference screenshot: the collection's title, a
 * "66 Products" line under it, then a two-column grid of ./ListingCard, with
 * the Sort / Filter bar along the foot. That bar and both its panels already
 * existed natively (../components/SortFilterBar, SortSheet, FilterSheet) and
 * are unchanged -- this screen only supplies what the grid itself needs.
 *
 * SORT IS OURS, FILTER IS SEARCHTAP'S, AND THAT SPLIT IS DELIBERATE. It is the
 * one design decision in this file worth reading twice.
 *
 *   Sort   Four of the site's five sorts are Shopify sort keys, so the grid
 *          re-queries and the answer is authoritative. The fifth,
 *          "Discount: High To Low", has no Shopify key at all and is computed
 *          over what has been loaded -- see ./listing's `sortByDiscount`, and
 *          the honest limit stated in `sortedProducts` below.
 *
 *   Filter SearchTap's facets are not Shopify's. Verified live 2026-09-09: the
 *          site's filter screen offers Pet type / Sub Category / Product
 *          Categories / Brands, while Shopify's own filter set for the same
 *          collection is Availability / Price / Product type / Category --
 *          different groups, different values, and SearchTap's counts are not
 *          even scoped the same way (it reports `dog (112)` on a collection
 *          that holds 66 products). A native filter screen fed by Shopify
 *          would quietly disagree with the website about its own catalogue, so
 *          filtering stays on ../webview/facetBridge and this screen steps
 *          aside when a filter is applied.
 *
 * PAGING IS BY CURSOR. `onEndReached` asks ./listing for the next page and
 * appends it. Not page numbers: Shopify's connection is cursor-based, and a
 * cursor is stable while an offset shifts under you if the merchant publishes
 * a product mid-scroll.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import {Block, usePulse} from '../components/Skeleton';
import ListingCard from './ListingCard';
import {
  PAGE_SIZE,
  fetchCollectionCount,
  fetchListingPage,
  fetchProductsByHandle,
  sortByDiscount,
  sortById,
  type ListingProduct,
  type SortId,
} from './listing';

const EDGE = 12;
const GUTTER = 10;

/**
 * The card width, from the screen.
 *
 * Two columns, the page's own inset either side and one gutter between. Read
 * from `Dimensions` once at module scope rather than per render: this grid does
 * not reflow on rotation (the app is portrait-locked), and a width recomputed
 * on every render would make every card a new prop and defeat memoisation.
 */
const CARD_WIDTH =
  (Dimensions.get('window').width - EDGE * 2 - GUTTER) / 2;

/** The grid's own placeholder: six cards' worth of shape. */
const GridSkeleton = () => {
  const pulse = usePulse(true);
  return (
    <View style={styles.skeleton}>
      {Array.from({length: 6}, (_, i) => (
        <View key={i} style={{width: CARD_WIDTH}}>
          <Block pulse={pulse} style={styles.skImage} />
          <Block pulse={pulse} style={styles.skTitle} />
          <Block pulse={pulse} style={styles.skPrice} />
          <Block pulse={pulse} style={styles.skButton} />
        </View>
      ))}
    </View>
  );
};

type Props = {
  /** The collection's handle, e.g. `applod`. */
  handle: string;
  /**
   * The heading above the grid.
   *
   * Passed in when the caller already knows it -- the card that was tapped
   * carries the merchant's own wording -- so the title paints on the first
   * frame instead of waiting for the query. The query's own title replaces it
   * if they differ, because the collection's title is the collection's.
   */
  title?: string;
  /** Which sort is applied. Owned by the screen above, which draws the sheet. */
  sort: SortId;
  /** Open a product page. */
  onOpen: (path: string) => void;
  /** Add a variant to the bag, through the WebView bridge. */
  onAdd: (variantId: number) => void;
  /** Space to leave under the last row, for the Sort/Filter bar. */
  bottomInset?: number;
  /**
   * The handles SearchTap's filters selected, or null when nothing is filtered.
   *
   * WHY THE GRID TAKES THIS AT ALL. The filter screen is SearchTap's, because
   * its facets are not Shopify's and cannot be derived from them -- see the
   * module note. So a filtered result set exists only as SearchTap's rendered
   * grid inside the page; ../webview/resultsBridge reads the handles out of it
   * and they arrive here. The grid then draws those products, with its own
   * cards, in SearchTap's own order.
   *
   * Null and empty mean different things and are treated differently. Null is
   * "no filter is applied", and the grid runs its own collection query. An
   * empty array is "the filter matched nothing", which is a real empty state
   * and must not silently fall back to the unfiltered list -- that would show
   * the customer a full grid after they filtered it down to none.
   */
  filteredHandles?: readonly string[] | null;
};

const CollectionScreen = ({
  handle,
  title,
  sort,
  onOpen,
  onAdd,
  bottomInset = 0,
  filteredHandles = null,
}: Props) => {
  const [products, setProducts] = useState<readonly ListingProduct[]>([]);
  const [heading, setHeading] = useState(title ?? '');
  const [count, setCount] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Guards against two pages landing out of order.
   *
   * A sort change starts a fresh query while an `onEndReached` page may still
   * be in flight; without this, that page appends products from the OLD sort
   * underneath the new first page. Each request records the generation it
   * belongs to and a stale answer is dropped.
   */
  const generation = useRef(0);

  /**
   * Whether a filter is applied, as a stable string.
   *
   * The handles arrive as a fresh array from the bridge on every report, so
   * depending on the array itself would re-run this effect on every identical
   * report. Joined into one string, an unchanged filter is an unchanged
   * dependency.
   */
  const filterKey = filteredHandles ? filteredHandles.join(',') : null;

  /** The products: either SearchTap's filtered set, or the collection's page. */
  useEffect(() => {
    const mine = ++generation.current;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    (async () => {
      /*
       * FILTERED: draw exactly what SearchTap selected.
       *
       * No paging and no cursor -- what the bridge read is what the page is
       * showing, and SearchTap does its own paging inside the page. Asking
       * Shopify for "the next page" of a set defined by SearchTap is not a
       * question that has an answer.
       */
      if (filteredHandles) {
        // Filtered to nothing is a real empty state, not a reason to fall back.
        const found = filteredHandles.length
          ? await fetchProductsByHandle(filteredHandles, controller.signal)
          : [];
        if (generation.current !== mine) {
          return;
        }
        setProducts(found);
        setCursor(null);
        setMore(false);
        setLoading(false);
        return;
      }

      const page = await fetchListingPage(handle, sort, null, controller.signal);
      if (generation.current !== mine) {
        return;
      }
      if (!page) {
        setFailed(true);
        setLoading(false);
        return;
      }
      setProducts(page.products);
      setCursor(page.cursor);
      setMore(page.hasNextPage);
      if (page.title) {
        setHeading(page.title);
      }
      setLoading(false);
    })();

    return () => controller.abort();
    // `filterKey` stands in for `filteredHandles` -- see its declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, sort, filterKey]);

  /**
   * The product count, fetched once per collection.
   *
   * Separate from the grid's own query and outside the sort effect: the total
   * does not change when the sort does, and re-counting on every sort would be
   * several hundred products' worth of round trip for a number that is already
   * on screen and already correct.
   */
  useEffect(() => {
    const controller = new AbortController();
    setCount(null);
    (async () => {
      const total = await fetchCollectionCount(handle, controller.signal);
      setCount(total);
    })();
    return () => controller.abort();
  }, [handle]);

  /** The next page. */
  const loadMore = useCallback(async () => {
    // A filtered set is complete as it stands -- see the effect above.
    if (paging || loading || !more || !cursor || filteredHandles) {
      return;
    }
    const mine = generation.current;
    setPaging(true);
    const page = await fetchListingPage(handle, sort, cursor);
    // Dropped if the sort changed while this was in flight -- see `generation`.
    if (generation.current === mine && page) {
      setProducts(current => [...current, ...page.products]);
      setCursor(page.cursor);
      setMore(page.hasNextPage);
    }
    setPaging(false);
  }, [cursor, filteredHandles, handle, loading, more, paging, sort]);

  /**
   * What the grid draws.
   *
   * Every sort but one is already applied by Shopify, so this is a pass-through
   * for four of the five. "Discount: High To Low" is the exception and is
   * ordered here.
   *
   * THE HONEST LIMIT OF THAT: a client-side sort can only order the products
   * that have been loaded. On the discount sort the grid therefore re-orders as
   * each page arrives, and the deepest discount in the collection is only
   * guaranteed to be at the top once every page is in. That is a real
   * difference from the website, whose engine sorts the whole collection before
   * sending the first row -- and it is the trade the sort was accepted under,
   * because Shopify offers no discount key to ask for instead.
   */
  /**
   * The number under the heading.
   *
   * The collection's total normally; the filtered set's size while a filter is
   * applied. Not `products.length` in the unfiltered case -- that is one page
   * of 24, and captioning a 66-product collection "24 Products" because that
   * is how far the customer has scrolled would be worse than no caption.
   */
  const shownCount = filteredHandles ? products.length : count;

  const sortedProducts = useMemo(
    () =>
      sortById(sort).key === null ? sortByDiscount(products) : [...products],
    [products, sort],
  );

  return (
    <FlatList
      style={styles.root}
      data={sortedProducts}
      keyExtractor={item => item.handle}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.content,
        {paddingBottom: EDGE + bottomInset},
      ]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.header}>
          {heading ? <Text style={styles.title}>{heading}</Text> : null}
          {/*
            The count, or nothing.

            Never a guess: ./listing returns null when it could not establish
            the total, and a wrong number under a collection heading is the kind
            of small false statement the standing design rule exists to prevent.
          */}
          {/*
            While a filter is applied the number is the filtered set's own
            size, because that is what is on screen -- printing the
            collection's total under a filtered grid would be a caption that
            contradicts the products beneath it. `shownCount` is null only
            when neither number is known yet.
          */}
          {shownCount !== null ? (
            <Text style={styles.count}>
              {shownCount} {shownCount === 1 ? 'Product' : 'Products'}
            </Text>
          ) : null}
        </View>
      }
      renderItem={({item}) => (
        <ListingCard
          product={item}
          width={CARD_WIDTH}
          onOpen={onOpen}
          onAdd={onAdd}
        />
      )}
      /*
       * Half a screen's warning. Zigly's product images are large and a page is
       * 24 products, so asking at the very bottom would show the spinner for as
       * long as the request takes; asking earlier usually means the next rows
       * are already there when the customer reaches them.
       */
      onEndReachedThreshold={0.5}
      onEndReached={loadMore}
      ListEmptyComponent={
        loading ? (
          <GridSkeleton />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {failed
                ? 'These products could not be loaded. Check your connection and try again.'
                : 'No products in this collection yet.'}
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        paging ? (
          <View style={styles.paging}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : undefined
      }
      /*
       * A modest window. Each card holds a large remote image, and Zigly's
       * bigger collections run to several hundred -- the default window keeps
       * far more mounted than two columns need and is felt as scroll jank on a
       * mid-range Android.
       */
      initialNumToRender={PAGE_SIZE / 2}
      windowSize={7}
      removeClippedSubviews
    />
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.white},
  content: {paddingHorizontal: EDGE, paddingTop: 4},
  row: {gap: GUTTER, marginBottom: GUTTER + 2},
  header: {paddingTop: 12, paddingBottom: 14, gap: 10},
  /** Large and heavy, as the reference shows -- the page's own name. */
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 27,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  count: {
    fontFamily: FONT_FAMILY,
    fontSize: 15.5,
    color: '#6B7280',
  },
  empty: {paddingVertical: 48, paddingHorizontal: 8},
  emptyText: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
  paging: {paddingVertical: 20},
  skeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GUTTER,
    paddingTop: 4,
  },
  skImage: {width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8},
  skTitle: {width: '90%', height: 13, borderRadius: 4, marginBottom: 6},
  skPrice: {width: '45%', height: 15, borderRadius: 4, marginBottom: 10},
  skButton: {width: '100%', height: 40, borderRadius: 8, marginBottom: 12},
});

export default CollectionScreen;
