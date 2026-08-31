/**
 * The product page, as the reference app draws it.
 *
 * Zigly's served PDP was read whole on 2026-08-31 (a live fetch of
 * /products/zl-bobo-bear-squeaker-dog-toy) and every selector below is from
 * that read, not guessed. What the theme gives, top to bottom:
 *
 *   .product-slider                  a Swiper of the media, plus a column of
 *                                    .product-media-thumbnails the theme
 *                                    already hides under 750px, and a
 *                                    .product-media-pagination strip of dots.
 *   .product__info-container         title, #text-container (the one-line
 *                                    sub-description), .price-main-container,
 *                                    then a long tail the reference does not
 *                                    draw: a variant slider, an extra-offer
 *                                    pill, a pincode checker.
 *   .product__buy-buttons-container  the quantity stepper and the real
 *                                    <product-form>. The buttons in it are
 *                                    already hidden by ./injectedStyles --
 *                                    ../components/ProductActionBar presses
 *                                    them from outside the page.
 *   ...then, in DOM order: a video banner, small images, a banner image,
 *   related products, the Judge.me widget (#judgeme_product_reviews), and only
 *   THEN .product-overview-accordion-section -- which is where the real
 *   Description and the "Sub Category Description" live, in accordions the
 *   theme ships collapsed.
 *
 * The reference wants that last section directly under the buy box, and open.
 * That is the one thing here CSS cannot do -- `order` only sorts siblings
 * inside one flex container, and each of these is its own top-level
 * <section id="shopify-section-..."> -- so the section is MOVED, once, and its
 * Product Details accordion is opened by pressing the theme's own trigger.
 *
 * THREE JOBS, and each is here rather than in ./injectedStyles because a
 * stylesheet cannot do it:
 *
 *   moveDescription()    a node cannot be moved between two containers by CSS.
 *   openAccordions()     a panel forced open by CSS leaves the theme's own
 *                        aria-expanded saying "closed" -- see below.
 *   onePhotoPerSwipe()   the peeking second photo is a Swiper CONSTRUCTOR
 *                        argument (slidesPerView 1.14) that the widget rewrites
 *                        as an inline style on every resize, and an inline
 *                        style beats a stylesheet rule. The wrap at the end of
 *                        the gallery is a constructor argument too, and `loop`
 *                        cannot even be assigned away on a live instance -- the
 *                        track is built from it. See the note on SLIDER.
 *
 * WHY THE TRIGGERS ARE PRESSED AND NOT THE PANELS UNHIDDEN. The accordion is
 * the theme's own component: aria-hidden on the content, aria-expanded on the
 * header, and a height it animates. Forcing the panel visible with CSS would
 * leave the header still saying "collapsed" to a screen reader, and leave the
 * theme's own next tap closing something it believes is already closed.
 * Clicking the header is exactly what a customer's tap does, so the theme's
 * state and the rendered state cannot disagree.
 *
 * WHAT THIS DOES NOT DO. It adds no content, reads no price, and builds no
 * card. Everything on the redesigned page is the store's own markup -- moved,
 * opened, or (in ./injectedStyles) restyled. That is the standing rule for
 * this app: the data is the site's, the view is ours.
 *
 * No regex and no backtick appears in the injected string: a lone backslash
 * inside one of these template literals is eaten at compile time and a
 * backtick would close the literal early -- see ./concernCards's `squash` and
 * the note at the top of ./productActions.
 */

/** Marks the moved section, so a re-run finds it instead of moving it again. */
export const MOVED_FLAG = 'data-zigly-pdp-moved';

/** Marks an accordion this has already opened, so a customer's close sticks. */
export const OPENED_FLAG = 'data-zigly-pdp-opened';

/**
 * Marks the gallery once it shows one photo and stops at both ends.
 *
 * On the element rather than on `window`, because it guards a different thing
 * from the module's own guard: that one stops a second injection re-running the
 * script, while this stops the retry loop inside ONE run destroying and
 * rebuilding a Swiper it has already rebuilt.
 */
