/**
 * The dashboard's full-width banners: Vet Care, the double banner's two halves,
 * the brand-claims strip -- and Furpro, which the dashboard does not draw.
 *
 * Sections thirteen, eighteen and twenty-three. Three are instances of the
 * theme's `custom-single-banner`; the other two are the two halves of
 * `redesign-custom-double-banner`, which stacks on a phone and therefore reads
 * as two of these. They are declared together because they are the same shape
 * to a customer, and separate copies of the same handling is how they drift.
 *
 * A BANNER HERE IS AN IMAGE AND A LINK, and nothing else on this store.
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
  /**
   * The artwork's own aspect ratio, width over height.
   *
   * Carried per banner rather than fixed in the component, because these are
   * not all the same shape: the `custom-single-banner` mobile crops are 600x210
   * (20:7) while the double banner's are 1350x535 (nearly 5:2). A single
   * hardcoded ratio would letterbox one set or crop the other, and the crop
   * would take the lettering with it -- these banners' words are inside the
   * picture.
   */
  readonly ratio: number;
};

/** 600x210, the `custom-single-banner` mobile crop. */
const SINGLE_RATIO = 600 / 210;

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
  ratio: SINGLE_RATIO,
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

/**
 * The double banner — "Let's Paw-ty!" and the gift-card block.
 *
 * ONE theme section (`redesign_custom_double_banner_FqtJbt`) carrying TWO
 * banners in numbered settings: `background_image_url_1` / `_2`,
 * `button_link_1` / `_2`. Its own stylesheet drops both to `width: 100%` below
 * 749px, so on a phone they stack and read as two blocks one after the other --
 * which is what ../webview/extraSections records and how the dashboard order
 * lists them.
 *
 * So they are declared as two banners here, sharing one section id and one
 * store: a single fetch resolves both, and ./tileIcons' merge-on-save means
 * neither overwrites the other. That is why these two are the only banners
 * whose `storeKey` and `sectionId` are shared.
 *
 * The artwork is 1350x535 -- landscape, and much wider than the 600x210 of the
 * single banners, so ./SingleBanner takes its ratio from the tile rather than
 * assuming one.
 *
 * THE SECOND BANNER IS A PLACEHOLDER AND IT IS STILL DRAWN. Its artwork is
 * literally named `GiftCard_1350X535_Coming-Soon.png` and its link is the bare
 * `shopify://collections` -- the collections list, not a collection. Zigly ship
 * it that way and the app shows what the site shows; suppressing it would be
 * this app deciding a merchant's placement was a mistake. Recorded so it is not
 * read as a bug on first sight.
 */
export const PAWTY_BANNER: SingleBanner = {
  storeKey: 'zigly.singleBanner.double.v1',
  sectionId: DOG + 'redesign_custom_double_banner_FqtJbt',
  fragment: 'redesign_custom_double_banner',
  tiles: [
    {
      label: "Let's Paw-ty! Birthday shop",
      path: '/collections/birthday-dog',
      key: 'Birthday_Dog_1350X535_8042bd77-c0d9-4d63-b574-55a5f0167d05.png',
    },
  ],
  // 1350x535, the double banner's own crop.
  ratio: 1350 / 535,
};

export const GIFT_CARD_BANNER: SingleBanner = {
  storeKey: 'zigly.singleBanner.double.v1',
  sectionId: DOG + 'redesign_custom_double_banner_FqtJbt',
  fragment: 'redesign_custom_double_banner',
  tiles: [
    {
      label: 'Gift cards, coming soon',
      // The theme's own `shopify://collections` -- the collections LIST.
      path: '/collections',
      key: 'GiftCard_1350X535_Coming-Soon.png',
    },
  ],
  ratio: 1350 / 535,
};

/** The four the dashboard draws, in dashboard order. */
export const DASHBOARD_BANNERS: readonly SingleBanner[] = [
  VET_CARE_BANNER,
  PAWTY_BANNER,
  GIFT_CARD_BANNER,
  LOGOS_BANNER,
];
