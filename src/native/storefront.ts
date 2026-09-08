/**
 * The Storefront GraphQL client: one query, one place.
 *
 * This is the data path chosen for the native dashboard, and DATA-SOURCES.md §2
 * gives the reason -- one round trip returns a collection with its variants,
 * images, availability and metafields, and it paginates by cursor rather than
 * by page number. The alternative, `?sections=`, returns the theme's rendered
 * HTML, which is the right tool when the goal is markup that cannot drift from
 * the site (./categoryIcons and ./bannerSlides both still use it, because what
 * they need *is* the rendered output). It is the wrong tool for data: the
 * bestsellers rail is 585 KB of HTML for twenty-two products.
 *
 * THE TOKEN IS PUBLIC, AND THAT IS NOT A LOOSE END. It is served in
 * `assets/searchtap.js` and in the homepage's own inline JS, because a
 * Storefront access token is designed to ship to browsers: read-only, scoped by
 * the app that issued it, and unable to reach a customer's account or an admin
 * resource. DATA-SOURCES.md §2 records both tokens found on the site and that
 * both answer. This uses the searchtap one.
 *
 * PRICES ARE DECIMAL HERE, NOT PAISE. Verified live 2026-09-08: a product that
 * `/products.json` reports as `price: 51300` comes back from GraphQL as
 * `"amount": "513.0"`. DATA-SOURCES.md §1's "divide by 100 exactly once" rule
 * is about the AJAX API and applying it to a GraphQL amount is a hundredfold
 * error. ../utils/money is where that conversion belongs; nothing here divides
 * anything.
 *
 * NO COOKIES, EVER. `credentials: 'omit'` on every call. DATA-SOURCES.md §7 is
 * explicit that the app has one session and it lives in the WebView's cookie
 * jar; a request from here that carried cookies would be a second session that
 * reads a different cart. Everything this client is used for is public
 * catalogue data, so there is nothing it needs a session for.
 */
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {warn} from '../utils/logger';

/**
 * The API version, pinned.
 *
 * Shopify supports each version for a year and removes fields only across a
 * version boundary, so a pinned version is a schema this app can rely on. An
 * unpinned `/api/graphql.json` would follow the newest release and could change
 * a response shape between one launch and the next.
 */
const API_VERSION = '2025-01';

/** Public Storefront token, as served in the theme's own `searchtap.js`. */
const TOKEN = '2d415fee375ed51500407e19f4c6c49a';

const ENDPOINT = `${ZIGLY_ORIGIN}/api/${API_VERSION}/graphql.json`;

/**
 * How long a dashboard section waits for data.
 *
 * `fetch` in React Native has no timeout of its own: a request made as the
 * radio comes up on a cold start can sit unresolved for as long as the OS
 * allows, and the section above it would hold its placeholder the whole time.
 * Eight seconds is longer than any of these queries needs and shorter than the
 * splash's own patience, so a stalled request becomes a retry rather than a
 * wait.
 */
const TIMEOUT_MS = 8000;

export type GraphQLResult<T> = {
  /** The payload, or null when the request or the query failed. */
  data: T | null;
};

/**
 * Run one query.
 *
 * Never throws. Every caller is a dashboard section whose job on failure is to
 * show what it has and retry, so an exception here would only ever be caught
 * and turned back into `null` -- see ./useSectionData, which treats a null and
 * an empty result the same way.
 *
 * @param query     The GraphQL document.
 * @param variables Its variables, if any.
 * @param signal    Aborted when the section unmounts.
 */
export const storefront = async <T,>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T | null> => {
  /**
   * Two reasons to give up, joined.
   *
   * The caller's signal fires when the screen goes away; the timeout fires when
   * the network stops answering. `AbortSignal.any` is not available in every
   * Hermes build this ships to, so the two are linked by hand.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const relay = () => controller.abort();
  signal?.addEventListener('abort', relay);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({query, variables: variables || {}}),
      signal: controller.signal,
    });
    if (!res.ok) {
      warn('storefront', res.status);
      return null;
    }
    const body = (await res.json()) as {
      data?: T;
      errors?: {message?: string}[];
    };
    /**
     * A GraphQL error arrives with HTTP 200.
     *
     * `errors` alongside a partial `data` is the shape that would otherwise slip
     * through: the request succeeded, the response parsed, and a field the
     * caller needs is quietly absent. Logged and treated as a failure, so a
     * section retries rather than drawing half of itself.
     */
    if (body.errors?.length) {
      warn('storefront errors:', body.errors.map(e => e.message).join('; '));
      return null;
    }
    return body.data ?? null;
  } catch (e) {
    // An abort is the screen leaving or the timeout firing, not a fault.
    if (!controller.signal.aborted) {
      warn('storefront unreachable:', e);
    }
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relay);
  }
};

/**
 * A metaobject's fields, flattened.
 *
 * The API returns `fields: [{key, value}]`, which is faithful to the schema and
 * awkward to read. Every caller wants `fields.discount_code`, so the shape is
 * turned once here rather than at each use.
 */
export type MetaobjectFields = Record<string, string>;

export const flattenFields = (
  fields: {key?: unknown; value?: unknown}[] | undefined | null,
): MetaobjectFields => {
  const out: MetaobjectFields = {};
  if (!Array.isArray(fields)) {
    return out;
  }
  for (const field of fields) {
    if (typeof field?.key === 'string' && typeof field?.value === 'string') {
      out[field.key] = field.value;
    }
  }
  return out;
};
