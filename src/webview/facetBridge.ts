/**
 * Read the site's sort and filter state, and drive it, from inside the page.
 *
 * WHY THIS EXISTS. The app draws its own Sort / Filter bar and its own two
 * sheets (see ../components/SortFilterBar, SortSheet, FilterSheet), because the
 * site's controls are a pair of blue pills, a drawer that slides in from the
 * left and a two-column accordion -- none of which is what this app looks like.
 * What the app must NOT do is re-implement what those controls *do*: the
 * results, the facet values and every count on this screen are SearchTap's
 * answers, and a second engine guessing at them would drift from the website
 * within a week.
 *
 * So this is a bridge and nothing else. It reads what SearchTap has rendered
 * and posts it out; when the customer taps a chip, it clicks SearchTap's own
 * checkbox. A click, not a store write: the checkbox carries Vue's v-model and
 * SearchTap's own `onChange`, so clicking it is exactly the path a tap on the
 * website takes -- the same state update, the same request, the same analytics
 * event -- and it keeps working when they rebuild the components, which reading
 * their Pinia store by hand would not.
 *
 * WHAT WAS READ, AND WHEN. Every selector below was read out of
 * `assets/searchtap.js` (v=178799483826802917671787218131) and the served
 * collection HTML on 2026-08-23:
 *
 *   .st-widget / .st-widget-title   one facet and its heading, in the
 *                                   `search-filters` component. Present in the
 *                                   DOM on mobile -- its wrapper `.st-sidebar`
 *                                   is display:none, which hides it without
 *                                   removing it, so it can be read and clicked.
 *   input[type="checkbox"][value]   one facet value; `value` is the label
 *                                   SearchTap filters on.
 *   .st-product-number              its count, as "(63)".
 *   button[value]                   one sort option, in
 *                                   `MobileSortingDropdown`. `.active-sort`
 *                                   marks the applied one.
 *   .filter_h                       the site's own Filter pill, in
 *                                   `initial-toolbox-bar`. Clicked once, out of
 *                                   sight, to make SearchTap fetch its facets.
 *   .mobilesearch .apply-btn        that drawer's own close.
 *
 * A selector that disappears costs the sheet its content and nothing else:
 * every read is guarded, every write is a no-op when its target is missing, and
 * the whole thing never runs outside a listing page.
 */

import {LISTING_TEST_JS} from './listingPage';

/** How long between polls while waiting for SearchTap's first render. */
const TICK_MS = 400;
/**
 * How long to keep polling. ~24s.
 *
 * The MutationObserver is what actually keeps up with SearchTap after that;
 * this only exists because an observer reports *changes*, and on a fast load
 * the facets can be in place before it is attached.
 */
const TRIES = 60;
/**
 * How long the warm-up waits between attempts.
 *
 * Long enough that SearchTap has a chance to answer one before the next is
 * spent: without a gap every poll tick would fire an attempt and the whole
 * budget would be gone within a couple of seconds, before the deferred bundle
 * had hydrated at all.
 */
const WARM_GAP_MS = 1200;

