/**
 * "Hot Picks of The Week" section with a New Arrivals tab.
 *
 * Zigly's homepage no longer carries this, but every part of it exists on the
 * live site, so nothing is invented:
 *   Hot Picks   -> the arrival sections on /pages/dog and /pages/zigly-cat,
 *                  giving picks for both pets as the reference app shows
 *   New Arrivals-> /collections/new-arrivals
 *
 * Real product cards are moved across, not rebuilt. Each keeps its own
 * <product-form>, so Add to Bag still posts to Shopify, and each card keeps its
 * real product link. The custom element upgrades itself on insertion, which is
 * why the buttons stay live.
 *
 * The New Arrivals tab is fetched on first tap rather than up front, so the
 * homepage does not pull two extra pages nobody may look at.
 */
const HOT_SOURCES = ['home_arrival_section@dog', 'home_arrival_section@cat'];
const NEW_SOURCE = '/collections/new-arrivals';
const CARDS_PER_TAB = 12;

export const HOT_PICKS_SCRIPT = `
(function () {
  var ID = 'zigly-hot-picks';
  var HOT_SOURCES = ${JSON.stringify(HOT_SOURCES)};
  var NEW_SOURCE = ${JSON.stringify(NEW_SOURCE)};
  var LIMIT = ${CARDS_PER_TAB};
  var CARD_SEL = '.card-wrapper.product-card-wrapper';

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

  // Sit below the breed rails when they exist, else below the banner.
  var anchor = document.getElementById('zigly-breed-cats')
            || document.getElementById('zigly-breed-dogs')
            || document.querySelector('[id*="coupon_slider"]')
            || document.querySelector('[id*="homepage_banner"]');
  if (!anchor || !anchor.parentNode) { warn('no anchor for hot picks'); return; }

  var section = document.createElement('section');
  section.id = ID;

  var title = document.createElement('h2');
  title.className = 'zigly-hp__title';
  title.textContent = 'Hot Picks of The Week';
  section.appendChild(title);

  var tabs = document.createElement('div');
  tabs.className = 'zigly-hp__tabs';
  var tabHot = document.createElement('button');
  tabHot.type = 'button';
  tabHot.className = 'zigly-hp__tab is-active';
  tabHot.textContent = 'Hot Picks of The Week';
  var tabNew = document.createElement('button');
  tabNew.type = 'button';
  tabNew.className = 'zigly-hp__tab';
  tabNew.textContent = 'New Arrivals';
  tabs.appendChild(tabHot);
  tabs.appendChild(tabNew);
  section.appendChild(tabs);

  var paneHot = document.createElement('div');
  paneHot.className = 'zigly-hp__grid';
  var paneNew = document.createElement('div');
  paneNew.className = 'zigly-hp__grid';
  paneNew.style.display = 'none';
  section.appendChild(paneHot);
  section.appendChild(paneNew);

  anchor.parentNode.insertBefore(section, anchor.nextSibling);

  function setActive(which) {
    var hot = which === 'hot';
    tabHot.className = 'zigly-hp__tab' + (hot ? ' is-active' : '');
    tabNew.className = 'zigly-hp__tab' + (hot ? '' : ' is-active');
    paneHot.style.display = hot ? '' : 'none';
    paneNew.style.display = hot ? 'none' : '';
  }

  function note(pane, text) {
    var p = document.createElement('p');
    p.className = 'zigly-hp__note';
    p.textContent = text;
    pane.appendChild(p);
  }

  /** Pull real product cards out of a fetched Zigly page. */
  function loadCards(path, pane, fragment, limit) {
    // A named section comes back via the Section Rendering API (~32 KB);
    // the collection page has no single section, so it is fetched whole.
    var source = fragment
      ? window.__ziglyFetchSection(path, fragment)
      : window.__ziglyFetchDoc(path);

    return source
      .then(function (scope) {
        if (!scope) { warn('could not load ' + path); return 0; }

        var cards = scope.querySelectorAll(CARD_SEL);
        var added = 0;
        for (var i = 0; i < cards.length && added < limit; i++) {
          pane.appendChild(document.importNode(cards[i], true));
          added++;
        }
        return added;
      })
      .catch(function (e) { warn('load failed ' + path + ': ' + e); return 0; });
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

  // Hot Picks: half from dogs, half from cats, so both pets are represented.
  var perSource = Math.max(1, Math.floor(LIMIT / HOT_SOURCES.length));

  whenNear(section, function () {
  var hotLoads = [];
  for (var i = 0; i < HOT_SOURCES.length; i++) {
    hotLoads.push(
      loadCards('/', paneHot, HOT_SOURCES[i], perSource)
    );
  }
  Promise.all(hotLoads).then(function (counts) {
    var total = 0;
    for (var j = 0; j < counts.length; j++) { total += counts[j] || 0; }
    if (total === 0) {
      // Nothing to show is not an error worth shouting about, but an empty
      // section would look broken -- remove it instead.
      if (section.parentNode) { section.parentNode.removeChild(section); }
    }
  });
  });

  var newLoaded = false;
  tabNew.addEventListener('click', function () {
    setActive('new');
    if (newLoaded) { return; }
    newLoaded = true;
    loadCards(NEW_SOURCE, paneNew, null, LIMIT).then(function (n) {
      if (!n) { note(paneNew, 'New arrivals are not available right now.'); }
    });
  });

  tabHot.addEventListener('click', function () { setActive('hot'); });
})();
true;
`;
