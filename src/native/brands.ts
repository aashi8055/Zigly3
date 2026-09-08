/**
 * "Top Pet Brands, One Spot!" — two tabs of brand logos, from metaobjects.
 *
 * Section eleven, and the first whose content is neither theme settings nor
 * products. The section's template entry carries ZERO blocks:
 *
 *   page.dog.json :: home_shop_by_brand_section_GYNVPA  blocks: 0
 *
 * because `sections/home-shop-by-brand-section-dog.liquid` opens with
 *
 *   {% assign brand_navigation = shop.metaobjects.brand_navigation.values %}
 *
 * and reads everything from there. So unlike the tile rails, nothing about this
 * section can be written down: the brands, their logos, their links and even
 * the two tab labels are all merchant data, edited in Shopify admin.
 *
 * VERIFIED LIVE 2026-09-08. One `brand_navigation` metaobject, handle
 * `all-brands`, carrying 33 fields. Two tabs -- labelled "Popular" and
 * "Emerging" -- with 12 brands each for the dog page, images resolving to real
 * CDN URLs and links to real collections.
 *
 * THE FIELDS ARE PER-PET AND THE SUFFIX IS THE WHOLE TRICK. The metaobject
 * carries five variants of each list -- no suffix, `_cat`, `_dog`,
 * `_newpawrent`, `_smallpets` -- and the Liquid picks by which section type is
 * rendering:
 *
 *   home-shop-by-brand-section-dog.liquid  -> home_feature_brand_images_dog
 *   home-shop-by-brand-section-cat.liquid  -> home_feature_brand_images_cat
 *   home-shop-by-brand-section.liquid      -> home_feature_brand_images
 *
 * The dashboard is the dog page (see ../webview/pageCache), so the `_dog`
 * fields are the right ones. Reading the unsuffixed pair would be a different
 * brand list under the same heading, and it would look entirely plausible --
 * which is why the field names are written out below rather than built by
 * string concatenation.
 *
 * THREE SECTION TYPES SHARE ONE SECTION ID, which is worth knowing before
 * anybody tries to reconcile them. `home_shop_by_brand_section_GYNVPA` appears
 * in index.json, page.dog.json and page.cat.json with types
 * `home-shop-by-brand-section`, `-dog` and `-cat` respectively, and three
 * different headings:
 *
 *   homepage   "Shop By Brands"
 *   dog page   "Top Pet Brands, One Spot!"   <- the app's
 *   cat page   "Top Pet Brands, One Place"
 *
 * The dog page's is what ../webview/extraSections moves onto the dashboard, so
 * that is the heading here.
 *
 * IMAGES AND LINKS ARE TWO PARALLEL LISTS, PAIRED BY INDEX. That is the
 * theme's own scheme --
 *
 *   {% for feature_image in feature_content %}
 *     {% assign feature_brand_url = feature_content_url[forloop.index0] %}
 *
 * -- and it is the one place index pairing is correct rather than a shortcut,
 * because the merchant maintains the two lists as a pair. It also means a
 * mismatch in their lengths is possible, and ./parseBrands drops the unpaired
 * tail rather than drawing a logo with no destination.
 */
import {storefront} from './storefront';

/** One brand: a logo and the collection behind it. */
export type Brand = {
  /** Logo image URL, absolute https. */
  readonly image: string;
  /** Where a tap goes: a storefront path, or an absolute zigly.com URL. */
  readonly link: string;
  /**
   * A stable key for React, and the accessibility name.
   *
   * Derived from the collection handle rather than from the logo filename: the
   * handle is the stable, human-readable half ("purple-tails" -> "Purple
   * Tails"), while filenames carry sizes and hashes ("475X268_Applod_1.png").
   * The brand's name is nowhere in this metaobject as text for these two tabs,
   * so the handle is the only source for it.
   */
  readonly name: string;
};

/** One tab: the merchant's label and its brands. */
export type BrandTab = {
  readonly label: string;
  readonly brands: readonly Brand[];
};

/**
 * The section heading, from the dog page's own `heading` setting.
 *
 * Not the homepage's "Shop By Brands" and not the cat page's "Top Pet Brands,
 * One Place" -- see the note above on the three section types.
 */
export const BRANDS_TITLE = 'Top Pet Brands, One Spot!';

/**
 * The metaobject, and the four `_dog` fields the dog section reads.
 *
 * Written out rather than built from a pet variable, so that reading the wrong
 * pet's brands is a visible edit rather than a one-character mistake.
 */
const HANDLE = 'all-brands';
const TYPE = 'brand_navigation';

const QUERY = `
  query Brands {
    metaobject(handle: {type: "${TYPE}", handle: "${HANDLE}"}) {
      featureLabel: field(key: "feature_brand_label") { value }
      otherLabel: field(key: "other_brand_label") { value }
      featureImages: field(key: "home_feature_brand_images_dog") {
        references(first: 40) {
          edges { node { ... on MediaImage { image { url } } } }
        }
      }
      featureLinks: field(key: "home_feature_brand_link_dog") { value }
      otherImages: field(key: "home_other_brand_images_dog") {
        references(first: 40) {
          edges { node { ... on MediaImage { image { url } } } }
        }
      }
      otherLinks: field(key: "home_other_brand_image_url_dog") { value }
    }
  }
`;

