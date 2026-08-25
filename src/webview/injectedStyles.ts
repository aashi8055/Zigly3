/**
 * Mobile CSS injected into zigly.com.
 *
 * Kept deliberately small. Analysis of the live site showed it already renders
 * the mobile UI the official Zigly app presents -- its own bottom nav, its own
 * sticky add-to-bag bar, its own sort/filter toolbar. Injecting a second copy of
 * any of that would fight the site's stylesheet rather than improve it.
 *
 * Rules for anything added here:
 *   - presentation only, never behaviour
 *   - never applied on checkout or payment pages
 *   - must degrade silently if the selector disappears
 */
import {HEADER_DRAWER_CSS, LIFT_PAINT_GATE} from './headerBridge';
import {BREED_PAGE_CSS} from './breedPage';

export const MOBILE_CSS = `
${HEADER_DRAWER_CSS}

/* ------------------------------------------------------------------
   App-wide typeface: sans-serif everywhere.

   Dawn drives typography through CSS custom properties rather than
   per-element font-family rules, so overriding the variables here covers
   body text, headings and buttons alike without a "*" rule that would risk
   clobbering icon fonts (wishlist heart, star ratings, swiper arrows, etc.).
   ------------------------------------------------------------------ */
:root {
  --font-body-family: sans-serif !important;
  --font-heading-family: sans-serif !important;
}
html, body {
  font-family: sans-serif !important;
}

/* ------------------------------------------------------------------
   Page ground.

   White, and the same white the store paints. This carried a warm off-white
   (#FFFAF1) until 2026-08-23, and the tint was removed for a reason that is
   not taste: the theme's own sections, cards and rails are pure white, so
   every one of them met the cream ground on a seam that moved while the page
   assembled. Agreeing with the store leaves nothing to repaint.

   The rule stays, rather than being deleted now that it states the colour the
   store already asks for. It is the app's statement of its own ground -- the
   native surfaces above and below the WebView carry the same token -- and it
   is what the paint gate uncovers onto.

   Two elements in the selector, not one, and the reason is not style. The
   store ships this as the last thing inside its <body>, on every page type --
   home, collection, cart, search, account and the content pages:

       <style> body {background-color: #ffffff !important;} </style>

   This stylesheet is installed in <head>. Against a bare "body" selector the
   two declarations tie on importance and on specificity (0,0,1), the cascade
   falls through to source order, and theirs wins by sitting further down the
   document -- which is how this shipped white the first time. "html body" is
   (0,0,2), and specificity is settled before source order is ever consulted,
   so it holds wherever in the document their tag lands.

   background-color rather than the background shorthand: the theme's own
   .gradient rule paints body from --gradient-background, which on this store
   is a flat colour in all ten of its schemes. Overriding just the colour
   leaves the shorthand's other parts alone rather than asserting values we
   have no reason to hold.

   Only the ground. The theme's cards, rails, bars and section fills paint
   their own backgrounds over this and keep their edge against it.
   ------------------------------------------------------------------ */
html,
html body {
  background-color: #FFFFFF !important;
}

/* ------------------------------------------------------------------
   Header rules intentionally REMOVED.

   Device diagnostics showed the header is not hidden at all: it reports
   display:block, visibility:visible, opacity:1, Dawn's hide class absent -- and
   height 0. It is being COLLAPSED, not retracted. Pinning position and
   neutralising transforms (v4, v6) addressed a mechanism that was never in
   play, so those rules are gone rather than left as dead weight that might
   itself distort layout while we diagnose the real cause.
   ------------------------------------------------------------------ */


/* ------------------------------------------------------------------
   Hot Picks of The Week (see hotPicks.ts).
   Only the section chrome is styled here -- the product cards inside are
   Zigly's own markup and pick up the theme's existing card styles.
   ------------------------------------------------------------------ */
#zigly-hot-picks {
  padding: 8px 12px 24px;
}
.zigly-hp__title {
  font-size: 22px;
  font-weight: 700;
  color: #1B1B1B;
  /* Left-aligned, matching the reference app. */
  text-align: left;
  margin: 22px 0 14px;
}
.zigly-hp__tabs {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 18px;
  overflow-x: auto;
}
.zigly-hp__tabs::-webkit-scrollbar {
  display: none;
}
.zigly-hp__tab {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 14px 22px;
  border-radius: 6px;
  border: 1px solid #ED2427;
  background: #FFFFFF;
  color: #ED2427;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}
.zigly-hp__tab.is-active {
  background: #ED2427;
  color: #FFFFFF;
}
.zigly-hp__grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}
.zigly-hp__grid::-webkit-scrollbar {
  display: none;
}
/* Just under half the viewport, so the next card peeks and the rail reads as
   scrollable without a visible scrollbar. */
.zigly-hp__grid > * {
  flex: 0 0 46%;
  max-width: 46%;
  scroll-snap-align: start;
}
.zigly-hp__note {
  flex: 1 0 100%;
  text-align: center;
  color: #767676;
  font-size: 14px;
  padding: 18px 0;
}

/* ------------------------------------------------------------------
   Bestsellers (see bestsellers.ts).

   Only the section chrome is styled here. The product cards inside are Zigly's
   own markup and pick up the theme's card styles, and the containment they need
   -- the floating sticky-ATC wrappers that otherwise escape their card and
   paint over the footer -- comes from the [id^="zigly-x-"] rules further down,
   because the rail is built inside the reserved zigly-x-bestsellers slot.

   Deliberately its own block rather than joined onto the Hot Picks rules it
   resembles. The declarations are near-identical, and sharing them would mean
   one selector list two sections deep in different files depend on; a rail is
   cheap enough to state twice.
   ------------------------------------------------------------------ */
.zigly-bs {
  padding: 8px 12px 24px;
}
.zigly-bs__title {
  font-size: 22px;
  font-weight: 700;
  color: #1B1B1B;
  /* Left-aligned, matching every other rail heading in the app. */
  text-align: left;
  margin: 22px 0 14px;
}
.zigly-bs__rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  /* A flick that runs off the end stops there, rather than chaining into the
     page's own scroll or Android's edge-swipe back gesture. */
  overscroll-behavior-x: contain;
  padding-bottom: 6px;
}
.zigly-bs__rail::-webkit-scrollbar {
  display: none;
}
/* Just under half the viewport, so the next card peeks and the rail reads as
   scrollable without a visible scrollbar. */
.zigly-bs__rail > * {
  flex: 0 0 46%;
  max-width: 46%;
  margin: 0 !important;
  scroll-snap-align: start;
}

/* ------------------------------------------------------------------
   Explore. Pick. Pamper. (see explorePicker.ts)

   The section's Swiper never initialises here -- its init runs inside a
   DOMContentLoaded that fired long before we transplant it -- so the slides are
   laid out as a native horizontal scroller instead. Same gesture, no dependency
   on a library callback we cannot trigger.
   ------------------------------------------------------------------ */
#zigly-explore [id^="tab_block_"] {
  display: none;
}
#zigly-explore [id^="tab_block_"][data-zigly-active="true"] {
  display: block;
}
#zigly-explore .swiper {
  overflow: visible;
}
#zigly-explore .swiper-wrapper {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  transform: none !important;
  padding-bottom: 4px;
}
#zigly-explore .swiper-wrapper::-webkit-scrollbar {
  display: none;
}
#zigly-explore .swiper-slide {
  flex: 0 0 55%;
  max-width: 55%;
  scroll-snap-align: start;
  margin: 0 !important;
}
#zigly-explore .swiper-pagination {
  display: none;
}
/* The "For Dogs" / "For Cats" line added to each tile by explorePicker.ts.

   Zigly render this <p> under every tile heading and ship it empty, so the room
   for it is already in their layout and no tile grows. It is only needed because
   both pets now share one rail, where four of their labels collide -- Dry Food,
   Wet Food, Meaty Treats, Plush Toys -- so it is deliberately quieter than the
   heading it sits under: the category is still what you read first. Colour is
   inherited from the tile's own coloured panel rather than set here. */
#zigly-explore .card-wrapper_info-subheading[data-zigly-species] {
  margin: 2px 0 0;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.8;
}

/* ------------------------------------------------------------------
   Breed Ready Picks rails (see breedSection.ts).

   Their Swiper is deliberately not initialised: it runs in loop mode and clones
   slides, which made the rail scroll forever and repeat breeds. A native
   horizontal scroller gives the same gesture over a finite list.
   ------------------------------------------------------------------ */
[id^="zigly-breed-"] .swiper {
  overflow: visible;
}
[id^="zigly-breed-"] .swiper-wrapper {
  display: flex;
  /* See "Breed circles" below: the air between circles is set there, in one
     place, because the width and the gap have to be chosen together. */
  gap: 26px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  transform: none !important;
  padding-bottom: 4px;
}
[id^="zigly-breed-"] .swiper-wrapper::-webkit-scrollbar {
  display: none;
}
[id^="zigly-breed-"] .swiper-slide {
  margin: 0 !important;
  scroll-snap-align: start;
}
[id^="zigly-breed-"] .swiper-pagination,
[id^="zigly-breed-"] .swiper-button-next,
[id^="zigly-breed-"] .swiper-button-prev {
  display: none;
}

/* ------------------------------------------------------------------
   Hot Picks cards: keep Add to Bag inside its card.

   The transplanted cards carry .mobile-atc-main / .atc-wrapper, the same
   containers the theme uses for the sticky add-to-cart bar on product pages.
   That styling is positioned to float above the page, so inside a rail the
   button escaped its card and sat over the footer.

   Only the add-to-cart containers are forced back into flow -- the wishlist
   heart is deliberately left alone, since it is meant to be absolutely
   positioned over the image.
   ------------------------------------------------------------------ */
#zigly-hot-picks .card-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #FFFFFF;
  border-radius: 10px;
}
#zigly-hot-picks .mobile-atc-main,
#zigly-hot-picks .atc-wrapper,
#zigly-hot-picks .quick-add,
#zigly-hot-picks .st-collection-atc {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  transform: none !important;
}

#zigly-hot-picks .quick-add {
  z-index: 20 !important;
}
/*
   relative, never static: the theme's button carries ::before and ::after,
   both position:absolute with inset:1px, drawing its border and focus ring.
   Made static, the button stops being their containing block and they resolve
   against the nearest positioned ancestor instead -- .card-wrapper, right
   below. The ring then covers the WHOLE CARD as an invisible layer that
   hit-tests as the button, so every tap anywhere on the card -- the heart, the
   photo, the title -- submitted its add-to-cart form. relative is the theme's
   own value and leaves the button in flow exactly as static did.
 */
#zigly-hot-picks .quick-add__submit {
  position: relative !important;
  width: 100% !important;
}
/* The rail must not paint over anything below it. */
#zigly-hot-picks {
  position: relative;
  z-index: 0;
  isolation: isolate;
}

/* ------------------------------------------------------------------
   The site's own sort and filter chrome: hidden.

   The app draws both natively now -- ../components/SortFilterBar, SortSheet and
   FilterSheet -- and drives the site's engine through ./facetBridge. So there
   are two of everything on a listing page, and exactly one of them may be seen.

   HIDDEN, NEVER REMOVED, and that is the whole design of this block rather than
   an aside. Every one of these elements is still working: the checkboxes inside
   .st-sidebar are what a chip tap clicks, the buttons inside
   .st-sorting-wrapper are what a sort tap clicks, and .filter_h is clicked once
   per page to make SearchTap fetch its facets at all. display:none hides an
   element from the customer while leaving it in the document, clickable and
   re-renderable; removing it would break the app's own controls and start
   SearchTap throwing on every change.

   .st-sidebar is not listed: the theme already hides its wrapper below 767px
   (searchtap-collection-template.css), which is exactly why the checkboxes in
   it can be read and clicked without being seen.

   The mobile drawer and the sort panel are hidden unconditionally rather than
   only while they are open: the app never wants either, and the facet warm-up
   in ./facetBridge opens the drawer for a moment on purpose.
   ------------------------------------------------------------------ */
body.zigly-listing .st-filter-count-sort-wrap,
body.zigly-listing initial-search-filters,
body.zigly-listing initial-search-sort,
body.zigly-listing initial-toolbox-bar,
body.zigly-listing .initialCollectionToolbar,
body.zigly-listing .st-filter-bar,
/* The two pills themselves, wherever they are drawn. A collection page and a
   search page build their toolbars in different components but both use these
   two class names, and after a filter is applied SearchTap replaces the grid
   with its own -- which brings a third copy of them. Hiding the pill rather
   than its container covers all three. */
body.zigly-listing .sort_h,
body.zigly-listing .filter_h,
body.zigly-listing .mobilesearch,
body.zigly-listing .mobilesearch-overlay,
body.zigly-listing .st-sorting-wrapper,
body.zigly-listing .st-overlay-active {
  display: none !important;
}
/* The drawer sets this on <body> while it is open. It does not open any more,
   and the facet warm-up puts it back down through the site's own Apply -- but
   if either ever failed, a page that cannot be scrolled is the worst outcome
   available, so the scroll is asserted rather than trusted. Only the scroll:
   the site's own rule for this class disables one animation, which is theirs to
   decide. */
body.zigly-listing.st-open-filter-section {
  overflow: auto !important;
}

/* ------------------------------------------------------------------
   Listing pages: the product card as the reference draws it.

   The reference app's collection and search grids show a plain full-width
   "Add to Bag" under each card. The site's own grid instead shows the compact
   variant picker ("+ Add", "+9 more"), and its cards carry .mobile-atc-main /
   .atc-wrapper -- the same containers the theme uses for the *product page's*
   floating sticky bar, so inside a card that styling escapes the card.

   These are the same two fixes the transplanted dashboard sections already
   carry (see Hot Picks above), against the same verified theme markup, applied
   where the site draws the grid itself.

   Scoped to body.zigly-listing, which listingPage.ts sets on collection and
   search pages only. It must never reach a product page: that page carries the
   same card markup in its "recently viewed" and recommendation rails, and a
   rule written for a two-column grid would stretch a rail chip across the whole
   page. (This note used to say .mobile-atc-main IS the sticky Add to Bag bar
   there. It is not -- see the product-page block below.)
   ------------------------------------------------------------------ */
body.zigly-listing .mobile-atc-main,
body.zigly-listing .atc-wrapper,
body.zigly-listing .quick-add,
body.zigly-listing .st-collection-atc {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  transform: none !important;
}

body.zigly-listing .quick-add {
  z-index: 20 !important;
}
body.zigly-listing .card--variant--main-wrapper,
body.zigly-listing .mobile-compact-variant-display,
body.zigly-listing .mobile-compact-variant-more,
body.zigly-listing .card-variant-wrapper {
  display: none !important;
}

/* ------------------------------------------------------------------
   Product pages: one Add to Bag, not two.

   The served PDP was read on 2026-08-24 and it draws the control twice:

     .product__buy-buttons-container    in the flow, under the quantity
                                        stepper. <product-form> with
                                        button.product-form__submit, "Add to
                                        Bag". This is the one that stays.
     .sticky-bar-container              pinned to the foot of the screen: a
                                        thumbnail, the title, the price, a
                                        second quantity stepper, "Buy Now" and
                                        a second "Add to Bag". Hidden here.

   The theme reveals the pinned bar once the in-flow one has scrolled off the
   top, so the two are never a deliberate pair -- the second is a stand-in for
   the first. Removing it also removes Buy Now, which exists only on that bar;
   that is the trade this was asked for, and Buy Now is one tap from the bag.

   display:none, and the element is left in the page on purpose. The theme's own
   scroll handler is stickyBar.classList.add(...) with no null guard -- it
   only guards atcSection -- so a bar removed from the DOM would throw on every
   scroll event. Hidden, offsetHeight reads 0, and the theme's own
   --bottomBarHeight resolves to zero: no reserved gap where the bar used to be.

   Scoped to body.zigly-product, from ./listingPage. Not scoped by class alone:
   an unscoped .sticky-bar-container would be this file reaching a page it has
   not read.

   UPDATE, native Add to Bag / Buy Now: the app now draws its own sticky bar
   below the WebView (see ../components/ProductActionBar) and presses these
   same buttons from outside the page (../webview/productActions), so the
   in-flow ones are hidden too -- the Add to Bag button, Shopify's own dynamic
   checkout widget if the theme renders one (.shopify-payment-button), and the
   store's actual Buy Now, which turned out to be neither of those: read off a
   live product page on 2026-08-26, it is a control carrying
   onclick="shiprocketCheckoutEvents.buyProduct(event)" -- a Shiprocket app
   embed, not a Shopify control, and not scoped to either known container.
   Matched on that attribute rather than a class or a container, since that is
   the one thing confirmed present on it. Only these controls, not
   .product__buy-buttons-container itself: the theme's own validation message
   for the form -- no size chosen, out of stock -- renders as a sibling of the
   Add to Bag button inside that container, and hiding the container would
   hide that message along with it.
   ------------------------------------------------------------------ */
body.zigly-product .sticky-bar-container {
  display: none !important;
}
body.zigly-product .product__buy-buttons-container .product-form__submit {
  display: none !important;
}
body.zigly-product .product__buy-buttons-container .shopify-payment-button {
  display: none !important;
}
body.zigly-product [onclick*="shiprocketCheckoutEvents"] {
  display: none !important;
}
/* relative, for the reason spelled out on the Hot Picks rule above: static
   hands the button's absolutely-positioned ::before / ::after to .card-wrapper
   and they cover the card, swallowing every tap into add-to-cart. */
body.zigly-listing .quick-add__submit {
  display: block !important;
  position: relative !important;
  width: 100% !important;
}
/* Cards clip their own contents, so nothing can paint over the row below. */
body.zigly-listing .card-wrapper {
  position: relative;
  overflow: hidden;
}

/* ------------------------------------------------------------------
   The whole card opens the product.

   The theme ships Dawn's full-card link -- .card__heading a::after, an
   absolutely positioned overlay over the whole card -- and then switches it off
   with content:unset (component-card.aio.min.css, read on 2026-08-23). So on
   the site only the photo and the two title links are tappable, and the brand
   line, the price and the discount strip between them are dead. In an app whose
   grid is a list of tap targets that reads as broken.

   This puts Dawn's own overlay back, on the below-image title only, so there is
   one of them per card and it is the card's own product link.

   The stacking is the whole point of the scoping, and it is verified rather than
   assumed (live markup and live theme CSS, read 2026-08-24, 390px viewport):

     - the heart wins, because the badge strip it sits in is lifted to z-index:2
       by the block below. It used to win by this overlay being z-index:0
       against the theme's own z-index:1 on .tag-wrapper -- and when this was
       raised to 1 the two TIED, which in one stacking context is settled by
       tree order, and .tag-wrapper is the card's FIRST child. So the overlay
       painted over the heart and every tap on it opened the product. That is
       why the strip now carries a z-index of its own instead of relying on the
       theme's: a tie is not a stacking rule.
     - Add to Bag wins, because .quick-add comes after the title in the DOM and
       is lifted to z-index:20 below.

   Result: heart -> wishlist, Add to Bag -> cart, anywhere else -> the product.
   ------------------------------------------------------------------ */
body.zigly-listing .card-wrapper .product--below-content .card__heading a::after,
#zigly-hot-picks .card-wrapper .product--below-content .card__heading a::after,
[id^="zigly-x-"] .card-wrapper .product--below-content .card__heading a::after {
  content: '' !important;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
}
  body.zigly-listing .card-wrapper .quick-add,
#zigly-hot-picks .card-wrapper .quick-add,
[id^="zigly-x-"] .card-wrapper .quick-add {
  position: relative !important;
  z-index: 20 !important;
}

body.zigly-listing .card-wrapper .quick-add__submit,
#zigly-hot-picks .card-wrapper .quick-add__submit,
[id^="zigly-x-"] .card-wrapper .quick-add__submit {
  position: relative !important;
  z-index: 21 !important;
}
/* The badge strip across the top of the card is a container, not a control:
   only the heart inside it takes taps, so the rest of that band reaches the
   product link underneath instead of being dead.

   z-index:2 is the fix for the heart being untappable -- see the note above. It
   clears the product-link overlay (1) and stays under the theme's own
   .atc-wrapper (3) and the Add to Bag (20), neither of which it overlaps, so
   the only relationship this changes is the one that was broken. */
body.zigly-listing .card-wrapper .tag-wrapper,
#zigly-hot-picks .card-wrapper .tag-wrapper,
[id^="zigly-x-"] .card-wrapper .tag-wrapper {
  pointer-events: none;
  z-index: 2;
}

/* ------------------------------------------------------------------
   The card's heart: the site's own glyph, on a target a thumb can hit.

   Scoped to the card component rather than to a page, because this is one
   component and the heart is the same control wherever it is drawn -- the grid,
   the transplanted rails, a product page's recommendations. Every figure below
   is the theme's, read off product-card.aio.min.css on 2026-08-24 at phone
   width (its max-width:750px block, the only width this app renders at):

     .tag-wrapper            position:absolute; top:0; left:0; width:100%
     .wishlist-icon-wrapper  width:20px; margin-right:14px; margin-left:auto
     ...icon-wrapper svg     width:100%; height:auto

   So the site draws a 20px-wide heart whose right edge is 14px in from the
   card's own edge. What the app drew instead was a 34px one flush against the
   card's border -- and it was the app that did it: the generic
   .swym-add-to-wishlist rule further down gives the control min-width:34px for
   the sake of the tap target, the theme's svg is width:100% OF THAT, and the
   extra 14px grew rightwards out of the 20px wrapper and into its margin. A
   stretched glyph sitting on the rounded corner.

   Both are fixed by separating the target from the glyph, which cannot be done
   inside that flex row -- so the control comes out of the row and is placed
   against .tag-wrapper, the positioned ancestor the theme already gives it. The
   row is then left holding an empty 20px box, and nothing measures it: the
   strip is absolutely positioned, decorative and pointer-events:none, and the
   badge pill inside it is absolutely positioned against .tag-wrapper too rather
   than laid out by the row.

   40x40 at right:4px puts the glyph's centre 24px in from the card's edge --
   exactly where the theme's own 20px-at-14px puts it -- and its top edge 11px
   down, 3px inside the photo instead of flush with it. Nothing moves that the
   customer can see; what changes is that the thing under their thumb is 40px
   across instead of 20.
   ------------------------------------------------------------------ */
.card-wrapper .tag-wrapper .swym-add-to-wishlist {
  position: absolute;
  top: 0;
  right: 4px;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  /* The strip is transparent to taps; the heart takes its own back. */
  pointer-events: auto;
  /* Above the badge pill, within the strip's own stacking context. */
  z-index: 1;
}
/*
   !important on the glyph, and only on the glyph: the theme's rule for it is
   .product-card-wrapper .wishlist-tag__wrapper .wishlist-icon-wrapper svg, and
   a transplanted section carries its own copy of that stylesheet along with the
   markup (extraSections.ts strips <script> and nothing else), so that copy can
   land after this file. Higher specificity alone would win on the site's own
   pages and lose on a transplanted rail; this closes that difference.
 */
.card-wrapper .tag-wrapper .swym-add-to-wishlist svg {
  width: 20px !important;
  height: auto !important;
}

/* ------------------------------------------------------------------
   The product page's heart: the same target, in the theme's own place.

   This rule used to read body.zigly-inner-page .product-form
   .swym-add-to-wishlist -- and it matched NOTHING. The served PDP was read on
   2026-08-24: the heart is a direct child of #main-slider, beside the zoom
   button, while .product-form is the buy-buttons element much further down the
   page. It was never inside it.

   Where the theme actually puts it (main-product.aio.min.css, same read):

     .pdp-container .swym-button.swym-add-to-wishlist {
       position: absolute; top: 2rem; right: 2rem;
       width: 34px; height: 30px; z-index: 1;
     }

   -- so unlike the card, the PDP heart is already positioned, already above the
   gallery and already tappable. Only its target is short: 34x30, which the
   generic rule's min-height rounds up to 34x34.

   40x40 centred on the same glyph is 3px wider each side and 5px taller each
   side, so the heart does not move by a pixel. calc against the theme's own
   2rem rather than a px figure of our own, so it holds at whatever the root
   font size resolves to.

   body.zigly-product, not zigly-inner-page: the flag the rest of the
   product-page rules already use, and it does not reach the other inner pages.
   ------------------------------------------------------------------ */
body.zigly-product .pdp-container .swym-button.swym-add-to-wishlist {
  width: 40px;
  height: 40px;
  top: calc(2rem - 5px);
  right: calc(2rem - 3px);
}

/* ------------------------------------------------------------------
   SearchTap's OWN grid, which is what a filtered listing shows.

   The moment a filter or a sort is applied, SearchTap empties .searchtap-temp
   and renders the results itself -- so the customer is looking at a different
   card component from the one they were looking at a second earlier. Same
   products, same prices, different card. That is the join this block closes:
   the filtered grid is made to read as the grid it replaced.

   It is not a rebuild, and it is mostly not even new rules. SearchTap's card
   carries the theme's own class names on the parts that matter --
   product-card-wrapper, card-wrapper, quick-add__submit, button--secondary,
   atc-wrapper, mobile-compact-variant-display -- so the listing-card block
   above already reaches it: the compact chip is hidden, the floating Add to Bag is
   unpinned and stretched, the card clips its own contents. What is left is the
   handful of things SearchTap draws that the theme does not, read out of its
   ProductCard render on 2026-08-23:

     .st-product          a bordered, rounded, padded white card. The theme's
                          sits on the page with no edge of its own.
     .st-review           the rating, absolutely positioned as a white chip
                          over the foot of the image. The theme puts it in the
                          flow, under the image, which is where the reference
                          app has it.
     .st-swatches         a row of size chips. The theme's equivalent is the
                          variant picker, which the block above hides for the
                          same reason: the reference app shows a plain
                          full-width Add to Bag.
     .st-product-price    price and Add to Bag side by side in one row. The
                          theme stacks them, price then button.

   Presentation only, as everywhere else here. Every control keeps its
   listeners: the Add to Bag is still SearchTap's button adding through the
   site's own cart, and the swatches are hidden rather than removed so its own
   scripts still find them.
   ------------------------------------------------------------------ */
body.zigly-listing .st-product {
  border: 0 !important;
  border-radius: 0 !important;
  padding: 0 !important;
  background: transparent !important;
}
/*
   The size chips, for the reason the theme's variant picker is hidden above:
   the reference app shows a plain full-width Add to Bag and no picker.

   NOT the brand line, and not the title's weight. Both were on the list until
   the theme's own card was read back: it renders product--brand--wrapper with
   the same brand and the same veg/non-veg mark, and its title is fw-700. They
   are already the same on both cards, and "matching" them would have been this
   block introducing the difference it exists to remove.
 */
body.zigly-listing .st-swatches {
  display: none !important;
}
/* The rating, back into the flow under the image and out of its chip. */
body.zigly-listing .st-review {
  position: static !important;
  inset: auto !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  padding: 8px 0 0 !important;
  letter-spacing: normal !important;
}
/*
   Price above, Add to Bag below and full width.

   column-reverse rather than a reorder, because SearchTap puts the button
   first in the DOM and the price second -- reversing the visual order of the
   two is the whole change, and it needs no knowledge of how many children
   there are.
 */
body.zigly-listing .st-product-price {
  flex-direction: column-reverse !important;
  flex-wrap: nowrap !important;
  align-items: stretch !important;
  gap: 10px !important;
}
/* The wrapper the button sits in is a red pill floating at the corner of the
   card. Unpinned by the block above; its own fill and radius come off here, so
   what shows is the theme's button underneath. */
body.zigly-listing .atc-wrapper.st-atc {
  background: transparent !important;
  border-radius: 0 !important;
}
/* SearchTap's results row is inset by a negative margin meant for a page with
   wider gutters than this one. At -15px a side it hangs off a phone screen. */
body.zigly-listing .st-main-content-wrap {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* ------------------------------------------------------------------
   The site's bottom navigation: hidden, because the app now draws its own.

   This app used to show the site's bar and restyle it, on the reasoning that a
   native one would stack a second bar on top of it. Two facts about the live
   site retired that, both verified on 2026-08-22:

     - the site's bar has four tabs and **no Account item**, while the reference
       app has five, so there was nothing here to turn into an Account tab;
     - it is drawn inside the page, so it vanished behind every native screen
       this app has -- the cart, the wishlist, and now the account section.

   So the bar is native (see ../components/BottomNav.tsx) and this hides the
   site's. Hidden, never removed: the theme's own scripts mark the active tab in
   here on navigation, and an element they cannot find is how a script starts
   throwing on every page.
   ------------------------------------------------------------------ */
.fixed-icons {
  display: none !important;
}

/* ------------------------------------------------------------------
   Collection pages: drop the category banner.

   The reference app goes straight from the header to the product grid. The
   section is only hidden, never removed, so nothing the theme's scripts expect
   to find disappears from the DOM.
   ------------------------------------------------------------------ */
[id*="collection_metafield_banner_info"] {
  display: none !important;
}

/* ------------------------------------------------------------------
   Transplanted dashboard sections (see extraSections.ts).

   Their Swiper never initialises -- the init runs inside a DOMContentLoaded
   that fired long before the transplant -- so any rail inside them is laid out
   as a native horizontal scroller, the same treatment the breed rails get.
   Sections without a rail are unaffected.
   ------------------------------------------------------------------ */
[id^="zigly-x-"] .swiper {
  overflow: visible;
}
[id^="zigly-x-"] .swiper-wrapper {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  transform: none !important;
  padding-bottom: 4px;
}
[id^="zigly-x-"] .swiper-wrapper::-webkit-scrollbar {
  display: none;
}
[id^="zigly-x-"] .swiper-slide {
  flex: 0 0 46%;
  max-width: 46%;
  margin: 0 !important;
  scroll-snap-align: start;
}
[id^="zigly-x-"] .swiper-pagination,
[id^="zigly-x-"] .swiper-button-next,
[id^="zigly-x-"] .swiper-button-prev {
  display: none;
}
/* Same containment as Hot Picks: these carry the theme's floating sticky-ATC
   wrappers, which otherwise escape their card and paint over the footer. */
[id^="zigly-x-"] .mobile-atc-main,
[id^="zigly-x-"] .atc-wrapper,
[id^="zigly-x-"] .quick-add,
[id^="zigly-x-"] .st-collection-atc {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  transform: none !important;
}

[id^="zigly-x-"] .quick-add {
  z-index: 20 !important;
}

[id^="zigly-x-"] {
  isolation: isolate;
}

/* ------------------------------------------------------------------
   Shop by price: a 2x3 grid, not a rail.

   The section holds exactly six tiles -- Under 599 / 999 / 1499 / 2499 / 3499
   / 5999, read off the live section on 2026-08-24 -- so all six fit in two rows
   of three with nothing hidden and nothing to scroll. That is the whole reason
   this one section opts out of the rail treatment above: for a rail to be worth
   its gesture there has to be something off-screen, and here there is not.

   display:grid on the Swiper wrapper overrides the flex row the generic rule
   sets, which also takes the horizontal overflow with it -- there is no track
   left to scroll. The slides then need their widths released: the theme's own
   stylesheet is transplanted with the markup (only <script> is stripped) and it
   sizes them at calc(100% / 3 - 54px) on mobile, which inside a grid cell would
   draw three tiles a third of a column wide. An id beats those two classes on
   specificity, so width:auto wins without !important; the margin keeps its
   !important because [id^="zigly-x-"] .swiper-slide and .shop-by-price
   .swiper-slide tie on specificity, and the section's own inline <style> lands
   after this file's.

   No backticks anywhere above, and that is not a style choice: this whole
   stylesheet is one template literal, so a backtick in a comment ends it and
   the file stops parsing.
   ------------------------------------------------------------------ */
#zigly-x-price .swiper-wrapper {
  display: grid;
  /* minmax(0,...) rather than a bare 1fr: a bare fr track floors at the item's
     min-content, so a longer price than the six on the section today -- or a
     bigger --font-body-scale, which the theme multiplies the root size by --
     would widen the columns past the row instead of wrapping inside them. */
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  overflow: visible;
  scroll-snap-type: none;
  padding-bottom: 0;
}
#zigly-x-price .swiper-slide {
  flex: none;
  width: auto;
  max-width: none;
  margin: 0 !important;
  scroll-snap-align: none;
}

/* ------------------------------------------------------------------
   Matching the reference dashboard.

   Side-by-side recordings showed three differences in the transplanted
   sections. All are presentation only.
   ------------------------------------------------------------------ */

/* 1. Breed circles.

      They were sized at 33% with a 14px gap, which drew a circle wider than
      the reference's and left the rail looking crowded -- three big discs
      almost touching. The brief is smaller icons with more air between them,
      so the width comes down and the gap goes up (the gap itself is set on the
      wrapper above, since the two only make sense together).

      24% + 26px still shows three circles and a peek of the fourth on a 360px
      screen, so nothing is lost from view: the same list, smaller discs, and
      roughly double the space between them. The label under each circle is the
      reason the width does not go lower -- "Labrador Retriever" needs room to
      wrap to two lines without hyphenating. */
[id^="zigly-breed-"] .swiper-slide {
 flex: 0 0 calc((100% - 52px) / 3) !important;
max-width: calc((100% - 52px) / 3) !important;
}
[id^="zigly-breed-"] .home-category-list-image-wrapper,
[id^="zigly-breed-"] .category-list-image {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
}
[id^="zigly-breed-"] .home-category-list-card img {
  width: 100% !important;
  height: auto !important;
}

/* 2. Section headings rendered light grey and small; the reference has them
      bold and near-black, at the same weight as "Hot Picks Of The Week". */
[id^="zigly-breed-"] h1,
[id^="zigly-breed-"] h2,
[id^="zigly-breed-"] h3,
[id^="zigly-breed-"] .top-head-wrapper,
[id^="zigly-breed-"] .top-head-wrapper p,
[id^="zigly-x-"] h2,
[id^="zigly-x-"] .top-head-wrapper p {
  font-size: 22px !important;
  font-weight: 700 !important;
  color: #1B1B1B !important;
  opacity: 1 !important;
  margin-bottom: 14px !important;
}

/* 3. Product cards showed the compact variant picker ("+ Add", "+9 more")
      where the reference shows a plain full-width "Add to Bag". The variant
      drawer is hidden and the theme's own mobile add-to-cart button restored,
      so the control still belongs to Zigly -- only which one is shown changes. */
#zigly-hot-picks .card--variant--main-wrapper,
#zigly-hot-picks .mobile-compact-variant-display,
#zigly-hot-picks .mobile-compact-variant-more,
#zigly-hot-picks .card-variant-wrapper,
[id^="zigly-x-"] .card--variant--main-wrapper,
[id^="zigly-x-"] .mobile-compact-variant-display,
[id^="zigly-x-"] .mobile-compact-variant-more,
[id^="zigly-x-"] .card-variant-wrapper {
  display: none !important;
}
#zigly-hot-picks .quick-add__submit,
[id^="zigly-x-"] .quick-add__submit {
  display: block !important;
  width: 100% !important;
}

/* ------------------------------------------------------------------
   Hot Picks cards: the Add to Bag button, actually on screen.

   The rule above showed .quick-add__submit and was believed to be the fix, but
   it never had any effect on a phone, because the button was not the thing
   being hidden -- its container was, twice over, by the theme's own mobile CSS
   (both verified against the live stylesheets on 2026-08-22):

     base.aio.min.css
       @media (max-width: 749px) { .small-hide { display: none !important } }
     product-card.aio.min.css
       @media (max-width: 749px) { .product-card-wrapper .quick-add { display: none } }

   and the card's markup is <div class="quick-add no-js-hidden small-hide">.
   A display:block on the child cannot bring back a parent that is display:none,
   so the cards showed no add control at all: the compact variant picker hidden
   by us, and Add to Bag hidden by the theme. That is the card the reference
   dashboard does not have.

   So the container is un-hidden -- which needs !important to beat .small-hide's
   own !important -- and the floating "+ Add" chip is hidden in its place. That
   chip is .atc-wrapper#mobile-atc-wrapper, positioned absolute bottom-right,
   and it is the mobile control the theme shows *instead of* Add to Bag. With
   both visible a card would carry two add buttons.

   The button is still Zigly's: the theme's own <product-form>, submitting the
   variant the theme itself pre-selected. Only which of the site's two add
   controls is on screen changes -- no cart request is made from this app.
   ------------------------------------------------------------------ */
#zigly-hot-picks .quick-add,
[id^="zigly-x-"] .quick-add,
body.zigly-listing .quick-add {
  display: block !important;
  margin-top: auto !important;
}
#zigly-hot-picks .atc-wrapper,
[id^="zigly-x-"] .atc-wrapper,
body.zigly-listing .atc-wrapper {
  display: none !important;
}
/* Full-width, and tall enough to be a real target. The theme's own button
   colours are left alone -- this only gives it the shape the reference has. */
#zigly-hot-picks .quick-add__submit,
[id^="zigly-x-"] .quick-add__submit,
body.zigly-listing .quick-add__submit {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-height: 38px !important;
  margin: 8px 0 0 !important;
}
/* Cards are a column with the button pinned to the bottom edge, so a two-line
   title next to a one-line title does not stagger the buttons in a rail. */
#zigly-hot-picks .card-wrapper,
[id^="zigly-x-"] .card-wrapper {
  height: 100%;
}
#zigly-hot-picks .card-wrapper .product--below-content,
[id^="zigly-x-"] .card-wrapper .product--below-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}

/* ------------------------------------------------------------------
   Category circles: the reference app runs them straight under the search
   band with no heading, so the section's own title is hidden.
   ------------------------------------------------------------------ */
[id*="home_category_section"] h2,
[id*="home_category_section"] .top-head-wrapper {
  display: none !important;
}

/* ------------------------------------------------------------------
   Category circles: scrollable by thumb.

   They were not. The section's own CSS lays the track out as

     .home-category-swiper .swiper-wrapper { display: inline-flex; width: auto }

   inside .home-category-swiper, which is the Swiper element and therefore
   carries Swiper's own overflow: hidden. On a page the site rendered that is
   fine, because Swiper slides the track with a transform. On the dashboard it
   is not: the rail here is a copy transplanted by homeLayout, and markup
   inserted through the DOM never runs its scripts, so no Swiper ever
   initialises. The track was simply wider than a box that clips it -- every
   circle past the fifth was on the page and unreachable.

   So the box scrolls natively instead. Nothing about the circles changes: the
   80px slides, their 30px gaps, the 70px images and the labels are all the
   section's own and are not touched here.

   It stops at both ends, deliberately -- six items, a short slide, and the
   customer brings it back. No wrap-around.

   Keyed on data-zigly-native-scroll, which homeLayout sets ONLY on a copy that
   has actually landed. The rail the site rendered keeps that marker off it even
   when the swap fails, so this can never fight a Swiper that is running.
   ------------------------------------------------------------------ */
[id*="home_category_section"][data-zigly-native-scroll="true"] .home-category-swiper {
  overflow-x: auto !important;
  overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch;
}
[id*="home_category_section"][data-zigly-native-scroll="true"] .home-category-swiper::-webkit-scrollbar {
  display: none;
}
/* A transform left behind by a Swiper that ran before the copy replaced it
   would offset the track with nothing to scroll it back. */
[id*="home_category_section"][data-zigly-native-scroll="true"] .home-category-swiper .swiper-wrapper {
  transform: none !important;
}

/* ------------------------------------------------------------------
   The wishlist heart: filled once the product is saved.

   Tapping a card's heart already worked -- what it does not do is *look* like it
   worked, and that is a gap on Zigly's own site rather than in this app.

   Their wishlist is not Swym any more (see wishlistBridge.ts). It is
   assets/wishlist.js, which keeps the saved handles in localStorage under
   'zigly_wishlist_handles' and, on a tap, does this:

     button.classList.toggle('is-wishlisted', wishlisted)
     button.setAttribute('aria-pressed', wishlisted ? 'true' : 'false')

   and then nothing happens, because there is no rule for .is-wishlisted
   anywhere in the theme -- not in the section styles, not in base.css, not in
   product-card.css. All three were searched on 2026-08-22. So the heart on a
   saved product looks exactly like the heart on an unsaved one, and the only way
   to find out whether a tap registered is to open the wishlist page.

   This supplies the missing rule and nothing else. The state is the site's, the
   class is the site's, the path is the site's; only the fill is drawn here.

   Both the class and the ARIA state are matched. They are set together by the
   same function, so either alone would do -- but a saved product whose heart
   reads unsaved is the failure this is fixing, and two selectors cost nothing.

   Red rather than black: #ED2427 is Zigly's own accent, the colour of the heart
   in their bottom bar and of every pill and link in their sections. A filled
   black heart over a product photo reads as a smudge.
   ------------------------------------------------------------------ */
.swym-button.swym-add-to-wishlist.is-wishlisted svg path,
.swym-button.swym-add-to-wishlist[aria-pressed="true"] svg path {
  fill: #ED2427 !important;
  stroke: #ED2427 !important;
}
/* The tap itself. The control is a bare div around a 36x32 glyph, and on a card
   it is the smallest thing on screen competing with the product link underneath
   it -- so it gets a real target and stops the tap becoming a scroll. Nothing
   about which element handles the tap changes: the listener is the site's own,
   delegated from document.

   min-width / min-height and nothing else, deliberately. A width here is what
   stretched the card's glyph: the theme sizes the svg as width:100% OF THIS
   BOX, so a box grown for a thumb grew the drawing with it. The two places the
   heart is actually drawn -- the card and the product page -- now state their
   own width and height, above, and each states the glyph's size separately. The
   floor stays for any third place the heart turns up that this file has not
   read; a floor cannot stretch anything the width does not already exceed. */
.swym-button.swym-add-to-wishlist {
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-width: 34px;
  min-height: 34px;
  display: flex !important;
  align-items: center;
  justify-content: center;
}
/* A tap should be visible at the moment it happens, not only once the fill
   arrives -- the toggle writes to localStorage and can wait a frame. */
.swym-button.swym-add-to-wishlist:active svg {
  transform: scale(0.86);
}
.swym-button.swym-add-to-wishlist svg {
  transition: transform 120ms ease-out;
}

/* ------------------------------------------------------------------
   The banner carousel: one clean edge-to-edge card, no frame.

   The site insets the strip and rounds it --

     .homepage_banner .homepageMainBanner.swiper { padding-inline: 20px }
     @media (max-width: 500px) { ... padding-inline: 16px }
     .homepage_banner .homepageMainBanner .swiper-slide { border-radius: 10px }
     .homepage_banner .homepageMainBanner .swiper-slide img { border-radius: 20px }

   -- which on a phone reads as a bordered card floating in a gutter rather
   than the full-width banner the reference app shows. The inset and the radius
   go, so the banner is the width of the screen with nothing drawn around it.

   Only the frame is touched. The slides, their images and their links are
   Zigly's, and the carousel itself is Zigly's Swiper instance -- see
   bannerCarousel.ts for the looping and autoplay, which is behaviour and
   deliberately not done from here.
   ------------------------------------------------------------------ */
.homepage_banner .homepageMainBanner.swiper,
[id*="homepage_banner"] .swiper {
  padding-inline-start: 0 !important;
  padding-inline-end: 0 !important;
}
.homepage_banner .homepageMainBanner .swiper-slide,
.homepage_banner .homepageMainBanner .swiper-slide img,
.homepage_banner .banner_image_div,
.homepage_banner .banner_link {
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
/* The dots the site only shows below 749px. Given room of their own, so they
   sit under the banner rather than over the last few pixels of the image. */
.homepage_banner .swiper-pagination {
  position: static !important;
  display: block !important;
  margin: 8px 0 0 !important;
}

/* ------------------------------------------------------------------
   The coupon strip: hand-scrolled, not self-scrolled.

   The site drives this with a CSS marquee, not JavaScript -- its own drag
   handler is commented out in the theme:

     .mySwiper_couponSlider .slider-track {
       animation: scroll 30s linear infinite;
     }
     @keyframes scroll { from { translateX(0) } to { translateX(-50%) } }

   So the strip slid past on its own and a coupon could not be held still long
   enough to read, let alone copied. The animation is stopped and the container
   becomes a native horizontal scroller, so it moves only under the user's
   thumb. It also means one infinite compositor animation stops running for the
   whole life of the dashboard.

   The duplicate coupons the marquee needed are removed in couponStrip.ts, which
   is also where the copy button is put back to work.
   ------------------------------------------------------------------ */
.mySwiper_couponSlider .slider-track {
  animation: none !important;
  transform: none !important;
  transition: none !important;
  width: max-content;
}
.slider-container.mySwiper_couponSlider {
  overflow-x: auto !important;
  overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}
.slider-container.mySwiper_couponSlider::-webkit-scrollbar {
  display: none;
}
.mySwiper_couponSlider .slide {
  scroll-snap-align: start;
}
/* The copy control is an 18px glyph on mobile, which is half a usable target.
   Padded out rather than scaled up, so Zigly's icon keeps its own size. */
.coupon_slider_main .secondary_Svg {
  padding: 8px !important;
  margin: -8px !important;
  min-width: 34px;
  min-height: 34px;
  align-items: center;
  justify-content: center;
}

/* ------------------------------------------------------------------
   Top Pet Brands: one brand per card.

   The section's own Swiper is initialised with

     grid: { rows: 2, fill: "row" }

   so every column of the rail holds two brands stacked one above the other.
   That is the two-brands-per-card the brief asks to undo. Swiper positions the
   second row by writing an inline margin-top on those slides, which is why the
   overrides here are !important -- a stylesheet rule with !important is the one
   thing that beats an inline declaration.

   Rather than re-initialise Zigly's Swiper with different options, the rail
   becomes a native horizontal scroller, which is the same treatment every other
   rail in this app already gets and needs no library callback. The cards, their
   images, their links and their order stay the section's own; the Popular /
   Emerging tabs keep working, because that handler is the site's and it only
   toggles a class.

   These rules describe the scroller. They cannot, on their own, make it scroll:
   this is the one rail on the dashboard whose Swiper is still ALIVE -- the
   section is moved into place, not transplanted -- and a live Swiper holds the
   touch gesture, so the finger moved and the rail did not follow. That is what
   brandRail.ts stands the instance down for. Read that file before changing
   anything here; the two halves only work together.
   ------------------------------------------------------------------ */
.home-brand-section-wrapper .home-shop-brand-swiper-wrapper {
  /* Swiper's own swiper-horizontal sets touch-action: pan-y here, which
     tells the browser to ignore horizontal pans outright. brandRail.ts removes
     that class with the instance, but the rail must not depend on the release
     having gone through to accept a sideways thumb. */
  touch-action: auto;
}
.home-brand-section-wrapper .home-shop-brand-swiper-wrapper .swiper-wrapper {
  display: flex !important;
  flex-wrap: nowrap !important;
  height: auto !important;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  transform: none !important;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  touch-action: auto;
  /* A flick that runs off the end stops there, instead of chaining into the
     page's own scroll or into Android's edge-swipe back gesture. */
  overscroll-behavior-x: contain;
  padding-bottom: 4px;
}
.home-brand-section-wrapper .home-shop-brand-swiper-wrapper .swiper-wrapper::-webkit-scrollbar {
  display: none;
}
.home-brand-section-wrapper .home-shop-brand-swiper-wrapper .swiper-slide {
  flex: 0 0 auto;
  scroll-snap-align: start;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
/* The arrows are desktop chrome and overlap the first and last card on a
   phone, where the rail is scrolled by thumb. */
.home-brand-section-wrapper .swiper-button-next,
.home-brand-section-wrapper .swiper-button-prev {
  display: none !important;
}
/* The dots are Swiper's control and do nothing once its instance is gone -- so
   they are hidden only on a section brandRail.ts has actually released. If a
   release ever fails, they stay: they are then the only way to move the rail. */
[data-zigly-brand-native='true'] .swiper-pagination {
  display: none !important;
}

/* ------------------------------------------------------------------
   Hide homepage sections the reference dashboard does not show.

   The site's homepage carries its own arrival sections ("Best Deals"), a video
   text banner and extra single banners that do not appear in the reference
   recording. They are hidden rather than removed, so nothing the theme's own
   scripts expect to find disappears from the DOM.

   The single-banner rule is scoped: our transplanted banners carry the same
   section fragment, so they are exempted by their wrapper.
   ------------------------------------------------------------------ */
/* The homepage's first arrival section is the reference app's "Bestsellers"
   and is relocated into place; any further arrival sections are extra.

   custom_video_text_banner is the reference's video section and is kept.
   video_swiper is "Shop from Feed", which the reference does not show. */
[id*="video_swiper"] {
  display: none !important;
}
[id*="home_arrival_section"][data-zigly-extra="true"] {
  display: none !important;
}

[id*="custom_single_banner"] {
  display: none !important;
}
[id^="zigly-x-"] [id*="custom_single_banner"] {
  display: block !important;
}

/* ------------------------------------------------------------------
   "Everything For" tab blocks (see everythingSection.ts). Its switcher is
   supplied by us, so visibility is driven by our own attribute rather than the
   theme's class.
   ------------------------------------------------------------------ */
#zigly-x-everything [id^="tab_block_"] {
  display: none;
}
#zigly-x-everything [id^="tab_block_"][data-zigly-active="true"] {
  display: block;
}

/* ------------------------------------------------------------------
   Breadcrumbs.

   The reference app goes straight from the header to the page heading; the
   site renders a "Home > Food > Dry Food" trail above it. Hidden on both
   collection and product pages, matched by class so it works regardless of the
   section's generated id suffix.
   ------------------------------------------------------------------ */
.breadcrumbs,
.breadcrumbs-container,
[id*="breadcrumbs"] {
  display: none !important;
}

/* ------------------------------------------------------------------
   Footer wave rules intentionally REMOVED.

   The footer opens with a decorative 2000px-wide desktop image in
   .wave-image-wrapper, which scaled unpredictably on a phone; there were rules
   here constraining it to an 84px band, clipping it, and keeping the footer's
   images and svgs from widening the page. The footer is hidden on every page
   now (below), so not one of those selectors can match. They are gone rather
   than left as dead weight that reads, to the next person, as evidence the
   footer still renders.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   From Our Instagram (see instagramSection.ts).

   The only section on the dashboard the app draws itself, so unlike every
   other block here these rules style our own markup rather than correcting
   Zigly's. It sits in the slot the "Happy Moments" photo grid used to hold,
   directly above the brand-claims strip that ends the page.

   Deliberately the same rail as Hot Picks and Explore: 12px gutters, a 12px
   gap, 46% cards so the next one peeks, no visible scrollbar. A section that
   scrolled differently from the two above it would read as a widget bolted on
   rather than part of the dashboard.
   ------------------------------------------------------------------ */
.zigly-ig {
  padding: 8px 12px 24px;
}
/* The heading matches "Hot Picks Of The Week" exactly. [id^="zigly-x-"] h2
   already sets the size, weight and colour for anything in a transplanted
   slot, and this section lives in one -- only the margins are its own. */
.zigly-ig__title {
  text-align: left;
  margin: 22px 0 14px;
}
.zigly-ig__rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
}
.zigly-ig__rail::-webkit-scrollbar {
  display: none;
}
/* Square, via padding rather than aspect-ratio: the covers are Instagram's
   own 640px square crops, so the card is showing them at their natural shape
   and nothing is cropped twice. */
.zigly-ig__card {
  position: relative;
  display: block;
  flex: 0 0 46%;
  max-width: 46%;
  height: 0;
  padding-bottom: 46%;
  scroll-snap-align: start;
  border-radius: 14px;
  overflow: hidden;
  /* Holds the card's shape while the cover decodes, so the rail does not
     assemble itself in front of the customer. */
  background: #EFEFEF;
  text-decoration: none;
}
.zigly-ig__img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 14px;
}
/* The reel marker. Only video posts carry one, so it tells the customer which
   cards are reels rather than decorating all of them alike. */
.zigly-ig__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

/* ------------------------------------------------------------------
   Two banners that lead nowhere, made untappable.

   Both close the dashboard, and both answer a tap with a navigation the
   customer did not ask for:

     - the brand-claims strip, the trust markers that end the page, wraps its
       artwork in <a href="">. An empty href is not an inert link -- it
       resolves to the current URL, so tapping the trust markers reloaded the
       dashboard. Read on the live site, those are the only empty-href anchors
       the homepage has, and both the homepage's own copy of the strip and the
       transplanted one are built that way.
     - the gift-card half of the double banner points at /collections, while
       its own artwork is the file GiftCard_1350X535_Coming-Soon.png. The tap
       offers a gift card and delivers the catalogue. The birthday half beside
       it points at a real collection and is deliberately left working.

   pointer-events rather than stripping the href: this file is presentation
   only, and the markup stays exactly where the theme's own scripts expect to
   find it.
   ------------------------------------------------------------------ */
#zigly-x-logos a,
[id*="custom_single_banner"] a[href=""],
#zigly-x-double .double-banner-cards-2 a {
  pointer-events: none !important;
  cursor: default !important;
}

/* ------------------------------------------------------------------
   The footer, hidden everywhere.

   It used to show at the end of the dashboard and be hidden only on inner
   pages, which is what the reference app does. What that actually put on
   screen was the footer's decorative navy wave as a blue band across the foot
   of the page, with the site's link lists under it -- below a native bottom
   bar that already carries those destinations. So the dashboard now ends
   where the reference's content ends, at the brand-claims strip, and that
   strip sits directly above the native bar.

   Hidden rather than removed, and the distinction matters here: drawerExtras
   clones the About Us row out of the footer's own links, and menuBridge reads
   the native drawer from that list. display:none leaves the anchors in the
   DOM for querySelectorAll to find; removing them would quietly drop a row
   from the menu.
   ------------------------------------------------------------------ */
footer,
[id*="__footer"] {
  display: none !important;
}

${BREED_PAGE_CSS}
`;

