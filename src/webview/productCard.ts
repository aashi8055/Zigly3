/**
 * ONE product card, everywhere the app draws one.
 *
 * WHY THIS FILE EXISTS. The card trim -- brand line out, discount chip out,
 * delivery row out, reserved price heights released -- was written by hand
 * three times over in ./injectedStyles.ts, once per surface:
 *
 *     #zigly-hot-picks .card-wrapper .product--brand--wrapper,
 *     [id^="zigly-x-"]  .card-wrapper .product--brand--wrapper,
 *     body.zigly-listing .card-wrapper .product--brand--wrapper { ... }
 *
 * Three copies of every selector, kept in step by nothing but attention. They
 * drifted, and the drift is what the customer saw: some blocks named all three
 * surfaces, some named one, so the same product wore a different card depending
 * on which page it was on.
 *
 * And a fourth surface was missing from every one of them.
 *
 * THE SEARCHTAP CARD. A listing page shows TWO different product cards. Before
 * any sort or filter, the theme's server-rendered grid. The moment either is
 * applied, SearchTap empties `.searchtap-temp` and renders its OWN grid.
 *
 * The trap is that SearchTap's card DOES carry `card-wrapper` and
 * `product-card-wrapper` on its root -- so `body.zigly-listing .card-wrapper`
 * looks like it covers both. It does not. None of the theme's INNER class names
 * exist inside a SearchTap card: no `.product--brand--wrapper`, no
 * `.custom_price__container`, no `.estimate-delivery--date-wrapper`. Every
 * descendant rule therefore matched nothing, and the card snapped back to the
 * raw site design the instant a sort was applied -- which is what "the styling
 * is impacting sort and filter" describes. The functionality was never broken;
 * the card under it changed identity and the styling did not follow.
 *
 * WHAT THIS DOES. Names each surface once, names each card's parts once, and
 * generates the cross product. Adding a surface is one entry in SURFACES;
 * adding a rule is one entry in the card blocks, and it lands on every surface
 * and BOTH card components at the same time. There is no longer a version of
 * this that can half-apply.
 *
 * WHAT IT DOES NOT DO. Presentation only, exactly as before -- this is the same
 * body of CSS, addressed differently. Nothing is removed from the DOM, every
 * control keeps its own listeners, and no rule here hides anything the sort or
 * filter bridge reads or clicks: ../webview/facetBridge drives SearchTap's own
 * checkboxes and its store, and none of the parts named below are among them.
 * See the note on `.st-overlay-active` in ./injectedStyles.ts -- hiding an
 * engine's own root is the mistake this file is careful not to repeat.
 */

/**
 * Every surface that draws a product card, as a CSS scope.
 *
 * Read off the sections this app builds and the pages it flags:
 *
 *   body.zigly-listing   collection and search pages -- ./listingPage sets it.
 *   #zigly-hot-picks     the dashboard's Hot Picks rail -- ./hotPicks, which
 *                        sets that id on the section it builds.
 *   [id^="zigly-x-"]     every transplanted dashboard section -- ./extraSections.
 *   .zigly-bs            the bestsellers rail -- ./bestsellers. A CLASS, not an
 *                        id: that file builds its section with
 *                        `section.className = 'zigly-bs'` and gives it no id at
 *                        all, so the `#zigly-bestsellers` this list first
 *                        guessed at would have matched nothing on the one
 *                        surface it was added to reach. Verified against
 *                        ./bestsellers.ts and the `.zigly-bs` rules already in
 *                        ./injectedStyles.ts.
 *
 * NOT a product page's own recommendation rails. Those cards sit under a
 * heading of their own on a page the customer has already committed to, where
 * the brand line and the offers note still say something -- and a rule written
 * for a two-column grid would stretch a rail chip across the whole page. That
 * exclusion is the reason `body.zigly-listing` exists at all rather than an
 * unscoped `.card-wrapper`; see ./listingPage.
 */
export const CARD_SURFACES = [
  'body.zigly-listing',
  '#zigly-hot-picks',
  '[id^="zigly-x-"]',
  '.zigly-bs',
] as const;

