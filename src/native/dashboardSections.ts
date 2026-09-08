/**
 * THE DASHBOARD, IN ORDER. One list, and the only list.
 *
 * The app's dashboard is not zigly.com's homepage. It is a reconstruction:
 * ../webview/extraSections declares eighteen entries, three more sections are
 * placed by their own modules (../webview/breedSection, ../webview/hotPicks,
 * ../webview/explorePicker), the category rail and banner come from
 * ../webview/homeLayout, and two of the homepage's own sections are hidden
 * outright. Read across five files, in three different placement mechanisms,
 * the order is genuinely hard to see -- and a reader of any one file gets it
 * wrong.
 *
 * So it is written down once, here, and both the screen and the tests read it
 * from this file. That is the point: "the native dashboard matches the app's
 * section list" becomes something a test asserts rather than something a person
 * remembers.
 *
 * HOW THE ORDER WAS DERIVED, so it can be re-derived rather than trusted:
 *
 *   1. ../webview/homeLayout puts the category rail directly under the search
 *      band, with the banner below it -- the reverse of the live site, which is
 *      an explicit reorder in that file.
 *   2. ../webview/extraSections anchors the coupon strip immediately after the
 *      banner, then walks its own SECTIONS array in declaration order.
 *   3. ../webview/breedSection anchors after `coupon || banner`, so the two
 *      breed rails land between the coupon strip and the rest.
 *   4. ../webview/hotPicks anchors after `zigly-breed-cats`.
 *   5. ../webview/explorePicker anchors after `zigly-hot-picks`.
 *   6. extraSections' remaining entries follow, in its declared order, because
 *      its `tail` starts at `zigly-explore || zigly-hot-picks ||
 *      zigly-breed-cats || banner`.
 *
 * WHY THE WEB ORDER IS THE TARGET AND NOT THE THEME'S. templates/page.dog.json
 * has its own order and it is close but not equal: the dashboard hides both
 * arrival sections, moves four sections from where the page puts them, and adds
 * two rails (bestsellers, Instagram) the page does not have. The customer's app
 * today is the reconstruction, so matching it is what "same to same" means.
 *
 * `source` records where a section's data comes from, because it is the thing
 * that decides how hard each remaining one is:
 *
 *   theme     Settings and blocks in zigly-website-code, read at build time.
 *   graphql   Storefront API -- products, collections, metaobjects.
 *   section   The Section Rendering API, for markup that has no data behind it
 *             (banner artwork, a promotional tile's image and link).
 *   frozen    Shipped in the app; not read from the site at all. Instagram
 *             only -- see ../webview/instagramSection for why.
 */

/** What feeds a section. See the note above. */
export type SectionSource = 'theme' | 'graphql' | 'section' | 'frozen';

export type DashboardSection = {
  /**
   * The app's own stable key for this slot.
   *
   * Not the Shopify section id: those carry a theme-generated suffix that
   * changes on every re-save (../webview/pageCache says so at length), so an id
   * cannot be an identity. This is what the native screen switches on and what
   * the tests name.
   */
  readonly key: string;
  /**
   * The heading as the customer reads it, or null where the section has none.
   *
   * Taken from the app's own rendering, which is not always the site's: the two
   * breed rails are both titled "Breed Ready Picks" on their source pages and
   * ../webview/breedSection suffixes them to disambiguate. The category rail's
   * own heading is hidden by ../webview/injectedStyles, so it is null here.
   */
  readonly title: string | null;
  /** Where the data comes from. */
  readonly source: SectionSource;
  /**
   * The fragment ../webview/pageCache fetches this section by, where one
   * exists. Null for sections the app builds itself.
   *
   * Kept for the migration rather than for runtime: it is how a native section
   * is checked against the web one it replaces.
   */
  readonly fragment: string | null;
  /** True once this section is drawn natively. */
  readonly native: boolean;
};

/**
 * The dashboard, top to bottom.
 *
 * Adding a section natively means flipping `native` here and adding the case in
 * ./NativeDashboard -- nothing else, and nothing about the order moves.
 */
