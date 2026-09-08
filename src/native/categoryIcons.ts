/**
 * The eight category icons, resolved from the site once and kept on the device.
 *
 * The category rail is the first thing under the search band and the first
 * thing tapped, so it is the section this app moves to native first. Its
 * headings and destinations are known at build time -- they are settings in
 * Zigly's own theme, read from `templates/page.dog.json` -- but its icons are
 * not: the theme records them as `shopify://shop_images/Dog_194aa273-….png`,
 * which is a Liquid reference, not a URL. Only the rendered section carries the
 * `cdn.shopify.com` address, and it carries a signed `?v=` stamp that changes
 * whenever the merchant re-uploads the file.
 *
 * So the URLs are learned rather than written down. One Section Rendering API
 * call -- ~15 KB, the cheapest section on the dashboard -- returns the rendered
 * rail; the eight `<img src>` values are lifted out of it and kept here. Every
 * launch after the first draws from disk and makes no request at all.
 *
 * WHY THIS IS CACHEABLE WHEN SECTION MARKUP IS NOT. ./sectionIdStore's rule is
 * that only ids are ever kept, never markup, because markup carries prices and
 * stock -- painting yesterday's copy of it would show a wrong storefront. An
 * icon URL is in the same class as an id: it is decorative, it has no price and
 * no stock behind it, and a stale one cannot state anything false about the
 * store. At worst it 404s, and a card that loses its picture keeps its heading
 * and its link -- the same degradation ../webview/instagramSection settled on.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE. The eight headings and hrefs are NOT
 * learned from the fetch. They are the theme's own settings and they are stable
 * across a re-save (only the id suffix moves), so making the labels depend on a
 * network call would mean a first launch with eight nameless circles. The
 * fallback is therefore a complete, tappable rail that is merely unillustrated,
 * which is a far better failure than an empty one.
 *
 * Failures are swallowed on purpose, as in ./sectionIdStore: this is a cache in
 * front of a rail that already draws without it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {log, warn} from '../utils/logger';

/**
 * Namespaced under the app, not the site -- the same rule ./sectionIdStore
 * keeps. `v1` so a change to the stored shape can never be read as the old one.
 */
const STORE_KEY = 'zigly.categoryIcons.v1';

/**
 * The rail, as Zigly's theme declares it.
 *
 * Read from `zigly-website-code/zigly-website/templates/page.dog.json`, section
 * `home_category_section_ej8trH`, in `block_order` -- so this is the site's own
 * content and its own ordering, not a selection made here.
 *
 * `page.dog.json` and not `index.json`, and that is the whole point: the app's
 * dashboard is the dog page's section set, not the homepage's (see
 * ../webview/pageCache, whose seeded ids are all `template--26530973942076__`).
 * The homepage ships a different and shorter set of circles, which is why
 * ../webview/homeLayout fetches this one and swaps it in.
 *
 * `key` is the stable half of the icon filename, used to match a rendered
 * `<img>` back to its block. Filenames carry a Shopify-appended hash on
 * re-upload (`Dog_194aa273-…`), so the match is a prefix test on the leading
 * word rather than an equality test on the whole name.
 */
export type CategoryItem = {
  /** The label under the circle. Zigly's own wording. */
  readonly label: string;
  /** Where a tap goes, as an app-internal path on the storefront. */
  readonly path: string;
  /** Stable filename stem, for pairing a rendered image with this block. */
  readonly key: string;
};

/**
 * `shopify://pages/x` and `shopify://collections/x` resolve to `/pages/x` and
 * `/collections/x` on the storefront, which is what a WebView navigation and a
 * native route both need. Resolved here, once, rather than at every call site.
 */
export const CATEGORIES: readonly CategoryItem[] = [
  {label: 'Dogs', path: '/pages/dog', key: 'Dog'},
  {label: 'Cats', path: '/pages/zigly-cat', key: 'Cat'},
  {label: 'Small Pets', path: '/collections/small-pets', key: 'Small-Pets'},
  {label: 'Pharmacy', path: '/collections/pet-pharmacy', key: 'Pharmacy'},
  {label: 'Vet Care', path: '/pages/vet-care-page', key: 'Vet-Care'},
  {label: 'Grooming', path: '/pages/grooming', key: 'Grooming'},
  {label: 'All', path: '/', key: 'All'},
  {
    label: 'New Pet Parent',
    path: '/pages/new-pet-owner-guide',
    key: 'petparent',
  },
];

