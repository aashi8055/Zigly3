/**
 * "Explore. Pick. Pamper." section.
 *
 * Transplanted from Zigly's own pet pages: four tabs -- Food, Treats, Toys,
 * Smart Petcare -- each holding category tiles that link to real collections.
 * Nothing here is invented; the tiles, images and destinations are Zigly's.
 *
 * Both /pages/dog and /pages/zigly-cat carry this section with the same four
 * tabs but species-specific collections, so the two are merged: tapping Food
 * shows dog AND cat categories rather than dog only.
 *
 * Every tile keeps the link the section shipped with. An earlier version tried
 * to improve on them by pointing a merged tile at a combined collection guessed
 * from its label; see combineDuplicates() for the counts that showed why that
 * has to stop.
 *
 * Two things the source page provides that the homepage does not:
 *
 *   makeActiveSlider() -- the tab switcher, defined on the pet pages only. We
 *   supply a compatible implementation ONLY if the page has not defined one, so
 *   the site's own version always wins where it exists.
 *
 *   Swiper init -- the section's script runs inside DOMContentLoaded with
 *   {once: true}, which has long fired by the time we transplant, so the
 *   carousels would never initialise. Rather than re-run their script, the
 *   slides are laid out as a native horizontal scroller in CSS. Same gesture
 *   for the user, no dependency on a library callback we cannot trigger.
 */