/**
 * Wraps the CSS in an idempotent installer.
 *
 * A <style> node in <head> survives Shopify section re-renders, which replace
 * subtree innerHTML wholesale -- that is why the styling lives here rather than
 * in nodes injected into the sections themselves. No MutationObserver needed.
 */
export const buildStyleInjection = (css: string): string => `
(function () {
  /*
   * Lift the paint gate installed by EARLY_HEADER_CSS.
   *
   * The gate holds the document invisible so nobody sees the mobile website in
   * the beat before this stylesheet lands; installing the stylesheet is exactly
   * the moment it has done its job. Called on every path out of this function,
   * including the ones that give up -- a gate that is not lifted is a blank
   * page, so it must never depend on the happy case being reached.
   */
  var liftGate = function () {${LIFT_PAINT_GATE}};

  try {
    // Mark inner pages so CSS can differentiate them from the dashboard.
    // Path is read at execution time, so this is correct on every navigation.
    //
    // No rule reads the class at the moment: hiding the footer on every page
    // rather than on inner pages only took its last consumer. Kept because it
    // is the hook any page-type rule would hang off, and because getting it
    // right on every navigation is the part that is easy to get wrong.
    try {
      var pth = window.location.pathname;
      while (pth.length > 1 && pth.charAt(pth.length - 1) === '/') {
        pth = pth.slice(0, -1);
      }
      var home = pth === '' || pth === '/' || pth === '/index';
      var root = document.documentElement;
      var cls = root.className.split(' ');
      var keep = [];
      for (var ci = 0; ci < cls.length; ci++) {
        if (cls[ci] && cls[ci] !== 'zigly-inner-page') { keep.push(cls[ci]); }
      }
      if (!home) { keep.push('zigly-inner-page'); }
      root.className = keep.join(' ');
    } catch (e) {}

    // Zigly's supported in-app hook; also set in the early payload. Repeated
    // here because if that one is missed, their header script would fall back
    // to user-agent sniffing instead of the path they intend for apps.
    window.IS_MOBILE_APP = true;

    // Self-guard. The WebView's injectedJavaScript prop is fixed at mount and
    // runs on EVERY page load, including checkout -- so the URL check cannot
    // live only on the React side. Never style the money flow.
    var p = window.location.pathname.toLowerCase();
    var host = window.location.hostname.toLowerCase();
    var isMoneyFlow =
      p.indexOf('/checkouts/') === 0 ||
      p.indexOf('/checkout') === 0 ||
      p.indexOf('/wallets/') === 0 ||
      p.indexOf('/payments/') === 0 ||
      host.indexOf('gokwik') !== -1 ||
      host.indexOf('shop.app') !== -1 ||
      host.indexOf('razorpay') !== -1 ||
      host.indexOf('payu') !== -1;
    if (isMoneyFlow) { liftGate(); return; }

    var ID = 'zigly-app-styles';
    var existing = document.getElementById(ID);
    var css = ${JSON.stringify(css)};
    if (existing) {
      if (existing.textContent !== css) { existing.textContent = css; }
      liftGate();
      return;
    }
    var el = document.createElement('style');
    el.id = ID;
    el.type = 'text/css';
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
    // Last, and only now: the page is this app's rather than the website's.
    liftGate();
  } catch (e) {
    // Never let presentation break the page. Including the gate: a page shown
    // unstyled is a bad page, a page never shown at all is a broken app.
    liftGate();
    if (window.console && console.warn) {
      console.warn('[ZiglyWebView] style injection failed:', e);
    }
  }
})();
true;
`;