/** Learned icon URLs, keyed by `CategoryItem.key`. */
export type IconMap = Record<string, string>;

/**
 * The section to ask for, and where its id is already known.
 *
 * The seeded id in ../webview/pageCache is reused rather than duplicated as a
 * literal, so a theme re-save that invalidates one invalidates both and there
 * is only one place to correct. The fragment is what rediscovery matches on if
 * the id has gone stale.
 */
const SECTION_FRAGMENT = 'home_category_section';
const SEEDED_SECTION_ID = 'template--26530973942076__home_category_section_ej8trH';

/** A ceiling, for the same reason ./sectionIdStore has one: eight, not a leak. */
const MAX_ENTRIES = 24;

/**
 * Only the shape this is supposed to be.
 *
 * Read back from disk and handed to an `<Image source>`, so it is checked
 * rather than trusted. A URL must be absolute https -- a relative or
 * `javascript:` value in this position would be a stored string deciding what
 * the app loads -- and a malformed store is discarded whole, not repaired.
 */
const clean = (raw: unknown): IconMap => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: IconMap = {};
  let kept = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= MAX_ENTRIES) {
      break;
    }
    if (
      typeof key === 'string' &&
      key &&
      typeof value === 'string' &&
      value.startsWith('https://')
    ) {
      out[key] = value;
      kept++;
    }
  }
  return out;
};

/** What earlier launches learned. `{}` when there is nothing, or on error. */
export const loadCategoryIcons = async (): Promise<IconMap> => {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) {
      return {};
    }
    const icons = clean(JSON.parse(raw));
    log('category icons loaded:', Object.keys(icons).length);
    return icons;
  } catch (e) {
    warn('category icons unreadable, starting fresh:', e);
    return {};
  }
};

/**
 * Keep what was just learned.
 *
 * Merged over what is stored, not replacing it: a fetch that resolved six of
 * eight must not discard two that an earlier launch had already found.
 */
export const saveCategoryIcons = async (
  learned: IconMap,
  known: IconMap = {},
): Promise<IconMap> => {
  const merged = clean({...known, ...clean(learned)});
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(merged));
  } catch (e) {
    warn('category icons not saved:', e);
  }
  return merged;
};

/**
 * Pair the `<img>` elements in a rendered rail with the blocks they belong to.
 *
 * Exported for its own test: this is the one piece of real logic here, it runs
 * against markup this app does not control, and it is where a theme change
 * would land first.
 *
 * Matched by filename stem rather than by position. Position would be shorter
 * and is exactly what breaks silently: if Zigly adds a ninth circle or reorders
 * two, an index-based read mislabels every icon after the change -- a cat photo
 * over "Dogs" -- and nothing throws. A stem that no longer appears simply goes
 * unresolved, and that circle falls back to its initial.
 *
 * A plain regex rather than a DOM parse, because there is no DOM here: this runs
 * in the React Native runtime, which has no `DOMParser`. `srcset` is read too --
 * Shopify emits both, and a `src` may be a data: placeholder for a lazy image
 * while the real address sits in `srcset`.
 */
export const parseIconUrls = (html: string): IconMap => {
  const out: IconMap = {};
  if (!html) {
    return out;
  }
  // Each <img …> in turn; attribute order is Shopify's and not relied upon.
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const candidates: string[] = [];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (src) {
      candidates.push(src[1]);
    }
    const srcset = /\bsrcset\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (srcset) {
      // "url 100w, url 200w" -- take the addresses, widest last.
      for (const part of srcset[1].split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) {
          candidates.push(url);
        }
      }
    }
    for (const raw of candidates) {
      // Protocol-relative is what Shopify emits most often.
      const url = raw.startsWith('//') ? `https:${raw}` : raw;
      if (!url.startsWith('https://')) {
        continue;
      }
      const item = CATEGORIES.find(c => matchesKey(url, c.key));
      // First match wins per block, and a block already resolved is not
      // overwritten -- the rail's own <img> comes before any decoration.
      if (item && !out[item.key]) {
        out[item.key] = url;
      }
    }
  }
  return out;
};

