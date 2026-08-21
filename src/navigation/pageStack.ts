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
