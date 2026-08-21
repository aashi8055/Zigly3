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
  gap: 14px;
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
/* Roughly three circles visible, matching the reference app. */
[id^="zigly-breed-"] .swiper-slide {
  flex: 0 0 30%;
  max-width: 30%;
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
   screens, so the site's bottom nav is hidden while it is present. Navigation
   stays available through the header's back arrow.
   ------------------------------------------------------------------ */
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
body.zigly-has-sortfilter .fixed-icons {
  display: none !important;
}
body.zigly-has-sortfilter {
  padding-bottom: 70px !important;
}

/* ------------------------------------------------------------------
   The site's bottom navigation.

   The reference app shows the site's own four tabs -- Zigly, Collections,
   Breed-verse, Wishlist -- so nothing is added to the bar. These rules only
   spread the tabs evenly and let "Breed-verse" wrap, as the reference does.
   ------------------------------------------------------------------ */
.fixed-icons {
  gap: 0 !important;
}
.fixed-icons > a {
  flex: 1 1 0 !important;
  min-width: 0 !important;
}
.fixed-icons > a span {
  font-size: 0.95rem !important;
  text-align: center;
  white-space: normal;
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

/* 1. Breed circles were roughly half the reference size, and four fitted per
      screen where the reference shows three. */
[id^="zigly-breed-"] .swiper-slide {
  flex: 0 0 33% !important;
  max-width: 33% !important;
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
   Category circles: the reference app runs them straight under the search
   band with no heading, so the section's own title is hidden.
   ------------------------------------------------------------------ */
[id*="home_category_section"] h2,
[id*="home_category_section"] .top-head-wrapper {
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
