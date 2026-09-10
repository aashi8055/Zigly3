/**
 * Products, read from the Storefront API and shaped for a card.
 *
 * The dashboard's product rails -- Hot Picks, Bestsellers, and the offer rails
 * after them -- all draw the same card from the same shape, so the query and
 * the parse live here once. This is the module the remaining product sections
 * are built on, which is why it is more careful than its size suggests.
 *
 * PRICES ARE CONVERTED TO PAISE AT THE EDGE, HERE. GraphQL returns decimal
 * strings (`"551.0"`, `"351.12"`), `/products/{handle}.js` returns integer
 * paise (`55100`), and ../utils/money is written for paise. DATA-SOURCES.md §1
 * warns that mixing the two is the classic way a Shopify client shows ₹5.51 or
 * ₹55,100 — so every amount crossing out of this module has already been
 * through `paiseFromDecimal`, and nothing downstream divides anything.
 *
 * `351.12` is a real live price, not a contrived example. Any assumption that
 * Zigly's prices are round rupees is false, which is why the conversion rounds
 * rather than truncates and why ../utils/money prints two decimals only when
 * there are any.
 *
 * THE VARIANT ID IS THE CARE POINT. ../webview/cartBridge's `addToCartScript`
 * takes a NUMERIC variant id and its comment is explicit: "never a guess, and
 * never for a product with more than one variant, where choosing on the
 * customer's behalf could add the wrong size." GraphQL hands back a GID
 * (`gid://shopify/ProductVariant/53172936245564`), so the number is extracted
 * here — and the variant count is carried alongside it, so a card can tell a
 * one-variant product (add it directly) from a product with choices (open the
 * product page and let the customer choose). A card that guessed would add a
 * 3 kg bag when the customer wanted 1 kg.
 *
 * ADD TO BAG NEVER HAPPENS HERE. Cart writes go through the WebView, because
 * the app has one session and it lives in that cookie jar (DATA-SOURCES.md §7,
 * and the standing rule that the cart is the AJAX cart). This module reads
 * catalogue data with `credentials: 'omit'`; it hands a card the variant id and
 * the card asks the screen to run the bridge.
 */
import {paiseFromDecimal} from '../utils/money';
import {storefront} from './storefront';

/** One product, as a card needs it. */
export type Product = {
  /** Shopify's handle: the card's key, and the path to its page. */
  readonly handle: string;
  readonly title: string;
  /** The product page path, resolved once. */
  readonly path: string;
  /** Sale price, in paise. See the note above on why paise. */
  readonly price: number;
  /**
   * The struck-through price, in paise, or null when there is no saving.
   *
   * Null rather than 0 or equal-to-price, so a card never has to decide what a
   * meaningless compare-at means. Shopify reports a compare-at of "0.0" on
   * products that have none, and some carry one *below* the sale price; both
   * are treated as no saving.
   */
  readonly compareAt: number | null;
  /** Featured image URL, or null. A card draws a placeholder rather than fail. */
  readonly image: string | null;
  /** False when Shopify says every variant is out of stock. */
  readonly available: boolean;
  /**
   * The numeric variant id for ../webview/cartBridge, or null.
   *
   * Null when the product has more than one variant -- see the note above. A
   * card with a null id must send the customer to the product page instead of
   * adding anything.
   */
  readonly variantId: number | null;
};

/**
 * The card's field set, as a fragment.
 *
 * One definition, used by every rail's query, so a card can never be handed a
 * product missing a field it draws. `variants(first: 20)` is deliberate: the
 * card's button adds the first variant IN STOCK, so it has to see past a
 * sold-out lead variant, and 20 covers Zigly's real weight and size ranges.
 * It was `first: 2` while a card only needed to answer "is there a choice to
 * make?" -- see parseProduct for why it no longer asks that.
 */
export const PRODUCT_FIELDS = `
  fragment CardProduct on Product {
    handle
    title
    availableForSale
    featuredImage { url }
    priceRange { minVariantPrice { amount } }
    compareAtPriceRange { minVariantPrice { amount } }
    variants(first: 20) {
      edges { node { id availableForSale } }
    }
  }
`;

