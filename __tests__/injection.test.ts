/**
 * Injection guard tests.
 *
 * The critical property is negative: nothing is ever injected into a checkout
 * or payment page. A stray rule there could hide a payment control.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {EARLY_HEADER_CSS} from '../src/webview/headerBridge';
import {HOT_PICKS_SCRIPT} from '../src/webview/hotPicks';

describe('getInjectionForUrl', () => {
  it.each([
    'https://zigly.com/',
    'https://zigly.com/collections/sale',
    'https://zigly.com/products/some-dog-bed',
    'https://zigly.com/cart',
  ])('injects on the storefront page %s', url => {
    expect(getInjectionForUrl(url)).toContain('zigly-app-styles');
  });

  it.each([
    'https://zigly.com/checkouts/c/abc123',
    'https://zigly.com/checkout',
    'https://shop.app/pay',
    'https://pdp.gokwik.co/checkout',
  ])('never injects on the money flow: %s', url => {
    expect(getInjectionForUrl(url)).toBeNull();
  });

  it('skips an empty url rather than throwing', () => {
    expect(getInjectionForUrl('')).toBeNull();
  });

  it('keeps the site header out of view without removing it', () => {
    // The site hides its own header in a WebView; we keep it rendered but
    // invisible so its menu drawer still works behind our native header.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('data-hide-header-in-app');
    expect(script).toContain('visibility: hidden');
  });

  it('never patches the page own network, storage or cookies', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // Reading a Zigly page with a plain fetch() is fine and is how the breed
    // rail is sourced. What is forbidden is REPLACING these globals, which
    // would put us in the path of the site's own cart, auth and checkout calls.
    expect(script).not.toContain('window.fetch =');
    expect(script).not.toContain('window.fetch=');
    expect(script).not.toContain('XMLHttpRequest.prototype');
    expect(script).not.toContain('window.XMLHttpRequest =');
    expect(script).not.toContain('document.cookie =');
    expect(script).not.toContain('localStorage.setItem');
    expect(script).not.toContain('sessionStorage.setItem');
  });

  it('is idempotent: re-running replaces rather than appends', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('getElementById');
  });

  describe('homepage section order', () => {
    it('moves the category rail above the banner', () => {
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('home_category_section');
      expect(script).toContain('homepage_banner');
      expect(script).toContain('insertBefore');
    });

    it('matches section ids by stable fragment, not the generated suffix', () => {
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('[id*="home_category_section"]');
    });

    it('installs the section fetcher before anything calls it', () => {
      // This was wrong and failed silently. homeLayout is the first module to
      // call window.__ziglyFetchSection, and pageCache -- which defines it --
      // came second in the payload, so the call threw on every load and was
      // swallowed by homeLayout's own try/catch. The visible symptom was the
      // reference app's six category circles never replacing the homepage's
      // fourteen, with nothing in the log to say why.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script.indexOf('window.__ziglyFetchSection = function')).toBeLessThan(
        script.indexOf('swapCategories'),
      );
    });

    it('swaps in the category set the reference app shows', () => {
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('swapCategories');
      expect(script).toContain('data-zigly-swapped');
      // Six circles from the pet page, not the homepage's fourteen tiles. The
      // set itself is Zigly's; only which of their sections is used changes.
      expect(script).toContain('home_category_section');
      expect(script).not.toContain('"Small Pets"');
      expect(script).not.toContain('"Vet Care"');
    });

    it('lets a transplanted section tell our slot from the site’s own', () => {
      // "Everything For" reserves a slot called zigly-x-everything, then
      // checked [id*="everything"] to see whether the site already rendered the
      // section -- and matched its own slot, so it disabled itself every time
      // and the section never appeared at all.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('siteRenders');
      expect(script).toContain("id.indexOf('zigly-') !== 0");
    });

    it('can recover when a seeded section id goes stale', () => {
      // Full ids are used as a fast-path cache hint for Shopify's Section
      // Rendering API, but a theme re-save changes them -- so there must always
      // be a fragment-based rediscovery path behind them.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('re-discovering');
      expect(script).toContain('rediscover');
      expect(script).toContain("job.fragment");
    });

    it('places the coupon strip below the banner when it exists', () => {
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('coupon_slider');
    });

    it('treats a missing coupon section as normal, not an error', () => {
      // Zigly adds and removes this section; absence must not warn or throw.
      // Scoped to the layout module: couponStrip.ts warns when a *copy* fails,
      // which is a different event and must not be read as this one.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      const layout = script.slice(
        script.indexOf('coupon_slider'),
        script.indexOf('__ziglyCouponStrip'),
      );
      expect(layout).not.toContain("warn('coupon strip");
      expect(layout).not.toContain("warn('coupon section");
    });

    it('stops the strip scrolling itself and lets the thumb do it', () => {
      // The movement is the theme's own CSS marquee, so it is stopped in CSS.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('.mySwiper_couponSlider .slider-track');
      expect(script).toContain('animation: none !important');
      expect(script).toContain('.slider-container.mySwiper_couponSlider');
      expect(script).toContain('overflow-x: auto !important');
    });

    it("re-supplies the site's own copy function, and only if absent", () => {
      // The section's markup calls copyCodeCoupon from an inline onclick, and
      // this app drops transplanted scripts -- so the function has to come
      // back, under the same name, without shadowing the site's own.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain("typeof window.copyCodeCoupon !== 'function'");
      expect(script).toContain('window.copyCodeCoupon = function');
      // Same feedback class the theme's CSS keys the tick off.
      expect(script).toContain('show_copy_message');
      // Clipboard API first, execCommand when the WebView refuses it.
      expect(script).toContain('navigator.clipboard.writeText');
      expect(script).toContain("document.execCommand('copy')");
    });

    it('drops the duplicate coupons the marquee needed', () => {
      // translateX(-50%) means the theme emits every coupon twice. Scrolled by
      // hand, that reads as the list repeating.
      const script = getInjectionForUrl('https://zigly.com/') as string;
      expect(script).toContain('data-zigly-deduped');
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });
  });

  describe('the wishlist heart', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('fills the heart on the site’s own saved state', () => {
      // Their wishlist.js toggles .is-wishlisted and aria-pressed and there is
      // no rule for either anywhere in the theme, so a saved product's heart
      // looked exactly like an unsaved one. This supplies the missing rule.
      const s = home();
      expect(s).toContain(
        '.swym-button.swym-add-to-wishlist.is-wishlisted svg path',
      );
      // The CSS is JSON-encoded into the payload, so its quotes arrive escaped.
      expect(s).toContain('aria-pressed=');
      expect(s).toContain('fill: #ED2427 !important');
    });

    it('adds no wishlist behaviour of its own', () => {
      // The toggle, the storage and the click handling are all the site's --
      // wishlist.js binds one delegated listener on document, which covers
      // transplanted cards too. Nothing injected on every page may add a second,
      // or a tap would toggle twice and land back where it started.
      // Nothing injected on every page writes their wishlist. The storage key
      // and their toggle are quoted in a comment above the rule, which is why
      // this checks for the write rather than for the names.
      expect(home()).not.toContain('localStorage.setItem');
    });

    it('gives the control a real tap target', () => {
      const s = home();
      expect(s).toContain('.swym-button.swym-add-to-wishlist {');
      expect(s).toContain('min-height: 34px');
    });
  });

  describe('the banner carousel', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('runs on inner pages too, not only the dashboard', () => {
      // The brief is that a banner is never stuck wherever one appears, and the
      // pet pages, the collection list and the lifestyle pages all carry one.
      for (const url of [
        'https://zigly.com/',
        'https://zigly.com/pages/dog',
        'https://zigly.com/collections/dog-dry-food',
      ]) {
        expect(getInjectionForUrl(url)).toContain('__ziglyBannerCarousel');
      }
    });

    it('turns the theme’s misplaced loop into a real one', () => {
      // The section passes loop: true nested inside autoplay, where Swiper
      // ignores it -- so the last banner was a dead end. Loop cannot be switched
      // on by assignment either: Swiper reads it while building the track. So
      // the instance is rebuilt with loop added, from its OWN passed parameters.
      const s = home();
      expect(s).toContain('enableLoop');
      expect(s).toContain('sw.passedParams');
      expect(s).toContain('withLoop.loop = true');
      expect(s).toContain('new Ctor(root, withLoop)');
      expect(s).toContain('stopOnLastSlide = false');
    });

    it('re-specifies nothing about the carousel', () => {
      // Every parameter comes from what the theme passed. A hardcoded
      // slidesPerView or delay here would be this app deciding how Zigly's
      // banner behaves.
      const s = home();
      expect(s).not.toContain('slidesPerView:');
      expect(s).not.toContain('spaceBetween:');
    });

    it('cannot leave a dead carousel if the rebuild fails', () => {
      // Destroy comes after the constructor is found and the parameters are
      // copied, and a failed rebuild puts an instance back with the originals.
      // No instance plus cleaned styles is a static stack of slides.
      const s = home();
      const at = s.indexOf('function enableLoop');
      const body = s.slice(at, at + 2600);
      expect(body.indexOf('window.Swiper')).toBeLessThan(
        body.indexOf('sw.destroy(true, true)'),
      );
      expect(body).toContain('new Ctor(root, original)');
    });

    it('keeps rewind only as the fallback, with its own drag wrap', () => {
      // rewind is not the same thing: it scrubs backwards through every slide
      // to reach the first, and it does not cover a manual drag off the end --
      // which loop mode does, so the wrap is bound only when loop failed.
      const s = home();
      expect(s).toContain('if (!result.looping) { bindDragWrap(sw); }');
      expect(s).toContain("sw.on('touchEnd'");
      expect(s).toContain('sw.isBeginning');
      expect(s).toContain('setTimeout(function () {');
    });

    it('leaves the pagination alone', () => {
      // The theme passes the document-wide '.swiper-pagination', and this app
      // puts a dozen more of those on the page -- which looks like a defect and
      // is not. Swiper's uniqueNavElements defaults to true and narrows a
      // multi-match string selector to nodes inside the instance's own element.
      // Re-pointing the dots from here would be pure risk, and Swiper 11
      // exposes no init/destroy on swiper.pagination to do it cleanly.
      const s = home();
      expect(s).not.toContain('pagination.destroy()');
      expect(s).not.toContain('params.pagination.el =');
    });

    it('stops autoplay off screen and re-arms it on the way back', () => {
      // Inner pages are parked off screen rather than hidden, so a carousel
      // nobody is looking at would keep the compositor busy.
      const s = home();
      expect(s).toContain('IntersectionObserver');
      expect(s).toContain('stopAutoplay');
      expect(s).toContain('armAutoplay');
      expect(s).toContain('sw.autoplay.start');
    });

    it('nudges a visible carousel that has stopped moving', () => {
      const s = home();
      expect(s).toContain('sw.slideNext()');
      expect(s).toContain('onScreen(root)');
    });

    it('builds no carousel of its own and touches no slide', () => {
      // It repairs the configuration of the instance the page already made.
      const s = home();
      expect(s).not.toContain('new Swiper');
      expect(s).not.toContain('swiper-slide-duplicate');
      expect(s).not.toContain('loopCreate');
    });

    it('leaves a section with no instance alone', () => {
      // Transplanted sections deliberately never run their scripts, so
      // el.swiper being undefined is the signal to leave them to the CSS.
      expect(home()).toContain('if (!sw || !sw.params) { return; }');
    });

    it('drops the frame the site draws round the strip', () => {
      const s = home();
      expect(s).toContain('.homepage_banner .homepageMainBanner.swiper');
      expect(s).toContain('padding-inline-start: 0 !important');
      expect(s).toContain('border-radius: 0 !important');
    });
  });

  describe('the breed rail', () => {
    it('draws smaller circles with more air between them', () => {
      // Was 33% wide with a 14px gap, which read as three big discs almost
      // touching. Width and gap only make sense chosen together.
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).toContain('flex: 0 0 24% !important');
      expect(s).toContain('gap: 26px');
      expect(s).not.toContain('flex: 0 0 33% !important');
    });
  });

  describe('the product card', () => {
    it('un-hides the container the theme hides, not just the button', () => {
      // Two mobile rules hid it: base.css's .small-hide and product-card.css's
      // .product-card-wrapper .quick-add. A display:block on the child cannot
      // bring back a parent that is display:none, so the cards had no add
      // control at all -- variants hidden by us, Add to Bag hidden by them.
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).toContain('#zigly-hot-picks .quick-add,');
      expect(s).toContain('display: block !important');
    });

    it('shows one add control, not two', () => {
      // .atc-wrapper is the floating "+ Add" the theme shows instead of Add to
      // Bag on mobile. With both visible a card carries two add buttons.
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).toContain('#zigly-hot-picks .atc-wrapper,');
      expect(s).toContain('body.zigly-listing .atc-wrapper');
    });

    it('makes no cart request of its own', () => {
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).not.toContain('/cart/add');
    });
  });

  describe('the brand rail', () => {
    it('shows one brand per card, not two stacked', () => {
      // The section's Swiper is initialised with grid: { rows: 2 }, so every
      // column held two brands. Swiper writes the second row's offset as an
      // inline margin-top, which is why the override has to be !important.
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).toContain(
        '.home-brand-section-wrapper .home-shop-brand-swiper-wrapper .swiper-wrapper',
      );
      expect(s).toContain('flex-wrap: nowrap !important');
      expect(s).toContain('margin-top: 0 !important');
    });
  });

  describe('hot picks section', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it("sources both tabs from Zigly's own hot-picks collections", () => {
      const s = home();
      // These are the two collections Zigly publish under these names. The
      // section used to be filled from the /pages/dog and /pages/zigly-cat
      // arrival rails, which put the wrong products under the right heading.
      expect(s).toContain('/collections/hot-picks-squeaker-toys');
      expect(s).toContain('/collections/hot-deals');
      // Scoped to this section: the full injection still names the arrival
      // sections, because pageCache seeds their ids and extraSections hides
      // the homepage's own copy. What matters is that nothing fetches them
      // to fill this one.
      expect(HOT_PICKS_SCRIPT).not.toContain('home_arrival_section');
      expect(HOT_PICKS_SCRIPT).not.toContain('__ziglyFetchSection');
      // No product titles, prices or handles baked in.
      expect(s).not.toMatch(/₹\s?\d/);
    });

    it('still defers both collection fetches until the section nears view', () => {
      // A collection page is fetched whole, so neither tab may become eager.
      const s = home();
      expect(s).toContain('whenNear(section, function () {');
      expect(s).toContain("loadCards(HOT_SOURCE, paneHot, LIMIT)");
    });

    it('loads the New Arrivals collection only when that tab is opened', () => {
      const s = home();
      expect(s).toContain('if (newLoaded) { return; }');
      expect(s).toContain('loadCards(NEW_SOURCE, paneNew, LIMIT)');
    });

    it('defaults to the Hot Picks tab', () => {
      expect(home()).toContain("zigly-hp__tab is-active");
    });

    it("keeps the site's own add-to-cart form on each card", () => {
      // Cards are imported whole; nothing strips or replaces product-form.
      const s = home();
      expect(s).toContain('.card-wrapper.product-card-wrapper');
      expect(s).not.toContain('removeChild(form');
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });
  });

  describe('explore section', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('transplants the real section rather than rebuilding it', () => {
      const s = home();
      expect(s).toContain('explore_product@dog');
      expect(s).toContain('explore_product@cat');
      // No hardcoded category names or collection handles.
      expect(s).not.toContain('dog-wet-food');
      expect(s).not.toContain('Smart Petcare');
    });

    it("does not shadow the site's own tab switcher when present", () => {
      expect(home()).toContain("typeof window.makeActiveSlider !== 'function'");
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });
  });

  it('does not re-run carousel scripts that loop and clone slides', () => {
    // Swiper loop mode clones slides, which made the breed rails scroll
    // forever and repeat breeds. The transplants strip scripts instead.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).not.toContain("createElement('script')");
  });

  it('keeps transplanted add-to-cart controls inside their card', () => {
    // These cards carry the theme's floating sticky-ATC containers, which
    // escaped the rail and painted over the footer.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('#zigly-hot-picks .mobile-atc-main');
    expect(script).toContain('isolation: isolate');
    // The wishlist heart must stay absolutely positioned over the image.
    expect(script).not.toContain('.wishlist-icon-wrapper');
  });

  it('shows both pets in the explore categories', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('explore_product@dog');
    expect(script).toContain('explore_product@cat');
    // Tabs are matched by their label so the merge cannot mis-pair Food
    // tiles into the Toys tab if Zigly reorders them.
    expect(script).toContain('tabMap');
  });

  it('does not treat a dog and a cat tile as the same tile', () => {
    // This is what made the section dog-only. Deduping on the label collapsed
    // dog "Dry Food" and cat "Dry Food" into one tile and kept the first, and
    // the dog set merges in first -- so on the Food tab only 1 of 4 cat tiles
    // survived. They go to different collections, so neither was a duplicate.
    // Keying on the destination is the fix; the counts are in explorePicker.ts.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('function destOf(slide)');
    expect(script).toContain("var key = 'k' + (destOf(slides[i])");
    // The old label-keyed pass and its name must both be gone.
    expect(script).not.toContain('combineDuplicates');
    expect(script).not.toContain("var label = squash(slides[i].textContent");
  });

  it("reads a tile's link from the anchor that wraps it, not its first one", () => {
    // Zigly close each tile's link by repeating the opening <a> instead of
    // writing </a>. The parser leaves an empty copy of it loose -- sometimes
    // inside the following tile -- so a tile's FIRST anchor is often the
    // previous tile's. Read that way, three of the four Food tiles report the
    // wrong destination and two are then deleted as duplicates of a neighbour.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain("querySelector('.card-wrapper_info-heading')");
    expect(script).toContain("node.tagName === 'A' && node.getAttribute('href')");
    // The naive read is what caused it and must not come back.
    expect(script).not.toContain("var link = slide.querySelector('a')");
  });

  it('clears the empty anchors that broken markup leaves in the rail', () => {
    // Two per rail. One sits in the rail itself, which is a flex row with a
    // gap, so it spends a gap and the tiles sit unevenly. Only an anchor with
    // no elements and no text is removed -- a real tile link wraps that tile's
    // image and heading, so it can never match.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('stripStrayAnchors(imported)');
    expect(script).toContain('stripStrayAnchors(catSec)');
    expect(script).toContain('if (link.children.length) { continue; }');
  });

  it('alternates the two pets so cat tiles are on screen, not just present', () => {
    // The rail shows about two tiles at a time, so four dog tiles followed by
    // four cat tiles still reads as dog-only. Alternating puts a cat tile
    // second in every tab.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('function interleave(wrap, catSlides)');
    expect(script).toContain('interleave(into, slidesIn(catTabs[label]))');
  });

  it('keeps every merged explore tile, rather than capping them away', () => {
    // Each pet page ships four tiles per tab and none of the eight is a real
    // duplicate, so a cap of 8 sat exactly on the real count -- one tile added
    // by Zigly would have vanished silently. It was 4 once, which dropped
    // every cat tile.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('var MAX_TILES = 16;');
  });

  it('labels which pet an explore tile is for without touching its heading', () => {
    // Four labels collide once both pets share a rail -- Dry Food, Wet Food,
    // Meaty Treats, Plush Toys -- so two identical headings would look broken.
    // The pet goes in the subheading <p> Zigly render and leave empty; their
    // heading text is never rewritten.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain("tagSpecies(imported, 'For Dogs')");
    expect(script).toContain("tagSpecies(catSec, 'For Cats')");
    expect(script).toContain('card-wrapper_info-subheading');
    // Anything Zigly put there themselves wins over our line.
    expect(script).toContain("if (squash(sub.textContent || '')) { continue; }");
    // The heading is read -- destOf walks up from it -- but never written to,
    // so Zigly's category names stay their words.
    expect(script).not.toMatch(/info-heading[^;]*textContent\s*=[^=]/);
    // Styled through the flag we set, so the site's own empty ones are untouched.
    expect(script).toContain(
      '.card-wrapper_info-subheading[data-zigly-species]',
    );
  });

  it('leaves every explore tile pointing where Zigly pointed it', () => {
    // This used to rewrite a merged tile's link to a combined collection
    // guessed from its label, guarded by a HEAD request. The guard did not
    // work: a Shopify collection can be published and empty, so HEAD answered
    // 200 for handles holding nothing, and five of sixteen tiles opened a
    // listing with no products in it. Counts are in explorePicker.ts.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).not.toContain("method: 'HEAD'");
    expect(script).not.toContain('handleFor');
    expect(script).not.toContain("'/search?q=' + encodeURIComponent(label)");
    // And no handle is written here either, guessed or otherwise.
    expect(script).not.toContain('/collections/dry-food');
    expect(script).not.toContain('/collections/rope-toys');
  });

  describe('sort and filter bar', () => {
    it("pins the site's own controls rather than rebuilding them", () => {
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain('initial-search-sort');
      expect(script).toContain('initial-search-filters');
      // No hand-rolled sort options or filter UI.
      expect(script).not.toContain('Price: Low to High');
    });

    it('relocates the real controls rather than cloning them', () => {
      // Moving preserves their listeners, so they stay SearchTap's controls.
      // Cloning would produce buttons that look right and do nothing.
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain('bar.appendChild(toMove[m])');
      expect(script).toContain('initial-search-sort');
      expect(script).not.toContain('cloneNode');
    });

    it('collects every control, not just the first of each', () => {
      // One of three reasons Sort and Filter showed up twice: querySelector
      // moved the first of each and left any others where they were.
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain("querySelectorAll('initial-search-filters')");
      expect(script).toContain("querySelectorAll('initial-search-sort')");
      expect(script).toContain("querySelectorAll('.st-filter-count-sort-wrap')");
    });

    it('leaves a control that is already in the bar alone', () => {
      // Re-appending is a detach and re-attach: it loses focus and can
      // interrupt SearchTap's own transition.
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain('found[i].parentNode !== bar');
    });

    it('re-pins on a re-render instead of polling for one', () => {
      // The poll ran every 500ms and gave up after forty tries, so a filter
      // change after the first twenty seconds left the duplicates up for the
      // rest of the page's life. An observer fires in the same task as the
      // render and does not expire.
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain('new MutationObserver');
      expect(script).toContain('childList: true, subtree: true');
      // Coalesced: SearchTap replacing a toolbar is many records, and each one
      // would otherwise cost a full sweep.
      expect(script).toContain('if (pending) { return; }');
    });

    it('hides any control that is not in the bar, whatever the timing', () => {
      // There is always a frame between SearchTap's render and our move, so
      // the CSS closes the race rather than relying on the JavaScript winning.
      const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(script).toContain('body.zigly-listing initial-search-sort');
      expect(script).toContain('#zigly-sortfilter-bar initial-search-sort');
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });

    it('covers search results, not just collections', () => {
      // SearchTap draws that grid too, and the reference app pins the same bar
      // there. Bare /collections is excluded on purpose -- it is the card
      // list, which has no products to sort.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain("path.indexOf('/collections/') === 0");
      expect(script).toContain("path.indexOf('/search') === 0");
    });

    it('refills a bar that SearchTap has emptied', () => {
      // SearchTap re-renders its controls on a filter change, and the bar is
      // then holding the stale nodes it moved earlier while the fresh ones sit
      // at the top of the grid. The old early-out tested the bar for content,
      // which is exactly the state that leaves -- so it stopped collecting and
      // the page showed two of each. There is no early-out on content now.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).not.toContain('existing.children.length > 0');
      // It early-outs only when there is genuinely nothing left to move.
      expect(script).toContain('if (!toMove.length) { return; }');
    });

    it("clears SearchTap's paginating loader above the bar", () => {
      // The loader draws at the foot of the grid, which is exactly where the
      // pinned bar covers it -- the page then looks stuck rather than loading.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain('padding-bottom: 96px');
      // The CSS reaches the page through JSON.stringify, so its double quotes
      // arrive escaped -- match the fragment, not the quoted selector.
      expect(script).toContain('st-load');
      // Margin only: a class-fragment match on third-party markup must not be
      // able to break the grid if it hits something unintended.
      const rule = script.slice(
        script.indexOf('st-load'),
        script.indexOf('st-load') + 200,
      );
      expect(rule).toContain('margin-bottom');
      expect(rule).not.toContain('display: none');
      expect(rule).not.toContain('position: fixed');
    });

    it('flattens the pills into the bar without rebuilding them', () => {
      // Presentation only: still SearchTap's elements and listeners.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain('#zigly-sortfilter-bar button');
      expect(script).not.toContain('cloneNode');
    });
  });

  describe('listing cards', () => {
    it('shows the plain Add to Bag the reference shows', () => {
      // The site's grid renders the compact variant picker ("+ Add", "+9
      // more") where the reference has a full-width button. Same fix the
      // transplanted dashboard sections already carry.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain('body.zigly-listing .card-variant-wrapper');
      expect(script).toContain('body.zigly-listing .quick-add__submit');
    });

    it('keeps the card fixes off product pages', () => {
      // There, .mobile-atc-main is the site's own sticky Add to Bag bar and is
      // supposed to float. The flag is only set for listing paths.
      const script = getInjectionForUrl(
        'https://zigly.com/products/x',
      ) as string;
      expect(script).toContain('function isListing()');
      expect(script).toContain("path.indexOf('/collections/') === 0");
      // Nothing keys the card rules on a product path.
      expect(script).not.toContain("indexOf('/products/') === 0");
    });

    it('flags the page whether or not the bar ever appears', () => {
      // The card fixes are needed even if SearchTap never renders its controls.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain('flagListing()');
      expect(script).toContain("var LISTING_FLAG = 'zigly-listing'");
    });
  });

  it('leaves the site’s bottom navigation alone', () => {
    // The reference app shows the site's own four tabs -- Zigly, Collections,
    // Breed-verse, Wishlist -- so no tab is added to the bar.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).not.toContain('zigly-account-tab');
    // And no auth handling of our own anywhere in the injection.
    expect(script).not.toContain('password');
    expect(script).not.toContain('customer[email]');
  });

  it('places the site’s own menu drawer without rebuilding it', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('.menu-drawer');
    expect(script).toContain('menu-drawer__overlay');
    // Categories must keep coming from Zigly's own menu, never authored here.
    expect(script).not.toContain('/collections/dog-');
    expect(script).not.toContain('/collections/cat-');
  });

  it('sources the extra drawer rows from links the site already publishes', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // Store Locator, Blogs and About Us are found by their visible text and
    // cloned; their URLs are never written here, so they cannot go stale.
    expect(script).toContain('findLink');
    expect(script).not.toContain('/pages/zigly-store-locator');
    expect(script).not.toContain('/blogs/all');
    expect(script).not.toContain('/pages/about-us');
    // Login/Register is no longer appended here. The drawer is native now and
    // opens with an account block of its own; adding the row to the list the
    // native drawer reads would show it twice.
    expect(script).not.toContain('Login/Register');
  });

  it('uses Zigly’s own in-app flag rather than only CSS', () => {
    // Their header script checks window.IS_MOBILE_APP before falling back to
    // user-agent sniffing; setting it is the sanctioned integration. It must be
    // in the earliest payload, and repeated in the main one as a backstop.
    expect(EARLY_HEADER_CSS).toContain('window.IS_MOBILE_APP = true');
    expect(getInjectionForUrl('https://zigly.com/')).toContain(
      'window.IS_MOBILE_APP = true',
    );
  });

  it('hides the collection banner without removing it from the DOM', () => {
    const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
    expect(script).toContain('collection_metafield_banner_info');
    expect(script).toContain('display: none');
    // Matched by fragment, not the theme-generated suffix.
    expect(script).not.toContain('collection_metafield_banner_info_iWzKUB');
  });

  it('shows the populated tab in transplanted sections', () => {
    // These sections mark one .tab-content 'active', and it is not always the
    // one holding content -- on the cat breed section the active block is
    // empty, which rendered the Cats rail permanently blank.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('activateFilledTab');
    expect(script).toContain('.tab-content');
  });

  it('keeps every category both source pages ship, deduplicated', () => {
    // Four per page and no genuine duplicates among them, so eight is
    // "everything both pets have" and the cap must sit above it -- see the
    // explore tests above for the two numbers that were wrong before.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('MAX_TILES = 16');
  });

  describe('full dashboard match', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('places every section the reference app shows', () => {
      const s = home();
      for (const mark of [
        'zigly-x-coupon',
        'zigly-x-offer1',
        'zigly-x-offer2',
        'zigly-x-offer3',
        'zigly-x-coins',
        'zigly-x-banner2',
        'zigly-x-logos',
        'zigly-x-price',
        'zigly-x-concern',
        'zigly-x-double',
        'zigly-x-everything',
      ]) {
        expect(s).toContain(mark);
      }
    });

    it('distinguishes sections whose fragment repeats on the source page', () => {
      // Three offer sections and three single banners share a fragment, so a
      // bare lookup would return the first one three times.
      const s = home();
      expect(s).toContain('offer_section#1');
      expect(s).toContain('offer_section#3');
      expect(s).toContain('custom_single_banner#3');
    });

    it('swaps in the category set the reference app shows', () => {
      const s = home();
      expect(s).toContain('swapCategories');
      // Replaced in place, never appended alongside the original.
      expect(s).toContain('replaceChild');
    });

    it('lets the category circles be scrolled by thumb', () => {
      // The transplanted rail has no Swiper -- markup inserted through the DOM
      // never runs its scripts -- so the track sat wider than a box that clips
      // it, and every circle past the fifth was on the page and unreachable.
      const s = home();
      expect(s).toContain('data-zigly-native-scroll');
      expect(s).toContain('.home-category-swiper');
      expect(s).toContain('overflow-x: auto !important');
    });

    it('never turns a live Swiper rail into a scroller as well', () => {
      // Two markers, and only the one set on a copy that actually landed drives
      // the CSS. When the fetch fails, the rail the site rendered keeps its own
      // Swiper, and it must not also be scrolling natively.
      const s = home();
      expect(s).toContain(
        "replacement.setAttribute('data-zigly-native-scroll'",
      );
      expect(s).not.toContain(
        "current.setAttribute('data-zigly-native-scroll'",
      );
    });
  });

  it('relocates sections the homepage already has rather than copying them', () => {
    // Top Pets Brands, Pet Parenting and Real Pets are already on the page.
    // Transplanting copies would show each of them twice.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    for (const frag of [
      'home_shop_by_brand_section',
      'helpful_tips',
      'about_our_communities',
      'custom_video_text_banner',
    ]) {
      expect(script).toContain(`"move":"${frag}"`);
      expect(script).not.toContain(`"key":"${frag}"`);
    }
    // The arrival sections are the exception: neither of the homepage's two is
    // in the reference dashboard, so they are hidden rather than relocated.
    expect(script).toContain('"hide":"home_arrival_section"');
    expect(script).not.toContain('"move":"home_arrival_section"');
  });

  it('hides homepage sections the reference does not show', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // The stylesheet is JSON-encoded into the script, so match without quotes.
    expect(script).toContain('home_arrival_section');
    expect(script).toContain('custom_video_text_banner');
    // Our transplanted banners share the fragment, so they must be exempted.
    expect(script).toContain('zigly-x-');
    expect(script).toContain('custom_single_banner');
  });

  it('uses the pet page product section for Bestsellers, not best_deals', () => {
    // Section names do not match their content here. best_deals holds the
    // Zigly Coins banner and offer cards, and the homepage's arrival sections
    // are "Best Deals" and "Trending Products" -- neither is the rail in this
    // slot. collection_product_section is: ten real product cards, sitting in
    // exactly this position on /pages/dog.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('"key":"collection_product_section"');
    expect(script).toContain('"mark":"zigly-x-bestsellers"');
    // best_deals is used, but for Coins -- a different slot entirely.
    expect(script).toContain('"mark":"zigly-x-coins"');
  });

  describe('everything for section', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('shows Dogs and Cats tabs, not the source templates’ labels', () => {
      // Dog page ships Puppy/Adult, cat page ships Kitten/Cat; the reference
      // shows Dogs/Cats, so the frame is relabelled and refilled.
      const s = home();
      expect(s).toContain("['Dogs', 'Cats']");
      expect(s).toContain('everything@dog');
      expect(s).toContain('everything@cat');
    });

    it('supplies the switcher the section needs to work', () => {
      // Its tabs call makeActiveSlider_eveything (their spelling), which the
      // homepage never defines -- so tapping a tab did nothing.
      const s = home();
      expect(s).toContain('makeActiveSlider_eveything');
      expect(s).toContain("typeof window.makeActiveSlider_eveything !== 'function'");
    });
  });

  it('keeps the video section and drops Shop from Feed', () => {
    // video_swiper renders "Shop from Feed", which the reference does not
    // show; the video is custom_video_text_banner.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('video_swiper');
    expect(script).toContain('custom_video_text_banner');
    expect(script).not.toContain('"key":"video_swiper"');
  });

  it('places the logos strip last, and it now closes the page', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // The declaration, not the bare id: the stylesheet names that id too, in
    // the rule that makes the strip untappable, and it does so earlier in the
    // payload -- so a bare indexOf measures the CSS, not the running order.
    const logos = script.indexOf('"mark":"zigly-x-logos"');
    const communities = script.indexOf('"move":"about_our_communities"');
    expect(logos).toBeGreaterThan(-1);
    // Declared after Real Pets. The footer used to follow it; now nothing
    // does, so this is what the dashboard ends on.
    expect(logos).toBeGreaterThan(communities);
  });

  it('closes the dashboard with real posts from the Zigly account', () => {
    // The reference heads this "From Our Instagram" and for a long time it
    // could not be built: no section on zigly.com is called that and none
    // pulls a feed, so the theme's photo grid (`gallery`, "Happy Moments")
    // stood in for it. The posts are now read live from Zigly's own account,
    // so the heading is accurate and the stand-in is gone.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('From Our Instagram');
    expect(script).toContain('"slot":"zigly-x-instagram"');
    // The stand-in and its page are no longer fetched at all.
    expect(script).not.toContain('"key":"gallery"');
    expect(script).not.toContain('/pages/store-home-page-section');
    expect(script).not.toContain('zigly-x-moments');
  });

  it('reserves the Instagram slot last but one, above the icons strip', () => {
    // The user asked for it directly above the brand-claims strip that ends
    // the page, which is where the reference puts it.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    const communities = script.indexOf('"move":"about_our_communities"');
    const instagram = script.indexOf('"slot":"zigly-x-instagram"');
    const logos = script.indexOf('"mark":"zigly-x-logos"');
    expect(communities).toBeGreaterThan(-1);
    expect(instagram).toBeGreaterThan(communities);
    expect(logos).toBeGreaterThan(instagram);
  });

  it('carries the posts in the payload, with no call out to Instagram', () => {
    // The posts are hardcoded, so the section draws on the first injection
    // with no network of its own. Only the covers are remote, and they are
    // <img> loads the customer pays for only if they scroll that far.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('/media/?size=m');
    expect(script).not.toContain('web_profile_info');
    expect(script).not.toContain('X-IG-App-ID');
  });

  describe('add to cart feedback', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('lets the site do the adding and only suppresses its drawer', () => {
      const s = home();
      // No cart POSTs, no cart state of our own.
      expect(s).not.toContain('/cart/add');
      expect(s).toContain('cart-drawer');
      expect(s).toContain('cart-added');
    });

    it('closes the drawer through its own controls', () => {
      // Calling close() or its close button lets the theme's cleanup run;
      // hiding it with CSS would leave the page scroll-locked.
      const s = home();
      expect(s).toContain('drawer.close()');
      expect(s).toContain('drawer__close');
    });

    it('only suppresses a drawer that follows an add', () => {
      // Tapping the cart icon must still open it normally.
      expect(home()).toContain('WINDOW_MS');
    });
  });

  describe('splash readiness', () => {
    it('reports only once the above-the-fold dashboard is in place', () => {
      const s = getInjectionForUrl('https://zigly.com/') as string;
      expect(s).toContain('dashboard-ready');
      expect(s).toContain('homepage_banner');
      expect(s).toContain('zigly-breed-dogs');
    });

    it('waits for the app’s own stylesheet before an inner page is shown', () => {
      // The bug this closes: a load ending is the document arriving, not the
      // page. Revealing on load end showed the mobile website for a beat and
      // then it became this app's page.
      const s = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(s).toContain("document.getElementById('zigly-app-styles')");
      expect(s).toContain('page-ready');
    });

    it('waits for a listing grid, which SearchTap renders after first paint', () => {
      // A collection that has loaded is usually still an empty column.
      const s = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(s).toContain('#zigly-sortfilter-bar, initial-search-sort');
    });

    it('reports even if a section never arrives', () => {
      // A missing section must delay the reveal, never trap the user. Located
      // inside the ready watcher, not by the first cap in the payload -- the
      // sort/filter retry loop has one of its own.
      const s = getInjectionForUrl('https://zigly.com/') as string;
      const at = s.indexOf('__ziglyReadyWatch');
      expect(at).toBeGreaterThan(-1);
      expect(s.slice(at)).toContain('tries > cap');
    });
  });

  it('hides breadcrumbs on collection and product pages', () => {
    // The reference goes header -> heading with no "Home > Food > Dry Food".
    for (const url of [
      'https://zigly.com/collections/dog-wet-food',
      'https://zigly.com/products/some-bed',
    ]) {
      const script = getInjectionForUrl(url) as string;
      expect(script).toContain('breadcrumbs-container');
    }
  });

  it('keeps Pet Parenting, the video and Real Pets directly above the logos', () => {
    const s = getInjectionForUrl('https://zigly.com/') as string;
    const at = (needle: string) => s.indexOf(needle);
    // Declaration order in the chain is the render order.
    expect(at('"move":"helpful_tips"')).toBeLessThan(
      at('"move":"custom_video_text_banner"'),
    );
    expect(at('"move":"custom_video_text_banner"')).toBeLessThan(
      at('"move":"about_our_communities"'),
    );
    // The declaration rather than the bare id -- see the note above.
    expect(at('"move":"about_our_communities"')).toBeLessThan(
      at('"mark":"zigly-x-logos"'),
    );
  });

  it('fixes Everything For after Bestsellers, not before it', () => {
    // It used to anchor itself off Style Steals, landing above Bestsellers.
    const s = getInjectionForUrl('https://zigly.com/') as string;
    expect(s).toContain('"slot":"zigly-x-everything"');
    expect(s.indexOf('"move":"home_arrival_section"')).toBeLessThan(
      s.indexOf('"slot":"zigly-x-everything"'),
    );
  });

  it('includes Zigly Coins and the offer cards', () => {
    // best_deals is not a product section despite the name: it carries the
    // coins banner and the category discount tiles.
    const s = getInjectionForUrl('https://zigly.com/') as string;
    expect(s).toContain('zigly-x-coins');
    expect(s).toContain('"key":"best_deals"');
  });

  it('puts Coins between the Applod sections and Top Pets Brands', () => {
    const s = getInjectionForUrl('https://zigly.com/') as string;
    expect(s.indexOf('offer_section#2')).toBeLessThan(s.indexOf('zigly-x-coins'));
    expect(s.indexOf('zigly-x-coins')).toBeLessThan(
      s.indexOf('"move":"home_shop_by_brand_section"'),
    );
  });

  it('reaches the cart without routing through the dashboard', () => {
    // Injecting a navigation into the dashboard WebView made it start loading
    // the cart, get cancelled by the routing, then load again -- a visible
    // flash. The cart is now loaded straight into the page view instead.
    const {OPEN_CART} = require('../src/webview/headerBridge');
    expect(OPEN_CART).not.toContain('cart-icon-bubble');
  });

  it('never lets the footer wave reach the screen', () => {
    // A 2000px desktop image opens the footer, and it used to be constrained
    // to a band here because the dashboard showed the footer. The dashboard
    // does not any more, so the band is gone with it -- and so is the rest of
    // the footer, on every page.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    // The rule, not the word: the block that used to hold these rules still
    // names the wave, in the comment recording why they went.
    expect(script).not.toContain('footer .wave-image-wrapper {');
    expect(script).not.toContain('.wave-image-wrapper {');
    // Scoped to a footer rule, not banned outright. This was a bare
    // `not.toContain('object-fit: cover')` over the whole payload, which read
    // as "the wave rules are gone" but actually asserted that no rule anywhere
    // in the stylesheet crops an image -- so the Instagram covers, which are
    // nothing to do with the footer, failed it.
    expect(script).not.toMatch(/footer[^{}]*\{[^{}]*object-fit/);
    // Because the footer itself never renders, on any page. The fragment
    // rather than the whole selector: the CSS is embedded with JSON.stringify,
    // so its double quotes are escaped by the time they reach the payload.
    // dashboardTail.test.ts asserts the exact selector against the stylesheet.
    expect(script).toContain('__footer');
  });

  it('marks inner pages from the live path, not per injected copy', () => {
    // No CSS reads this class today -- hiding the footer everywhere took its
    // last consumer -- but the marking is what any page-type rule would hang
    // off, and it has to be right on every navigation.
    const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
    expect(script).toContain('zigly-inner-page');
    expect(script).toContain('window.location.pathname');
  });

  it('moves the toolbox wrapper, where the visible pills actually live', () => {
    // initial-search-* ship empty; SearchTap renders the pills into
    // .st-filter-count-sort-wrap, which an earlier version left at the top.
    const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
    expect(script).toContain('st-filter-count-sort-wrap');
  });
});
