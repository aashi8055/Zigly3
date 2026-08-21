/**
 * Section fetching for the transplanted homepage sections.
 *
 * Fetching whole pages to lift one section out of each is what made the
 * homepage feel slow: /pages/dog alone is ~2 MB, and three sections were
 * sourced from two such pages plus a collection.
 *
 * Shopify's Section Rendering API returns a single section as JSON --
 * /pages/dog?sections=<section-id> is ~32 KB against 2 MB for the page, a 64x
 * reduction. That is a documented Shopify feature, so this stays firmly inside
 * "the website is the engine": same markup, same content, just without the
 * other ninety-eight percent of the page.
 *
 * The catch is that section ids carry a Shopify-generated suffix that changes
 * whenever the merchant re-saves the theme, so they cannot simply be hardcoded.
 * The strategy is:
 *
 *   1. Try the seeded id for this page+section, so a first run is already fast.
 *   2. If that returns nothing -- wrong id, theme re-saved, section removed --
 *      fall back to fetching the page once, re-discover the real id, remember
 *      it for this page view, and carry on.
 *
 * So the seeded ids are a cache hint, never a source of truth: a stale one
 * costs one page fetch and then self-heals. Deliberately nothing is written to
 * the site's sessionStorage -- that namespace belongs to Zigly, and the brief
 * is clear about leaving their storage alone. The cost is that a stale id is
 * re-discovered once per page view rather than once per session; if Zigly
 * re-saves their theme, update SEEDED_IDS.
 */
const DOG = 'template--26530973942076__';
const CAT = 'template--26530973843772__';

/**
 * Seeded section ids, used as a fast-path hint.
 *
 * Sections resolve by id against any page, so everything is requested from '/'
 * -- verified: the dog page's breed section returns byte-identical output from
 * the homepage URL. That keeps us to one origin and lets unrelated sections
 * share a batch.
 *
 * These ids carry a Shopify-generated suffix that changes when the theme is
 * re-saved, so a miss falls back to discovery and self-heals.
 */
/**
 * Seeded section ids, used as a fast-path hint.
 *
 * Comparing the reference recording against the live templates, the app's
 * dashboard is very close to /pages/dog: same sections, same order, plus the
 * cat breed rail. So these are the dog-page sections, keyed by the slot they
 * fill. Several fragments repeat on that page (three offer sections, three
 * single banners), which is why the keys are numbered -- a bare fragment
 * lookup would return only the first.
 *
 * Ids carry a Shopify-generated suffix that changes when the theme is re-saved,
 * so a miss falls back to discovery by fragment and self-heals.
 */
const SEEDED_IDS: Record<string, string> = {
  '/|home_category_section': DOG + 'home_category_section_ej8trH',
  '/|home_shop_by_breed_section@dog': DOG + 'home_shop_by_breed_section_arbGWM',
  '/|home_shop_by_breed_section@cat': CAT + 'home_shop_by_breed_section_arbGWM',
  '/|home_arrival_section@dog': DOG + 'home_arrival_section_XRNURe',
  '/|home_arrival_section@cat': CAT + 'home_arrival_section_zdNe4b',
  '/|explore_product@dog': DOG + 'explore_product_8WFgmB',
  '/|explore_product@cat': CAT + 'explore_product_8WFgmB',
  '/|coupon_slider': DOG + 'coupon_slider_74pjHD',
  '/|offer_section#1': DOG + 'offer_section_nYDda8',
  '/|offer_section#2': DOG + 'offer_section_H88hDB',
  '/|offer_section#3': DOG + 'offer_section_4xR48g',
  '/|custom_single_banner#1': DOG + 'custom_single_banner_QYTfgc',
  '/|custom_single_banner#2': DOG + 'custom_single_banner_WGCJEB',
  '/|custom_single_banner#3': DOG + 'custom_single_banner_kKkUwL',
  '/|shop_by_price': DOG + 'shop_by_price_KEMKVQ',
  '/|best_deals': DOG + 'best_deals_b8xpdj',
  '/|shop_of_concern': DOG + 'shop_of_concern_T9kBGJ',
  '/|collection_product_section': DOG + 'collection_product_section_eNzYyW',
  '/|everything@dog': DOG + 'everything_czXFGJ',
  '/|everything@cat': CAT + 'everything_czXFGJ',
  '/|redesign_custom_double_banner': DOG + 'redesign_custom_double_banner_FqtJbt',
  '/|video_swiper': DOG + 'video_swiper_U9CqpQ',
};

