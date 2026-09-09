/**
 * Artwork for a tile rail, resolved from the site once and kept on the device.
 *
 * Generalised out of ./categoryIcons when the breed rails needed the same
 * thing. Three rails now share this shape -- category circles, dog breeds, cat
 * breeds -- and they share it for the same reason: their labels and
 * destinations are theme settings that can be read at build time, but their
 * artwork is recorded as `shopify://shop_images/Golden-Retriever_300X300_e95d…`,
 * which is a Liquid reference and not a URL. Only the rendered section carries
 * the `cdn.shopify.com` address, and that address carries a `?v=` stamp that
 * changes whenever the merchant re-uploads the file.
 *
 * So the labels ship and the pictures are learned. A rail is complete and
 * tappable on its first frame with no network at all; a tile whose artwork has
 * not arrived keeps its label, its size and its tap target.
 *
 * WHY THIS IS CACHEABLE WHEN SECTION MARKUP IS NOT. ../webview/sectionIdStore's
 * rule is that only ids are ever kept, never markup, because markup carries
 * prices and stock -- painting yesterday's copy would show a wrong storefront.
 * An image URL is in the same class as an id: decorative, with no price and no
 * stock behind it, and a stale one cannot state anything false about the store.
 * At worst it 404s and the tile loses its picture.
 *
 * MATCHED BY FILENAME STEM, NEVER BY POSITION. Position is shorter and is
 * exactly what fails silently: if Zigly inserts a breed or reorders two, an
 * index-based read mislabels every tile after the change -- a Pug photo over
 * "Beagle" -- and nothing throws. A stem that no longer appears simply goes
 * unresolved.
 *
 * Failures are swallowed on purpose: this is a cache in front of rails that
 * already draw without it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {log, warn} from '../utils/logger';

/** One tile: what it says, where it goes, and how to find its picture. */
export type Tile = {
  /** The label under the artwork. Zigly's own wording. */
  readonly label: string;
  /** Where a tap goes, as a path on the storefront. */
  readonly path: string;
  /**
   * Stable filename stem, for pairing a rendered `<img>` with this tile.
   *
   * The leading word of the theme's filename, before any size or hash Shopify
   * appends. Must be unique within a rail, which ./breeds asserts in a test --
   * two tiles sharing a stem would both claim the first matching image.
   */
  readonly key: string;
};

/** Learned image URLs, keyed by `Tile.key`. */
export type IconMap = Record<string, string>;

/**
 * A rail's identity for storage and fetching.
 *
 * Held as one object so a caller states the whole contract in one place, and so
 * adding a rail is a declaration rather than four more functions.
 */
export type TileRail = {
  /** Distinguishes this rail's cache from every other. */
  readonly storeKey: string;
  /**
   * The seeded Shopify section id -- a fast-path hint, never a source of truth.
   * A stale one costs one extra request and then self-heals via `fragment`.
   */
  readonly sectionId: string;
  /** The stable part of the section id, for rediscovery when the seed misses. */
  readonly fragment: string;
  /** The tiles this rail draws. */
  readonly tiles: readonly Tile[];
  /**
   * Which page this rail's section lives on. Defaults to `/`.
   *
   * The Section Rendering API only returns sections that are actually on the
   * page asked for: `/?sections=x` answers with an empty body for a section the
   * homepage does not render, which is indistinguishable here from a stale id.
   * The three original rails are all on the homepage, so this was implicit
   * until ./collectionCards -- whose section is on `/collections` and nowhere
   * else -- had to say so.
   */
  readonly page?: string;
};

/**
 * A ceiling on stored entries, per rail.
 *
 * The dog rail is the largest at 25. 64 is room for the merchant to add breeds
 * without a code change, and a bound so a runaway map cannot become a growing
 * read on every launch -- the same reason ../webview/sectionIdStore caps its own.
 */
const MAX_ENTRIES = 64;