export const SINGLE_FLAG = 'data-zigly-pdp-single';

/**
 * The section that holds Description and Sub Category Description.
 *
 * Matched on the theme's own section class, which is stable across the
 * template suffix -- unlike the id, which reads
 * `shopify-section-template--26530985017660__product_overview_accordion_KfCLAQ`
 * and carries a store-specific number this app must not hard-code.
 */
const DESCRIPTION_SECTION = '.product-overview-accordion-section';

/**
 * Where the description is moved to: immediately after the section holding the
 * buy box, which is the main product section.
 *
 * Found through the info container rather than by the section's own id, for
 * the reason above -- and then walked up to the top-level <section>, so the
 * move lands between two things the theme lays out rather than inside one.
 */
const MAIN_ANCHOR = '.product__info-container';

/**
 * The accordions the redesign drops: Key Features and More Information.
 *
 * Matched on the block name inside the trigger id -- the theme renders
 * `AccordionTrigger-Features-template--...` and `AccordionTrigger-Information-`
 * -- rather than on position. An index would retarget silently the moment a
 * merchant reorders the blocks in the theme editor, and would then be hiding
 * the description instead of the extras.
 *
 * ./injectedStyles hides these too, and both halves are wanted: the CSS is what
 * makes them gone on the first paint, and this list is what stops the sweep
 * below clicking a header nobody can see.
 */
const DROPPED_BLOCKS = ['AccordionTrigger-Features-', 'AccordionTrigger-Information-'];

/**
 * The product gallery: one whole photo per swipe, and a hard stop at each end.
 *
 * The theme builds it as `new window.Swiper(sliderElement, {...})` -- read off
 * the live page on 2026-08-31 -- and three of its settings are wrong for this
 * redesign:
 *
 *   breakpoints: { 0: { slidesPerView: totalSlides > 1 ? 1.14 : 1 } }
 *       The 0.14 is the sliver of the next image. It is a JavaScript number, so
 *       no stylesheet can hold against it: Swiper writes each slide's width as
 *       an INLINE style from it, on init and on every resize, and inline beats
 *       a rule.
 *   loop: totalSlides >= 3
 *       Three or more photos and the gallery wraps for ever -- past the last is
 *       the first again, with no end to reach.
 *   rewind: totalSlides > 1 && !enableLoop
 *       Exactly two photos and it JUMPS back to the first instead of wrapping.
 *       A different mechanism, the same wrong outcome.
 *   autoplay: totalSlides > 1 && !reduceMotion
 *       And it advances on its own besides.
 *
 * Wanted instead: swipe to the end, then swipe back. Both ends stop dead.
 *
 * WHY THIS REBUILDS RATHER THAN ASSIGNS. `slidesPerView` can be assigned and
 * re-measured, but `loop` cannot be unset that way: Swiper consults it while it
 * builds the track -- it CLONES slides to make the wrap seamless -- and works
 * out its snap grid from the result. A live looping instance told `loop = false`
 * keeps the clones and keeps wrapping. The supported route is a new instance.
 *
 * This is the same problem ./bannerCarousel solves in the other direction (it
 * turns a loop ON), and it is solved the same way, for the same reasons: build
 * from `sw.passedParams`, which is what the theme itself passed, so nothing
 * about the gallery is guessed at or re-specified -- only the four settings
 * above are overridden. The constructor is found and the parameters copied
 * BEFORE anything is destroyed, and a failed rebuild puts an instance back from
 * the originals. A gallery with no instance is a static stack of every photo at
 * full width, which is far worse than one that loops.
 */
const SLIDER = '.product-slider .main-slider';