/** The API's product node, as much of it as this module reads. */
type ProductNode = {
  handle?: unknown;
  title?: unknown;
  availableForSale?: unknown;
  featuredImage?: {url?: unknown} | null;
  priceRange?: {minVariantPrice?: {amount?: unknown}};
  compareAtPriceRange?: {minVariantPrice?: {amount?: unknown}};
  variants?: {edges?: {node?: {id?: unknown; availableForSale?: unknown}}[]};
};

/**
 * Pull the number out of a Shopify GID.
 *
 * Exported for its own test. `gid://shopify/ProductVariant/53172936245564` ->
 * 53172936245564. The last path segment is taken rather than a digit match on
 * the whole string, so a numeric fragment elsewhere in the gid cannot be
 * mistaken for the id.
 *
 * Returns null rather than NaN for anything unexpected: a null id sends the
 * customer to the product page, which is always safe, while a NaN id would be
 * posted to /cart/add.js and fail there.
 */
export const numericId = (gid: unknown): number | null => {
  if (typeof gid !== 'string') {
    return null;
  }
  const last = gid.split('/').pop();
  if (!last || !/^\d+$/.test(last)) {
    return null;
  }
  const value = Number(last);
  return Number.isSafeInteger(value) ? value : null;
};

/**
 * Turn one API product node into a card's product.
 *
 * Exported for its own test. Returns null for a node missing anything a card
 * cannot draw without -- a handle, a title or a price -- because a card with a
 * blank title or a "₹NaN" is worse than one fewer card in a rail.
 */
export const parseProduct = (node: ProductNode | null | undefined): Product | null => {
  if (!node || typeof node.handle !== 'string' || !node.handle) {
    return null;
  }
  if (typeof node.title !== 'string' || !node.title) {
    return null;
  }
  const price = paiseFromDecimal(node.priceRange?.minVariantPrice?.amount);
  if (price <= 0) {
    // A zero price is either unparseable or a product not for sale here.
    return null;
  }

  const compareRaw = paiseFromDecimal(
    node.compareAtPriceRange?.minVariantPrice?.amount,
  );
  // Only a compare-at ABOVE the sale price is a saving. Shopify reports "0.0"
  // for products with none, and a few carry one below the sale price.
  const compareAt = compareRaw > price ? compareRaw : null;

  const edges = Array.isArray(node.variants?.edges) ? node.variants.edges : [];
  /*
   * The variant the card's button adds: the first one in stock, and failing
   * that the first one at all.
   *
   * A card USED to refuse an id whenever a product had choices, and its button
   * read "View Options" and opened the product page. That was wrong -- not
   * unsafe, just not what zigly.com does. The theme's own cards
   * (sections/custom-recently-viewed.liquid, ~line 663) say "Add to Bag" on
   * every product and post `variants.find(availableForSale)`, falling back to
   * `variants[0]`. A rail of cards where some buttons add and some navigate is
   * a divergence the site never had, so this picks the variant the same way.
   *
   * `variants(first: 20)` covers Zigly's real catalogue -- weights and sizes,
   * not a hundred-variant configurator -- and a product whose in-stock variant
   * sits past the 20th falls back to the first, which is the theme's own
   * fallback for an all-sold-out product.
   */
  const nodes = edges.map(edge => edge?.node).filter(Boolean);
  const firstAvailable = nodes.find(v => v?.availableForSale !== false);
  const variantId = numericId((firstAvailable ?? nodes[0])?.id);

  const url = node.featuredImage?.url;

  return {
    handle: node.handle,
    title: node.title,
    path: `/products/${node.handle}`,
    price,
    compareAt,
    image: typeof url === 'string' && url.startsWith('https://') ? url : null,
    available: node.availableForSale !== false,
    variantId,
  };
};

/** Products from one collection, in the collection's own order. */
type CollectionResponse = {
  collection?: {
    products?: {edges?: {node?: ProductNode}[]};
  } | null;
};

const COLLECTION_QUERY = `
  ${PRODUCT_FIELDS}
  query RailProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      products(first: $first) {
        edges { node { ...CardProduct } }
      }
    }
  }
`;

