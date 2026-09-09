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
  /**
   * This section can be taller than the viewport, so it must not be clipped.
   *
   * ../native/NativeDashboard scrolls with `removeClippedSubviews`, and on
   * Android the clipping stops re-attaching the children that follow a section
   * taller than the viewport -- the failure that once left Real Pets, From Our
   * Instagram and the logo strip permanently missing, with the video block's
   * navy ground reading as a wall ending the page.
   *
   * Marking a section here opts THAT SECTION out of the clipping and leaves
   * the others clipped, which is where the scrolling gain comes from.
   *
   * NOTHING SETS IT TODAY, and it is kept rather than removed. The video block
   * was the only section that ever needed it and that section is now hidden
   * (see `video` below), so the constraint is currently satisfied by every
   * section on the page. The flag stays because the constraint has not gone
   * away: it is a property of the scroller, not of that one block, and the
   * next section that outgrows a short screen would hit the same bug with no
   * hint as to why. Left as the documented escape hatch, with the mechanism
   * wired up in ../native/NativeDashboard.
   */
  readonly tall?: boolean;
};

/**
 * The dashboard, top to bottom.
 *
 * Adding a section natively means flipping `native` here and adding the case in
 * ./NativeDashboard -- nothing else, and nothing about the order moves.
 */
export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
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
    source: 'theme',
    fragment: 'offer_section#1',
    native: true,
  },
  {
    key: 'offers-treats',
    title: 'Applod Treats',
    source: 'theme',
    fragment: 'offer_section#2',
    native: true,
  },
  /**
   * Zigly Coins and the discount offer tiles.
   *
   * Named `best_deals` in the theme and it is NOT a product section -- it holds
   * the coins banner and the category offer tiles. ../webview/extraSections
   * records the same warning, because the name invites exactly the wrong
   * assumption. Confirmed on reading it: one banner, six category blocks, not
   * one product and not one price.
   *
   * Two things about it are unlike every section above:
   *
   * It is a GRID, not a rail -- the theme's own shape on a phone, which
   * collapses to one column below 1000px and lays the six tiles out as
   * `repeat(3, 1fr)`, dropping to `repeat(2, 1fr)` below 400px.
   *
   * And its banner LEAVES zigly.com: Zigly Prime on `ziglyprime.erlpaas.com`,
   * which ../constants/appConstants deliberately lists as an INTERNAL host
   * because that flow asks for a mobile number and sending it to the browser
   * broke it. So this section is the first to hand up an absolute URL rather
   * than a storefront path.
   */
  {
    key: 'coins',
    title: null,
    source: 'theme',
    fragment: 'best_deals',
    native: true,
  },
  /**
   * "Top Pet Brands, One Spot!" -- two tabs of brand logos.
   *
   * `graphql`, and the only section so far whose content is neither theme
   * settings nor products: its template entry carries ZERO blocks, because
   * `home-shop-by-brand-section-dog.liquid` reads
   * `shop.metaobjects.brand_navigation.values` instead. Verified live -- one
   * metaobject, 24 brands across two tabs, resolvable in one query.
   *
   * THE FIELDS ARE PER-PET. The metaobject carries five variants of each list
   * (no suffix, `_cat`, `_dog`, `_newpawrent`, `_smallpets`) and the Liquid
   * picks by section type. The dashboard is the dog page, so `_dog` is right;
   * the unsuffixed pair would be a different brand list under the same
   * heading, and it would look entirely plausible.
   *
   * THREE SECTION TYPES SHARE THIS SECTION ID, with three headings: the
   * homepage's "Shop By Brands", the dog page's "Top Pet Brands, One Spot!"
   * and the cat page's "Top Pet Brands, One Place". ../webview/extraSections
   * moves the dog page's onto the dashboard, so that is the heading.
   */
  {
    key: 'brands',
    title: 'Top Pet Brands, One Spot!',
    source: 'graphql',
    fragment: 'home_shop_by_brand_section',
    native: true,
  },
  /**
   * The six price tiles, three across rather than as a rail.
   *
   * The ONE section in the dashboard that needs no network: every tile is a
   * heading, a price string, a colour and a link, all theme block settings,
   * with no artwork to resolve. Complete on the first frame of a first launch
   * with no connection.
   *
   * Thirteen blocks in the theme, of which six are enabled. The seven disabled
   * ones are visibly unfinished -- three say "Lorem Ipsum", one prices at
   * "₹999.00" where the live ones use "₹999", and all seven link to "/" -- so
   * a rebuild reading the block list wholesale would put placeholder copy on
   * the dashboard.
   *
   * Three across, not the theme's rail: ../webview/injectedStyles already
   * overrides the Swiper here with `grid-template-columns: repeat(3, minmax(0,
   * 1fr))`, so that is what the customer's app shows today.
   */
  {
    key: 'price-tiles',
    title: 'Find the Best Deals!',
    source: 'theme',
    fragment: 'shop_by_price',
    native: true,
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
    source: 'theme',
    fragment: 'custom_single_banner#2',
    native: true,
  },
  {
    key: 'concern',
    title: 'Care by Concern',
    source: 'theme',
    fragment: 'shop_of_concern',
    native: true,
  },
  /**
   * "Zigly Style Steals" -- the third `offer-section`, seven tiles.
   *
   * BUILT BUT NOT YET MARKED NATIVE, deliberately, and this is the one entry
   * where `native: false` does not mean "not written". ./offerRails carries its
   * tiles as `STYLE_STEALS` and ./OfferRail draws it; it is the same component
   * as Applod Food and Applod Treats above with a different tile list, and it
   * was finished alongside them because declaring three copies of the same
   * section separately is how they drift.
   *
   * It stays false because `native` has to stay a contiguous run from the top
   * -- five web sections sit between it and Applod Treats -- and
   * ../../__tests__/dashboardSections.test.ts enforces that so a partial
   * switch-over remains possible at any point. Flipping this one alone would
   * buy nothing and lose that guarantee. It flips when the five above it do.
   */
  {
    key: 'offers-style',
    title: 'Zigly Style Steals',
    source: 'theme',
    fragment: 'offer_section#3',
    native: true,
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
    native: true,
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
   *
   * TWO THINGS FOUND WHEN IT WAS BUILT.
   *
   * The Dogs tab is BOTH of the dog page's tabs together (Puppy + Adult) and
   * the Cats tab is both of the cat page's (Kitten + Cat) -- so the merge is
   * not tab-for-tab, and the two tabs a customer taps correspond to no single
   * tab in either template.
   *
   * And one tile cannot be drawn at all: the dog page's Adult tab has a slot
   * with a link (`shopify://collections/wet-dog-food-adult`) and no image. The
   * theme's own loop skips it, these tiles carry no text, and a blank square
   * that navigates is worse than one fewer tile -- so twenty of the
   * twenty-one slots are drawn. ./everything records it so the absence is not
   * read as an oversight.
   *
   * `theme`, because the tiles are block settings; only the artwork is
   * learned, from both pages.
   */
  {
    key: 'everything',
    title: 'Everything For Your Pet',
    source: 'theme',
    fragment: null,
    native: true,
  },
  {
    key: 'double-banner',
    title: null,
    source: 'theme',
    fragment: 'redesign_custom_double_banner',
    native: true,
  },
  /**
   * "Pet Parenting Made Easy" -- the article cards.
   *
   * THE ONLY NATIVE SECTION FED BY PARSED HTML, and `source: 'section'` here is
   * a permission rather than a preference. Verified 2026-09-09 that BOTH public
   * Storefront tokens are denied blog content:
   *
   *   Access denied for blog field.
   *   Required access: `unauthenticated_read_content` access scope.
   *
   * The theme's blocks carry only article handles and its `new-article-card`
   * snippet resolves each to a title, cover, date and two metafields at render
   * time -- none of which can be fetched as data with the credentials the site
   * ships. So this section reads the rendered markup, which is Zigly's own and
   * therefore cannot drift, at the cost of a parse that a theme change to the
   * card's class names would break.
   *
   * Granting the scope would remove all of that, and it is not this app's
   * decision to make. ./tips carries the full note.
   */
  {
    key: 'tips',
    title: 'Pet Parenting Made Easy',
    source: 'section',
    fragment: 'helpful_tips',
    native: true,
  },
  /**
   * The promotional video block.
   *
   * `frozen`, not `theme`, and the correction is worth the entry. This was
   * `theme` with a `custom_video_text_banner` fragment, on the reading that the
   * poster came from a `video_poster` setting the app would learn from the
   * rendered section. It does not: the dog page's copy of the section sets
   * `video_link` to a YouTube URL and no poster at all, so the section emits a
   * bare `<iframe>` with no image in it. The app spent every launch fetching
   * that section to look for a picture that was never there -- and, because
   * ../native/VideoBlock returned null without one, drew no section at all.
   *
   * The heading, the copy and the navy ground are theme settings held in the
   * app; the poster is derived from the video id against YouTube's own image
   * host. So nothing about this section is read from zigly.com at runtime, and
   * `fragment` is null because there is no longer a section to compare a native
   * version against. ./video carries the full reading.
   */
  {
    key: 'video',
    title: null,
    source: 'frozen',
    fragment: null,
    /*
     * HIDDEN, and the entry stays as the record of that.
     *
     * `native: false` rather than a deleted entry: this list is the dashboard's
     * running order and the one place the full set of sections is written
     * down, so a section the app deliberately does not draw has to be
     * distinguishable from one nobody has got to yet. ../../__tests__ read
     * this file for exactly that.
     *
     * WHY IT IS HIDDEN. The block never played anything. React Native has no
     * `<Video>` and no media package is installed, so ../native/VideoBlock
     * drew the poster frame, the heading and a 431-character paragraph -- a
     * still photograph of a brown living room, filling most of a screen, that
     * did nothing when tapped. It was also the tallest section on the page by
     * a wide margin, which is what put the three sections after it behind the
     * clipping bug the note on `removeClippedSubviews` in
     * ../native/NativeDashboard records.
     *
     * So the component and ./video are both kept -- nothing is deleted, and
     * flipping this back to true restores the section as it was -- but the
     * dashboard does not draw a video it cannot play. Wiring a real player is
     * the dependency decision ../native/VideoBlock's own header sets out.
     */
    native: false,
  },
  {
    key: 'community',
    title: 'Real Pets. Real Stories. Real Community.',
    source: 'theme',
    fragment: 'about_our_communities',
    native: true,
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
    native: true,
  },
  /** The brand-claims logo strip. Last, so it sits directly above the footer. */
  {
    key: 'logos',
    title: null,
    source: 'theme',
    fragment: 'custom_single_banner#3',
    native: true,
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
