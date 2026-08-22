/**
 * "Everything For" with Dogs and Cats tabs.
 *
 * The reference app shows this section with Dogs / Cats tabs. Neither source
 * template has that: the dog page ships Puppy / Adult and the cat page ships
 * Kitten / Cat, and the homepage carries no such section at all. So the dog
 * section is used as the frame, its two tabs relabelled Dogs and Cats, and the
 * second tab filled with the cat page's tiles.
 *
 * All tiles remain Zigly's own markup with their real collection links; only
 * which tiles sit behind which label changes.
 *
 * The section's tab switcher is a page function named makeActiveSlider_eveything
 * (their spelling). We never run the section's scripts -- they also start the
 * looping carousels -- so a compatible one is defined here, and only if the
 * page has not defined its own.
 */
export const EVERYTHING_SCRIPT = `
(function () {
  var ID = 'zigly-x-everything';
  var FRAGMENT = 'everything';

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  if (!isHome()) { return; }

  /**
   * Is the SITE already rendering this section?
   *
   * The plain \`[id*="everything"]\` test this used to be always matched -- and
   * what it matched was our own slot, \`zigly-x-everything\`, which extraSections
   * reserves a few lines earlier in the same injection. So the section bailed
   * out every single time and "Everything For" never appeared on the dashboard
   * at all. Ids this app creates are all \`zigly-\` prefixed, so they are the one
   * thing this check has to ignore.
   */
  function siteRenders(fragment) {
    var found = document.querySelectorAll('[id*="' + fragment + '"]');
    for (var i = 0; i < found.length; i++) {
      var id = found[i].getAttribute('id') || '';
      if (id.indexOf('zigly-') !== 0) { return true; }
    }
    return false;
  }

  if (siteRenders(FRAGMENT)) { return; }

  // The slot is reserved by extraSections so the order is fixed there, not
  // recomputed here from whichever siblings happen to exist yet.
  var slot = document.getElementById(ID);
  if (!slot) { warn('everything slot not reserved yet'); return; }
  if (slot.getAttribute('data-filled') === 'true') { return; }
  slot.setAttribute('data-filled', 'true');

  /** The section's own switcher, supplied only if the page lacks it. */
  if (typeof window.makeActiveSlider_eveything !== 'function') {
    window.makeActiveSlider_eveything = function (el, blockId) {
      try {
        var root = document.getElementById(ID) || document;

        var tabs = root.querySelectorAll('.everything_product__header_switcher_tab');
        for (var i = 0; i < tabs.length; i++) {
          var parts = tabs[i].className.split(' ');
          var kept = [];
          for (var k = 0; k < parts.length; k++) {
            if (parts[k] && parts[k] !== 'active') { kept.push(parts[k]); }
          }
          tabs[i].className = kept.join(' ');
        }
        if (el) { el.className = el.className + ' active'; }

        var blocks = root.querySelectorAll('[id^="tab_block_"]');
        for (var j = 0; j < blocks.length; j++) {
          blocks[j].setAttribute('data-zigly-active', 'false');
        }
        var target = document.getElementById(blockId);
        if (target) { target.setAttribute('data-zigly-active', 'true'); }
      } catch (e) {
        warn('everything tab switch failed: ' + e);
      }
    };
  }

  function firstSlides(section) {
    if (!section) { return []; }
    var block = section.querySelector('[id^="tab_block_"]');
    if (!block) { return []; }
    return block.querySelectorAll('.swiper-slide');
  }

  function load() {
    Promise.all([
      window.__ziglyFetchSection('/', 'everything@dog'),
      window.__ziglyFetchSection('/', 'everything@cat')
    ])
      .then(function (res) {
        var dogSec = res[0];
        var catSec = res[1];
        if (!dogSec) { warn('everything section unavailable'); return; }

        var imported = document.importNode(dogSec, true);

        var scripts = imported.querySelectorAll('script');
        for (var s = 0; s < scripts.length; s++) {
          scripts[s].parentNode.removeChild(scripts[s]);
        }
        var tracks = imported.querySelectorAll('.swiper-wrapper');
        for (var t = 0; t < tracks.length; t++) { tracks[t].removeAttribute('style'); }

        // Relabel the tabs to match the reference.
        var tabs = imported.querySelectorAll('.everything_product__header_switcher_tab');
        var labels = ['Dogs', 'Cats'];
        for (var i = 0; i < tabs.length && i < labels.length; i++) {
          var heading = tabs[i].querySelector('.switcher_heading') || tabs[i];
          heading.textContent = labels[i];
        }

        // Second tab shows the cat page's tiles.
        var blocks = imported.querySelectorAll('[id^="tab_block_"]');
        if (blocks.length > 1 && catSec) {
          var catSlides = firstSlides(catSec);
          var wrap = blocks[1].querySelector('.swiper-wrapper') || blocks[1];
          while (wrap.firstChild) { wrap.removeChild(wrap.firstChild); }
          for (var c = 0; c < catSlides.length; c++) {
            wrap.appendChild(document.importNode(catSlides[c], true));
          }
        } else if (!catSec) {
          warn('cat tiles unavailable; Cats tab will mirror Dogs');
        }

        for (var b = 0; b < blocks.length; b++) {
          blocks[b].setAttribute('data-zigly-active', b === 0 ? 'true' : 'false');
        }

        slot.appendChild(imported);
      })
      .catch(function (e) { warn('everything failed: ' + e); });
  }

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); load(); return; }
      }
    }, {rootMargin: '700px 0px'});
    io.observe(slot);
  } else {
    load();
  }
})();
true;
`;
