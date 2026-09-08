/**
 * The banner carousel's slides, read from the site and kept on the device.
 *
 * Unlike the category rail next door, NOTHING about this section can be written
 * down at build time -- not the images, and not even the links or how many
 * slides there are. `templates/page.dog.json` declares twenty-five banner
 * blocks, and a good number of them are expired campaigns: Mother's Day, Holi,
 * Valentine's, "puppy-day-sale". Shopify renders only the blocks the merchant
 * currently has enabled, and the template file does not record which those are.
 *
 * That makes hardcoding this section actively wrong rather than merely
 * inflexible: it would put a Valentine's banner on the dashboard in September
 * and link customers to a finished sale. So the slides are learned from the
 * rendered section, in the order the site renders them, and the app ships none
 * of its own.
 *
 * WHAT IS CACHED, AND WHY THAT IS SAFE. Image URL, link and order -- no price,
 * no stock, no product. ./sectionIdStore's rule is that markup carrying prices
 * must never be persisted, because painting a stale copy would state something
 * false about the store. A banner has nothing to be stale *about* except which
 * campaign is running, so the cost of a stale one is bounded: a customer sees
 * last week's promotion for the few hundred milliseconds before this launch's
 * fetch replaces it. That is the trade that lets the dashboard paint a real
 * banner on the first frame instead of a grey box.
 *
 * Which is the whole point of caching here. The banner is the largest thing on
 * the dashboard's first screen; ../components/Skeleton reserves a 2:1 block for
 * it. Painting yesterday's real banner and swapping it for today's is far
 * quieter than a grey rectangle resolving into an image.
 *
 * The mobile crop is taken, never the desktop one. Every block carries both
 * (`600X400_…` against `1920X741_…`) and the section's own markup picks between
 * them with a `<picture>`/media query the app has no reason to re-evaluate: on a
 * phone the answer is always the mobile asset, which is a quarter of the bytes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {log, warn} from '../utils/logger';

/** Namespaced under the app, as ./categoryIcons and ../webview/sectionIdStore. */
const STORE_KEY = 'zigly.bannerSlides.v1';

/**
 * The banner section on the dashboard's source page, and the fragment to
 * rediscover it by. Note this is `homepage_banner_xCbpfX` -- the dog page's
 * instance, not `index.json`'s `homepage_banner_tA3yzQ`. The app's dashboard is
 * the dog page (see ../webview/pageCache), and the two carry different slides.
 */
const SECTION_FRAGMENT = 'homepage_banner';
const SEEDED_SECTION_ID = 'template--26530973942076__homepage_banner_xCbpfX';

/**
 * A ceiling on stored slides.
 *
 * The template declares twenty-five blocks and the merchant could enable all of
 * them. Ten is what a customer will ever swipe on a dashboard, it bounds the
 * disk read on every launch, and -- more importantly -- it bounds how many
 * full-width images the rail will try to hold. Taken from the front, so this
 * keeps the site's own ordering and drops only the tail.
 */
const MAX_SLIDES = 10;

export type BannerSlide = {
  /** The mobile crop, absolute https. */
  readonly image: string;
  /** Where a tap goes: a storefront path, or an absolute zigly.com URL. */
  readonly link: string | null;
};

/**
 * Only the shape this is supposed to be.
 *
 * Both fields are checked because both are acted on: the image goes to an
 * `<Image source>` and the link goes to a navigation. A `javascript:` or
 * `file://` value in either position would be a string from disk deciding what
 * the app loads or where it goes, so anything that is not https (or a
 * site-relative path, for the link) is dropped.
 */
const clean = (raw: unknown): BannerSlide[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: BannerSlide[] = [];
  for (const entry of raw) {
    if (out.length >= MAX_SLIDES) {
      break;
    }
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const {image, link} = entry as {image?: unknown; link?: unknown};
    if (typeof image !== 'string' || !image.startsWith('https://')) {
      continue;
    }
    out.push({image, link: safeLink(link)});
  }
  return out;
};

