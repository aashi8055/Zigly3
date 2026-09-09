/**
 * A collection's products, for the native listing grid.
 *
 * WHY THIS IS NOT ./products. That module feeds the dashboard's rails, and a
 * rail card draws a picture, a title and a price. A listing card draws two more
 * things -- the coloured badge at its top-left and its rating -- and the screen
 * around it needs three more: a total count, a cursor to page with, and the
 * site's five sorts. Adding all of that to the rail query would make every
 * dashboard section pay for fields no rail draws, on a screen where twelve
 * sections load at once.
 *
 * PRICES ARE PAISE ON THE WAY OUT, as in ./products and for the same reason:
 * GraphQL answers in decimal strings ("199.0"), ../utils/money is written for
 * paise, and DATA-SOURCES.md §1 warns that mixing the two is how a Shopify
 * client shows ₹1.99 or ₹19,900. `paiseFromDecimal` runs at this edge and
 * nothing downstream divides anything.
 *
 * THE BADGE AND THE RATING ARE METAFIELDS, AND THAT IS NOT OBVIOUS. Neither is
 * part of a Shopify product. Read out of `snippets/card-product.liquid` on
 * 2026-09-09:
 *
 *   custom.product_tags    a list; the theme draws the FIRST value only and
 *                          then `{% break %}`, with a fixed colour per value.
 *   reviews.rating         a `rating` metafield -- JSON carrying value,
 *                          scale_min and scale_max.
 *   reviews.rating_count   how many reviews, for the count beside the star.
 *
 * So a card that queried only product fields would silently lose every badge
 * and every rating. Verified live on 2026-09-09: the first Applod product comes
 * back with `custom.product_tags` = `["Hot Buys"]` and a rating of 4.72, which
 * is exactly what the site's own card shows.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO. It does not filter. The listing's
 * filter screen is SearchTap's -- its groups (Pet type, Sub Category, Brands)
 * do not exist in Shopify's filter set and its counts are not scoped the way
 * Shopify's are, verified live: SearchTap reports `dog (112)` on a collection
 * GraphQL and the site both agree holds 66 products. Filtering therefore stays
 * on ../webview/facetBridge, and this module answers the unfiltered,
 * sorted, paged question. See DATA-SOURCES.md and the note on SORTS below.
 */
import {paiseFromDecimal} from '../utils/money';
import {storefront} from './storefront';
import {numericId} from './products';

/**
 * The badge colours, exactly as `snippets/card-product.liquid` assigns them.
 *
 * A `case` on the downcased first value of `custom.product_tags`, with
 * `#183761` for anything not named -- the theme's own `assign badge_color`
 * default, so a tag Zigly adds tomorrow gets the navy pill it would get on the
 * website rather than no pill at all.
 */
export const BADGE_COLORS: Record<string, string> = {
  bestsellers: '#2196F3',
  'new arrival': '#32CD32',
  'hot buys': '#FF1694',
  'few left': '#FF9800',
  exclusives: '#673AB7',
  'zigly choice': '#d82329',
};

/** The theme's fallback for an unrecognised tag. */
export const BADGE_DEFAULT = '#183761';

/** One card's badge: what it says and what colour it is. */
export type Badge = {
  readonly label: string;
  readonly color: string;
};

/** One product, as the listing grid draws it. */
export type ListingProduct = {
  readonly handle: string;
  readonly title: string;
  readonly path: string;
  /** Sale price, in paise. */
  readonly price: number;
  /** Struck-through price in paise, or null when there is no saving. */
  readonly compareAt: number | null;
  readonly image: string | null;
  readonly available: boolean;
  /** Numeric variant id for ../webview/cartBridge, or null. */
  readonly variantId: number | null;
  /** The coloured pill, or null when the product carries no tag. */
  readonly badge: Badge | null;
  /** Average rating, or null when the product has none. */
  readonly rating: number | null;
  /** How many reviews that average is over. 0 when unknown. */
  readonly ratingCount: number;
};