export const PRODUCT_PAGE_SCRIPT = `
(function () {
  if (window.__ziglyProductPage) { return; }
  window.__ziglyProductPage = true;

  var MOVED = ${JSON.stringify(MOVED_FLAG)};
  var OPENED = ${JSON.stringify(OPENED_FLAG)};
  var DESCRIPTION_SECTION = ${JSON.stringify(DESCRIPTION_SECTION)};
  var MAIN_ANCHOR = ${JSON.stringify(MAIN_ANCHOR)};
  var DROPPED_BLOCKS = ${JSON.stringify(DROPPED_BLOCKS)};
  var SLIDER = ${JSON.stringify(SLIDER)};
  var SINGLE = ${JSON.stringify(SINGLE_FLAG)};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isProduct() {
    var path = (window.location.pathname || '/').toLowerCase();
    return path.indexOf('/products/') !== -1;
  }

  /** The top-level Shopify section an element belongs to. */
  function sectionOf(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        var id = node.getAttribute('id') || '';
        if (id.indexOf('shopify-section-') === 0) { return node; }
      }
      node = node.parentNode;
    }
    return null;
  }

  /**
   * Put Description directly under the buy box.
   *
   * Both ends are checked before anything moves: with no anchor to move it to,
   * the section stays exactly where the theme put it, and the page is the
   * theme's page -- the correct outcome for a template this has not seen.
   * Nothing is created and nothing is deleted; this is one insertBefore.
   */
  function moveDescription() {
    var section = document.querySelector(DESCRIPTION_SECTION);
    if (!section) { return false; }
    if (section.getAttribute(MOVED) === 'true') { return true; }

    var anchor = sectionOf(document.querySelector(MAIN_ANCHOR));
    if (!anchor || !anchor.parentNode) { return false; }
    // The description already inside the main section would make this a move
    // of a node onto itself.
    if (anchor === section) { return false; }

    anchor.parentNode.insertBefore(section, anchor.nextSibling);
    section.setAttribute(MOVED, 'true');
    return true;
  }

  /** True for a header belonging to one of the accordions the redesign drops. */
  function isDropped(header) {
    var id = header.getAttribute('id') || '';
    for (var i = 0; i < DROPPED_BLOCKS.length; i++) {
      if (id.indexOf(DROPPED_BLOCKS[i]) !== -1) { return true; }
    }
    return false;
  }

  /**
   * Open Product Details by pressing its own header.
   *
   * Only inside the description section, only the blocks that survive, and
   * only the ones still closed: a header already expanded is left alone, so
   * this never toggles a panel shut. Each header is marked the first time it is
   * seen, so a customer who collapses Product Details again does not have it
   * reopened under them by the next sweep.
   *
   * Key Features and More Information are skipped rather than clicked. They are
   * hidden by ./injectedStyles, and clicking a header the customer cannot see
   * would leave the theme animating a panel nobody asked for.
   */
  function openAccordions() {
    var section = document.querySelector(DESCRIPTION_SECTION);
    if (!section) { return false; }

    var headers = section.querySelectorAll('[data-accordion-header]');
    if (!headers.length) { return false; }

    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (isDropped(header)) { continue; }
      if (header.getAttribute(OPENED) === 'true') { continue; }
      header.setAttribute(OPENED, 'true');
      if (header.getAttribute('aria-expanded') === 'true') { continue; }
      try {
        header.click();
      } catch (e) {
        warn('product accordion did not open');
      }
    }
    return true;
  }

  /** Set one slide per view on a parameter bag and every breakpoint in it. */
  function pinToOne(params) {
    if (!params) { return; }
    params.slidesPerView = 1;
    // The breakpoint entries are what a resize re-reads, so they have to agree
    // with the live value or the peek comes back the first time the phone
    // turns. Rewritten as fresh objects, never mutated in place: passedParams
    // and params can share the same breakpoint objects, and editing one through
    // the other is how a "fixed" value quietly reappears.
    var points = params.breakpoints;
    if (!points) { return; }
    var copy = {};
    for (var key in points) {
      if (Object.prototype.hasOwnProperty.call(points, key)) {
        var at = points[key];
        var next = {};
        if (at) {
          for (var inner in at) {
            if (Object.prototype.hasOwnProperty.call(at, inner)) {
              next[inner] = at[inner];
            }
          }
        }
        next.slidesPerView = 1;
        copy[key] = next;
      }
    }
    params.breakpoints = copy;
  }

  /**
   * One whole photo per swipe, and no wrap at either end.
   *
   * Two different jobs, because Swiper treats them differently. slidesPerView
   * can be changed on the live instance and re-measured with update(). loop
   * cannot: the track is built from it, clones and all, so turning it off means
   * building a new instance from the theme's own passedParams.
   *
   * So the cheap path is taken when it is enough -- a gallery that is not
   * looping, not rewinding and not autoplaying only needs the count -- and the
   * rebuild happens only when there is actually a wrap to remove. Fewer than
   * two slides never needs either.
   *
   * Everything is guarded and nothing is assumed: no element, no Swiper (the
   * widget failed to load, or the theme changed), no params, no constructor --
   * each is a return, and the page keeps whatever gallery it already had.
   */
  function onePhotoPerSwipe() {
    var el = document.querySelector(SLIDER);
    if (!el) { return false; }

    // Marked on the ELEMENT, not on window: the window guard above covers
    // re-injection, but the retry below can call this several times inside one
    // run, and a second destroy/rebuild of a gallery already rebuilt would tear
    // down a working instance to build the same thing again. The mark survives
    // the rebuild because the element does -- Swiper is destroyed, its element
    // is not.
    if (el.getAttribute(SINGLE) === 'true') { return true; }

    var sw = el.swiper;
    if (!sw || !sw.params) { return false; }

    var wraps = sw.params.loop || sw.params.rewind ||
      (sw.params.autoplay && sw.params.autoplay.enabled !== false);

    // Nothing to unwrap: pin the count on the instance we have and stop.
    if (!wraps) {
      try {
        pinToOne(sw.params);
        if (typeof sw.update === 'function') { sw.update(); }
      } catch (e) {
        warn('product gallery slidesPerView not applied');
        return false;
      }
      el.setAttribute(SINGLE, 'true');
      return true;
    }

    var Ctor = window.Swiper;
    var passed = sw.passedParams;
    // Without a constructor or the theme's own parameters there is nothing safe
    // to rebuild from. The count is still worth setting -- a looping gallery
    // that shows one whole photo is better than one showing 1.14 of them.
    if (typeof Ctor !== 'function' || !passed) {
      warn('product gallery cannot be rebuilt; loop left as the theme set it');
      try {
        pinToOne(sw.params);
        if (typeof sw.update === 'function') { sw.update(); }
      } catch (e) {}
      return false;
    }

    // Copied BEFORE anything is destroyed, so a failed rebuild has something to
    // put back.
    var stopping = {};
    var original = {};
    for (var key in passed) {
      if (Object.prototype.hasOwnProperty.call(passed, key)) {
        stopping[key] = passed[key];
        original[key] = passed[key];
      }
    }
    pinToOne(stopping);
    // The three ways this gallery refuses to stop, all off. loop and rewind are
    // mutually exclusive in Swiper, so a stale rewind left on would simply take
    // over from the loop that was just removed.
    stopping.loop = false;
    stopping.rewind = false;
    stopping.autoplay = false;

    try {
      sw.destroy(true, true);
    } catch (e) {
      warn('product gallery destroy failed; keeping the instance we have');
      return false;
    }

    try {
      new Ctor(el, stopping);
      el.setAttribute(SINGLE, 'true');
      return true;
    } catch (e) {
      warn('product gallery rebuild failed');
      try {
        new Ctor(el, original);
      } catch (e2) {
        warn('product gallery could not be rebuilt at all');
      }
      return false;
    }
  }

  function sweep() {
    var moved = moveDescription();
    var opened = openAccordions();
    var single = onePhotoPerSwipe();
    return moved && opened && single;
  }

  /**
   * The description section is the theme's own markup, not an app's, so it is
   * usually in the first parse -- but this injection runs before the document
   * is finished, and the accordion binds its click handler from a deferred
   * script. Retried on a short schedule, then given up on: the page without
   * the move is the theme's own page, which is still a working product page.
   */
  function run() {
    if (!isProduct()) { return; }
    if (sweep()) { return; }
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (sweep() || tries > 20) { clearInterval(timer); }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
true;
`;
