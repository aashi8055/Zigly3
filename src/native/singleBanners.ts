/**
 * The three single banners: Furpro, Vet Care and the brand-claims strip.
 *
 * Sections thirteen and twenty-three of the dashboard, plus one the dashboard
 * does not use -- all three instances of the theme's `custom-single-banner`,
 * declared together because they are the same shape and three copies of the
 * same handling is how they drift.
 *
 * A SINGLE BANNER IS AN IMAGE AND A LINK, and nothing else on this store.
 * `sections/custom-single-banner.liquid` supports a heading, a description and
 * a button over the artwork, but all three settings are EMPTY on all three
 * instances -- `banner_heading: ""`, `banner_description: ""`,
 * `button_text: ""`. So the text-and-button branch of that section never
 * renders, and what ships is a picture wrapped in an anchor. `text_color`,
 * `button_text_color` and `button_bg_color` are set but style nothing;
 * recorded so they do not look overlooked.
 *
 * WHICH IS WHY THESE HAVE NO LABEL TO FALL BACK ON. The words are lettering
 * inside the artwork, exactly as with the offer rails -- so an unresolved
 * banner is a blank strip that may or may not navigate, and ./SingleBanner
 * draws nothing rather than that. ./OfferRail carries the full argument.
 *
 * THE MOBILE CROP, NEVER THE DESKTOP ONE. Each carries both -- `1680X324` and
 * `600X210` -- and the theme picks between them with a media query at 749px.
 * On a phone the answer is always the mobile asset, which is a third of the
 * bytes and cut for a phone's aspect.
 *
 * ONE OF THE THREE HAS NO LINK. The brand-claims strip's `button_link` is
 * empty: it is a statement, not a control. That is the theme's own choice and
 * ./SingleBanner honours it -- the banner draws, and it does not announce
 * itself as a link or take a press state.
 */
import type {Tile} from './tileIcons';

/** ../webview/pageCache's own template prefix for the dog page. */
const DOG = 'template--26530973942076__';

/**
 * One banner.
 *
 * Shaped as ./tileIcons' `TileRail` so the artwork resolution is shared, with
 * exactly one tile in it. `path` is empty for a banner with no link -- see
 * `LOGOS` below.
 */
export type SingleBanner = {
  readonly storeKey: string;
  readonly sectionId: string;
  readonly fragment: string;
  /** The one tile: its artwork key, its link and its accessibility name. */
  readonly tiles: readonly Tile[];
};

const banner = (
  storeKey: string,
  section: string,
  label: string,
  path: string,
  key: string,
): SingleBanner => ({
  storeKey,
  sectionId: DOG + section,
  fragment: 'custom_single_banner',
  tiles: [{label, path, key}],
});

/**
 * The Vet Care banner -- `custom_single_banner#2` in
 * ../webview/extraSections, `custom_single_banner_WGCJEB` in the theme.
 *
 * ../webview/extraSections flags this as "the one block in this chain that is a
 * standing placement rather than a match to a named section in the dashboard
 * order -- recorded so it does not read as a stray and get tidied away." It
 * sits directly under the price tiles, which is where it sits on Zigly's own
 * pet pages, and that placement is kept.
 */
export const VET_CARE_BANNER = banner(
  'zigly.singleBanner.vetCare.v1',
  'custom_single_banner_WGCJEB',
  'Advanced Vet Care, Anytime You Need It',
  '/pages/vet-care-page',
  '600X210_VetCare_1.png',
);

/**
 * The brand-claims strip -- `custom_single_banner#3`,
 * `custom_single_banner_kKkUwL`. Last section on the dashboard, so it sits
 * directly above the footer.
 *
 * `path` is deliberately empty: the theme's `button_link` is blank on this
 * instance. It is a row of claim icons, not a destination.
 */
export const LOGOS_BANNER = banner(
  'zigly.singleBanner.logos.v1',
  'custom_single_banner_kKkUwL',
  'Zigly brand promises',
  '',
  '600X210_BrandClaims_1_bc7011c7-2cc8-47a6-ab90-7de4d1357bc9.png',
);

/**
 * The Furpro banner -- `custom_single_banner#1`,
 * `custom_single_banner_QYTfgc`.
 *
 * NOT ON THE DASHBOARD, and declared here anyway. ../webview/extraSections
 * seeds its id (`/|custom_single_banner#1`) but no entry places it, so the app
 * does not show it -- while the dog page does, at order position 8. Written
 * down so the next reader can see the set is complete and that its absence is
 * the app's own decision rather than something missed.
 */
export const FURPRO_BANNER = banner(
  'zigly.singleBanner.furpro.v1',
  'custom_single_banner_QYTfgc',
  'Furpro grooming range',
  '/collections/furpro',
  '600X210_Furpro_mobile.png',
);

/** The two the dashboard draws, in dashboard order. */
export const DASHBOARD_BANNERS: readonly SingleBanner[] = [
  VET_CARE_BANNER,
  LOGOS_BANNER,
];