/**
 * The theme card's root, which its parts genuinely hang off.
 *
 * `.card-wrapper` is on SearchTap's root too, which is exactly why the parts
 * below are named per component rather than assumed shared: none of the theme's
 * INNER class names exist inside a SearchTap card, so a descendant rule written
 * here reaches the theme's card and only the theme's card.
 */
const THEME_CARD = '.card-wrapper';

/**
 * SearchTap's parts are NOT nested, and that is the whole reason this comment
 * exists rather than a `SEARCHTAP_CARD` constant beside THEME_CARD.
 *
 * `st-product` is not a wrapper containing `st-review` and `st-product-price`.
 * It is one class in a family of flat, sibling class names -- `st-product`,
 * `st-product-name`, `st-product-price`, `st-product-details` -- and the first
 * draft of this file read the shared prefix as a parent/child relationship. It
 * generated `.st-product .st-review`, which requires an `.st-review` INSIDE an
 * element classed `st-product`, and matched nothing.
 *
 * That regressed rules which had worked for weeks: the rating stayed pinned in
 * its floating chip, the price and button stayed side by side, the size chips
 * came back. The CSS was valid, the tests passed on the generated string, and
 * none of it applied. The rules this file replaced were all flat --
 * `body.zigly-listing .st-review` -- and flat is how they are written here.
 *
 * The scope alone keeps them off a product page, which is the same protection
 * the flat originals had. There is no card-root qualifier to add, because
 * SearchTap does not give its card one that its parts sit inside.
 */

/**
 * One rule, on every surface, for every selector given.
 *
 * The cross product is built here rather than written out so that a surface
 * added above reaches every rule below without any of them being edited.
 */
const onEverySurface = (selectors: string[], body: string): string => {
  const heads: string[] = [];
  for (let s = 0; s < CARD_SURFACES.length; s++) {
    for (let i = 0; i < selectors.length; i++) {
      heads.push(`${CARD_SURFACES[s]} ${selectors[i]}`);
    }
  }
  return `${heads.join(',\n')} {\n${body}\n}`;
};

/** Same, for the theme's card only -- parts SearchTap does not render. */
const onThemeCard = (parts: string[], body: string): string =>
  onEverySurface(
    parts.map(part => `${THEME_CARD} ${part}`),
    body,
  );

/**
 * Same, for SearchTap's card -- flat, for the reason set out above.
 *
 * Kept as a named function rather than calling onEverySurface directly, so that
 * every SearchTap rule reads as one at the call site and the note explaining
 * why it is not nested has somewhere to point.
 */
const onSearchTapCard = (parts: string[], body: string): string =>
  onEverySurface(parts, body);

/**
 * The rows that come off both cards.
 *
 * Each entry pairs the theme's class name with SearchTap's for the SAME row, so
 * the two can never be trimmed to different shapes. Both columns were read off
 * the live site: the theme's from /collections/all?sort_by=best-selling on
 * 2026-09-03, SearchTap's from its ProductCard render on 2026-09-06.
 *
 *   brand line        the maker's name above the title. Redundant on a card
 *                     whose title already names the product.
 *   discount chip     "45% Off" -- a second statement of a saving the struck
 *                     compare-at price already makes.
 *   offers note       "Enjoy offers on Checkout!" -- true of every product, so
 *                     it distinguishes none of them.
 *   delivery row      a van icon and an EMPTY date span; the theme fills it
 *                     from a script that never runs on these pages, so what the
 *                     card shows is a van and nothing else.
 *
 * Nothing carrying a number the customer buys on is in this list. The sale
 * price and the struck compare-at price beside it both stay on both cards.
 */
const HIDDEN_ROWS: Array<{theme: string[]; searchTap: string[]}> = [
  {
    theme: ['.product--brand--wrapper'],
    searchTap: ['.st-brand-wrapper'],
  },
  {
    theme: ['.discount-container'],
    // SearchTap draws the same saving as a red line of its own.
    searchTap: ['.product-item-discount'],
  },
  {
    theme: ['.metafield__richtext_value_tag'],
    // No SearchTap equivalent: its card does not render the offers note.
    searchTap: [],
  },
  {
    theme: ['.estimate-delivery--date-wrapper'],
    // Nor a delivery row.
    searchTap: [],
  },
];