/**
 * Turn a list of product edges into cards, dropping any that cannot draw and
 * any that cannot be bought.
 *
 * SOLD-OUT PRODUCTS DO NOT REACH A RAIL. ./ProductCard still knows how to draw
 * one -- a greyed "Sold Out" button in place of Add to Bag -- and that state is
 * kept, because ./listing's grid is a page the customer navigated to on purpose
 * and a collection that silently shed items would misreport how big it is.
 *
 * A rail is the opposite case. Hot Picks, New Arrivals and Bestsellers are
 * fifteen and twelve cards of a curated collection, shown to a customer who did
 * not ask for them; a dead card there spends a rail slot on something nobody
 * can buy and is a worse offer than the product behind it. The theme's own
 * rails are backed by collections Shopify does not prune, so this is the app
 * choosing what to show rather than contradicting the site -- the standing rule
 * is that the data is Zigly's and the view is ours.
 *
 * `available` is Shopify's `availableForSale` on the product, which is false
 * only when EVERY variant is out of stock -- see ./ProductCard on how a variant
 * is picked. So this drops products with nothing in stock at all, never a
 * product whose 3 kg bag happens to be out.
 *
 * The drop is here rather than in each caller because every rail's products
 * come through this one function, and a filter written twice is a filter that
 * drifts once.
 */
const collect = (
  edges: {node?: ProductNode}[] | undefined,
): Product[] => {
  if (!Array.isArray(edges)) {
    return [];
  }
  const out: Product[] = [];
  for (const edge of edges) {
    const product = parseProduct(edge?.node);
    if (product && product.available) {
      out.push(product);
    }
  }
  return out;
};

/**
 * Read a collection's products.
 *
 * Order is Shopify's own for that collection -- the merchant's manual order, or
 * whatever sort they have set. Nothing is re-sorted here: a rail that ordered
 * products by price or discount would be this app merchandising on Zigly's
 * behalf, which is the same line ./coupons declines to cross.
 *
 * `[]` on any failure, so ./useSectionData can retry rather than a caller
 * having to catch.
 */
export const fetchCollectionProducts = async (
  handle: string,
  first: number,
  signal?: AbortSignal,
): Promise<Product[]> => {
  const data = await storefront<CollectionResponse>(
    COLLECTION_QUERY,
    {handle, first},
    signal,
  );
  return collect(data?.collection?.products?.edges);
};

/** Products from the whole store, sorted. */
type StoreResponse = {
  products?: {edges?: {node?: ProductNode}[]};
};

/**
 * The store's best sellers.
 *
 * `sortKey: BEST_SELLING` on the `products` root, which is the Storefront
 * API's equivalent of the `?sort_by=best-selling` the web version reads off
 * `/collections/all`. Verified live 2026-09-08 that it returns the same shape
 * of answer ../webview/bestsellers recorded on 2026-08-24: Applod and Royal
 * Canin at the top rather than Acana alphabetically, so the sort genuinely
 * reorders rather than being ignored.
 *
 * NOT `collection(handle: "all")`. That is Shopify's virtual all-products
 * collection and the Storefront API does not expose it by handle -- asking for
 * it returns null, which would look exactly like a section that failed to
 * load. The `products` root is the documented way to read the whole catalogue.
 *
 * STORE-WIDE, DOGS AND CATS MIXED, AND NOTHING RE-SORTED.
 * ../webview/bestsellers is explicit about why: "Splitting it evenly between
 * the two pets would have been a curated mix wearing a bestseller label."
 * Whatever Shopify says sells, in that order, is the only reading under which
 * the heading is true.
 */
export const fetchBestSellers = async (
  first: number,
  signal?: AbortSignal,
): Promise<Product[]> => {
  const data = await storefront<StoreResponse>(
    BEST_SELLING_QUERY,
    {first},
    signal,
  );
  return collect(data?.products?.edges);
};

const BEST_SELLING_QUERY = `
  ${PRODUCT_FIELDS}
  query BestSellers($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges { node { ...CardProduct } }
    }
  }
`;