export const EXPLORE_SCRIPT = `
(function () {
  var ID = 'zigly-explore';
  /**
   * Tiles kept per tab, after the dog and cat sets are merged and deduplicated.
   *
   * Each source page ships four, so eight is "everything both pets have" and
   * the cap is really a runaway guard. It used to be four, which silently threw
   * away every cat-only category because the dog tiles merge in first.
   */
  var MAX_TILES = 8;
  var PRIMARY = 'explore_product@dog';
  var SECONDARY = 'explore_product@cat';
  var FRAGMENT = 'explore_product';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  if (!isHome()) { return; }
  if (document.getElementById(ID)) { return; }
  if (document.querySelector('[id*="' + FRAGMENT + '"]')) { return; }

  var anchor = document.getElementById('zigly-hot-picks')
            || document.getElementById('zigly-breed-cats')
            || document.querySelector('[id*="coupon_slider"]')
            || document.querySelector('[id*="homepage_banner"]');
  if (!anchor || !anchor.parentNode) { warn('no anchor for explore section'); return; }

  var slot = document.createElement('div');
  slot.id = ID;
  anchor.parentNode.insertBefore(slot, anchor.nextSibling);

  /**
   * Tab switcher matching the site's own signature. Defined only if absent, so
   * we never shadow Zigly's implementation.
   */
  if (typeof window.makeActiveSlider !== 'function') {
    window.makeActiveSlider = function (el, blockId) {
      try {
        var root = document.getElementById('${'zigly-explore'}') || document;

        var tabs = root.querySelectorAll('.explore_product__header_switcher_tab');
        for (var i = 0; i < tabs.length; i++) {
          tabs[i].className = tabs[i].className.split('active').join('').trim();
        }
        if (el) { el.className = el.className + ' active'; }

        var blocks = root.querySelectorAll('[id^="tab_block_"]');
        for (var j = 0; j < blocks.length; j++) {
          blocks[j].setAttribute('data-zigly-active', 'false');
        }
        var target = document.getElementById(blockId);
        if (target) { target.setAttribute('data-zigly-active', 'true'); }
      } catch (e) {
        warn('tab switch failed: ' + e);
      }
    };
  }

  /** Whitespace-collapsing trim without a regex (escapes get mangled here). */
  function squash(str) {
    var out = '';
    var prevWs = true;
    for (var k = 0; k < str.length; k++) {
      var c = str.charCodeAt(k);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
      else { out += str.charAt(k); prevWs = false; }
    }
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); }
    return out;
  }

  /** Pair each tab label with the block it reveals. */
  function tabMap(root) {
    var map = {};
    var tabs = root.querySelectorAll('.explore_product__header_switcher_tab');
    for (var i = 0; i < tabs.length; i++) {
      var label = squash(tabs[i].textContent || '');
      var onclick = tabs[i].getAttribute('onclick') || '';
      var parts = onclick.split("'");
      var blockId = parts.length >= 2 ? parts[parts.length - 2] : '';
      var block = blockId ? root.querySelector('[id="' + blockId + '"]') : null;
      if (label && block) { map[label] = block; }
    }
    return map;
  }

  /**
   * Only fetch when the section is close to the viewport.
   *
   * These pull real product markup from other Zigly pages -- the arrival
   * section alone is ~562 KB -- and they sit well below the fold. Loading them
   * on sight keeps the homepage's first paint cheap; without IntersectionObserver
   * we simply load immediately, which is the old behaviour.
   */
  function whenNear(el, run) {
    if (!window.IntersectionObserver) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          io.disconnect();
          run();
          return;
        }
      }
    }, {rootMargin: '600px 0px'});
    io.observe(el);
  }

  /**
   * Collapse the dog and cat copies of a category into one tile.
   *
   * After merging, a category that both pets have appears twice -- Wet Food
   * (dog) and Wet Food (cat) -- where the reference app shows one tile. The
   * first is kept and the later ones dropped.
   *
   * WHAT THIS DELIBERATELY NO LONGER DOES, because it was sending people to
   * empty listings. It used to rewrite the surviving tile's link to a combined
   * collection whose handle it guessed from the label -- "Rope Toys" becoming a
   * "rope-toys" collection -- guarded by a HEAD request, and fell back to the
   * site's search when that 404'd. The guard was the problem: a Shopify
   * collection can be published and empty, so HEAD answers 200 for a handle
   * with nothing in it. Product counts read on 2026-08-22:
   *
   *     tile                 guessed handle       had   handle it shipped  had
   *     Biscuits & Cookies   biscuits-cookies       0   dog-biscuits         7
   *     Rope Toys            rope-toys              0   dog-rope-tug-toys   21
   *     Plush Toys           plush-toys             0   dog-plush-toys     112
   *     Interactive Toys     interactive-toys       0   dog-interactive-...  17
   *     Travel Essentials    travel-essentials      0   dog-grooming-...     33
   *
   * So five of sixteen tiles opened an empty page, and the rest had their
   * species-specific listing swapped for a broader guess. Every tile already
   * carries a real collection URL that Zigly themselves chose -- there was
   * never anything to improve on. The links are now left exactly as the section
   * ships them, which is the only way to be sure a tile lands on products.
   *
   * The cost is that a shared category shows the dog listing rather than a
   * combined one. That is a listing with products in it, which beats a listing
   * without.
   */
  function combineDuplicates(root) {
    var blocks = root.querySelectorAll('[id^="tab_block_"]');
    for (var b = 0; b < blocks.length; b++) {
      (function (block) {
        var wrap = block.querySelector('.swiper-wrapper') || block;
        var slides = block.querySelectorAll('.swiper-slide');
        var seen = {};

        for (var i = 0; i < slides.length; i++) {
          var label = squash(slides[i].textContent || '');
          if (!label) { continue; }
          if (seen[label]) {
            if (slides[i].parentNode) {
              slides[i].parentNode.removeChild(slides[i]);
            }
          } else {
            seen[label] = 1;
          }
        }

        // Keep the cap generous. The rail is a horizontal scroller, so extra
        // tiles cost nothing on screen, and the categories only one pet has --
        // Kitten Food, Creamy Treats, Catnip Toys, Wand Toys, Litter
        // Accessories -- are exactly the ones a tight cap threw away, since the
        // dog tiles are merged in first.
        var remaining = wrap.querySelectorAll('.swiper-slide');
        for (var r = MAX_TILES; r < remaining.length; r++) {
          if (remaining[r].parentNode) {
            remaining[r].parentNode.removeChild(remaining[r]);
          }
        }
      })(blocks[b]);
    }
  }

  whenNear(slot, function () {
  Promise.all([
    window.__ziglyFetchSection('/', PRIMARY),
    window.__ziglyFetchSection('/', SECONDARY)
  ])
    .then(function (results) {
      var dogSec = results[0];
      var catSec = results[1];

      if (!dogSec) { warn('explore section unavailable'); return; }

      var imported = document.importNode(dogSec, true);

      // Its scripts only bind Swiper via an event that has already fired; drop
      // them rather than leave dead code that could double-bind later.
      var scripts = imported.querySelectorAll('script');
      for (var k = 0; k < scripts.length; k++) {
        scripts[k].parentNode.removeChild(scripts[k]);
      }

      // Merge the cat tiles into the matching tab, so Food means dog and cat.
      if (catSec) {
        var dogTabs = tabMap(imported);
        var catTabs = tabMap(catSec);
        for (var label in catTabs) {
          if (!Object.prototype.hasOwnProperty.call(catTabs, label)) { continue; }
          var target = dogTabs[label];
          if (!target) { continue; }
          var into = target.querySelector('.swiper-wrapper') || target;
          var slides = catTabs[label].querySelectorAll('.swiper-slide');
          for (var sIdx = 0; sIdx < slides.length; sIdx++) {
            into.appendChild(document.importNode(slides[sIdx], true));
          }
        }
      } else {
        warn('cat explore section unavailable; showing dog categories only');
      }

      slot.appendChild(imported);
      combineDuplicates(slot);

      var blocks = slot.querySelectorAll('[id^="tab_block_"]');
      for (var b = 0; b < blocks.length; b++) {
        blocks[b].setAttribute('data-zigly-active', b === 0 ? 'true' : 'false');
      }
    })
    .catch(function (e) { warn('explore section failed: ' + e); });
  });
})();
true;
`;