/**
 * A link that is safe to navigate, or null.
 *
 * This is `normaliseLink` applied to a value coming *off disk* rather than out
 * of the site's markup, and it is deliberately the same function. The parser
 * already rejects an off-origin href, so for a freshly fetched slide this is a
 * second pass over a value that has been checked once -- but the stored copy is
 * the one that matters: it is read on the next launch and handed straight to a
 * navigation, and by then nothing remembers where it came from.
 *
 * `evil.example.com` was accepted here until a test caught it: the check was
 * `startsWith('https://')`, which is the right question for an image URL and
 * the wrong one for a link. An image loads; a link takes the customer
 * somewhere. Only zigly.com and site-relative paths qualify.
 */
const safeLink = (link: unknown): string | null =>
  typeof link === 'string' ? normaliseLink(link) : null;

/** What earlier launches learned. `[]` when there is nothing, or on error. */
export const loadBannerSlides = async (): Promise<BannerSlide[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) {
      return [];
    }
    const slides = clean(JSON.parse(raw));
    log('banner slides loaded:', slides.length);
    return slides;
  } catch (e) {
    warn('banner slides unreadable, starting fresh:', e);
    return [];
  }
};

/**
 * Keep what was just learned.
 *
 * REPLACED, not merged -- and this is the one place this module deliberately
 * differs from ./categoryIcons. Icons are a map of independent entries, so
 * merging preserves what a partial fetch missed. Slides are an ordered list
 * whose whole meaning is "the campaigns running right now": merging would
 * accumulate retired banners forever and there would be no way to tell which of
 * them the merchant had switched off. A fetch that succeeds is the truth; a
 * fetch that fails writes nothing and the previous list stands.
 */
export const saveBannerSlides = async (
  learned: BannerSlide[],
): Promise<BannerSlide[]> => {
  const slides = clean(learned);
  if (!slides.length) {
    return loadBannerSlides();
  }
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(slides));
  } catch (e) {
    warn('banner slides not saved:', e);
  }
  return slides;
};

/**
 * Read the slides out of a rendered banner section.
 *
 * Exported for its own test, for the same reason ./categoryIcons exports its
 * parser: this is the logic that runs against markup the app does not own.
 *
 * Each slide is one `.homepageMainBanner_slide`, and the theme wraps its
 * contents in `<a class="banner_link" href>` only when the block has a link --
 * so the anchor is optional and a slide without one is still a slide. The image
 * is taken from within the slide rather than by document order, which is what
 * keeps an image paired with its own link when any block lacks one.
 *
 * Slides carrying a video and no image are skipped: the theme supports
 * `video_url`/`video_desktop` blocks, this rail draws stills, and a slide with
 * nothing to draw would be a blank page in the carousel.
 *
 * Regex rather than a DOM parse because there is no `DOMParser` in the React
 * Native runtime. The split is on the slide class the theme itself emits, so it
 * survives attribute reordering and unrelated markup changes inside a slide.
 */
export const parseBannerSlides = (html: string): BannerSlide[] => {
  if (!html) {
    return [];
  }
  const out: BannerSlide[] = [];
  // Split on the slide boundary and drop whatever preceded the first one.
  const chunks = html.split(/<div\b[^>]*class="[^"]*homepageMainBanner_slide/i);
  for (const chunk of chunks.slice(1)) {
    if (out.length >= MAX_SLIDES) {
      break;
    }
    const image = pickMobileImage(chunk);
    if (!image) {
      continue;
    }
    const href = /<a\b[^>]*class="[^"]*banner_link[^"]*"[^>]*href="([^"]+)"/i.exec(
      chunk,
    );
    const link = href ? normaliseLink(href[1]) : null;
    out.push({image, link});
  }
  return out;
};

/**
 * The mobile crop from one slide's markup.
 *
 * The theme emits both crops -- often as two `<img>` in a `<picture>`, or one
 * `<img>` with a `srcset` -- so a naive "first src" would take the 1920px
 * desktop asset and pull down four times the bytes for the same picture.
 * Preference order: a filename that names the mobile crop, then any Shopify CDN
 * image at all, so an unrecognised naming convention still yields a banner
 * rather than a gap.
 */