/**
 * Only the shape this is supposed to be.
 *
 * Read back from disk and handed to an `<Image source>`, so it is checked
 * rather than trusted: a `javascript:` or `file://` value in this position
 * would be a stored string deciding what the app loads. A malformed store is
 * discarded whole, not repaired.
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

/** What earlier launches learned for this rail. `{}` on nothing, or on error. */
export const loadIcons = async (rail: TileRail): Promise<IconMap> => {
  try {
    const raw = await AsyncStorage.getItem(rail.storeKey);
    if (!raw) {
      return {};
    }
    const icons = clean(JSON.parse(raw));
    log('icons loaded:', rail.storeKey, Object.keys(icons).length);
    return icons;
  } catch (e) {
    warn('icons unreadable, starting fresh:', rail.storeKey, e);
    return {};
  }
};

/**
 * Keep what was just learned.
 *
 * Merged over what is stored, never replacing: a fetch that resolved twenty of
 * twenty-five must not discard five an earlier launch had already found. This
 * is the opposite of ./bannerSlides, which replaces -- because that list's
 * whole meaning is "the campaigns running now", while these are independent
 * entries.
 */
export const saveIcons = async (
  rail: TileRail,
  learned: IconMap,
  known: IconMap = {},
): Promise<IconMap> => {
  const merged = clean({...known, ...clean(learned)});
  try {
    await AsyncStorage.setItem(rail.storeKey, JSON.stringify(merged));
  } catch (e) {
    warn('icons not saved:', rail.storeKey, e);
  }
  return merged;
};

/**
 * Does this URL's filename belong to this tile?
 *
 * TWO MATCHING MODES, and which one a rail needs is decided by whether its
 * filenames are distinguishable by their leading word.
 *
 * A `key` containing a `.` is treated as a WHOLE FILENAME and must match
 * exactly. That is what the Explore section requires: the dog and cat pages
 * both ship `Meaty-Treats_650X765_<hash>.png`, `Plush-Toys_650X765_<hash>.png`
 * and `Fresh-Food_650X765_<hash>.png`, differing only in the hash Shopify
 * appended. A stem cannot tell those two tiles apart, and pairing the wrong one
 * puts a cat photo on a dog collection -- so those tiles name their file in
 * full.
 *
 * Otherwise the key is a STEM, and must be followed by a separator or nothing:
 * `Pug` cannot claim `Puggle_300X300.png` and `All` cannot claim
 * `allergy-banner.png`, while `Small-Pets` still matches
 * `Small-Pets_option-2_1_39a67…`. This is what the category and breed rails
 * use, because their filenames carry hashes that change on re-upload and a
 * stem is the stable part.
 *
 * Both compare case-insensitively, because the theme's filenames are
 * inconsistently cased -- `petparent_option_1_…` beside `Vet-Care_…`,
 * `boxer.png` beside the label "Boxer".
 */
export const matchesKey = (url: string, key: string): boolean => {
  const file = (url.split('?')[0].split('/').pop() || '').toLowerCase();
  const wanted = key.toLowerCase();
  // A key naming an extension is a full filename, not a stem.
  if (wanted.includes('.')) {
    return file === wanted;
  }
  if (!file.startsWith(wanted)) {
    return false;
  }
  const next = file.charAt(wanted.length);
  return next === '' || next === '_' || next === '-' || next === '.';
};

/**
 * Pair the `<img>` elements in a rendered rail with the tiles they belong to.
 *
 * Exported for its own test: this is the one piece of real logic here, it runs
 * against markup this app does not control, and it is where a theme change
 * would land first.
 *
 * A plain regex rather than a DOM parse, because there is no `DOMParser` in the
 * React Native runtime. `srcset` is read as well as `src` -- Shopify emits
 * both, and a lazy image's `src` is a data: placeholder while the real address
 * sits in `srcset`.
 */
