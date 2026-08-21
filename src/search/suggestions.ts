/**
 * Turning a suggest.json reply into something the search screen can draw.
 *
 * Defensive by design: this parses a third-party payload that arrives over a
 * string bridge, so every field is checked rather than trusted. A malformed row
 * is dropped, never rendered half-drawn — and a malformed *reply* becomes an
 * empty result set, not a crash on a screen the user is typing into.
 */
import {paiseFromDecimal} from '../utils/money';

export interface ProductHit {
  id: number;
  title: string;
  /** Absolute; suggest.json returns paths, carrying its own analytics params. */
  url: string;
  image: string | null;
  /** Paise, converted at this boundary. See utils/money.ts. */
  price: number;
  /** Paise, or null when there is no "was" price to strike through. */
  compareAt: number | null;
  vendor: string;
  available: boolean;
}

export interface QueryHit {
  text: string;
  url: string;
}

export interface CollectionHit {
  title: string;
  url: string;
}

export interface Suggestions {
  /** The query these results answer, so a stale set can be spotted. */
  query: string;
  products: ProductHit[];
  queries: QueryHit[];
  collections: CollectionHit[];
}

/** How many recent searches are kept. */
export const MAX_RECENTS = 8;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** Absolute-ise a storefront path, leaving an already-absolute url alone. */
export const absoluteUrl = (origin: string, path: string): string =>
  path.indexOf('http') === 0 ? path : origin + path;

const parseProduct = (raw: unknown, origin: string): ProductHit | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const title = asString(row.title);
  const url = asString(row.url);
  if (!title || !url) {
    return null;
  }

  const price = paiseFromDecimal(row.price);
  // The reference app's baseline filter requires a price above zero. A
  // zero-price row here means an unpriced or misconfigured product, and tapping
  // one is a dead end.
  if (price <= 0) {
    return null;
  }

  const compareAt = paiseFromDecimal(row.compareAt);
  const image = asString(row.image);

  return {
    id: typeof row.id === 'number' ? row.id : 0,
    title,
    url: absoluteUrl(origin, url),
    image: image ? image : null,
    price,
    compareAt: compareAt > price ? compareAt : null,
    vendor: asString(row.vendor),
    available: row.available !== false,
  };
};

const parseQuery = (raw: unknown, origin: string): QueryHit | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const text = asString(row.text);
  const url = asString(row.url);
  return text && url ? {text, url: absoluteUrl(origin, url)} : null;
};

const parseCollection = (raw: unknown, origin: string): CollectionHit | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const title = asString(row.title);
  const url = asString(row.url);
  return title && url ? {title, url: absoluteUrl(origin, url)} : null;
};

const parseList = <T>(
  raw: unknown,
  parse: (row: unknown) => T | null,
): T[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: T[] = [];
  for (const row of raw) {
    const parsed = parse(row);
    if (parsed) {
      out.push(parsed);
    }
  }
  return out;
};

/**
 * Read one `search-suggest` message. Returns an empty result set for an error
 * reply or a malformed payload — the screen then offers the site's own search,
 * which is the honest fallback when our fast path has nothing.
 */
export const parseSuggestions = (
  message: Record<string, unknown>,
  origin: string,
): Suggestions => {
  const query = asString(message.q);
  if (message.error === true) {
    return {query, products: [], queries: [], collections: []};
  }
  return {
    query,
    products: parseList(message.products, row => parseProduct(row, origin)),
    queries: parseList(message.queries, row => parseQuery(row, origin)),
    collections: parseList(message.collections, row =>
      parseCollection(row, origin),
    ),
  };
};

/** True when a result set has nothing at all to show. */
export const isEmpty = (suggestions: Suggestions): boolean =>
  suggestions.products.length === 0 &&
  suggestions.queries.length === 0 &&
  suggestions.collections.length === 0;

/**
 * Add a search to the recents list: most recent first, no case-insensitive
 * duplicates, capped. Returns the list unchanged for a blank query.
 */
export const rememberSearch = (recents: string[], query: string): string[] => {
  const term = query.trim();
  if (!term) {
    return recents;
  }
  const fold = term.toLowerCase();
  return [term, ...recents.filter(past => past.toLowerCase() !== fold)].slice(
    0,
    MAX_RECENTS,
  );
};
