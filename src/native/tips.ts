/**
 * "Pet Parenting Made Easy" — the article cards.
 *
 * Section nineteen, and THE ONE SECTION IN THE DASHBOARD THAT CANNOT USE
 * GRAPHQL. Every other native section reads either theme settings or the
 * Storefront API; this one reads the rendered section's HTML, and the reason is
 * a permission rather than a preference.
 *
 * Verified 2026-09-09, against both public tokens `DATA-SOURCES.md` §2 lists:
 *
 *   blog(handle: "all")   -> Access denied for blog field.
 *   articleByHandle(...)  ->   Required access:
 *   articles(first: 2)    ->   `unauthenticated_read_content` access scope.
 *
 * So an article's title, cover and date are simply not readable as data with
 * the credentials the site ships. The theme's blocks carry only handles --
 * `{"article": "all/bond-better-together-with-your-pet"}` -- and its
 * `new-article-card` snippet resolves each to `article.url`, `article.image`,
 * `article.published_at`, `article.title` and two custom metafields
 * (`blog_card_image`, `blog_card_tag`) at render time. Without the scope none
 * of that can be fetched.
 *
 * WHAT THAT LEAVES, and it is a real trade rather than a workaround: the
 * section is fed by the Section Rendering API, the same mechanism the WebView
 * dashboard uses today. It is Zigly's own rendered markup, so it cannot drift
 * from the site -- which is what `DATA-SOURCES.md` §3 recommends the endpoint
 * for. The cost is that this section parses HTML where its neighbours parse
 * JSON, and that a theme change to the article card's classes will break the
 * parse rather than merely restyle it. That is why the parser is small, keyed
 * on the theme's own class names, and covered by its own tests.
 *
 * GRANTING THE SCOPE WOULD REMOVE ALL OF THIS, and it is not this app's
 * decision: it needs `unauthenticated_read_content` on a Shopify app whose
 * token the app then carries, which is for whoever owns the Zigly admin.
 * Recorded so the constraint is visibly external.
 *
 * THE HANDLES ARE STILL WORTH SHIPPING. Seven of them, read from
 * `templates/index.json` -- the HOMEPAGE, because ../webview/extraSections
 * places this section with `{move: 'helpful_tips'}` rather than a fetch. They
 * are not needed to draw the section, since the rendered markup carries its own
 * links; they are here so the app knows how many cards to expect and can hold
 * that many placeholders, and so a card that fails to parse can still be
 * counted rather than silently missing.
 */
import {ZIGLY_ORIGIN} from '../constants/appConstants';
import {log, warn} from '../utils/logger';

/** The section heading, from `heading_helpful_tips`. */
export const TIPS_TITLE = 'Pet Parenting Made Easy';

/** The "View All" control, from `button_helpful_tips` and `button_link`. */
export const TIPS_VIEW_ALL = 'View All';
export const TIPS_VIEW_ALL_PATH = '/blogs/all';

/**
 * The seven article handles the section declares, in block order.
 *
 * Kept for the count and as a cross-check, not as the source of the cards --
 * see the note above.
 */
export const TIP_HANDLES: readonly string[] = [
  'all/bond-better-together-with-your-pet',
  'all/why-your-grooming-visit-deserves-a-quick-vet-check-too',
  'all/small-habits-that-make-a-big-difference-together',
  'all/the-best-food-pairings-for-your-pets-bowl',
  'all/tick-season-is-here-everything-you-need-to-know-about-anti-tick-topicals',
  'all/how-to-train-a-kitten-to-use-the-litter-box-without-losing-your-mind',
  'all/what-to-feed-your-pet-in-summer-a-vet-approved-diet-guide',
];

/** One article card. */
export type Tip = {
  /** The article's path on the storefront. */
  readonly path: string;
  /** Its title, as the theme prints it. */
  readonly title: string;
  /** Cover image URL, or null -- a card keeps its title either way. */
  readonly image: string | null;
  /** The date line the theme prints, verbatim. Null when absent. */
  readonly date: string | null;
};

/**
 * The homepage's template prefix. See ./community on why `template--` and not
 * `sections--`.
 */
const SECTION_ID = 'template--26530973548860__helpful_tips_CEYEgg';
const FRAGMENT = 'helpful_tips';

/** Decode the handful of HTML entities Shopify emits in a title. */
const decode = (raw: string): string =>
  raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .trim();