export const parseIcons = (
  html: string,
  tiles: readonly Tile[],
): IconMap => {
  const out: IconMap = {};
  if (!html) {
    return out;
  }
  /*
   * Both element kinds, in document order. `<video ...>` is matched as an open
   * tag rather than with its content: the poster is on the opening tag and the
   * `<source>` inside it is an mp4, which no tile wants.
   */
  const tags = html.match(/<(?:img|video)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const candidates: string[] = [];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (src) {
      candidates.push(src[1]);
    }
    // The video block's artwork. Only ever present on a <video>.
    const poster = /\bposter\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (poster) {
      candidates.push(poster[1]);
    }
    const srcset = /\bsrcset\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (srcset) {
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
      const tile = tiles.find(t => matchesKey(url, t.key));
      // First match wins per tile: the rail's own <img> precedes any
      // decoration, and a tile already resolved is not overwritten.
      if (tile && !out[tile.key]) {
        out[tile.key] = url;
      }
    }
  }
  return out;
};

/**
 * Ask the site for a rendered rail and read its artwork.
 *
 * Two attempts, and they are two different requests rather than a retry of one:
 * the seeded id first, then the same section by fragment discovery off the
 * homepage. That is the self-healing path ../webview/pageCache established for
 * every transplanted section -- a stale id costs one request and corrects
 * itself, because whatever this resolves is written to disk by the caller.
 *
 * `credentials: 'omit'`, deliberately. These are public decorative sections and
 * the app's one cookie jar belongs to the WebView (DATA-SOURCES.md §7); a
 * cookie sent from here would be a second session doing nothing useful.
 */
export const fetchIcons = async (
  rail: TileRail,
  signal?: AbortSignal,
): Promise<IconMap> => {
  const bySeed = await fetchSection(rail, rail.sectionId, signal);
  if (bySeed && Object.keys(bySeed).length) {
    return bySeed;
  }
  log('icons: seeded id missed, rediscovering', rail.fragment);
  return (await discoverAndFetch(rail, signal)) || {};
};

/** One Section Rendering API call, parsed. `null` on any failure. */
const fetchSection = async (
  rail: TileRail,
  sectionId: string,
  signal?: AbortSignal,
): Promise<IconMap | null> => {
  const url = `${ZIGLY_ORIGIN}${rail.page ?? '/'}?sections=${encodeURIComponent(
    sectionId,
  )}`;
  try {
    const res = await fetch(url, {credentials: 'omit', signal});
    if (!res.ok) {
      warn('section fetch failed:', rail.fragment, res.status);
      return null;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const html = body[sectionId];
    if (typeof html !== 'string' || !html) {
      return null;
    }
    return parseIcons(html, rail.tiles);
  } catch (e) {
    // An abort is the screen going away, not a fault worth warning about.
    if (!signal?.aborted) {
      warn('section unreachable:', rail.fragment, e);
    }
    return null;
  }
};

/**
 * Learn the real section id off the homepage, then fetch by it.
 *
 * The whole page is the expensive path -- the ~2 MB fetch
 * ../webview/pageCache describes -- so it runs only when the seed has missed,
 * which is once per theme re-save rather than once per launch.
 *
 * Sections resolve by id against any page, verified in DATA-SOURCES.md §3, so
 * `/` is asked even for a section that lives on `/pages/dog`.
 */
const discoverAndFetch = async (
  rail: TileRail,
  signal?: AbortSignal,
): Promise<IconMap | null> => {
  try {
    const res = await fetch(`${ZIGLY_ORIGIN}${rail.page ?? '/'}`, {
      credentials: 'omit',
      signal,
    });
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    const re = new RegExp(
      `id="shopify-section-([^"]*${rail.fragment}[^"]*)"`,
      'i',
    );
    const found = re.exec(html);
    if (!found) {
      warn('section id not found on homepage:', rail.fragment);
      return null;
    }
    return await fetchSection(rail, found[1], signal);
  } catch (e) {
    if (!signal?.aborted) {
      warn('id discovery failed:', rail.fragment, e);
    }
    return null;
  }
};