/**
 * The site's five sorts, and what each one is here.
 *
 * The labels are the site's own, read off its sort sheet in the order the sheet
 * lists them, so the native sheet is the same five rows in the same order.
 *
 * FOUR MAP TO A SHOPIFY SORT KEY. The fifth does not: Shopify has no
 * discount sort, so `discount` carries a null key and is computed in the app --
 * see `sortByDiscount`. That is a real difference in kind and it is named here
 * rather than hidden, because a client-side sort can only order the products it
 * has actually loaded.
 */
export type SortId =
  | 'best-selling'
  | 'price-asc'
  | 'price-desc'
  | 'new-release'
  | 'discount';

export type SortOption = {
  readonly id: SortId;
  /** The site's own wording. */
  readonly label: string;
  /** Shopify's sort key, or null when the app must do it. */
  readonly key: 'BEST_SELLING' | 'PRICE' | 'CREATED' | null;
  readonly reverse: boolean;
};

/** The five, in the site's order. `best-selling` is the site's default. */
export const SORTS: readonly SortOption[] = [
  {id: 'best-selling', label: 'Best Selling', key: 'BEST_SELLING', reverse: false},
  {id: 'price-asc', label: 'Price: Low To High', key: 'PRICE', reverse: false},
  {id: 'price-desc', label: 'Price: High To Low', key: 'PRICE', reverse: true},
  {id: 'new-release', label: 'New Release', key: 'CREATED', reverse: true},
  {id: 'discount', label: 'Discount: High To Low', key: null, reverse: false},
];

export const DEFAULT_SORT: SortId = 'best-selling';

export const sortById = (id: SortId): SortOption =>
  SORTS.find(sort => sort.id === id) ?? SORTS[0];

/**
 * The saving on a product, as a fraction of its compare-at price.
 *
 * Exported for its own test. 0 when there is no compare-at, so an undiscounted
 * product sorts below every discounted one rather than above them -- which is
 * what `Number.NEGATIVE_INFINITY` or a null would risk depending on the
 * comparator.
 *
 * A FRACTION, NOT AN AMOUNT. "Discount: High To Low" on a storefront means the
 * biggest percentage off, not the biggest rupee saving: ₹200 off a ₹5,000 bag
 * is a smaller discount than ₹100 off a ₹150 toy, and ordering by the amount
 * would put every large bag at the top of the list.
 */
export const discountFraction = (product: ListingProduct): number => {
  if (!product.compareAt || product.compareAt <= product.price) {
    return 0;
  }
  return (product.compareAt - product.price) / product.compareAt;
};

/**
 * Order by discount, deepest first.
 *
 * A new array; the input is left alone because the caller holds it as React
 * state. Ties keep their existing order -- `Array.prototype.sort` is stable in
 * Hermes and on every JS engine since ES2019 -- so products with equal
 * discounts stay in the collection's own order rather than shuffling between
 * renders.
 */
export const sortByDiscount = (
  products: readonly ListingProduct[],
): ListingProduct[] =>
  [...products].sort((a, b) => discountFraction(b) - discountFraction(a));

/**
 * The first value of `custom.product_tags`, as a badge.
 *
 * Exported for its own test. The metafield arrives as a JSON array in a string
 * (`"[\"Hot Buys\"]"`), which is how Shopify returns a `list.` type -- so it is
 * parsed, not read. Anything unparseable, empty, or not a list of strings
 * yields null and the card simply has no pill.
 *
 * ONLY THE FIRST, because that is what the theme draws: its loop breaks after
 * `forloop.index == 1`. A card showing two pills would be this app disagreeing
 * with the website about its own merchandising.
 *
 * The label is trimmed and capitalised the way the theme does
 * (`capitalize | truncatewords: 4`) -- capitalize in Liquid upper-cases the
 * first letter and lower-cases the rest, which is why "Hot Buys" renders as
 * "Hot buys" on the site. The site's own screenshot shows "Hot Buys", so the
 * theme's stored value is used as-is rather than re-cased; truncation at four
 * words is kept because a long tag would otherwise overrun the card.
 */
