/**
 * Inner-page navigation: a bounded stack of keep-alive layers.
 *
 * Why this exists at all: Zigly's pages carry no cache-control and Cloudflare
 * reports them DYNAMIC, so every navigation refetches the whole document --
 * /pages/dog alone is ~2 MB. The dashboard was already exempt by being kept
 * mounted; every other page was mounted on entry and thrown away on Back, so
 * walking home and tapping the same product again paid for it twice.
 *
 * The fix is not a cache of bytes but a cache of *live views*: a page the user
 * has visited stays mounted, hidden behind whatever is on top, and showing it
 * again is a paint rather than a page load. That is the same trade the dashboard
 * already makes, extended to a small number of inner pages.
 *
 * Two lists, deliberately separate:
 *
 *   layers   the WebViews that exist right now, least-recently-shown first.
 *            Bounded by MAX_LAYERS, because each one is a real Android
 *            renderer and Zigly's pages are not small.
 *   history  the Back stack. Entries point at a layer, or carry `key: null`
 *            once that layer has been evicted -- Back then re-mounts it, which
 *            reloads that one page rather than skipping it silently.
 *
 * So a layer can outlive its place in history (visited, then dismissed: still
 * mounted, so returning is instant) and a history entry can outlive its layer
 * (walked past MAX_LAYERS deep: reloads when reached). Keeping them in one list
 * would have to give up one of those.
 *
 * Pure and dependency-light on purpose: all of it is exercised directly in
 * __tests__/pageStack.test.ts, which is far easier than driving four WebViews.
 */
import {isCheckoutUrl} from '../utils/urlUtils';

/**
 * How many inner-page WebViews may exist at once.
 *
 * Three plus the dashboard. Chosen against memory, not comfort: the renderer
 * for a Shopify product page is tens of megabytes, and Android kills the
 * process rather than the app when it runs short -- which surfaces as
 * onRenderProcessGone, not as a tidy warning.
 */
export const MAX_LAYERS = 3;

/** One mounted inner page. */
export interface PageLayer {
  /** React key and ref identity. The WebView lives exactly as long as this. */
  key: number;
  /**
   * The uri handed to the WebView. Set once at mount and never changed --
   * changing `source` is what makes a WebView reload, which is the whole thing
   * this module exists to avoid.
   */
  source: string;
  /** Where the layer actually is now, tracked from onNavigationStateChange. */
  url: string;
  /** Whether that layer has in-page history left to walk. */
  canGoBack: boolean;
}

/** One step of the Back stack. */
export interface HistoryEntry {
  /** The layer showing this step, or null once it has been evicted. */
  key: number | null;
  /** Kept in step with the layer's live url, so a re-mount lands in the right place. */
  url: string;
}

export interface PageStack {
  layers: PageLayer[];
  history: HistoryEntry[];
  /** Monotonic; a key is never reused, so a stale ref can never match a new layer. */
  nextKey: number;
}

/** No inner pages open: the dashboard is showing. */
export const EMPTY_STACK: PageStack = {layers: [], history: [], nextKey: 1};

/**
 * Whether two urls address the same document.
 *
 * The query string counts -- `/search?q=food` and `/search?q=toys` are
 * different pages -- but a fragment and a trailing slash do not.
 */
export const sameDocument = (a: string, b: string): boolean =>
  bareUrl(a) === bareUrl(b);

const bareUrl = (url: string): string => {
  const hash = url.indexOf('#');
  const bare = hash === -1 ? url : url.slice(0, hash);
  return bare.length > 1 && bare.endsWith('/') ? bare.slice(0, -1) : bare;
};

/** The path, with the query and fragment taken off. */
const pathOf = (url: string): string => bareUrl(url).split('?')[0];

/**
 * The query keys SearchTap writes into the url as the customer sorts and
 * filters, read out of its own `pushSort` / `pushFilters` on 2026-09-06.
 *
 * `sort` and `page` are written by name. Every facet is written under its own
 * heading, which cannot be listed here -- Zigly can add one in the admin any
 * afternoon -- so `facetLike` below tests the SHAPE those take instead.
 */
const SEARCHTAP_QUERY_KEYS = ['sort', 'page', 'q', 'query'];