/** The hide rules, both cards, every surface. */
const hiddenRowCss = (): string => {
  const theme: string[] = [];
  const searchTap: string[] = [];
  for (let i = 0; i < HIDDEN_ROWS.length; i++) {
    for (let t = 0; t < HIDDEN_ROWS[i].theme.length; t++) {
      theme.push(HIDDEN_ROWS[i].theme[t]);
    }
    for (let s = 0; s < HIDDEN_ROWS[i].searchTap.length; s++) {
      searchTap.push(HIDDEN_ROWS[i].searchTap[s]);
    }
  }
  return [
    onThemeCard(theme, '  display: none !important;'),
    onSearchTapCard(searchTap, '  display: none !important;'),
  ].join('\n');
};

/**
 * The space those rows leave behind.
 *
 * Hiding a row takes its text but not the height the card holds open for it, so
 * a hide-only change leaves the card its old height with the title floating in
 * the middle of it. Both cards reserve that space, and they reserve it
 * differently -- which is the second half of why one set of selectors could
 * never have covered both.
 *
 * The theme reserves it with min-heights and a fixed 75px on the price row
 * (product-card.aio.min.css, read 2026-09-03). SearchTap reserves it with
 * Tailwind utilities compiled into its own sheet (read 2026-09-06):
 *
 *   .st-product-price   st-mt-auto and st-min-h-[38px]. `mt-auto` is the one
 *                       that matters: it pins the price block to the foot of
 *                       the card, so freeing height above it becomes empty
 *                       space rather than a shorter card. Released, not
 *                       trimmed.
 *   .st-product-name    a FIXED st-h-[38px] -- a height, not a floor, so it
 *                       will not shrink for a one-line title on its own.
 *   .st-product-details st-pt-[1rem] above the whole text block.
 *
 * `auto` and `0` throughout rather than smaller fixed numbers: nothing here
 * should assert what a row measures. It should measure its own contents,
 * whatever the card turns out to hold.
 */
const releasedHeightCss = (): string =>
  [
    /* --- the theme's card ------------------------------------------- */
    onThemeCard(['.product--below-content'], '  padding-top: 6px !important;'),
    onThemeCard(['.card__heading'], '  margin: 0 0 4px !important;'),
    onThemeCard(
      ['.price'],
      '  margin: 0 !important;\n  padding: 0 !important;',
    ),
    onThemeCard(
      ['.only-price-align--wrapper'],
      '  min-height: 0 !important;\n  align-items: center !important;',
    ),
    onThemeCard(
      ['.custom_price__container'],
      '  min-height: 0 !important;\n  margin-top: 0 !important;',
    ),
    /* The compare-at price carries line-height:2.1, which is what makes the
       struck price taller than the sale price beside it and pads the row from
       within. */
    onThemeCard(['.price .compare-at-price'], '  line-height: 1.2 !important;'),
    /* A fixed height, not a floor -- the theme sizes this block for its fullest
       case (membership panel, discount wrapper, sold-out notice stacked under
       the price) so cards line up in a grid. Our card shows one line in it and
       the rest was empty space the button sat below. justify-content is reset
       alongside so the row cannot end up hanging in what is left. */
    onThemeCard(
      ['.price > *'],
      '  height: auto !important;\n  min-height: 0 !important;\n  justify-content: flex-start !important;',
    ),
    onThemeCard(
      ['.price__regular', '.price__container'],
      '  height: auto !important;\n  min-height: 0 !important;',
    ),
    /* .card-information wraps the price and the delivery row; with the row gone
       its own bottom padding is the last thing holding the button off. */
    onThemeCard(
      ['.card-information'],
      '  margin-bottom: 0 !important;\n  padding-bottom: 0 !important;',
    ),

    /* --- SearchTap's card ------------------------------------------- */
    /* .st-product-price is deliberately not here. Releasing its reserved
       height and reversing its two children are one element's worth of layout,
       and ./injectedStyles.ts's own warning applies: two rules for one element
       in two places is how a value drifts. Both are set together, once, in the
       furniture block below. */
    /* A fixed 38px that will not shrink for a one-line title. */
    onSearchTapCard(
      ['.st-product-name'],
      '  height: auto !important;\n  min-height: 0 !important;',
    ),
    onSearchTapCard(['.st-product-details'], '  padding-top: 6px !important;'),
    onSearchTapCard(
      ['.st-price-wrapper'],
      '  margin: 0 !important;\n  min-height: 0 !important;',
    ),
  ].join('\n');