const pickMobileImage = (chunk: string): string | null => {
  const urls: string[] = [];
  const tags = chunk.match(/<(?:img|source)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const src = /\b(?:src|srcset|data-src)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!src) {
      continue;
    }
    for (const part of src[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (!url) {
        continue;
      }
      const abs = url.startsWith('//') ? `https:${url}` : url;
      if (abs.startsWith('https://') && !abs.startsWith('data:')) {
        urls.push(abs);
      }
    }
  }
  if (!urls.length) {
    return null;
  }
  // "600X400_…" / "…-mobile.png" / "Mob_1.png" are the theme's own conventions.
  const mobile = urls.find(u => /600x400|mobile|mob[_-]/i.test(u));
  return mobile || urls[0];
};

/**
 * Reduce a banner href to something the app can navigate.
 *
 * The theme's links are a mix of absolute `https://zigly.com/collections/x?utm…`
 * and Liquid `shopify://pages/x`. Absolute zigly.com URLs are kept whole --
 * their query strings carry campaign sorts (`?sort=Discount:+High+to+Low`) that
 * change what the customer sees, so stripping them would land them on a
 * different page than the banner promises. A `shopify://` reference is resolved
 * the way the storefront resolves it. Anything off-origin is dropped rather
 * than followed: a banner is not a reason to leave the app.
 */
const normaliseLink = (href: string): string | null => {
  const raw = href.trim();
  if (raw.startsWith('shopify://')) {
    const path = raw.slice('shopify://'.length);
    return path ? `/${path}` : null;
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  if (raw.startsWith(`${ZIGLY_ORIGIN}/`) || raw === ZIGLY_ORIGIN) {
    return raw;
  }
  return null;
};

/**
 * Ask the site for the rendered banner and read its slides.
 *
 * The same two-attempt shape as ./categoryIcons: seeded id, then fragment
 * discovery off the homepage if that misses. Kept as its own function rather
 * than shared with the icons module because the two differ in what they parse
 * and in how a partial result is treated, and a shared helper would have to be
 * parameterised on both.
 */
export const fetchBannerSlides = async (
  signal?: AbortSignal,
): Promise<BannerSlide[]> => {
  const bySeed = await fetchSection(SEEDED_SECTION_ID, signal);
  if (bySeed && bySeed.length) {
    return bySeed;
  }
  log('banner slides: seeded id missed, rediscovering');
  return (await discoverAndFetch(signal)) || [];
};

/** One Section Rendering API call, parsed. `null` on any failure. */
const fetchSection = async (
  sectionId: string,
  signal?: AbortSignal,
): Promise<BannerSlide[] | null> => {
  const url = `${ZIGLY_ORIGIN}/?sections=${encodeURIComponent(sectionId)}`;
  try {
    const res = await fetch(url, {credentials: 'omit', signal});
    if (!res.ok) {
      warn('banner section fetch failed:', res.status);
      return null;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const html = body[sectionId];
    if (typeof html !== 'string' || !html) {
      return null;
    }
    return parseBannerSlides(html);
  } catch (e) {
    if (!signal?.aborted) {
      warn('banner section unreachable:', e);
    }
    return null;
  }
};

/** Learn the real section id off the homepage, then fetch by it. */
const discoverAndFetch = async (
  signal?: AbortSignal,
): Promise<BannerSlide[] | null> => {
  try {
    const res = await fetch(`${ZIGLY_ORIGIN}/`, {credentials: 'omit', signal});
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    const re = new RegExp(
      `id="shopify-section-([^"]*${SECTION_FRAGMENT}[^"]*)"`,
      'i',
    );
    const found = re.exec(html);
    if (!found) {
      warn('banner section id not found on homepage');
      return null;
    }
    return await fetchSection(found[1], signal);
  } catch (e) {
    if (!signal?.aborted) {
      warn('banner id discovery failed:', e);
    }
    return null;
  }
};
