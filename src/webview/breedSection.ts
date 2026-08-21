/**
 * Bring the "Breed Ready Picks" rails onto the homepage.
 *
 * Zigly's homepage no longer carries them, but the pet landing pages still do,
 * and the reference app shows both under the banner. Rather than rebuild them --
 * which would mean hardcoding breed names, images and links -- we fetch Zigly's
 * own pages and move their own rendered sections across. Every card keeps its
 * real destination (/pages/golden-retriever, /pages/persian and so on).
 *
 * Notes on why this is written the way it is:
 *   - `fetch` is only CALLED here, never patched or wrapped. Same origin, plain
 *     GET, no interception of the site's own requests.
 *   - Each section is a Swiper carousel carrying an init script. Markup inserted
 *     via the DOM never executes its scripts, so those are recreated
 *     deliberately; Swiper itself is already loaded by the homepage.
 *   - Placeholders are created synchronously, in order, before any fetch
 *     resolves. Otherwise the rails would land in whichever order the network
 *     happened to return.
 *   - Nothing is cached or stored. Each load reads the live pages, so when Zigly
 *     changes the breeds the app follows.
 *
 * Both source pages title the section simply "Breed Ready Picks". Shown together
 * that is ambiguous, so each heading is suffixed the way the reference app does
 * it. Only the label is touched; the breeds, images and links are Zigly's.
 */
/**
 * Both rails are requested from '/' -- sections resolve by id against any page,
 * so unrelated sections can share one batched request. The @dog / @cat marker
 * selects which page template's copy of the section to ask for.
 */
const SOURCES = [
  {path: '/', fragment: 'home_shop_by_breed_section@dog', mark: 'zigly-breed-dogs', suffix: ' - Dogs'},
  {path: '/', fragment: 'home_shop_by_breed_section@cat', mark: 'zigly-breed-cats', suffix: ' - Cats'},
];

export const BREED_SECTION_SCRIPT = `
(function () {
  var SOURCES = ${JSON.stringify(SOURCES)};


  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  if (!isHome()) { return; }
  // Already done, or the site put the section back on the homepage itself.
  if (document.getElementById(SOURCES[0].mark)) { return; }
  if (document.querySelector('[id*="home_shop_by_breed_section"]')) { return; }

  var banner = document.querySelector('[id*="homepage_banner"]');
  var coupon = document.querySelector('[id*="coupon_slider"]');
  var anchor = coupon || banner;
  if (!anchor || !anchor.parentNode) { warn('no anchor for breed rails'); return; }

  // Reserve the slots up front, in order, so async fetches cannot reorder them.
  var slots = [];
  var prev = anchor;
  for (var i = 0; i < SOURCES.length; i++) {
    var ph = document.createElement('div');
    ph.id = SOURCES[i].mark;
    ph.setAttribute('data-state', 'loading');
    prev.parentNode.insertBefore(ph, prev.nextSibling);
    prev = ph;
    slots.push(ph);
  }

  /**
   * Trim without a regex. Escape sequences inside this template literal keep
   * being mangled by tooling -- /[\s]/ has compiled down to /[s]/ before,
   * which silently stripped the "s" from "Breed Ready Picks". Character codes
   * cannot be mangled.
   */
  function trimWs(str) {
    var a = 0;
    var b = str.length;
    function ws(c) { return c === 32 || c === 9 || c === 10 || c === 13; }
    while (a < b && ws(str.charCodeAt(a))) { a++; }
    while (b > a && ws(str.charCodeAt(b - 1))) { b--; }
    return str.slice(a, b);
  }

  /**
   * Show the tab that actually has breeds in it.
   *
   * These sections carry two .tab-content blocks and mark one 'active', which
   * is the only one the theme's CSS shows. On the cat section the active block
   * is empty and the breeds sit in the inactive one -- so transplanted as-is,
   * the Cats rail rendered permanently blank. The tab switcher that would
   * normally fix that is JavaScript we deliberately do not run, since it also
   * starts the looping carousel.
   *
   * So pick the first block containing a slide and activate that instead.
   */
  function activateFilledTab(root) {
    var tabs = root.querySelectorAll('.tab-content');
    if (tabs.length < 2) { return; }

    var filled = null;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].querySelector('.swiper-slide')) { filled = tabs[i]; break; }
    }
    if (!filled) { return; }

    for (var j = 0; j < tabs.length; j++) {
      // Rebuilt from tokens rather than a regex: escape sequences inside this
      // template literal have been mangled by tooling repeatedly.
      var parts = tabs[j].className.split(' ');
      var kept = [];
      for (var k = 0; k < parts.length; k++) {
        if (parts[k] && parts[k] !== 'active') { kept.push(parts[k]); }
      }
      if (tabs[j] === filled) { kept.push('active'); }
      tabs[j].className = kept.join(' ');
    }
  }

  function fill(src, slot) {
    window.__ziglyFetchSection(src.path, src.fragment)
      .then(function (sec) {
        if (!sec) { warn('breed section unavailable: ' + src.fragment); return; }

        var imported = document.importNode(sec, true);

        // Disambiguate the two identical headings.
        var head = imported.querySelector('h1, h2, h3, .top-head-wrapper');
        if (head && head.textContent && head.textContent.indexOf(src.suffix) === -1) {
          head.textContent = trimWs(head.textContent) + src.suffix;
        }

        // Drop the section's scripts rather than re-running them.
        //
        // They initialise Swiper in loop mode, which clones slides -- on the
        // homepage that showed as the breed rail scrolling forever and
        // repeating breeds, where the reference app simply stops at the last
        // one. The rail is laid out as a native horizontal scroller in CSS
        // instead: same gesture, finite list, no cloned slides.
        var scripts = imported.querySelectorAll('script');
        for (var j = 0; j < scripts.length; j++) {
          scripts[j].parentNode.removeChild(scripts[j]);
        }

        // Swiper leaves an inline transform on the track when it has run; clear
        // any that arrived with the markup so our scroller starts at zero.
        var tracks = imported.querySelectorAll('.swiper-wrapper');
        for (var t = 0; t < tracks.length; t++) {
          tracks[t].removeAttribute('style');
        }

        activateFilledTab(imported);

        slot.setAttribute('data-state', 'ready');
        slot.appendChild(imported);
      })
      .catch(function (e) { warn('breed rail failed for ' + src.path + ': ' + e); });
  }

  for (var n = 0; n < SOURCES.length; n++) {
    fill(SOURCES[n], slots[n]);
  }
})();
true;
`;