/**
 * SearchTap's own furniture, made to read as the grid it replaced.
 *
 * These are the parts SearchTap draws that the theme does not, so they have no
 * opposite number above. Every one is presentation: the swatches are hidden
 * rather than removed so SearchTap's own scripts still find them, and the Add
 * to Bag inside `.atc-wrapper.st-atc` is still SearchTap's button adding
 * through the site's own cart.
 */
const searchTapFurnitureCss = (): string =>
  [
    /* A bordered, rounded, padded white card. The theme's sits on the page with
       no edge of its own. */
    onSearchTapCard(
      ['.st-product'],
      '  border: 0 !important;\n  border-radius: 0 !important;\n  padding: 0 !important;\n  background: transparent !important;',
    ),
    /* Size chips, for the reason the theme's variant picker is hidden: the
       reference app shows a plain full-width Add to Bag and no picker. */
    onSearchTapCard(['.st-swatches'], '  display: none !important;'),
    /* The rating, back into the flow under the image and out of its white chip
       over the foot of the image -- which is where the theme puts it. */
    onSearchTapCard(
      ['.st-review'],
      '  position: static !important;\n  inset: auto !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  border-radius: 0 !important;\n  padding: 8px 0 0 !important;\n  letter-spacing: normal !important;',
    ),
    /* Price above, Add to Bag below and full width. column-reverse rather than
       a reorder, because SearchTap puts the button first in the DOM and the
       price second -- reversing the two is the whole change, and it needs no
       knowledge of how many children there are.

       margin-top and min-height are set here too, in the same rule, because
       they belong to the same element: SearchTap pins this block to the card's
       foot with `mt-auto` and holds it open to 38px, and releasing both is what
       turns the height freed above into a shorter card rather than a gap. */
    onSearchTapCard(
      ['.st-product-price'],
      '  display: flex !important;\n  flex-direction: column-reverse !important;\n  flex-wrap: nowrap !important;\n  align-items: stretch !important;\n  gap: 10px !important;\n  margin-top: 0 !important;\n  min-height: 0 !important;',
    ),
    /* SearchTap pins Add to Bag absolutely over the foot of the image with a
       bottom margin of its own. Unpinning it is not enough -- that margin is
       the image/button gap and has to be closed explicitly. */
    onEverySurface(
      ['.atc-wrapper.st-atc'],
      '  position: relative !important;\n  inset: auto !important;\n  width: 100% !important;\n  margin: 0 !important;\n  background: transparent !important;\n  border-radius: 0 !important;',
    ),
    /* Its results row is inset by a negative margin meant for a page with wider
       gutters than this one. At -15px a side it hangs off a phone screen. */
    onEverySurface(
      ['.st-main-content-wrap'],
      '  margin-left: 0 !important;\n  margin-right: 0 !important;',
    ),
  ].join('\n');

/**
 * The whole card, as one block.
 *
 * Spliced into MOBILE_CSS in ./injectedStyles.ts, at the position the
 * hand-written blocks used to occupy, so the cascade order around it is
 * unchanged.
 */
export const PRODUCT_CARD_CSS = `
/* ==================================================================
   THE PRODUCT CARD -- generated, see ./productCard.ts.

   One definition, applied to every surface that draws a card and to BOTH card
   components: the theme's server-rendered one and the one SearchTap swaps in
   the moment a sort or a filter is applied. Written by hand these were three
   copies of each rule that covered only the first of those, so the card
   changed shape under the customer the instant they sorted.
   ================================================================== */
${hiddenRowCss()}

/* The height those hidden rows were holding open. */
${releasedHeightCss()}

/* SearchTap's own furniture, matched to the grid it replaces. */
${searchTapFurnitureCss()}
`;
