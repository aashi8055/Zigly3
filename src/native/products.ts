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
 * product missing a field it draws. `variants(first: 2)` is deliberate: two is
 * all that is needed to answer "is there a choice to make?", and asking for
 * more would pull data no card reads.
 */
export const PRODUCT_FIELDS = `
  fragment CardProduct on Product {
    handle
    title
    availableForSale
    featuredImage { url }
    priceRange { minVariantPrice { amount } }
    compareAtPriceRange { minVariantPrice { amount } }
    variants(first: 2) {
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
   * One variant means the card may add it; two or more means it must not.
   * `variants(first: 2)` caps the list at two, so "length > 1" reads as "there
   * is a choice to make" rather than as an exact count.
   */
  const variantId = edges.length === 1 ? numericId(edges[0]?.node?.id) : null;

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
  const edges = data?.collection?.products?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  const out: Product[] = [];
  for (const edge of edges) {
    const product = parseProduct(edge?.node);
    if (product) {
      out.push(product);
    }
  }
  return out;
};