export const parseBadge = (raw: unknown): Badge | null => {
  if (typeof raw !== 'string' || !raw) {
    return null;
  }
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(list)) {
    return null;
  }
  const first = list.find(
    value => typeof value === 'string' && value.trim().length > 0,
  );
  if (typeof first !== 'string') {
    return null;
  }
  const label = first.trim().split(/\s+/).slice(0, 4).join(' ');
  return {
    label,
    color: BADGE_COLORS[label.toLowerCase()] ?? BADGE_DEFAULT,
  };
};

/**
 * The average out of `reviews.rating`.
 *
 * Exported for its own test. The metafield is a `rating` type, whose value is
 * JSON: `{"scale_min":"1.0","scale_max":"5.0","value":"4.72"}`. Null for
 * anything else, and null rather than 0 -- an unrated product must draw no star
 * at all, and a 0 would draw one reading "0".
 *
 * The theme only shows a rating at or above 1.00 (`if average_rating >= '1.00'`
 * in its Judge.me branch), and that floor is kept: a 0.4 average on one review
 * is noise the site does not print.
 */
export const parseRating = (raw: unknown): number | null => {
  if (typeof raw !== 'string' || !raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const value = Number((parsed as {value?: unknown}).value);
  if (!Number.isFinite(value) || value < 1) {
    return null;
  }
  return value;
};

/** The listing card's field set. */
const LISTING_FIELDS = `
  fragment ListingCard on Product {
    handle
    title
    availableForSale
    featuredImage { url }
    priceRange { minVariantPrice { amount } }
    compareAtPriceRange { minVariantPrice { amount } }
    productTags: metafield(namespace: "custom", key: "product_tags") { value }
    reviewRating: metafield(namespace: "reviews", key: "rating") { value }
    reviewCount: metafield(namespace: "reviews", key: "rating_count") { value }
    variants(first: 20) {
      edges { node { id availableForSale } }
    }
  }
`;

type ListingNode = {
  handle?: unknown;
  title?: unknown;
  availableForSale?: unknown;
  featuredImage?: {url?: unknown} | null;
  priceRange?: {minVariantPrice?: {amount?: unknown}};
  compareAtPriceRange?: {minVariantPrice?: {amount?: unknown}};
  productTags?: {value?: unknown} | null;
  reviewRating?: {value?: unknown} | null;
  reviewCount?: {value?: unknown} | null;
  variants?: {edges?: {node?: {id?: unknown; availableForSale?: unknown}}[]};
};

/**
 * One node into a card. Exported for its own test.
 *
 * Null for a product missing a handle, a title or a price, exactly as
 * ./products does: one fewer card is better than a card reading "₹NaN".
 */
export const parseListingProduct = (
  node: ListingNode | null | undefined,
): ListingProduct | null => {
  if (!node || typeof node.handle !== 'string' || !node.handle) {
    return null;
  }
  if (typeof node.title !== 'string' || !node.title) {
    return null;
  }
  const price = paiseFromDecimal(node.priceRange?.minVariantPrice?.amount);
  if (price <= 0) {
    return null;
  }
  const compareRaw = paiseFromDecimal(
    node.compareAtPriceRange?.minVariantPrice?.amount,
  );
  const compareAt = compareRaw > price ? compareRaw : null;

  /*
   * The variant the Add to Bag button posts: the first in stock, else the
   * first at all. ./products carries the full argument -- briefly, the theme's
   * own cards do exactly this, so a grid where some buttons add and some
   * navigate would be a divergence the site never had.
   */
  const edges = Array.isArray(node.variants?.edges) ? node.variants.edges : [];
  const nodes = edges.map(edge => edge?.node).filter(Boolean);
  const firstAvailable = nodes.find(v => v?.availableForSale !== false);
  const variantId = numericId((firstAvailable ?? nodes[0])?.id);

  const url = node.featuredImage?.url;
  const count = Number(node.reviewCount?.value);

  return {
    handle: node.handle,
    title: node.title,
    path: `/products/${node.handle}`,
    price,
    compareAt,
    image: typeof url === 'string' && url.startsWith('https://') ? url : null,
    available: node.availableForSale !== false,
    variantId,
    badge: parseBadge(node.productTags?.value),
    rating: parseRating(node.reviewRating?.value),
    ratingCount: Number.isFinite(count) && count > 0 ? count : 0,
  };
};

/** One page of a collection. */
export type ListingPage = {
  /** The collection's own title, for the heading above the grid. */
  readonly title: string;
  /** The cards in this page. */
  readonly products: readonly ListingProduct[];
  /** Cursor for the next page, or null at the end. */
  readonly cursor: string | null;
  readonly hasNextPage: boolean;
};

type CollectionResponse = {
  collection?: {
    title?: unknown;
    products?: {
      edges?: {cursor?: unknown; node?: ListingNode}[];
      pageInfo?: {hasNextPage?: unknown; endCursor?: unknown};
    };
  } | null;
};

const LISTING_QUERY = `
  ${LISTING_FIELDS}
  query Listing(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) {
    collection(handle: $handle) {
      title
      products(
        first: $first
        after: $after
        sortKey: $sortKey
        reverse: $reverse
      ) {
        edges { cursor node { ...ListingCard } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/**
 * How many products a page holds.
 *
 * Shopify caps `first` at 250, and the cost budget makes a large page with this
 * many metafields expensive. 24 is six rows of the two-column grid -- enough
 * that the first screen is full and the customer scrolls before the next
 * request, and small enough that the first paint is quick on a slow connection.
 */
export const PAGE_SIZE = 24;

/**
 * Read one page of a collection.
 *
 * `null` on failure rather than an empty page, so the screen can tell "this
 * collection is empty" from "the request failed" -- one is an empty state and
 * the other is a retry.
 *
 * THE DISCOUNT SORT IS NOT APPLIED HERE. It has no Shopify key, so this asks
 * for the collection's own order and the caller sorts what it holds -- see
 * `sortByDiscount` and the note on SORTS.
 */
export const fetchListingPage = async (
  handle: string,
  sort: SortId,
  after: string | null,
  signal?: AbortSignal,
): Promise<ListingPage | null> => {
  const option = sortById(sort);
  const data = await storefront<CollectionResponse>(
    LISTING_QUERY,
    {
      handle,
      first: PAGE_SIZE,
      after,
      // A null key means the app sorts; ask Shopify for the collection's order.
      sortKey: option.key ?? 'COLLECTION_DEFAULT',
      reverse: option.reverse,
    },
    signal,
  );
  const collection = data?.collection;
  if (!collection) {
    return null;
  }
  const edges = collection.products?.edges;
  const products: ListingProduct[] = [];
  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const product = parseListingProduct(edge?.node);
      if (product) {
        products.push(product);
      }
    }
  }
  const info = collection.products?.pageInfo;
  return {
    title: typeof collection.title === 'string' ? collection.title : '',
    products,
    cursor: typeof info?.endCursor === 'string' ? info.endCursor : null,
    hasNextPage: info?.hasNextPage === true,
  };
};

/**
 * How many products the collection holds, for the "66 Products" line.
 *
 * A separate query, and deliberately: Storefront GraphQL has no total count on
 * a collection's product connection, so the only way to a number is to page
 * through it. This asks for handles alone -- no images, no prices, no
 * metafields -- so the trip is cheap, and it pages until Shopify says there is
 * no more.
 *
 * IT COUNTS EVERY PRODUCT IN THE COLLECTION, in stock or not. Note for whoever
 * compares this against the website: they can differ by the sold-out count.
 * Verified live on 2026-09-09, `/collections/applod` holds 67 products of which
 * one is sold out, and the site's own heading reads "66 Products" -- so the site
 * is counting what is in stock. Counting all of them is what was asked for
 * here, so this screen may read one higher than the web page for the same
 * collection.
 *
 * `null` when it cannot be established, so the screen omits the line rather
 * than printing a number it had to guess. A wrong count under a collection
 * heading is worse than none: it is the kind of small false statement the
 * standing design rule exists to prevent.
 */
const COUNT_QUERY = `
  query ListingCount($handle: String!, $after: String) {
    collection(handle: $handle) {
      products(first: 250, after: $after) {
        edges { node { handle } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/**
 * A ceiling on the paging, so a very large collection cannot spin.
 *
 * Four pages of 250 is 1,000 products; Zigly's largest listing is in the
 * hundreds, so this is headroom rather than a limit anyone should meet. A
 * collection past it returns null and the line is omitted.
 */
const MAX_COUNT_PAGES = 4;

/** The count query's reply, as much of it as the loop below reads. */
type CountResponse = {
  collection?: {
    products?: {
      edges?: unknown[];
      pageInfo?: {hasNextPage?: unknown; endCursor?: unknown};
    };
  } | null;
};

export const fetchCollectionCount = async (
  handle: string,
  signal?: AbortSignal,
): Promise<number | null> => {
  let after: string | null = null;
  let total = 0;
  for (let page = 0; page < MAX_COUNT_PAGES; page++) {
    const data = await storefront<CountResponse>(
      COUNT_QUERY,
      {handle, after},
      signal,
    );
    const products = data?.collection?.products;
    if (!products) {
      return null;
    }
    total += Array.isArray(products.edges) ? products.edges.length : 0;
    if (products.pageInfo?.hasNextPage !== true) {
      return total;
    }
    const next: unknown = products.pageInfo?.endCursor;
    if (typeof next !== 'string' || !next) {
      return total;
    }
    after = next;
  }
  return null;
};

/**
 * A ceiling on one by-handle request.
 *
 * SearchTap pages its own grid, so what the bridge reads is one page of results
 * -- a few dozen. Each handle costs a point of query cost, and Shopify's
 * per-request budget is 1,000, so this is well inside it while still bounding a
 * runaway grid.
 */
const MAX_BY_HANDLE = 100;

/**
 * Read specific products, by handle, in the order asked for.
 *
 * WHAT THIS IS FOR. The filter screen is SearchTap's, so a filtered result set
 * exists only as SearchTap's rendered grid inside the page.
 * ../webview/resultsBridge reads the handles out of it and posts them; this
 * turns them back into cards, so the native grid draws the site's answer with
 * the app's own card. See that file for the whole argument, and the module note
 * above for why the facets cannot simply be asked of Shopify.
 *
 * ONE REQUEST, NOT ONE PER HANDLE. Storefront GraphQL has no "products by
 * handle list" field -- `query:"handle:a OR handle:b"` exists on the `products`
 * connection but is a search, and it does not preserve the order asked for. So
 * the handles are aliased into a single document (`p0: product(handle: …)`),
 * which is one round trip and, verified live 2026-09-09, costs 1 point per
 * handle and returns `null` for a handle that no longer resolves rather than
 * failing the whole query.
 *
 * THE ORDER IS SEARCHTAP'S AND IS PRESERVED. Its grid is in its own relevance
 * order, which is part of the answer the customer filtered for. The reply is
 * re-assembled in the order the handles were given, not the order Shopify
 * happened to return -- which for aliases is the document order anyway, but
 * relying on that would be relying on something unstated.
 *
 * A handle that resolves to nothing is dropped, so a product unpublished
 * between SearchTap rendering and this query costs one card rather than the
 * screen.
 */
export const fetchProductsByHandle = async (
  handles: readonly string[],
  signal?: AbortSignal,
): Promise<ListingProduct[]> => {
  /*
   * Only handles that can safely be an alias and a GraphQL string. A Shopify
   * handle is lowercase alphanumerics and hyphens; anything else did not come
   * from a product URL and is dropped rather than interpolated into a query.
   */
  const safe = handles
    .filter(handle => /^[a-z0-9][a-z0-9-]*$/.test(handle))
    .slice(0, MAX_BY_HANDLE);
  if (!safe.length) {
    return [];
  }

  const fields = safe
    .map(
      (handle, i) => `p${i}: product(handle: "${handle}") { ...ListingCard }`,
    )
    .join('\n      ');

  const data = await storefront<Record<string, ListingNode | null>>(
    `${LISTING_FIELDS}
    query ByHandle {
      ${fields}
    }`,
    {},
    signal,
  );
  if (!data) {
    return [];
  }

  const out: ListingProduct[] = [];
  safe.forEach((_handle, i) => {
    const product = parseListingProduct(data[`p${i}`]);
    if (product) {
      out.push(product);
    }
  });
  return out;
};