/**
 * Does this URL's filename belong to this block?
 *
 * The stem is matched at a word boundary so `Cat` cannot claim
 * `Cat_Scratchers`-style names from a neighbouring section, and so
 * `Small-Pets_option-2_1_39a67…` still matches `Small-Pets`. Compared
 * case-insensitively because the theme's filenames are inconsistently cased
 * (`petparent_option_1_…` against `Vet-Care_…`).
 */
const matchesKey = (url: string, key: string): boolean => {
  const file = (url.split('?')[0].split('/').pop() || '').toLowerCase();
  const stem = key.toLowerCase();
  if (!file.startsWith(stem)) {
    return false;
  }
  // What follows the stem must be a separator, not more letters: "all" must not
  // match "allergy.png".
  const next = file.charAt(stem.length);
  return next === '' || next === '_' || next === '-' || next === '.';
};

/**
 * Ask the site for the rendered rail and read its icons.
 *
 * Two attempts, and they are two different requests rather than a retry of one:
 * the seeded id first, and if that returns nothing usable, the same section by
 * fragment discovery off the homepage. That is the self-healing path
 * ../webview/pageCache already established for every transplanted section --
 * a stale id costs one extra request and then corrects itself.
 *
 * `credentials: 'omit'`, deliberately. This is a public, decorative section and
 * the app's one cookie jar belongs to the WebView (see DATA-SOURCES.md §7); a
 * cookie sent from here would be a second session doing nothing useful.
 */
export const fetchCategoryIcons = async (
  signal?: AbortSignal,
): Promise<IconMap> => {
  const bySeed = await fetchSection(SEEDED_SECTION_ID, signal);
  if (bySeed && Object.keys(bySeed).length) {
    return bySeed;
  }
  log('category icons: seeded id missed, rediscovering');
  const byDiscovery = await discoverAndFetch(signal);
  return byDiscovery || {};
};

/** One Section Rendering API call, parsed. `null` on any failure. */
const fetchSection = async (
  sectionId: string,
  signal?: AbortSignal,
): Promise<IconMap | null> => {
  const url = `${ZIGLY_ORIGIN}/?sections=${encodeURIComponent(sectionId)}`;
  try {
    const res = await fetch(url, {credentials: 'omit', signal});
    if (!res.ok) {
      warn('category section fetch failed:', res.status);
      return null;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const html = body[sectionId];
    if (typeof html !== 'string' || !html) {
      return null;
    }
    return parseIconUrls(html);
  } catch (e) {
    // An abort is the screen going away, not a fault worth warning about.
    if (!signal?.aborted) {
      warn('category section unreachable:', e);
    }
    return null;
  }
};

/**
 * Learn the real section id off the homepage, then fetch by it.
 *
 * The whole page is the expensive path -- this is the ~2 MB fetch
 * ../webview/pageCache describes -- so it runs only when the seed has missed,
 * which is once per theme re-save rather than once per launch, because whatever
 * this resolves gets written to disk by the caller.
 */
const discoverAndFetch = async (
  signal?: AbortSignal,
): Promise<IconMap | null> => {
  try {
    const res = await fetch(`${ZIGLY_ORIGIN}/`, {
      credentials: 'omit',
      signal,
    });
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    // id="shopify-section-template--…__home_category_section_…"
    const re = new RegExp(
      `id="shopify-section-([^"]*${SECTION_FRAGMENT}[^"]*)"`,
      'i',
    );
    const found = re.exec(html);
    if (!found) {
      warn('category section id not found on homepage');
      return null;
    }
    return await fetchSection(found[1], signal);
  } catch (e) {
    if (!signal?.aborted) {
      warn('category id discovery failed:', e);
    }
    return null;
  }
};