export const FACET_BRIDGE_SCRIPT = `
(function () {
  if (window.__ziglyFacets) { return; }

${LISTING_TEST_JS}
  if (!ziglyIsListing()) { return; }

  function send(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  /**
   * Collapse whitespace, without a regular expression.
   *
   * Deliberate: this file reaches the page through a JavaScript template
   * literal, which eats a lone backslash -- so a pattern written here as
   * whitespace-plus would arrive as the letter "s" and match nothing. Character
   * codes cannot be mangled that way.
   */
  function squash(value) {
    var s = value == null ? '' : String(value);
    var out = '';
    var space = false;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code === 32 || code === 9 || code === 10 || code === 13 || code === 160) {
        if (out) { space = true; }
      } else {
        if (space) { out += ' '; space = false; }
        out += s.charAt(i);
      }
    }
    return out;
  }

  /**
   * "(63)" -> 63, or null when there is no count to read.
   *
   * Null is meaningful: it is how a value that is not a counted facet --
   * SearchTap's lone out-of-stock toggle -- is left out of a screen the app
   * draws as counted chips, without a list of names to keep in step with.
   */
  function countIn(node) {
    if (!node) { return null; }
    var text = squash(node.textContent);
    var open = text.indexOf('(');
    var close = text.lastIndexOf(')');
    if (open === -1 || close < open) { return null; }
    var digits = text.slice(open + 1, close);
    if (!digits.length) { return null; }
    for (var i = 0; i < digits.length; i++) {
      var code = digits.charCodeAt(i);
      if (code < 48 || code > 57) {
        // Thousands separators are the only other thing seen here.
        if (digits.charAt(i) === ',') { continue; }
        return null;
      }
    }
    var n = parseInt(digits.split(',').join(''), 10);
    return isNaN(n) ? null : n;
  }

  /**
   * The count that belongs to ONE checkbox, or null when it carries none.
   *
   * Three levels, which is the label, its wrapper and its row -- and not one
   * more. A row is one value; the list above it is shared, so climbing into it
   * would hand a value with no count of its own the count of whichever value
   * happens to be first. That is how an uncounted toggle would sneak in wearing
   * somebody else's number.
   */
  function countFor(box) {
    var node = box;
    for (var up = 0; up < 3; up++) {
      node = node ? node.parentNode : null;
      if (!node || !node.querySelector) { continue; }
      var found = node.querySelector('.st-product-number');
      if (found) { return countIn(found); }
    }
    return null;
  }

  /**
   * Every facet SearchTap has rendered, in the order it rendered them.
   *
   * ONE function, used by the read and by the write, and that is the point of
   * it: the app addresses a chip by the position of its facet in this list, so
   * a facet the reader skipped and the writer counted would apply the wrong
   * filter. There is one definition of "a facet", and it is here.
   *
   * A widget with no heading is skipped, and that is not tidiness: the mobile
   * drawer renders each facet's values inside a bare .st-widget of its own, so
   * without the heading test every facet would be read twice -- once from the
   * sidebar and once from the drawer.
   *
   * A widget with no counted value is skipped too, which is what keeps
   * SearchTap's price slider and its lone out-of-stock toggle out of a screen
   * the app draws as chips -- by what they are, rather than by their names.
   */
  function facets() {
    var out = [];
    var widgets = document.querySelectorAll('.st-widget');
    for (var w = 0; w < widgets.length; w++) {
      var widget = widgets[w];
      var titleNode = widget.querySelector('.st-widget-title');
      if (!titleNode) { continue; }
      var title = squash(titleNode.textContent);
      if (!title) { continue; }

      var boxes = widget.querySelectorAll('input[type="checkbox"]');
      var options = [];
      for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        var label = squash(box.getAttribute('value'));
        if (!label) { continue; }
        var count = countFor(box);
        if (count === null) { continue; }
        options.push({label: label, count: count, box: box});
      }
      if (!options.length) { continue; }
      out.push({title: title, options: options});
    }
    return out;
  }

  /** The same list, as the app is given it: labels and counts, no nodes. */
  function groups() {
    var found = facets();
    var out = [];
    for (var g = 0; g < found.length; g++) {
      var options = [];
      for (var i = 0; i < found[g].options.length; i++) {
        var option = found[g].options[i];
        options.push({
          label: option.label,
          count: option.count,
          on: !!option.box.checked
        });
      }
      out.push({title: found[g].title, options: options});
    }
    return out;
  }

  /**
   * Every sort button SearchTap has rendered.
   *
   * Scoped to its own sorting panel, so nothing else on a listing page that
   * happens to carry a value attribute -- a quantity stepper, an add-to-bag --
   * can be mistaken for a sort. Widened to any button whose visible text is its
   * own value only if that panel is not found, which is the shape a rename of
   * the wrapper would leave.
   */
  function sortButtons() {
    var found = document.querySelectorAll('.st-sorting-wrapper button[value]');
    if (found.length) { return found; }
    var out = [];
    var all = document.querySelectorAll('button[value]');
    for (var i = 0; i < all.length; i++) {
      var label = squash(all[i].getAttribute('value'));
      if (!label) { continue; }
      if (squash(all[i].textContent).indexOf(label) === -1) { continue; }
      out.push(all[i]);
    }
    return out;
  }

  /** The sort options, in the site's order, and which one is applied. */
  function sorts() {
    var labels = [];
    var active = '';
    var buttons = sortButtons();
    for (var i = 0; i < buttons.length; i++) {
      var label = squash(buttons[i].getAttribute('value'));
      if (!label) { continue; }
      if (labels.indexOf(label) === -1) { labels.push(label); }
      // SearchTap puts 'active-sort' on the applied button. NOT the
      // '.st-active-sort' span inside it: that one is a hoisted static node
      // rendered in every button and revealed by CSS, so reading it would
      // report the first option as applied whatever is applied.
      var cls = ' ' + (buttons[i].className || '') + ' ';
      if (cls.indexOf('active-sort') !== -1) { active = label; }
    }

    /*
     * Failing that, the pill: it draws the applied label, out of the same state
     * the buttons are marked from. Taken only when it names a sort we already
     * know, so a pill that draws something else cannot invent an option.
     */
    if (!active) {
      var pill = document.querySelector('.sort_h');
      var shown = pill ? squash(pill.textContent) : '';
      if (shown && labels.indexOf(shown) !== -1) { active = shown; }
    }

    /*
     * And failing that, the store the buttons and the pill are both drawn
     * from. This is the only source that exists before SearchTap has rendered
     * either of them, which is exactly when the sheet is first drawn -- without
     * it the sheet shows "Best selling" ticked on a collection the customer
     * has already sorted. Read only, and still filtered against the labels we
     * know, so a value we cannot offer cannot become a tick on nothing.
     *
     * piniaStores() is declared further down; function declarations hoist, so
     * this call is safe wherever the two sit relative to each other.
     */
    if (!active) {
      var stores = piniaStores();
      for (var s = 0; s < stores.length; s++) {
        var held = stores[s].sortingValue;
        if (typeof held !== 'string') { continue; }
        var value = squash(held);
        if (value && labels.indexOf(value) !== -1) { active = value; break; }
      }
    }
    return {options: labels, label: active};
  }

  /**
   * SearchTap has drawn its filter UI, whether or not there is anything in it.
   *
   * NOT "there is at least one facet", which is what this used to mean and was
   * wrong in the one case it matters: a small collection can publish no facets
   * at all, and a sheet told "not ready yet" about that spins for ever. This
   * says only that the answer has arrived; how many facets it contained is the
   * groups list's business.
   */
  function answered() {
    return !!document.querySelector('.st-sidebar, .st-widget');
  }

  /** The poll has stopped waiting. Nothing is coming; say so rather than spin. */
  var settled = false;

  function state() {
    var sort = sorts();
    return {
      tag: 'facets',
      ready: answered() || settled,
      groups: groups(),
      sortOptions: sort.options,
      sortLabel: sort.label
    };
  }

  /** Only when something actually changed; this runs off a MutationObserver. */
  var last = '';
  function report() {
    var payload;
    try { payload = state(); } catch (e) { return; }
    var serialised = JSON.stringify(payload);
    if (serialised === last) { return; }
    last = serialised;
    send(payload);
  }

  /**
   * Make SearchTap fetch its facets, without its drawer appearing.
   *
   * On a collection page the grid is the theme's own, server-rendered, and
   * SearchTap asks for nothing until the customer opens Filter -- so a sheet
   * opened before that would have nothing in it. Its own Filter pill is
   * clicked once instead: that is the request the site itself makes, so the
   * facets that come back are the ones the website would show. The pill and
   * the drawer it opens are both display:none (see injectedStyles), which is
   * why none of this is visible, and the drawer is closed again through its
   * own Apply so the site is not left holding a state nobody opened.
   *
   * Runs while the app's cover is still over the page, so even the request is
   * spent before the customer sees the screen.
   */
  /*
   * How many times the warm-up may be spent before giving up.
   *
   * More than once, deliberately. This used to latch after a single click, and
   * that assumed the click landed on a mounted Vue component -- but SearchTap
   * is a deferred script that hydrates <initial-toolbox-bar> some time after
   * the poll below starts, and a click dispatched at a pill whose component is
   * not listening yet is simply lost. There was then no second attempt: one
   * lost click meant no fetch, no facets, and a filter sheet that opened empty
   * for the life of the page.
   *
   * So the warm-up now retries until the facets actually arrive, which is the
   * only evidence that the click did anything. Bounded, so a page that will
   * never produce facets is not clicked at for ever.
   */
  var WARM_TRIES = 10;
  var warmClicks = 0;
  var warmedAt = 0;

  /** The facets are here. Nothing left to ask for. */
  function warmDone() {
    return !!document.querySelector('.st-widget .st-widget-title');
  }

  /**
   * SearchTap's own Pinia store, reached through the Vue app it is provided to.
   *
   * WHY THE STORE AND NOT A PILL. There are TWO .filter_h pills in this bundle
   * and they do different things. One is onClick: isFilterOpen = true, which
   * only opens the drawer -- it never fetches. The other is
   * onClick: openFilter(), and openFilter is the one that matters:
   *
   *     openFilter() {
   *       this.filterArray.length > 0 ? (open the drawer)
   *                                   : (setMobileFilter(true),
   *                                      checkFilterArrayLength(5000))
   *     }
   *
   * setMobileFilter(true) flips the store's showMobileFilter, and the watcher
   * on it is what calls init() -- the fetch. Clicking blind takes whichever
   * pill querySelector finds first, which on a collection page is the one that
   * only opens a drawer. That is why the filter sheet said "No filters for
   * this listing" on every listing page.
   *
   * HOW IT IS REACHED. Vue 3 leaves the app on its mount element as
   * '__vue_app__', and Pinia is handed to it by 'app.provide(key, pinia)' --
   * so it lives in 'app._context.provides'. The catch, read out of the bundle
   * on 2026-09-06, is the key:
   *
   *     let Ol; const jl = t => Ol = t, Rl = Symbol();
   *     install(t) { jl(r), r._a = t, t.provide(Rl, r), ... }
   *
   * 'Rl = Symbol()'. Pinia is provided under a SYMBOL, and 'provides' is an
   * 'Object.create(null)' carrying nothing else -- so a 'for (var key in ...)'
   * walk, like Object.keys, does not enumerate it at all and would run zero
   * times on every real page. Reflect.ownKeys is the one enumeration that
   * returns string AND symbol keys, which is why it is used here. Guarded, and
   * the click path below still backs this up, because reaching into a
   * framework's internals is exactly the thing that stops working when they
   * upgrade Vue.
   */
  function piniaStores() {
    var out = [];
    var seen = false;

    function collect(pinia) {
      if (!pinia || !pinia._s || typeof pinia._s.forEach !== 'function') {
        return;
      }
      seen = true;
      pinia._s.forEach(function (store) {
        if (store) { out.push(store); }
      });
    }

    function fromApp(app) {
      if (!app || !app._context) { return; }
      /*
       * The globalProperties route first: Pinia's install also does
       * 'config.globalProperties.$pinia = pinia', and that is a plain STRING
       * key -- immune to the whole symbol problem above.
       */
      var config = app._context.config;
      if (config && config.globalProperties) {
        collect(config.globalProperties.$pinia);
        if (seen) { return; }
      }
      var provides = app._context.provides;
      if (!provides) { return; }
      var keys = typeof Reflect !== 'undefined' && Reflect.ownKeys
        ? Reflect.ownKeys(provides)
        : Object.keys(provides);
      for (var k = 0; k < keys.length; k++) {
        collect(provides[keys[k]]);
      }
    }

    try {
      /*
       * The mount element, which is where Vue 3 leaves __vue_app__ -- and only
       * there, on the exact element handed to app.mount(). The bundle ends in
       * .mount('#collectionmodalcontainer'), which is NOT a child of <body>:
       * the served HTML nests it inside the theme's section wrapper. So the id
       * is named rather than swept for.
       */
      var hosts = document.querySelectorAll(
        '#collectionmodalcontainer, #searchModalContainer, searchtap'
      );
      for (var h = 0; h < hosts.length; h++) {
        fromApp(hosts[h].__vue_app__);
        if (seen) { return out; }
      }

      /*
       * Failing that, the app is found rather than guessed at: climb from
       * something SearchTap definitely rendered. This is what survives them
       * renaming the container, which a fixed list of ids would not.
       */
      var anchor = document.querySelector(
        'initial-search-filters, initial-toolbox-bar, .st-widget, .st-collection-content'
      );
      for (var up = 0; anchor && up < 12; up++) {
        if (anchor.__vue_app__) {
          fromApp(anchor.__vue_app__);
          if (seen) { return out; }
        }
        anchor = anchor.parentNode;
      }

      /*
       * And last, a sweep for whatever is carrying the app. Only reached when
       * both of the cheap routes missed, so the cost lands on a page that has
       * already failed twice rather than on every poll of a healthy one.
       */
      var all = document.querySelectorAll('div, searchtap, section, main');
      for (var a = 0; a < all.length; a++) {
        if (!all[a].__vue_app__) { continue; }
        fromApp(all[a].__vue_app__);
        if (seen) { return out; }
      }
    } catch (e) {}
    return out;
  }

  /**
   * Run 'fn' against the first store that carries 'name' as a function.
   *
   * By name rather than by store id: 'sidebarContent' is what the bundle calls
   * it today, and an action that exists is better evidence than a label.
   */
  function withStore(name, fn) {
    var stores = piniaStores();
    for (var i = 0; i < stores.length; i++) {
      if (typeof stores[i][name] !== 'function') { continue; }
      try { fn(stores[i]); return true; } catch (e) {}
    }
    return false;
  }

  /** Ask SearchTap for its facets: the state change its own pill makes. */
  function storeWarm() {
    if (withStore('setMobileFilter', function (store) {
      store.setMobileFilter(true);
    })) {
      return true;
    }
    // No action of that name; the raw flag is the same watcher's input.
    var stores = piniaStores();
    for (var i = 0; i < stores.length; i++) {
      if (!('showMobileFilter' in stores[i])) { continue; }
      try { stores[i].showMobileFilter = true; return true; } catch (e) {}
    }
    return false;
  }

  /**
   * Every pill that might be the one that fetches, clicked.
   *
   * All of them rather than the first: they are told apart only by a handler
   * that cannot be read from the DOM, and clicking the drawer-opening one is
   * harmless -- the drawer is put straight back down by closeSite().
   */
  function clickWarm() {
    var pills = document.querySelectorAll(
      '.filter_h, .mobile-toggle-filter, .st-filter-btn'
    );
    var clicked = false;
    for (var i = 0; i < pills.length; i++) {
      try { pills[i].click(); clicked = true; } catch (e) {}
    }
    return clicked;
  }

  function warm() {
    // Already rendered -- a search page fetches its own facets with its
    // results, so there is nothing to ask for.
    if (warmDone()) { return; }
    if (warmClicks >= WARM_TRIES) { return; }
    /*
     * Give the last attempt time to land before spending another. Without this
     * every poll tick would fire one and the budget would be gone in seconds --
     * before SearchTap had a chance to answer any of them.
     */
    var now = Date.now();
    if (warmClicks > 0 && now - warmedAt < ${WARM_GAP_MS}) { return; }
    warmedAt = now;

    // The store first: it is the state change the real pill makes.
    var asked = storeWarm();
    // And the pills, which is the path that survives a Vue upgrade.
    if (clickWarm()) { asked = true; }
    if (!asked) { return; }

    warmClicks++;
    closeSite();
    setTimeout(closeSite, 700);
    setTimeout(closeSite, 2500);
  }

  /** Put the site's own drawer back down, whenever it manages to open. */
  function closeSite() {
    try {
      var apply = document.querySelector('.mobilesearch .apply-btn');
      if (apply) { apply.click(); }
      var body = document.body;
      if (body && body.className.indexOf('st-open-filter-section') !== -1) {
        body.className = body.className
          .split('st-open-filter-section').join(' ');
      }
    } catch (e) {}
  }

  /**
   * Apply one facet value: SearchTap's own checkbox, clicked.
   *
   * Addressed by the facet's position in the list the app was given, checked
   * against the heading it was drawn under. Position alone would be fragile --
   * SearchTap re-renders these on every change -- and the heading alone is not
   * enough either: two facets on this store are both called "Flavor" and both
   * offer "chicken", so a tap on one of them would be ambiguous. Position with
   * the heading as a guard is exact in the normal case, and degrades to a
   * search by heading, then by label, when the page has moved underneath.
   */
  function toggle(index, title, label) {
    var box = find(index, title, label);
    if (!box) { return refuse(); }
    /*
     * Force the next report through even if nothing about the page changes.
     * The app shows a spinner until it hears back, and "nothing changed" is
     * exactly the case where the de-duplication in report() would otherwise
     * leave it spinning for ever.
     */
    last = '';
    try { box.click(); } catch (e) { return refuse(); }
    // The results and the counts are about to change; ask again shortly.
    setTimeout(report, 300);
    setTimeout(report, 1200);
    return true;
  }

  /**
   * A tap this bridge could not deliver, reported rather than dropped.
   *
   * The app sets its spinner the moment a chip is tapped and clears it only on
   * a facets message it accepts (see setFacetBusy in
   * ../screens/ZiglyWebViewScreen.tsx). Every 'return false' below used to
   * return before the forced report, so a tap that found no checkbox posted
   * nothing at all and the Filters screen span for as long as the customer
   * left it open -- with the chip drawn as applied for a filter that never was.
   *
   * So a refusal sends the page's CURRENT state: it clears the spinner and, in
   * the same message, corrects the optimistic chip back to what SearchTap
   * actually holds. 'last' is cleared first so report() cannot de-duplicate
   * this against the state it last sent.
   */
  function refuse() {
    last = '';
    try { report(); } catch (e) {}
    return false;
  }

  function find(index, title, label) {
    var found = facets();

    // The facet the app drew, still where the app drew it.
    if (index >= 0 && index < found.length && found[index].title === title) {
      var exact = boxIn(found[index], label);
      if (exact) { return exact; }
    }
    // It has moved: the same heading, wherever it is now.
    var loose = null;
    for (var g = 0; g < found.length; g++) {
      var match = boxIn(found[g], label);
      if (!match) { continue; }
      if (found[g].title === title) { return match; }
      if (!loose) { loose = match; }
    }
    // Only the label is left. Right when a heading has been reworded, and the
    // page's own answer corrects it when it is wrong.
    return loose;
  }

  function boxIn(facet, label) {
    for (var i = 0; i < facet.options.length; i++) {
      if (facet.options[i].label === label) { return facet.options[i].box; }
    }
    return null;
  }

  /**
   * Apply a sort, through the same state change the site's own button makes.
   *
   * THE STORE FIRST, AND WHY. SearchTap's mobile sort button does not sort
   * anything itself -- it emits, and the toolbar it sits in handles that emit
   * with one line, read out of the bundle on 2026-09-06:
   *
   *     sortList(t) { kf().setSortingValue(t); setTimeout(...) }
   *
   * 'kf()' is the 'sidebarContent' store, and writing 'sortingValue' is what
   * trips the watcher that does the work:
   *
   *     collectionSortingValue(t) {
   *       t && "Best selling" !== t && (this.isSearchOpen ||
   *         (this.checkAndOpenCollectionsPage(), ...), this.sortList(t))
   *     }
   *
   * So the store write is not a shortcut past the button -- it IS what the
   * button does, minus the button having to exist yet. The sort sheet is drawn
   * from SEED_SORT_OPTIONS (see ../listing/facets) whenever the page reports
   * none, so the customer can tap a sort before SearchTap has rendered a
   * single button, and clicking alone would silently do nothing on exactly
   * that tap -- which is the normal first tap on a collection page, because
   * <initial-toolbox-bar> ships empty and its buttons are client-rendered.
   *
   * The button is still clicked when the store cannot be reached, which is the
   * path that survives a Vue upgrade -- the same two-path shape as the warm-up.
   */
  function sort(label) {
    /*
     * Only a sort the site actually offers, and the seeded five count as
     * offered until it has said otherwise -- see SEED_SORT_OPTIONS in
     * ../listing/facets, which is what the sheet draws before SearchTap has
     * rendered its buttons.
     *
     * The guard matters because SearchTap's own sortList does
     * 'this.sort.find(s => s.label === this.sortLabel).field' with no fallback:
     * a label it does not know is a TypeError inside its watcher, which would
     * leave the store holding a sort the page can never act on -- and once it
     * has thrown, later sorts and filters on that page stop working too.
     */
    var known = sorts().options;
    if (known.length && known.indexOf(label) === -1) { return refuse(); }

    // As in toggle(): the app is waiting to hear back, so the next report must
    // go out whether or not the page ends up looking different.
    last = '';

    var asked = withStore('setSortingValue', function (store) {
      store.setSortingValue(label);
    });

    /*
     * "Best selling" is the site's default, and its watcher deliberately
     * ignores it -- 't && "Best selling" !== t'. So restoring the default
     * cannot go through the store, and the button is the only way back.
     */
    if (!asked || label === 'Best selling') {
      var buttons = sortButtons();
      for (var i = 0; i < buttons.length; i++) {
        if (squash(buttons[i].getAttribute('value')) !== label) { continue; }
        try { buttons[i].click(); asked = true; } catch (e) {}
        break;
      }
    }

    if (!asked) { return refuse(); }
    /*
     * The results are about to change; ask again once they have. Three, not
     * two: a store write trips a watcher that on a collection page hands the
     * theme's server-rendered grid over to SearchTap before sorting it, which
     * is a longer round trip than clicking a button on a grid SearchTap
     * already owns.
     */
    setTimeout(report, 300);
    setTimeout(report, 1200);
    setTimeout(report, 2500);
    return true;
  }

  window.__ziglyFacets = {
    read: report,
    toggle: toggle,
    sort: sort,
    warm: warm
  };

  /**
   * Keep up with SearchTap, which replaces these components outright on every
   * filter change and every page of results. Coalesced: one re-render is many
   * mutation records and each would otherwise cost a full sweep.
   */
  if (window.MutationObserver && document.body) {
    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        report();
      }, 120);
    });
    try {
      observer.observe(document.body, {childList: true, subtree: true});
    } catch (e) {}
  }

  /*
   * And a bounded poll for the first render, which the observer cannot see if
   * it happened before the observer was attached. It also carries the warm:
   * SearchTap is a deferred script, so its Filter pill does not exist yet on
   * the pass that installs this.
   */
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try {
      warm();
      report();
    } catch (e) {}
    if (tries > ${TRIES}) {
      clearInterval(timer);
      /*
       * Nothing more is coming. Report it, so a sheet that is waiting stops
       * waiting -- an honest "no filters here" beats a spinner that never ends.
       */
      settled = true;
      try { report(); } catch (e) {}
    }
  }, ${TICK_MS});

  try {
    warm();
    report();
  } catch (e) {}
})();
true;
`;