/** Strip tags and collapse whitespace, for text read out of an element. */
const text = (raw: string): string =>
  decode(raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

/**
 * Read the article cards out of a rendered `helpful_tips` section.
 *
 * Exported for its own test. Keyed on the theme's own class names from
 * `snippets/new-article-card.liquid`:
 *
 *   a.main-collection-article   the card, carrying the article's href
 *   span.time-stamp             the date
 *   p.article-title             the title
 *
 * A card with no title is dropped: the title is the only thing that says what
 * an article is, and a card showing a date and a photograph is a mystery link.
 * A card with no IMAGE is kept, because the title still says what it is -- the
 * same asymmetry ./ConcernRail applies.
 *
 * Regex rather than a DOM parse: there is no `DOMParser` in the React Native
 * runtime.
 */
export const parseTips = (html: string): Tip[] => {
  if (!html) {
    return [];
  }
  const out: Tip[] = [];
  // Split on the card anchor; drop whatever preceded the first one.
  const chunks = html.split(/<a\b[^>]*class="[^"]*main-collection-article[^"]*"/i);
  for (const chunk of chunks.slice(1)) {
    const href = /^[^>]*href="([^"]+)"/i.exec(chunk);
    const path = href ? normalisePath(href[1]) : null;
    if (!path) {
      continue;
    }
    const title = /<p[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(
      chunk,
    );
    const heading = title ? text(title[1]) : '';
    if (!heading) {
      continue;
    }
    const stamp = /<span[^>]*class="[^"]*time-stamp[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(
      chunk,
    );
    out.push({
      path,
      title: heading,
      image: pickImage(chunk),
      date: stamp ? text(stamp[1]) || null : null,
    });
  }
  return out;
};

/**
 * The card's cover image.
 *
 * The snippet prefers a `blog_card_image` metafield and falls back to the
 * article's own featured image, so several `<img>`/`<source>` tags can appear in
 * one card. The first Shopify CDN address wins, which is the metafield's when
 * there is one -- the theme's own preference order.
 */
const pickImage = (chunk: string): string | null => {
  const tags = chunk.match(/<(?:img|source)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attr = /\b(?:src|srcset|data-src)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!attr) {
      continue;
    }
    for (const part of attr[1].split(',')) {
      const raw = part.trim().split(/\s+/)[0];
      if (!raw) {
        continue;
      }
      const url = raw.startsWith('//') ? `https:${raw}` : raw;
      if (url.startsWith('https://') && !url.startsWith('data:')) {
        return url;
      }
    }
  }
  return null;
};

/**
 * Reduce an article href to a storefront path.
 *
 * The theme prints `article.url`, which is site-relative (`/blogs/all/...`).
 * An absolute zigly.com URL is accepted too; anything off-origin is dropped
 * rather than followed.
 */
const normalisePath = (href: string): string | null => {
  const raw = href.trim();
  if (raw.startsWith('/')) {
    return raw;
  }
  if (raw.startsWith(`${ZIGLY_ORIGIN}/`)) {
    return raw.slice(ZIGLY_ORIGIN.length);
  }
  return null;
};

/**
 * Ask the site for the rendered section and read its cards.
 *
 * The same two-attempt shape every section-fetched module in this set uses:
 * the seeded id, then fragment rediscovery off the homepage if that misses.
 * `credentials: 'omit'` -- this is public content and the app's one session
 * belongs to the WebView (DATA-SOURCES.md §7).
 */
export const fetchTips = async (signal?: AbortSignal): Promise<Tip[]> => {
  const bySeed = await fetchSection(SECTION_ID, signal);
  if (bySeed && bySeed.length) {
    return bySeed;
  }
  log('tips: seeded id missed, rediscovering');
  return (await discoverAndFetch(signal)) || [];
};

const fetchSection = async (
  sectionId: string,
  signal?: AbortSignal,
): Promise<Tip[] | null> => {
  const url = `${ZIGLY_ORIGIN}/?sections=${encodeURIComponent(sectionId)}`;
  try {
    const res = await fetch(url, {credentials: 'omit', signal});
    if (!res.ok) {
      warn('tips section fetch failed:', res.status);
      return null;
    }
    const body = (await res.json()) as Record<string, unknown>;
    const html = body[sectionId];
    if (typeof html !== 'string' || !html) {
      return null;
    }
    return parseTips(html);
  } catch (e) {
    if (!signal?.aborted) {
      warn('tips section unreachable:', e);
    }
    return null;
  }
};

const discoverAndFetch = async (
  signal?: AbortSignal,
): Promise<Tip[] | null> => {
  try {
    const res = await fetch(`${ZIGLY_ORIGIN}/`, {credentials: 'omit', signal});
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    const re = new RegExp(`id="shopify-section-([^"]*${FRAGMENT}[^"]*)"`, 'i');
    const found = re.exec(html);
    if (!found) {
      warn('tips section id not found on homepage');
      return null;
    }
    return await fetchSection(found[1], signal);
  } catch (e) {
    if (!signal?.aborted) {
      warn('tips id discovery failed:', e);
    }
    return null;
  }
};