type ImageList = {
  references?: {edges?: {node?: {image?: {url?: unknown} | null}}[]} | null;
} | null;

type Response = {
  metaobject?: {
    featureLabel?: {value?: unknown} | null;
    otherLabel?: {value?: unknown} | null;
    featureImages?: ImageList;
    featureLinks?: {value?: unknown} | null;
    otherImages?: ImageList;
    otherLinks?: {value?: unknown} | null;
  } | null;
};

/**
 * Turn a collection handle into a brand name.
 *
 * Exported for its own test. "purple-tails" -> "Purple Tails",
 * "arden-grange-dogs" -> "Arden Grange". The `-dogs`/`-cats` suffix is the
 * merchant's way of scoping a brand's collection to one pet and is not part of
 * the brand's name, so it comes off -- otherwise the dashboard would read
 * "Farmina Dogs" beside "Applod Dogs".
 *
 * A best effort, and it is allowed to be: this is a React key and a screen
 * reader's label, not anything drawn on screen. The logos carry the names
 * visually.
 */
export const brandNameFromLink = (link: string): string => {
  const path = link.split('?')[0].replace(/\/+$/, '');
  const handle = path.split('/').pop() || '';
  return handle
    .replace(/-(?:dogs|cats|dog|cat)$/i, '')
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/** Image URLs out of a `list.file_reference` field. */
const imageUrls = (field: ImageList | undefined): string[] => {
  const edges = field?.references?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  const out: string[] = [];
  for (const edge of edges) {
    const url = edge?.node?.image?.url;
    if (typeof url === 'string' && url.startsWith('https://')) {
      out.push(url);
    }
  }
  return out;
};

/**
 * URLs out of a `list.url` field.
 *
 * These arrive as a JSON-encoded array in `value`, not as a list -- so a
 * malformed value must not take the section down with it.
 */
const linkList = (field: {value?: unknown} | null | undefined): string[] => {
  if (typeof field?.value !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(field.value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
};

/**
 * Pair one tab's images with its links.
 *
 * Exported for its own test. Index pairing, as the theme does it -- and the
 * unpaired tail is dropped: a logo with no destination is a control that does
 * nothing, and a destination with no logo has nothing to draw. The theme takes
 * the same view (`{% if feature_image != blank and feature_brand_url != blank %}`).
 */
export const pairBrands = (
  images: readonly string[],
  links: readonly string[],
): Brand[] => {
  const out: Brand[] = [];
  const paired = Math.min(images.length, links.length);
  for (let i = 0; i < paired; i++) {
    const link = normaliseLink(links[i]);
    if (!link) {
      continue;
    }
    out.push({image: images[i], link, name: brandNameFromLink(link)});
  }
  return out;
};

/**
 * Keep a brand link only if it stays on Zigly.
 *
 * The stored values are absolute `https://zigly.com/collections/x`. Anything
 * off-origin is dropped rather than followed: a brand logo is not a reason to
 * leave the app, and this value comes from admin data the app does not control.
 */
const normaliseLink = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const link = raw.trim();
  if (link.startsWith('/')) {
    return link;
  }
  if (/^https:\/\/(?:www\.)?zigly\.com\//i.test(link)) {
    return link;
  }
  return null;
};

/**
 * Read the two tabs.
 *
 * Exported for its own test. A tab with no brands is dropped, so a section
 * whose "Emerging" list the merchant has emptied shows one tab rather than an
 * empty second one -- which is what the theme's own
 * `{% if brand_content.other_brand_label != blank %}` amounts to.
 */
export const parseBrands = (data: Response | null): BrandTab[] => {
  const m = data?.metaobject;
  if (!m) {
    return [];
  }
  const tabs: BrandTab[] = [];

  const feature = pairBrands(imageUrls(m.featureImages), linkList(m.featureLinks));
  if (feature.length) {
    tabs.push({
      label: label(m.featureLabel, 'Popular'),
      brands: feature,
    });
  }

  const other = pairBrands(imageUrls(m.otherImages), linkList(m.otherLinks));
  if (other.length) {
    tabs.push({
      label: label(m.otherLabel, 'Emerging'),
      brands: other,
    });
  }

  return tabs;
};

/**
 * A tab's label, trimmed.
 *
 * The live `feature_brand_label` is `"Popular "` -- with a trailing space, as
 * merchant-entered text tends to be -- which would show as a wider pill than
 * its neighbour. The fallback is the label observed live, so a metaobject with
 * the label cleared still names its tab something true rather than "Tab 1".
 */
const label = (field: {value?: unknown} | null | undefined, fallback: string): string => {
  const value = typeof field?.value === 'string' ? field.value.trim() : '';
  return value || fallback;
};

/** Ask for the brands. `[]` on any failure, so a caller can retry. */
export const fetchBrands = async (
  signal?: AbortSignal,
): Promise<BrandTab[]> => {
  const data = await storefront<Response>(QUERY, {}, signal);
  return parseBrands(data);
};