/** Ask the page for its current sort and filter state. */
export const READ_FACETS_SCRIPT = `
(function () {
  try { if (window.__ziglyFacets) { window.__ziglyFacets.read(); } } catch (e) {}
})();
true;
`;

/**
 * Quote a label for the page.
 *
 * JSON.stringify, not hand-written quotes: these are Zigly's own strings, and
 * one of them containing an apostrophe -- "Cat's Food" is a facet value away --
 * would otherwise be a syntax error in the injected script rather than a
 * filter that does not apply.
 */
const quote = (value: string): string => JSON.stringify(String(value));

/**
 * Turn one facet value on or off, through the site's own control.
 *
 * `index` is the facet's position in the list the page last reported, which is
 * the list the sheet is drawing -- see `find` above for why it is sent as well
 * as the heading.
 */
export const toggleFacetScript = (
  index: number,
  title: string,
  label: string,
): string => `
(function () {
  try {
    if (window.__ziglyFacets) {
      window.__ziglyFacets.toggle(
        ${Math.max(0, Math.floor(index))},
        ${quote(title)},
        ${quote(label)}
      );
    }
  } catch (e) {}
})();
true;
`;

/** Apply one sort, through the site's own control. */
export const applySortScript = (label: string): string => `
(function () {
  try {
    if (window.__ziglyFacets) { window.__ziglyFacets.sort(${quote(label)}); }
  } catch (e) {}
})();
true;
`;
