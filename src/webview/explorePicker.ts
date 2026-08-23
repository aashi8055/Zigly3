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
 * WHY THE MERGE SHOWED DOGS ONLY
 *
 * The merge worked and the section still read as dog-only, for three separate
 * reasons that each had to be fixed:
 *
 *   1. Duplicates were keyed on the tile's label. Both pets ship a "Dry Food"
 *      tile, so the cat one was deleted as a repeat -- and since the dog set
 *      merges in first, every category the two pets share silently became the
 *      dog listing. Measured against the live sections on 2026-08-23:
 *
 *        tab             collided labels                cat tiles surviving
 *        Food            Dry Food, Wet Food, Prescr.    1 of 4 (Kitten Food)
 *        Treats          Meaty Treats                   3 of 4
 *        Toys            Plush Toys, Interactive Toys   2 of 4
 *        Smart Petcare   Fresh Food                     3 of 4
 *
 *      Every collided pair goes to a DIFFERENT collection -- each pet's tile
 *      points at that pet's own listing -- so not one of them was a duplicate.
 *      dropRepeats() therefore keys on where a tile goes, not what it is
 *      called, and all four cat tiles survive in all four tabs.
 *
 *   2. Cat tiles were appended after all the dog ones. The rail shows about two
 *      tiles at a time, so four dog tiles followed by four cat tiles is still a
 *      dog-only rail -- the cats are real but off-screen, with nothing on
 *      screen to suggest scrolling would reach them. interleave() alternates
 *      the two, putting a cat tile second in every tab.
 *
 *   3. The per-tab cap was 8, exactly the real total, so one tile added by
 *      Zigly on either page would have disappeared with no sign. It is now a
 *      true runaway guard. It was 4 once, which dropped every cat tile.
 *
 * THE MARKUP IS MALFORMED, AND KEYING ON A LINK HAS TO ALLOW FOR IT
 *
 * Zigly close each tile's link by repeating the opening <a href> rather than
 * writing </a>. The parser recovers from that -- nested anchors are not allowed
 * -- by leaving an empty copy of the anchor loose: sometimes out in the rail
 * beside the tile, sometimes inside the tile that follows. Every rail on both
 * pages comes out the same way, four tiles and two empty leftovers.
 *
 * The tiles themselves are fine. Each one's heading and image really are inside
 * the right link, so on the website every tile goes where it should. What is not
 * fine is asking a tile for its FIRST anchor: for half of them that returns the
 * leftover belonging to the tile before. Read that way, three of the four Food
 * tiles report the wrong destination and two then look like duplicates of their
 * neighbour and get deleted. So destOf() walks up from the heading to the anchor
 * actually wrapping it -- correct for all 32 tiles across both pages -- and
 * stripStrayAnchors() clears the empty leftovers, which otherwise leave the rail
 * unevenly spaced and keep that trap lying around for the next reader.
 *
 * No link is repaired or rewritten -- the tiles keep the markup the site serves,
 * so a tap does here what it does on the website.
 *
 * With both pets in one rail four of Zigly's labels collide, so tagSpecies()
 * writes "For Dogs" / "For Cats" into the subheading element the section
 * already renders under every heading and leaves empty. Their heading text is
 * never rewritten -- only the pet is added, in the space their own layout
 * already reserves.
 *
 * EVERY TILE KEEPS THE LINK IT SHIPPED WITH
 *
 * An earlier version tried to improve on those links, pointing a merged tile at
 * a combined collection whose handle it guessed from the label -- a "Rope Toys"
 * tile at a rope-toys collection -- guarded by a HEAD request, falling back to
 * the site's search on a 404. The guard was the problem: a Shopify collection
 * can be published and empty, so HEAD answers 200 for a handle holding nothing.
 * Counts read on 2026-08-22 showed five of sixteen tiles opening an empty page,
 * while the rest had a real species-specific listing swapped for a broader
 * guess -- one guessed handle held 0 products against 112 in the handle it
 * replaced. Every tile already carries a collection URL Zigly themselves chose,
 * so there was never anything to improve on. Leaving the links exactly as
 * shipped is the only way to be sure a tile lands on products.
 *
 * Handles are deliberately absent from this file, injected script and comments
 * alike: the app authors no collection URL, and injection.test.ts holds that.
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
  // Runaway guard only. The real total is eight per tab -- four from each pet,
  // none of them duplicates -- so this must stay above it. See the file header.
  var MAX_TILES = 16;
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

  /** Every .swiper-slide under a node, as a real array we can reorder. */
  function slidesIn(node) {
    var found = node.querySelectorAll('.swiper-slide');
    var list = [];
    for (var i = 0; i < found.length; i++) { list.push(found[i]); }
    return list;
  }

  /**
   * Where a tile points. This, not its label, is what makes a tile itself.
   *
   * Read by walking up from the tile's heading to the anchor wrapping it, NOT
   * by taking the tile's first anchor -- the first one is often a leftover that
   * belongs to the tile before it. See the file header on the markup.
   */
  function destOf(slide) {
    var node = slide.querySelector('.card-wrapper_info-heading') || slide;
    while (node && node !== slide) {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        return node.getAttribute('href');
      }
      node = node.parentNode;
    }
    return '';
  }

  /**
   * Remove the empty anchors the browser leaves behind in this section.
   *
   * Zigly close each tile's link by repeating the opening <a> rather than
   * writing </a>, and the parser resolves that by leaving an empty copy of the
   * anchor loose -- some hoisted out into the rail beside the tile, some landed
   * inside the tile that follows. Two per rail either way, on every rail.
   *
   * Both kinds are worth clearing. One sits in the rail, which is a flex row
   * with a gap, so it spends a gap and leaves the tiles unevenly spaced. The
   * other is the trap destOf() has to work around: it is the first anchor
   * inside its tile while pointing at the previous one. Removing them means
   * asking a tile for its link the obvious way is no longer wrong.
   *
   * The test is what makes this safe rather than a guess: an anchor with no
   * elements in it and nothing to read cannot be a tile's link, because a real
   * one wraps that tile's image and heading. There is nothing there to lose.
   */
  function stripStrayAnchors(scope) {
    var links = scope.querySelectorAll('a');
    for (var i = links.length - 1; i >= 0; i--) {
      var link = links[i];
      if (link.children.length) { continue; }
      if (squash(link.textContent || '')) { continue; }
      if (link.parentNode) { link.parentNode.removeChild(link); }
    }
  }

  /**
   * Say which pet a tile is for, in the subheading the tile already renders.
   *
   * Both pets share one rail here, where several of Zigly's labels read
   * identically, so the pet has to be on the tile. The heading is never
   * touched; this fills a sibling element the section ships empty. Reasoning in
   * the file header.
   */
  function tagSpecies(scope, text) {
    var slides = slidesIn(scope);
    for (var i = 0; i < slides.length; i++) {
      var sub = slides[i].querySelector('.card-wrapper_info-subheading');
      if (!sub) { continue; }
      // If Zigly ever fill this in, what they wrote wins.
      if (squash(sub.textContent || '')) { continue; }
      sub.textContent = text;
      sub.setAttribute('data-zigly-species', '1');
    }
  }

  /**
   * Alternate the two pets' tiles instead of appending one set after the other.
   *
   * The rail shows about two tiles at a time, so appending puts every tile of
   * the second pet out of sight. See the file header.
   *
   * appendChild moves a node already in the wrapper, so re-appending the first
   * pet's tiles in order is what reorders them.
   */
  function interleave(wrap, catSlides) {
    var dogSlides = slidesIn(wrap);
    var most = Math.max(dogSlides.length, catSlides.length);
    for (var i = 0; i < most; i++) {
      if (i < dogSlides.length) { wrap.appendChild(dogSlides[i]); }
      if (i < catSlides.length) { wrap.appendChild(document.importNode(catSlides[i], true)); }
    }
  }

  /**
   * Drop tiles that lead to the same place, then cap the rail.
   *
   * Keyed on the destination, NOT on the label: the two pets label many tiles
   * the same while pointing them at different listings, and keying on the label
   * is what deleted the cat ones. The key still earns its place -- it catches a
   * tile genuinely listed on both pages, and it is the honest test for one.
   *
   * A tile's link is never rewritten, only kept or dropped. The file header has
   * the counts for why.
   */
  function dropRepeats(root) {
    var blocks = root.querySelectorAll('[id^="tab_block_"]');
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      var wrap = block.querySelector('.swiper-wrapper') || block;
      var slides = slidesIn(block);
      var seen = {};

      for (var i = 0; i < slides.length; i++) {
        // Prefixed so a handle like "constructor" cannot collide with
        // something already on Object.prototype.
        var key = 'k' + (destOf(slides[i]) || squash(slides[i].textContent || ''));
        if (key === 'k') { continue; }
        if (seen[key]) {
          if (slides[i].parentNode) { slides[i].parentNode.removeChild(slides[i]); }
        } else {
          seen[key] = 1;
        }
      }

      var remaining = slidesIn(wrap);
      for (var r = MAX_TILES; r < remaining.length; r++) {
        if (remaining[r].parentNode) {
          remaining[r].parentNode.removeChild(remaining[r]);
        }
      }
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
      stripStrayAnchors(imported);

      if (catSec) {
        stripStrayAnchors(catSec);
        tagSpecies(imported, 'For Dogs');
        tagSpecies(catSec, 'For Cats');

        var dogTabs = tabMap(imported);
        var catTabs = tabMap(catSec);
        for (var label in catTabs) {
          if (!Object.prototype.hasOwnProperty.call(catTabs, label)) { continue; }
          var target = dogTabs[label];
          if (!target) { continue; }
          var into = target.querySelector('.swiper-wrapper') || target;
          interleave(into, slidesIn(catTabs[label]));
        }
      } else {
        // No cat tiles to tell apart, so the tiles are left exactly as shipped.
        warn('cat explore section unavailable; showing dog categories only');
      }

      slot.appendChild(imported);
      dropRepeats(slot);

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
