/**
 * "Hot Picks of The Week" section with a New Arrivals tab.
 *
 * Both tabs are Zigly's own curated collections, so the products are the ones
 * Zigly themselves put under these names -- nothing is assembled here:
 *   Hot Picks    -> /collections/hot-picks-squeaker-toys
 *   New Arrivals -> /collections/hot-deals, the newest of those hot picks
 *
 * These replaced an earlier guess. The section used to be filled from the
 * arrival rails on /pages/dog and /pages/zigly-cat, on the reasoning that the
 * homepage carries no "hot picks" section of its own -- but Zigly do publish
 * exactly these two collections, so the pet-page arrivals were the wrong
 * products under the right heading. Reading the real collections also drops the
 * payload sharply: those two arrival sections are 534 KB and 360 KB, against
 * one collection page here.
 *
 * Real product cards are moved across, not rebuilt. Each keeps its own
 * <product-form>, so Add to Bag still posts to Shopify, and each card keeps its
 * real product link. The custom element upgrades itself on insertion, which is
 * why the buttons stay live.
 *
 * The New Arrivals tab is fetched on first tap rather than up front, so the
 * homepage does not pull a second collection nobody may look at.
 */
const HOT_SOURCE = '/collections/hot-picks-squeaker-toys';
const NEW_SOURCE = '/collections/hot-deals';
const CARDS_PER_TAB = 15;

export const HOT_PICKS_SCRIPT = `
(function () {
  var ID = 'zigly-hot-picks';
  var HOT_SOURCE = ${JSON.stringify(HOT_SOURCE)};
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

  /** Pull real product cards out of a fetched Zigly collection page. */
  function loadCards(path, pane, limit) {
    // Fetched whole: a collection page has no single named section to ask the
    // Section Rendering API for, and both of these collections are small.
    return window.__ziglyFetchDoc(path)
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
   * This pulls a whole collection page of real product markup and sits well
   * below the fold. Loading it on sight keeps the homepage's first paint cheap;
   * without IntersectionObserver we simply load immediately, which is the old
   * behaviour.
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

  // Hot Picks: whatever Zigly currently has in the collection, in their order.
  whenNear(section, function () {
    loadCards(HOT_SOURCE, paneHot, LIMIT).then(function (added) {
      if (!added) {
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
    loadCards(NEW_SOURCE, paneNew, LIMIT).then(function (n) {
      if (!n) { note(paneNew, 'New arrivals are not available right now.'); }
    });
  });

  tabHot.addEventListener('click', function () { setActive('hot'); });
})();
true;
`;
