/**
 * Reading the wishlist reply.
 *
 * Every field here came from `/products/{handle}.js`, so prices are already
 * integer paise and need no conversion — unlike the search suggestions, which
 * arrive as decimal strings. The only defensive work is dropping rows that are
 * missing something a tile needs, so a half-known product never renders.
 */

/** One choice on a product that has them, as the picker draws it. */
export interface WishlistVariant {
  id: number;
  /** Shopify's own label -- "M", "1 kg". Never composed by this app. */
  title: string;
  /** Paise, like every other price from this endpoint. */
  price: number;
  available: boolean;
}

export interface WishlistItem {
  handle: string;
  title: string;
  /** Absolute. The reply carries a storefront path. */
  url: string;
  image: string | null;
  /** Paise. */
  price: number;
  /** Paise, or null when there is no "was" price to strike through. */
  compareAt: number | null;
  available: boolean;
  /**
   * The variant to add, or null when the product has more than one.
   *
   * Null is not "cannot be added" any more — it means "ask first". The
   * standing rule is unchanged: this app never picks a size on the customer's
   * behalf, because adding a 3 kg bag when they wanted 1 kg is worse than an
   * extra tap. What changed is where the asking happens — a picker on the
   * wishlist itself (../components/VariantSheet) rather than a trip to the
   * product page. See `variants`.
   */
  variantId: number | null;
  /**
   * The choices, when there are any; empty when there is nothing to choose.
   *
   * Empty for a one-variant product (`variantId` already says what to add) and
   * empty when the reply carried no usable variant rows — a product whose
   * choices could not be read falls back to opening its page, which is the one
   * answer that is always right.
   *
   * Capped by the bridge at WISHLIST_VARIANT_LIMIT, so this is not necessarily
   * every variant a product has. The picker says so rather than implying the
   * list is complete.
   */
  variants: readonly WishlistVariant[];
}

export interface Wishlist {
  items: WishlistItem[];
  /**
   * Which container the page was read from: 'swym', 'main' or 'none'. Reported
   * so a device run confirms the root instead of leaving it assumed.
   */
  root: string;
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Shopify serves protocol-relative image urls; Android will not load those. */
export const httpsUrl = (raw: string): string =>
  raw.indexOf('//') === 0 ? 'https:' + raw : raw;

/** One shared empty list, so an item with no choices allocates nothing. */
const EMPTY_VARIANTS: readonly WishlistVariant[] = Object.freeze([]);

/**
 * The variant rows, dropping any that could not furnish a whole row.
 *
 * A choice with no id cannot be added and a choice with no label cannot be
 * described, so either one missing means the row is not shown — the same
 * discipline parseItem applies to a half-known product. A price of 0 is
 * dropped for the same reason a product's is: a picker offering a size at no
 * price is worse than one fewer row.
 *
 * Returns a frozen empty array for anything that is not a list, so callers
 * never have to distinguish "no variants" from "no reply".
 */
const parseVariants = (raw: unknown): readonly WishlistVariant[] => {
  if (!Array.isArray(raw)) {
    return EMPTY_VARIANTS;
  }
  const out: WishlistVariant[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const id = row.id;
    const title = asString(row.title);
    const price = asNumber(row.price);
    if (typeof id !== 'number' || !Number.isFinite(id) || !title || price <= 0) {
      continue;
    }
    out.push({
      id,
      title,
      price,
      available: row.available !== false,
    });
  }
  return out.length > 0 ? out : EMPTY_VARIANTS;
};

const parseItem = (raw: unknown, origin: string): WishlistItem | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const handle = asString(row.handle);
  const title = asString(row.title);
  const price = asNumber(row.price);
  // No handle, no title or no price means the product fetch came back partial;
  // a tile with a blank price is worse than one fewer tile.
  if (!handle || !title || price <= 0) {
    return null;
  }

  const compareAt = asNumber(row.compareAt);
  const image = asString(row.image);
  const url = asString(row.url) || '/products/' + handle;

  return {
    handle,
    title,
    url: url.indexOf('http') === 0 ? url : origin + url,
    image: image ? httpsUrl(image) : null,
    price,
    compareAt: compareAt > price ? compareAt : null,
    available: row.available !== false,
    variantId:
      typeof row.variantId === 'number' && row.variantCount === 1
        ? row.variantId
        : null,
    variants: parseVariants(row.variants),
  };
};

/**
 * Read one `wishlist` message. A malformed payload becomes an empty wishlist
 * rather than a crash — the screen then shows the empty state, which is at
 * worst a wrong "nothing saved" and never a broken screen.
 */
export const parseWishlist = (
  message: Record<string, unknown>,
  origin: string,
): Wishlist => {
  const raw = Array.isArray(message.items) ? message.items : [];
  const items: WishlistItem[] = [];
  for (const row of raw) {
    const item = parseItem(row, origin);
    if (item) {
      items.push(item);
    }
  }
  return {items, root: asString(message.root) || 'none'};
};
