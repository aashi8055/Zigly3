/**
 * Ask for the dashboard's sections while the homepage is still downloading.
 *
 * THE PROBLEM THIS SOLVES. `injectedJavaScript` runs when the document has
 * finished loading. Every module that builds the dashboard lives in that
 * payload, so every section fetch -- including the four the splash is actually
 * waiting on -- began its round trip only *after* the whole ~2 MB homepage had
 * arrived. Two costs stacked end to end that have no reason to be sequential:
 * the Section Rendering API is a plain `fetch` against the same origin and
 * needs no DOM at all.
 *
 * So this runs at document-start instead, and issues one batched request for
 * the sections above the fold. The page download and the section download now
 * overlap, and by the time ./pageCache is installed the answers are usually
 * already in hand -- it consults `window.__ziglySectionPrewarm` before queueing
 * anything of its own.
 *
 * NOTHING IS CACHED ACROSS LAUNCHES HERE, and that is deliberate. ./pageCache
 * is explicit that only section *ids* are ever kept on the device, never the
 * markup, because the markup carries prices and stock. This does not weaken
 * that: the request is the same request the page would have made anyway, just
 * issued a few hundred milliseconds earlier in the same page view. Earlier is
 * fresher, never staler.
 *
 * A MISS COSTS NOTHING. The ids are the same hints ./pageCache uses, so a theme
 * re-save makes them stale here exactly as it does there. A stale id returns
 * nothing, ./pageCache notices and falls back to its ordinary discovery path,
 * and the dashboard is built the way it always was -- one wasted request slower.
 */
import {SEEDED_IDS} from './pageCache';
import type {SectionIds} from './sectionIdStore';

/**
 * The sections the splash is actually blocked on.
 *
 * Read straight off `homeReady` in ./readySignal, which is the definition of
 * "the dashboard has assembled": the category rail (./homeLayout), the coupon
 * strip (the one eager entry in ./extraSections) and the dog breed rail
 * (./breedSection). The cat rail rides along because ./breedSection fills both
 * slots in the same pass, so it is in flight either way and costs nothing extra
 * to batch here.
 *
 * Four, which is inside Shopify's limit of five section ids per request -- so
 * this is exactly ONE round trip. Adding a fifth entry is still free; a sixth
 * would silently become a second request, which is the thing this exists to
 * avoid.
 */
const CRITICAL_KEYS = [
  '/|home_category_section',
  '/|coupon_slider',
  '/|home_shop_by_breed_section@dog',
  '/|home_shop_by_breed_section@cat',
];

/**
 * The rest of the dashboard, warmed once it is on screen and settled.
 *
 * These are the sections ./extraSections, ./everythingSection and
 * ./explorePicker defer until they near the viewport -- which is right for
 * first paint and is also why scrolling the dashboard used to start a fresh
 * round trip under the customer's thumb. Warming them after `dashboard-ready`
 * puts the markup in ./pageCache's own `sectionCache`, so when the deferred
 * loader does run it finds a resolved promise and places the section with no
 * network at all.
 *
 * Placement is untouched: this only calls the fetcher, never the code that
 * inserts anything. The sections still appear exactly where and when their own
 * modules decide.
 *
 * Listed rather than derived from SEEDED_IDS because not every seeded id is a
 * section this dashboard builds -- `video_swiper` is seeded and deliberately
 * unused (./extraSections moves `custom_video_text_banner` instead), and
 * warming it would spend a request on markup nobody places.
 */
const BELOW_FOLD_FRAGMENTS = [
  'offer_section#1',
  'offer_section#2',
  'best_deals',
  'shop_by_price',
  'custom_single_banner#2',
  'shop_of_concern',
  'offer_section#3',
  'redesign_custom_double_banner',
  'everything@dog',
  'everything@cat',
  'explore_product@dog',
  'explore_product@cat',
];

/**
 * The whole pages the dashboard still has to fetch, warmed after the sections.
 *
 * ./hotPicks builds its two tabs out of real product cards lifted from these
 * collections, and it takes the whole page for each because a collection has no
 * single named section to ask the Section Rendering API for. That makes them the
 * heaviest deferred loads on the dashboard by a wide margin -- which is why they
 * are warmed strictly *after* the section batch above rather than alongside it.
 *
 * Warmed through ./pageCache's own document cache, which is keyed by path, so a
 * page the dashboard has already asked for is not fetched twice.
 */
const BELOW_FOLD_DOCS = [
  '/collections/hot-picks-squeaker-toys',
  '/collections/hot-deals',
];

/**
 * Hosts worth a handshake before anything asks them for bytes.
 *
 * Every image on the dashboard comes from Shopify's CDN, and the first request
 * to it pays DNS, TCP and TLS before a single byte of image moves. Starting
 * that at document-start means the connection is already open when the parser
 * reaches the first `<img>`.
 */
const PRECONNECT_HOSTS = ['https://cdn.shopify.com'];

