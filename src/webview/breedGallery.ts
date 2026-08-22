/**
 * Show every breed on the Breed-verse index.
 *
 * Zigly's breed grid pages itself: 32 cards, 24 per page, with the next page
 * revealed by an IntersectionObserver on the last visible card. Verified
 * against the live page on 2026-08-22, the section's own script does this:
 *
 *   galleryObserver = new IntersectiongalleryObserver(
 *     entries => { ... currentPage++; renderGallery(); },
 *     { rootMargin: '200px' }
 *   );
 *
 * `IntersectiongalleryObserver` is a typo on the site -- a find-and-replace of
 * `observer` with `galleryObserver` that also caught the middle of
 * `IntersectionObserver`. The name is undefined, so `observeLastCard` throws a
 * ReferenceError on the first render and page two is never asked for.
 *
 * The arithmetic is exactly what was reported: 25 dogs and 7 cats.
 *
 *   All -- 32 cards, 24 shown, 8 missing.
 *   Dog -- 25 cards, 24 shown, 1 missing.
 *   Cat -- 7 cards, under the page size, so nothing is missing and nothing
 *          looked wrong.
 *
 * The fix supplies the identifier the section's own code is asking for, and
 * then re-runs the section's own render by clicking the tab that is already
 * active. Nothing here reimplements the grid, the paging or the filter: after
 * this, `observeLastCard` succeeds and Zigly's infinite scroll works as it was
 * written to. If they correct the typo, the alias goes unused and the one
 * re-render costs a repaint.
 *
 * Injection lands after the page's DOMContentLoaded, which is why the tab has
 * to be clicked at all -- the failed render has already happened by then.
 */
export const BREED_GALLERY_SCRIPT = `
(function () {
  var FLAG = '__ziglyBreedGallery';
  // The name the section's script asks for, misspelled at the source.
  var WANTED = 'Intersection' + 'galleryObserver';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  try {
    // This is the breed index and nothing else: the grid the section renders
    // into. On any other page there is nothing to repair.
    var grid = document.getElementById('galleryGrid');
    if (!grid) { return; }

    // Once per page load. The stylesheet is re-injected on a schedule after
    // load, and re-clicking the tab would send a customer who had already
    // scrolled back to the first page of cards.
    if (window[FLAG]) { return; }
    window[FLAG] = true;

    if (!window[WANTED] && window.IntersectionObserver) {
      window[WANTED] = window.IntersectionObserver;
    }
    if (!window[WANTED]) {
      warn('no IntersectionObserver; breed paging left as the site has it');
      return;
    }

    // Re-run the section's own render, through the control the section binds
    // its filter to. Clicking the active tab keeps the current category.
    var tabs = document.querySelectorAll('.gallery-tabs button');
    if (!tabs.length) { return; }
    var active = tabs[0];
    for (var i = 0; i < tabs.length; i++) {
      if (String(tabs[i].className || '').indexOf('active') !== -1) {
        active = tabs[i];
        break;
      }
    }
    active.click();
  } catch (e) {
    warn('breed gallery repair failed: ' + e);
  }
})();
true;
`;