/**
 * Whether two urls are the same listing page with only its sort or filters
 * changed.
 *
 * WHY THIS EXISTS. SearchTap applies a sort by writing it into the url --
 * `pushSort()` calls `pushRouteToURL()`, which is a history.pushState. Android
 * reports a pushState through onPageStarted exactly as it reports a real
 * navigation, and `sameDocument` says the two urls differ because the query
 * differs. So the app put its cover back over a page the customer was already
 * reading and re-ran the whole injection -- and because a pushState loads no
 * document, nothing ever posted `page-ready` to lift that cover again, so it
 * sat there until the blanket deadline expired.
 *
 * The path must match exactly: this says "the same page, re-sorted", never
 * "some other page". A url that changes anything but these keys is a real
 * navigation and is treated as one.
 */
export const sameListingResults = (a: string, b: string): boolean => {
  if (pathOf(a) !== pathOf(b)) {
    return false;
  }
  if (bareUrl(a) === bareUrl(b)) {
    return false; // Not a rewrite at all; sameDocument already covers it.
  }

  /*
   * Every key whose value differs between the two urls. If they are all
   * SearchTap's, this is its own rewrite of the page already on screen.
   */
  const changed = new Set<string>();
  const read = (url: string): Map<string, string> => {
    const out = new Map<string, string>();
    const query = bareUrl(url).split('?')[1] ?? '';
    if (!query) {
      return out;
    }
    for (const pair of query.split('&')) {
      if (!pair) {
        continue;
      }
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      out.set(
        decodeURIComponent(key).toLowerCase(),
        eq === -1 ? '' : pair.slice(eq + 1),
      );
    }
    return out;
  };

  const before = read(a);
  const after = read(b);
  before.forEach((value, key) => {
    if (after.get(key) !== value) {
      changed.add(key);
    }
  });
  after.forEach((value, key) => {
    if (before.get(key) !== value) {
      changed.add(key);
    }
  });

  if (changed.size === 0) {
    return false;
  }
  /*
   * A facet is written under its own heading, so anything that is not one of
   * the named keys is accepted only when it looks like a facet rather than
   * like a page identity: no path-ish or tracking-ish key gets through.
   */
  const facetLike = (key: string): boolean =>
    key.length > 0 &&
    key.indexOf('/') === -1 &&
    !key.startsWith('utm_') &&
    key !== 'variant' &&
    key !== 'redirect';

  let sawSearchtapKey = false;
  for (const key of changed) {
    if (SEARCHTAP_QUERY_KEYS.indexOf(key) !== -1) {
      sawSearchtapKey = true;
      continue;
    }
    if (!facetLike(key)) {
      return false;
    }
    sawSearchtapKey = true;
  }
  return sawSearchtapKey;
};

/** The layer on top, or null when the dashboard is showing. */
export const visibleLayer = (stack: PageStack): PageLayer | null => {
  const top = stack.history[stack.history.length - 1];
  if (!top || top.key === null) {
    return null;
  }
  return stack.layers.find(layer => layer.key === top.key) ?? null;
};

/** True when no inner page is open. */
export const onDashboard = (stack: PageStack): boolean =>
  stack.history.length === 0;

/** Move a layer to the most-recently-shown end, which is also the paint order. */
const touch = (layers: PageLayer[], key: number): PageLayer[] => {
  const found = layers.find(layer => layer.key === key);
  return found
    ? [...layers.filter(layer => layer.key !== key), found]
    : layers;
};

const mint = (stack: PageStack, url: string): PageLayer => ({
  key: stack.nextKey,
  source: url,
  url,
  canGoBack: false,
});

/**
 * Bring the layer count back inside MAX_LAYERS.
 *
 * Order of sacrifice: first the least-recently-shown layer that Back can no
 * longer reach -- pure cache, losing it costs nothing but a future reload --
 * and only then the oldest step of history, whose entry is left behind with a
 * null key so Back still stops there and re-loads it.
 */