export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  // --- Done -----------------------------------------------------------------
  {
    key: 'categories',
    // Its own heading is hidden: the reference app runs the circles straight
    // under the search band.
    title: null,
    source: 'theme',
    fragment: 'home_category_section',
    native: true,
  },
  {
    key: 'banner',
    title: null,
    source: 'section',
    fragment: 'homepage_banner',
    native: true,
  },
  {
    key: 'coupons',
    title: null,
    source: 'graphql',
    fragment: 'coupon_slider',
    native: true,
  },

  /**
   * The two breed rails, dogs then cats.
   *
   * Placed by ../webview/breedSection, which anchors after the coupon strip.
   * Both source sections are titled "Breed Ready Picks"; the suffixes are the
   * app's own, added because the two are shown together here and the site never
   * shows them that way.
   *
   * `theme`, not `graphql`: these are breed *cards* -- artwork, a label and a
   * page link, all of them theme blocks -- not product cards. No product data is
   * involved. The artwork URLs are learned from the rendered section the way the
   * category circles' are; see ./tileIcons.
   *
   * The two rails come from two different pages, which is not obvious and is
   * forced by the theme: the dog page's section carries 25 enabled `dog_card`
   * blocks AND 7 `cat_card` blocks that are all `disabled` with wrong URLs
   * (Tabby pointing at Pedigree dog food). The cats therefore come from
   * `/pages/cat`. ./breeds carries the full reading.
   */
  {
    key: 'breeds-dogs',
    title: 'Breed Ready Picks - Dogs',
    source: 'theme',
    fragment: 'home_shop_by_breed_section@dog',
    native: true,
  },
  {
    key: 'breeds-cats',
    title: 'Breed Ready Picks - Cats',
    source: 'theme',
    fragment: 'home_shop_by_breed_section@cat',
    native: true,
  },
  // --- Remaining ------------------------------------------------------------
  /**
   * "Hot Picks of The Week", with a New Arrivals tab. Placed by
   * ../webview/hotPicks, anchored after the cats rail.
   *
   * TWO CORRECTIONS TO WHAT THIS ENTRY FIRST SAID, both found when the section
   * was actually built, and both the same mistake -- reading the manifest's
   * first draft from a source the app had already abandoned.
   *
   * The title was "Hot Picks For Your Pet". The section is headed "Hot Picks of
   * The Week", which is also its first tab's label; ../webview/hotPicks sets
   * both to that string.
   *
   * The fragment was `home_arrival_section@dog`. That is the superseded source:
   * the section used to be filled from the arrival rails on the pet pages, and
   * ../webview/hotPicks records that this was "the wrong products under the
   * right heading" because Zigly publish two collections for exactly this. It
   * now reads /collections/hot-picks-squeaker-toys and /collections/hot-deals,
   * so there is no section fragment behind it at all -- and the change dropped
   * 894 KB of section HTML for two small queries.
   */
  {
    key: 'hot-picks',
    title: 'Hot Picks of The Week',
    source: 'graphql',
    fragment: null,
    native: true,
  },
  /**
   * "Explore. Pick. Pamper." -- four tabs of category tiles. Placed by
   * ../webview/explorePicker, anchored after hot picks.
   *
   * The title was "Explore More" in this manifest's first draft; the section's
   * own `section_heading` setting on both source pages is
   * "Explore. Pick. Pamper.", which is what ../webview/explorePicker renders.
   *
   * `theme`, because the tiles are tab-block settings read at build time -- and
   * that is a deliberate departure from the web version, which has to parse the
   * rendered section. That markup is malformed (each tile's link is closed by
   * repeating the opening `<a href>` rather than with `</a>`), so a parser gets
   * the wrong anchor about half the time. Only the artwork needs the network.
   *
   * Sourced from BOTH pet pages and merged: 32 tiles, 8 per tab, dog and cat
   * interleaved. ./explore carries why the merge cannot de-duplicate by label.
   */
  {
    key: 'explore',
    title: 'Explore. Pick. Pamper.',
    source: 'theme',
    fragment: 'explore_product@dog',
    native: true,
  },
  // From here down, ../webview/extraSections' own declaration order.
  {
    key: 'offers-food',
    title: 'Applod Food',
    source: 'section',
    fragment: 'offer_section#1',
    native: false,
  },
  {
    key: 'offers-treats',
    title: 'Applod Treats',
    source: 'section',
    fragment: 'offer_section#2',
    native: false,
  },
  /**
   * Zigly Coins and the discount offer tiles.
   *
   * Named `best_deals` in the theme and it is NOT a product section -- it holds
   * the coins banner and the category offer tiles. ../webview/extraSections
   * records the same warning, because the name invites exactly the wrong
   * assumption.
   */
  {
    key: 'coins',
    title: null,
    source: 'section',
    fragment: 'best_deals',
    native: false,
  },
  {
    key: 'brands',
    title: 'Top Pet Brands, One Spot!',
    source: 'section',
    fragment: 'home_shop_by_brand_section',
    native: false,
  },
  /** The six price tiles, laid out 2x3 rather than as a rail. */
  {
    key: 'price-tiles',
    title: 'Find the Best Deals!',
    source: 'section',
    fragment: 'shop_by_price',
    native: false,
  },
  /**
   * The Vet Care banner.
   *
   * ../webview/extraSections flags this as the one block in the chain that is a
   * standing placement rather than a match to a named section in the reference
   * order -- recorded so it does not read as a stray and get tidied away.
   */
  {
    key: 'vet-banner',
    title: null,
    source: 'section',
    fragment: 'custom_single_banner#2',
    native: false,
  },
  {
    key: 'concern',
    title: 'Care by Concern',
    source: 'section',
    fragment: 'shop_of_concern',
    native: false,
  },
  {
    key: 'offers-style',
    title: 'Zigly Style Steals',
    source: 'section',
    fragment: 'offer_section#3',
    native: false,
  },
  /**
   * Bestsellers.
   *
   * The dashboard's largest fetch by far -- 585 KB of section HTML for
   * twenty-two cards, from `/collections/all?sort_by=best-selling`. The biggest
   * single payload win available in this migration, and the section that
   * carries the real product card.
   */
  {
    key: 'bestsellers',
    title: 'Bestsellers',
    source: 'graphql',
    fragment: null,
    native: false,
  },
  /**
   * "Everything For", with Dogs and Cats tabs.
   *
   * A reserved slot, not a fetch, and the tabs are the app's own construction:
   * ../webview/everythingSection fetches `everything@dog` AND `everything@cat`,
   * uses the dog section as the frame, and relabels its two tabs -- the dog
   * page ships Puppy / Adult and the cat page ships Kitten / Cat, and no
   * template anywhere has Dogs / Cats. So `fragment` is null: there is no
   * single section to compare a native version against.
   *
   * The tiles stay Zigly's own with their real collection links; only which
   * tiles sit behind which label changes. A native version has to do the same
   * merge, which is why this is recorded here rather than looking like an
   * ordinary one-section fetch.
   */
  {
    key: 'everything',
    title: 'Everything For Your Pet',
    source: 'section',
    fragment: null,
    native: false,
  },
  {
    key: 'double-banner',
    title: null,
    source: 'section',
    fragment: 'redesign_custom_double_banner',
    native: false,
  },
  {
    key: 'tips',
    title: 'Pet Parenting Made Easy',
    source: 'section',
    fragment: 'helpful_tips',
    native: false,
  },
  {
    key: 'video',
    title: null,
    source: 'section',
    fragment: 'custom_video_text_banner',
    native: false,
  },
  {
    key: 'community',
    title: 'Real Pets. Real Stories. Real Community.',
    source: 'section',
    fragment: 'about_our_communities',
    native: false,
  },
  /**
   * The rail that closes the dashboard.
   *
   * The one section not sourced from zigly.com: the site has no Instagram
   * section and nothing on it pulls a feed. Eight shortcodes are frozen in
   * ../webview/instagramSection and the covers are derived from them. See
   * DATA-SOURCES.md §9 for the full argument and the cost.
   */
  {
    key: 'instagram',
    title: 'From Our Instagram',
    source: 'frozen',
    fragment: null,
    native: false,
  },
  /** The brand-claims logo strip. Last, so it sits directly above the footer. */
  {
    key: 'logos',
    title: null,
    source: 'section',
    fragment: 'custom_single_banner#3',
    native: false,
  },
];

/**
 * The two homepage sections the dashboard deliberately does not show.
 *
 * Recorded because "the list is complete" has to include what was left out on
 * purpose. Neither arrival section appears in the reference dashboard: the
 * picks rail is built from the pet pages by ../webview/hotPicks instead, and
 * ../webview/extraSections marks these for hiding explicitly rather than
 * letting it happen as a side effect of a relocation.
 */
export const HIDDEN_SECTIONS: readonly string[] = ['home_arrival_section'];

/** How far along the migration is. Used by the tests and worth reading. */
export const nativeCount = (): number =>
  DASHBOARD_SECTIONS.filter(s => s.native).length;