/**
 * The document-start payload.
 *
 * Built with the ids this app knows: the written-down seeds, with anything
 * earlier launches learned laid over the top (see ./sectionIdStore). The
 * learned map arrives from disk asynchronously, so the copy compiled into the
 * first navigation is seeds-only and the app re-injects a fuller one on
 * `onLoadStart`; the guard below makes the second run a no-op when the first
 * already landed.
 */
export const buildSectionPrewarmScript = (learned: SectionIds = {}): string => {
  const ids: Record<string, string> = {};
  for (const key of CRITICAL_KEYS) {
    const id = learned[key] || SEEDED_IDS[key];
    if (id) {
      ids[key] = id;
    }
  }

  return `
(function () {
  // Idempotent by requirement: this payload is injected more than once per page
  // load, and a second run must not fire the same request again.
  if (window.__ziglySectionPrewarm) { return; }

  /*
   * The dashboard only. Every id below names a section of the homepage, and
   * asking an inner page for them would spend a request to be told nothing.
   */
  var p = window.location.pathname || '';
  while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
  if (p !== '' && p !== '/' && p !== '/index') { return; }

  var store = {};
  window.__ziglySectionPrewarm = store;

  // ------------------------------------------------------------- preconnect
  try {
    var head = document.head || document.documentElement;
    var hosts = ${JSON.stringify(PRECONNECT_HOSTS)};
    for (var h = 0; h < hosts.length; h++) {
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = hosts[h];
      /*
       * No crossOrigin attribute, on purpose. A preconnect marked anonymous
       * opens a connection in the CORS pool, and the page's images, styles and
       * scripts are all requested WITHOUT crossorigin -- so they would not
       * reuse it, and the handshake this is here to save would be paid twice
       * instead of once. Anonymous is for fonts; this host serves imagery.
       */
      head.appendChild(link);
    }
  } catch (e) {}

  // ---------------------------------------------------------------- sections
  var SEEDS = ${JSON.stringify(ids)};

  var keys = [];
  var resolved = [];
  var names = Object.keys(SEEDS);
  for (var i = 0; i < names.length; i++) {
    var key = names[i];
    var id = SEEDS[key];
    /*
     * Prefer what the app handed back over what is written down. On the very
     * first navigation this global is usually not set yet and the seed is all
     * there is, which is correct -- the seed is right until Zigly re-saves the
     * theme.
     */
    try {
      if (window.__ziglySectionIds && window.__ziglySectionIds[key]) {
        id = window.__ziglySectionIds[key];
      }
    } catch (e) {}
    if (id) { keys.push(key); resolved.push(id); }
  }
  if (!keys.length) { return; }

  var url = '/?sections=' + encodeURIComponent(resolved.join(','));
  // One request, shared by every key in it. A failure resolves to null rather
  // than rejecting, so ./pageCache sees a miss and falls back instead of
  // inheriting an unhandled rejection.
  var request = fetch(url, {credentials: 'same-origin'})
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });

  for (var k = 0; k < keys.length; k++) {
    (function (key, id) {
      store[key] = request.then(function (json) {
        if (!json) { return null; }
        var html = json[id];
        return (typeof html === 'string' && html) ? html : null;
      });
    })(keys[k], resolved[k]);
  }
})();
true;
`;
};

/**
 * Warm the deferred sections, run once the dashboard has reported itself ready.
 *
 * Deliberately after `dashboard-ready` and behind a further beat: nothing here
 * may compete with the sections the splash is waiting for, and nothing here is
 * urgent -- the customer has to scroll before any of it is looked at.
 *
 * Only calls ./pageCache's fetcher, which batches and de-duplicates on its own.
 * Sections already asked for are already cached there, so this cannot double
 * fetch, and sections nobody ends up scrolling to cost one request each.
 */
export const SECTION_WARM_SCRIPT = `
(function () {
  if (window.__ziglySectionWarm) { return; }
  window.__ziglySectionWarm = true;

  if (typeof window.__ziglyFetchSection !== 'function') { return; }

  var FRAGMENTS = ${JSON.stringify(BELOW_FOLD_FRAGMENTS)};
  var DOCS = ${JSON.stringify(BELOW_FOLD_DOCS)};

  /*
   * A breath after the dashboard settles, and ahead of ./prefetch's own 800ms
   * warm of other pages: these sections belong to the page the customer is
   * already looking at, so they are the ones worth having first.
   */
  setTimeout(function () {
    for (var i = 0; i < FRAGMENTS.length; i++) {
      try { window.__ziglyFetchSection('/', FRAGMENTS[i]); } catch (e) {}
    }

    /*
     * The whole-page fetches last, and in their own tick.
     *
     * Each of these is a collection page rather than a 32 KB section, so
     * issuing them alongside the batch above would have the heaviest requests
     * on the dashboard competing with the lightest -- and the light ones cover
     * far more of what the customer is about to scroll past.
     */
    setTimeout(function () {
      if (typeof window.__ziglyFetchDoc !== 'function') { return; }
      for (var d = 0; d < DOCS.length; d++) {
        try { window.__ziglyFetchDoc(DOCS[d]); } catch (e) {}
      }
    }, 600);
  }, 400);
})();
true;
`;
