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
import {HEADER_DRAWER_CSS} from './headerBridge';
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
  position: static !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  z-index: auto !important;
  transform: none !important;
}
#zigly-hot-picks .quick-add__submit {
  position: static !important;
  width: 100% !important;
}
/* The rail must not paint over anything below it. */
#zigly-hot-picks {
  position: relative;
  z-index: 0;
  isolation: isolate;
}

/* ------------------------------------------------------------------
   Sort / Filter bar on collection pages (see sortFilterBar.ts).
   The controls inside are SearchTap's own; this only places them.

   The reference app shows this bar in place of the tab bar on collection
   screens. The site's own nav is hidden everywhere now, and the *native* bar
   stands down on these pages for the same reason -- see showsSortFilterBar in
   ../utils/urlUtils.ts, which mirrors the path test this script uses.
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   One Sort and one Filter, never two.

   SearchTap re-renders its controls on every filter change and every page of
   results, and it recreates them where they started -- at the top of the grid.
   sortFilterBar.ts moves them into the pinned bar, and now re-pins from a
   MutationObserver rather than a poll, but no amount of JavaScript makes that
   race impossible: there is always a frame between their render and our move.

   This closes it. A control anywhere on a listing page is hidden; the same
   control inside our bar is shown, and wins because an id beats a class. So the
   duplicate at the top of the grid is never visible, whatever the timing --
   and if the move fails outright, the bar is empty rather than doubled.

   Hidden, never removed: these are SearchTap's own custom elements, and their
   scripts re-render into them. An element they cannot find is how a script
   starts throwing on every filter change.
   ------------------------------------------------------------------ */
body.zigly-listing .st-filter-count-sort-wrap,
body.zigly-listing initial-search-filters,
body.zigly-listing initial-search-sort {
  display: none !important;
}
#zigly-sortfilter-bar .st-filter-count-sort-wrap,
#zigly-sortfilter-bar initial-search-filters,
#zigly-sortfilter-bar initial-search-sort {
  display: flex !important;
}

#zigly-sortfilter-bar {
  position: fixed !important;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-top: 1px solid #E3E9F3;
  box-shadow: 0 -4px 16px rgba(24, 55, 97, 0.10);
  min-height: 56px;
}
#zigly-sortfilter-bar > * {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Divider between the two controls. */
#zigly-sortfilter-bar > *:first-child {
  border-right: 1px solid #E3E9F3;
}
/* Clearance for the pinned bar. 56px of bar plus room to breathe: at 70px the
   foot of the document sat almost against the strip, which is where SearchTap
   draws its paginating loader -- so the page looked stuck rather than loading.
   scroll-padding too, so an anchored jump cannot land behind the bar either. */
body.zigly-has-sortfilter {
  padding-bottom: 96px !important;
  scroll-padding-bottom: 96px;
}
/* And lift the loader itself clear, for the case where it is not the last
   thing in the document. Matched by class fragment because it is SearchTap's
   markup, not the theme's -- the same approach used for the Gorgias launcher,
   and the reason this sets nothing but a margin: a false positive costs a gap,
   never a broken grid. */
body.zigly-has-sortfilter [class*="st-load"],
body.zigly-has-sortfilter [class*="st-spinner"],
body.zigly-has-sortfilter [class*="st-infinite"] {
  margin-bottom: 72px !important;
}
/* The controls arrive as SearchTap's own pills -- rounded, bordered, inset.
   Inside a full-width bar they read as two buttons floating in a strip rather
   than as the strip itself, so their chrome is flattened and they are stretched
   to fill their half. Only presentation: these are still SearchTap's elements,
   with SearchTap's listeners, opening Zigly's real panels. */
#zigly-sortfilter-bar button,
#zigly-sortfilter-bar [role="button"] {
  width: 100% !important;
  min-height: 56px !important;
  margin: 0 !important;
  padding: 0 12px !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #1B1B1B !important;
}
/* A count badge SearchTap renders on the filter control must not be stretched
   along with the button it sits in. */
#zigly-sortfilter-bar button > svg,
#zigly-sortfilter-bar button > img {
  width: auto !important;
  min-height: 0 !important;
  flex: 0 0 auto !important;
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

   Scoped to body.zigly-listing, which sortFilterBar.ts sets on collection and
   search pages only. It must never reach a product page: there,
   .mobile-atc-main IS the site's sticky Add to Bag bar and is meant to float.
   ------------------------------------------------------------------ */
body.zigly-listing .mobile-atc-main,
body.zigly-listing .atc-wrapper,
body.zigly-listing .quick-add,
body.zigly-listing .st-collection-atc {
  position: static !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  z-index: auto !important;
  transform: none !important;
}
body.zigly-listing .card--variant--main-wrapper,
body.zigly-listing .mobile-compact-variant-display,
body.zigly-listing .mobile-compact-variant-more,
body.zigly-listing .card-variant-wrapper {
  display: none !important;
}
body.zigly-listing .quick-add__submit {
  display: block !important;
  position: static !important;
  width: 100% !important;
}
/* Cards clip their own contents, so nothing can paint over the row below. */
body.zigly-listing .card-wrapper {
  position: relative;
  overflow: hidden;
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
  position: static !important;
  inset: auto !important;
  width: 100% !important;
  z-index: auto !important;
  transform: none !important;
}
[id^="zigly-x-"] {
  isolation: isolate;
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
  flex: 0 0 24% !important;
  max-width: 24% !important;
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
   it is the smallest thing on screen competing with the product link
   underneath it -- so it gets a real target and stops the tap becoming a
   scroll. Nothing about which element handles the tap changes: the listener is
   the site's own, delegated from document. */
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
   ------------------------------------------------------------------ */
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
   Footer wave.

   The footer opens with a decorative 2000px-wide desktop image in
   .wave-image-wrapper. On a phone it scaled unpredictably as the page grew,
   showing as the footer stretching. Constrained to its own aspect and clipped,
   so it stays a band at the top of the footer.
   ------------------------------------------------------------------ */
footer .wave-image-wrapper {
  height: auto !important;
  max-height: 84px !important;
  overflow: hidden !important;
  line-height: 0 !important;
}
footer .wave-image-wrapper img {
  display: block !important;
  width: 100% !important;
  height: auto !important;
  max-height: 84px !important;
  object-fit: cover !important;
  object-position: top center !important;
}
/* Nothing in the footer should be able to widen the page. */
footer img,
footer svg {
  max-width: 100% !important;
}
footer {
  overflow-x: hidden !important;
}

/* ------------------------------------------------------------------
   Footer on the dashboard only.

   The reference app shows the footer at the end of the dashboard; inner pages
   end at the product grid with Sort and Filter pinned instead. Hidden rather
   than removed, so nothing the theme's scripts expect disappears.
   ------------------------------------------------------------------ */
html.zigly-inner-page footer,
html.zigly-inner-page [id*="__footer"] {
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
  try {
    // Mark inner pages so CSS can differentiate them from the dashboard.
    // Path is read at execution time, so this is correct on every navigation.
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
    if (isMoneyFlow) { return; }

    var ID = 'zigly-app-styles';
    var existing = document.getElementById(ID);
    var css = ${JSON.stringify(css)};
    if (existing) {
      if (existing.textContent !== css) { existing.textContent = css; }
      return;
    }
    var el = document.createElement('style');
    el.id = ID;
    el.type = 'text/css';
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  } catch (e) {
    // Never let presentation break the page.
    if (window.console && console.warn) {
      console.warn('[ZiglyWebView] style injection failed:', e);
    }
  }
})();
true;
`;