const evict = (
  layers: PageLayer[],
  history: HistoryEntry[],
): {layers: PageLayer[]; history: HistoryEntry[]} => {
  let keptLayers = layers;
  let keptHistory = history;

  while (keptLayers.length > MAX_LAYERS) {
    const top = keptHistory[keptHistory.length - 1];
    const inHistory = new Set(
      keptHistory
        .map(entry => entry.key)
        .filter((key): key is number => key !== null),
    );

    const victim =
      keptLayers.find(layer => !inHistory.has(layer.key)) ??
      keptLayers.find(layer => layer.key !== (top ? top.key : null));
    if (!victim) {
      // Only the visible layer is left; MAX_LAYERS cannot be honoured below 1.
      break;
    }

    keptLayers = keptLayers.filter(layer => layer.key !== victim.key);
    keptHistory = keptHistory.map(entry =>
      entry.key === victim.key ? {key: null, url: entry.url} : entry,
    );
  }

  return {layers: keptLayers, history: keptHistory};
};

/**
 * Show `url` as an inner page.
 *
 * A page still mounted from an earlier visit is re-shown rather than reloaded.
 * If it is also still in history, the stack collapses back to it instead of
 * stacking a second copy -- the same thing a browser does, and what stops a
 * ring of cross-linked pages growing the stack without bound.
 */
export const openPage = (stack: PageStack, url: string): PageStack => {
  const showing = visibleLayer(stack);
  if (showing && sameDocument(showing.url, url)) {
    return stack;
  }

  const cached = stack.layers.find(layer => sameDocument(layer.url, url));
  if (cached) {
    const at = stack.history.findIndex(entry => entry.key === cached.key);
    return {
      ...stack,
      layers: touch(stack.layers, cached.key),
      history:
        at === -1
          ? [...stack.history, {key: cached.key, url: cached.url}]
          : stack.history.slice(0, at + 1),
    };
  }

  const layer = mint(stack, url);
  const pruned = evict(
    [...stack.layers, layer],
    [...stack.history, {key: layer.key, url}],
  );
  return {...pruned, nextKey: stack.nextKey + 1};
};

/**
 * Step Back out of the top page.
 *
 * The page being left stays mounted, so returning to it is instant; it simply
 * becomes the first candidate for eviction. Checkout is the exception -- a
 * half-finished payment page restored from a cache would be showing a session
 * that has moved on, so those are torn down on the way out.
 */
export const closeTopPage = (stack: PageStack): PageStack => {
  const top = stack.history[stack.history.length - 1];
  if (!top) {
    return stack;
  }

  const layers = isCheckoutUrl(top.url)
    ? stack.layers.filter(layer => layer.key !== top.key)
    : stack.layers;
  const history = stack.history.slice(0, -1);

  const next = history[history.length - 1];
  if (!next) {
    return {...stack, layers, history};
  }
  if (next.key !== null) {
    return {...stack, layers: touch(layers, next.key), history};
  }

  // Its layer was evicted while the user was deeper in. Mount it again --
  // this is the one case where Back costs a page load.
  const layer = mint(stack, next.url);
  const pruned = evict(
    [...layers, layer],
    [...history.slice(0, -1), {key: layer.key, url: next.url}],
  );
  return {...pruned, nextKey: stack.nextKey + 1};
};

/**
 * Back to the dashboard in one step, keeping every page mounted so that
 * re-opening one is a paint. Checkout layers are dropped, as in closeTopPage.
 */
export const goToDashboard = (stack: PageStack): PageStack => {
  if (onDashboard(stack)) {
    return stack;
  }
  return {
    ...stack,
    layers: stack.layers.filter(layer => !isCheckoutUrl(layer.url)),
    history: [],
  };
};

/**
 * Record where a layer has navigated to in place.
 *
 * The history entry follows the layer, so if that layer is later evicted, Back
 * re-loads the page the user was actually looking at rather than the one they
 * entered by.
 */
export const noteNavigation = (
  stack: PageStack,
  key: number,
  url: string,
  canGoBack: boolean,
): PageStack => {
  const layer = stack.layers.find(candidate => candidate.key === key);
  if (!layer || (layer.url === url && layer.canGoBack === canGoBack)) {
    return stack;
  }
  return {
    ...stack,
    layers: stack.layers.map(candidate =>
      candidate.key === key ? {...candidate, url, canGoBack} : candidate,
    ),
    history: stack.history.map(entry =>
      entry.key === key ? {...entry, url} : entry,
    ),
  };
};
