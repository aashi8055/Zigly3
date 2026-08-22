/**
 * Reading the wishlist reply.
 *
 * Every field here came from `/products/{handle}.js`, so prices are already
 * integer paise and need no conversion — unlike the search suggestions, which
 * arrive as decimal strings. The only defensive work is dropping rows that are
 * missing something a tile needs, so a half-known product never renders.
 */

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
   * The variant to add, or null when the product has more than one. With
   * several, the app opens the product page rather than picking for the
   * customer — adding the wrong size is worse than one extra tap.
   */
  variantId: number | null;
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
