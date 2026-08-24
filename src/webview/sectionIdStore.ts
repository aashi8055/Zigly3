/**
 * The Shopify section ids this app has learned, kept across launches.
 *
 * The dashboard is assembled out of about twenty of Zigly's own theme sections,
 * fetched one-by-id through the Section Rendering API -- 32 KB a section instead
 * of the ~2 MB page each one lives on. That trade depends entirely on knowing the
 * ids, and the ids carry a Shopify-generated suffix that changes every time the
 * merchant re-saves the theme.
 *
 * `SEEDED_IDS` in ./pageCache is the written-down guess. When it is right, the
 * dashboard is fast. When the theme has been re-saved it is wrong, and the page
 * falls back to fetching whole pages to re-learn the ids -- correct, self-healing,
 * and expensive. It used to be expensive *on every launch*, because what it
 * learned died with the page view.
 *
 * So the learned ids come back over the bridge and are kept here. A theme re-save
 * now costs one slow launch instead of every launch, and nobody has to remember to
 * update the seeds.
 *
 * A HINT, AND ONLY EVER A HINT. Nothing here is trusted: a stored id that has gone
 * stale misses exactly like a stale seed does, and rediscovery replaces it. That is
 * what makes it safe to keep on disk without any notion of expiry -- and it is why
 * only ids are kept and never the section markup, which carries prices and stock.
 *
 * Failures are swallowed on purpose. This is a cache in front of a mechanism that
 * already works without it; a storage error must cost a little speed and nothing
 * else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {log, warn} from '../utils/logger';

/**
 * Namespaced under the app, not the site.
 *
 * ./pageCache is explicit that Zigly's own `sessionStorage` and `localStorage`
 * are theirs. This is the app's own storage on the device, which is the reason
 * that rule survives this cache.
 */
const KEY = 'zigly.sectionIds.v1';

/**
 * A ceiling on what will be kept.
 *
 * The dashboard needs about twenty, and the map is keyed by path and fragment, so
 * it cannot grow with the number of pages visited. The cap is here for the case
 * this reasoning stops being true -- a future section list, or a bug that writes a
 * key per page view -- so that a runaway map cannot become a growing read on every
 * launch.
 */
const MAX_ENTRIES = 64;

export type SectionIds = Record<string, string>;

/**
 * Only the shape this is supposed to be.
 *
 * The value is read back from disk and pushed into a page as script, so it is
 * checked rather than trusted: string keys, string values, nothing else. A
 * malformed store is discarded, not repaired.
 */
const clean = (raw: unknown): SectionIds => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: SectionIds = {};
  let kept = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= MAX_ENTRIES) {
      break;
    }
    if (typeof key === 'string' && key && typeof value === 'string' && value) {
      out[key] = value;
      kept++;
    }
  }
  return out;
};

/** What was learned on earlier launches. `{}` when there is nothing, or on error. */
export const loadSectionIds = async (): Promise<SectionIds> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const ids = clean(JSON.parse(raw));
    log('section ids loaded:', Object.keys(ids).length);
    return ids;
  } catch (e) {
    warn('section ids unreadable, starting fresh:', e);
    return {};
  }
};

/**
 * Keep what the page has learned.
 *
 * Merged over what is already stored rather than replacing it: the page reports
 * the ids *it* had to rediscover, which on any given launch is only the sections
 * whose seed had gone stale. Replacing would throw away everything learned on a
 * previous launch that this one never needed to ask about.
 */
export const saveSectionIds = async (
  learned: SectionIds,
  known: SectionIds,
): Promise<SectionIds> => {
  const merged = clean({...known, ...clean(learned)});
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch (e) {
    warn('section ids not saved:', e);
  }
  return merged;
};

/**
 * Hand the stored ids to a page.
 *
 * Set as a plain global rather than folded into the injected payload, because the
 * payload is built synchronously when the WebView mounts and this arrives from
 * disk a moment later. ./pageCache reads the global per lookup for exactly that
 * reason, so a map that lands after the script has run still serves every section
 * not yet asked for.
 *
 * Merged into whatever is already there, so this can be injected more than once --
 * which it is, because the payload runs seven times per page load and nothing in
 * this app may assume it runs once.
 */
export const seedSectionIdsScript = (ids: SectionIds): string => `
(function () {
  try {
    var incoming = ${JSON.stringify(ids)};
    var current = window.__ziglySectionIds || {};
    for (var key in incoming) {
      if (Object.prototype.hasOwnProperty.call(incoming, key)) {
        current[key] = incoming[key];
      }
    }
    window.__ziglySectionIds = current;
  } catch (e) {}
})();
true;
`;