export const PAGE_CACHE_SCRIPT = `
(function () {
  if (window.__ziglyFetchSection) { return; }

  var SEEDED = ${JSON.stringify(SEEDED_IDS)};
  var discovered = {};
  var pageCache = {};
  var sectionCache = {};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /** Whole page, fetched at most once per page view. */
  function fetchDoc(path) {
    if (pageCache[path]) { return pageCache[path]; }
    pageCache[path] = fetch(path, {credentials: 'same-origin'})
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        return html ? new DOMParser().parseFromString(html, 'text/html') : null;
      })
      .catch(function () { return null; });
    return pageCache[path];
  }

  function toElement(html) {
    var holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.firstElementChild;
  }

  /** Fall back to the whole page, learn the real ids, resolve from it. */
  function rediscover(path, jobs) {
    fetchDoc(path).then(function (doc) {
      for (var i = 0; i < jobs.length; i++) {
        var job = jobs[i];
        if (!doc) { job.resolve(null); continue; }
        var frag = job.fragment.split('@')[0].split('#')[0];
        var found = doc.querySelector('[id*="' + frag + '"]');
        if (!found) { job.resolve(null); continue; }
        var realId = (found.getAttribute('id') || '').replace('shopify-section-', '');
        if (realId) { discovered[path + '|' + job.fragment] = realId; }
        job.resolve(document.importNode(found, true));
      }
    });
  }

  /**
   * Requests are queued and flushed together, because Shopify accepts several
   * section ids in one call (?sections=a,b,c) and the transplants all draw from
   * the same two pages. Six round trips become two -- the bytes are unchanged,
   * but on mobile it is the per-request latency that is felt.
   */
  var queue = [];
  var flushScheduled = false;

  function flush() {
    flushScheduled = false;
    var batch = queue;
    queue = [];

    var byPath = {};
    for (var i = 0; i < batch.length; i++) {
      var job = batch[i];
      if (!byPath[job.path]) { byPath[job.path] = []; }
      byPath[job.path].push(job);
    }

    Object.keys(byPath).forEach(function (path) {
      var jobs = byPath[path];
      var withId = [];
      var withoutId = [];
      for (var j = 0; j < jobs.length; j++) {
        (jobs[j].id ? withId : withoutId).push(jobs[j]);
      }
      if (withoutId.length) { rediscover(path, withoutId); }

      // Shopify answers 400 above five sections per request, so chunk.
      var CHUNK = 5;
      for (var c = 0; c < withId.length; c += CHUNK) {
        requestChunk(path, withId.slice(c, c + CHUNK));
      }
    });
  }

  function requestChunk(path, jobs) {
    var ids = [];
    for (var i = 0; i < jobs.length; i++) { ids.push(jobs[i].id); }

    var url = path + (path.indexOf('?') === -1 ? '?' : '&') +
      'sections=' + encodeURIComponent(ids.join(','));

    fetch(url, {credentials: 'same-origin'})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        var missed = [];
        for (var k = 0; k < jobs.length; k++) {
          var html = json ? json[jobs[k].id] : null;
          if (typeof html === 'string' && html) {
            jobs[k].resolve(toElement(html));
          } else {
            missed.push(jobs[k]);
          }
        }
        if (missed.length) {
          warn('section ids stale for ' + path + '; re-discovering');
          rediscover(path, missed);
        }
      })
      .catch(function () { rediscover(path, jobs); });
  }

  /** Get one section by its stable name fragment. Resolves to an element or null. */
  window.__ziglyFetchSection = function (path, fragment) {
    var key = path + '|' + fragment;
    if (sectionCache[key]) { return sectionCache[key]; }

    sectionCache[key] = new Promise(function (resolve) {
      queue.push({
        path: path,
        fragment: fragment,
        id: discovered[key] || SEEDED[key] || null,
        resolve: resolve
      });
      if (!flushScheduled) {
        flushScheduled = true;
        // Let every caller register before the request goes out.
        setTimeout(flush, 0);
      }
    });

    return sectionCache[key];
  };

  /** Still needed for the collection page, which has no single section. */
  window.__ziglyFetchDoc = fetchDoc;
})();
true;
`;
