/**
 * Injection guard tests.
 *
 * The critical property is negative: nothing is ever injected into a checkout
 * or payment page. A stray rule there could hide a payment control.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {FACET_BRIDGE_SCRIPT} from '../src/webview/facetBridge';
import {LISTING_PATHS} from '../src/constants/appConstants';
import {
  LISTING_FLAG,
  LISTING_PAGE_SCRIPT,
  PRODUCT_FLAG,
} from '../src/webview/listingPage';
import {BANNER_CAROUSEL_SCRIPT} from '../src/webview/bannerCarousel';
import {EARLY_HEADER_CSS} from '../src/webview/headerBridge';
import {HOT_PICKS_SCRIPT} from '../src/webview/hotPicks';
import {MOBILE_CSS} from '../src/webview/injectedStyles';

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

    it('insets the first coupon, by padding the track and not the scroller', () => {
      // The first coupon sat flush against the left edge while every coupon
      // after it had a gutter: the theme's inset is on an ancestor, and once
      // this element became a scroller its content box starts at x=0.
      //
      // The gutter has to be on the TRACK. A scroll container's own start
      // padding is scrolled away, and an older Android WebView drops its end
      // padding outright -- so padding .slider-container fixes neither the
      // first coupon at rest nor the missing gutter after the last one. On a
      // max-content flex track the padding is part of the track's width, so it
      // scrolls with the content.
      const css = MOBILE_CSS;
      // The FIRST occurrence of this selector in the file is inside the comment
      // above the block, which quotes the theme's own marquee rule to explain
      // what is being stopped. The real declaration is the one after it.
      const quoted = css.indexOf('.mySwiper_couponSlider .slider-track {');
      const from = css.indexOf(
        '.mySwiper_couponSlider .slider-track {',
        quoted + 1,
      );
      expect(from).toBeGreaterThan(quoted);
      const rule = css.slice(from, css.indexOf('}', from));
      expect(rule).toContain('padding-left: 12px');
      expect(rule).toContain('padding-right: 12px');
      // Included in the track's own width, or the padding pushes the last
      // coupon out of reach instead of sitting inside the scroll extent.
      expect(rule).toContain('box-sizing: border-box');
    });

    it('snaps a coupon to where the first one rests, not under the inset', () => {
      const css = MOBILE_CSS;
      const from = css.indexOf('.slider-container.mySwiper_couponSlider {');
      const rule = css.slice(from, css.indexOf('}', from));
      expect(rule).toContain('scroll-padding-left: 12px');
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
      /*
       * Every parameter comes from what the theme passed. A hardcoded
       * slidesPerView or delay here would be this app deciding how Zigly's
       * banner behaves.
       *
       * Asserted against the carousel MODULE, not the whole bundle, and that
       * narrowing is the point rather than a loosening: the bundle is one
       * string, so a rule written against it says "nothing anywhere in this app
       * may name slidesPerView" -- which is not what this test means and not
       * true. ../src/webview/productPage.ts names it deliberately, to pin the
       * product gallery to one photo per swipe, and that is a different widget
       * on a different page. What must stay true is that the BANNER's geometry
       * is still Zigly's, which is exactly what this now checks.
       */
      expect(BANNER_CAROUSEL_SCRIPT).not.toContain('slidesPerView:');
      expect(BANNER_CAROUSEL_SCRIPT).not.toContain('spaceBetween:');
      // ...and it is still what the page actually receives.
      expect(home()).toContain('__ziglyBannerCarousel');
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
    /*
     * The wishlist heart must stay absolutely positioned over the image, so
     * nothing here may write a RULE for the wrapper it arrives in: forcing that
     * wrapper back into the flow, the way the add-to-cart containers above are
     * forced, is what drops the heart into the middle of the card.
     *
     * A rule, not a mention. This used to be a bare `not.toContain`, and it
     * failed the moment the heart's own block quoted the theme's selector in a
     * comment -- so the brace is what makes it a test of the stylesheet rather
     * than of the prose around it.
     */
    expect(script).not.toMatch(/\.wishlist-icon-wrapper[^{;]*\{/);
  });

  /*
   * The heart, read off MOBILE_CSS rather than off the payload: the payload
   * JSON-encodes the stylesheet, so a selector carrying a double quote (every
   * [id^="zigly-x-"] scope here) does not survive a substring match against it.
   */
  describe('the card heart', () => {
    /** The declarations of the one rule whose selector list ends with `sel`. */
    const declarationsFor = (sel: string): string => {
      const at = MOBILE_CSS.indexOf(sel + ' {');
      expect(at).toBeGreaterThan(-1);
      const open = MOBILE_CSS.indexOf('{', at);
      return MOBILE_CSS.slice(open, MOBILE_CSS.indexOf('}', open));
    };

    it('is lifted clear of the full-card product link', () => {
      /*
       * .tag-wrapper is the theme's own z-index:1 and the product-link overlay
       * is this file's own z-index:1, both in one stacking context -- and the
       * overlay is later in tree order, so it painted over the heart and took
       * every tap on it to the product page. A tie is not a stacking rule; the
       * strip needs a z-index that beats the overlay's.
       */
      const strip = declarationsFor(
        '[id^="zigly-x-"] .card-wrapper .tag-wrapper',
      );
      expect(strip).toContain('z-index: 2');
      const overlay = declarationsFor(
        '[id^="zigly-x-"] .card-wrapper .product--below-content .card__heading a::after',
      );
      expect(overlay).toContain('z-index: 1');
    });

    it('states its target and its glyph separately', () => {
      /*
       * The theme sizes the svg at width:100% OF THE CONTROL, so the min-width
       * that made the control thumb-sized stretched the drawing with it -- a
       * 34px glyph flush against the card's border where the site draws a 20px
       * one 14px in. The size of the target and the size of the heart are two
       * decisions and are written as two.
       */
      const target = declarationsFor(
        '.card-wrapper .tag-wrapper .swym-add-to-wishlist',
      );
      expect(target).toContain('width: 40px');
      expect(target).toContain('height: 40px');
      // Out of the theme's flex row, against the strip it is positioned in.
      expect(target).toContain('position: absolute');
      // The strip is transparent to taps; the heart has to take its own back.
      expect(target).toContain('pointer-events: auto');

      const glyph = declarationsFor(
        '.card-wrapper .tag-wrapper .swym-add-to-wishlist svg',
      );
      expect(glyph).toContain('width: 20px');
    });

    it('reaches the product page heart where the heart actually is', () => {
      // It is a child of #main-slider, styled by the theme through
      // .pdp-container. The old rule looked inside .product-form, which the
      // served PDP does not put it in, so it matched nothing at all.
      expect(MOBILE_CSS).not.toContain('.product-form .swym-add-to-wishlist');
      expect(MOBILE_CSS).toContain(
        'body.zigly-product .pdp-container .swym-button.swym-add-to-wishlist',
      );
    });

    it('carries no backtick, which would end the template literal', () => {
      expect(MOBILE_CSS).not.toContain('`');
    });
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

  describe('sort and filter', () => {
    /*
     * WHAT THESE TESTS USED TO SAY. Until 2026-08-23 the app moved SearchTap's
     * own Sort and Filter controls into a bar it pinned inside the page, and
     * this block tested the moving: that the nodes were relocated rather than
     * cloned, that every one of them was collected, that a re-render was
     * chased. All of that is gone with the bar. The controls are native now
     * (../src/components/SortFilterBar and its two sheets) and the injection's
     * job is the other half: hide the site's own chrome, and expose its engine.
     */
    const listing = () =>
      getInjectionForUrl('https://zigly.com/collections/x') as string;

    it('builds no bar inside the page any more', () => {
      // The native bar takes the tab bar's own slot, so there is nothing to pin
      // and nothing to pad the page out from under.
      const script = listing();
      expect(script).not.toContain('zigly-sortfilter-bar');
      expect(script).not.toContain('zigly-has-sortfilter');
      expect(script).not.toContain('padding-bottom: 96px');
    });

    it("hides the site's own sort and filter chrome", () => {
      // Two of everything exists on a listing page from here on -- the site's
      // controls and the app's -- and only one of them may be seen.
      const script = listing();
      for (const selector of [
        'body.zigly-listing initial-search-sort',
        'body.zigly-listing initial-search-filters',
        'body.zigly-listing .st-filter-count-sort-wrap',
        'body.zigly-listing initial-toolbox-bar',
        'body.zigly-listing .sort_h',
        'body.zigly-listing .filter_h',
        'body.zigly-listing .mobilesearch',
        'body.zigly-listing .st-sorting-wrapper',
      ]) {
        expect(script).toContain(selector);
      }
    });

    it('hides them rather than removing them, because it drives them', () => {
      // Every one of those elements is still working: the checkboxes are what a
      // chip tap clicks and the buttons are what a sort tap clicks. Removing
      // them would break the app's own controls and start SearchTap throwing.
      // Asserted against the bridge alone -- the payload as a whole is entitled
      // to remove nodes it owns, and several modules do.
      expect(listing()).toContain('display: none !important');
      expect(FACET_BRIDGE_SCRIPT).not.toContain('.remove()');
      expect(FACET_BRIDGE_SCRIPT).not.toContain('removeChild');
    });

    it('reads the facets the site rendered, and never invents any', () => {
      const script = listing();
      // SearchTap's own markup, read on 2026-08-23.
      expect(script).toContain(".querySelectorAll('.st-widget')");
      expect(script).toContain(".querySelector('.st-widget-title')");
      expect(script).toContain('.st-product-number');
      // No facet name, no facet value and no sort label is authored here.
      expect(script).not.toContain('Price: Low to High');
      expect(script).not.toContain('meta_pet_type');
      expect(script).not.toContain('Royal Canin');
    });

    it('applies a filter by clicking the site’s own checkbox', () => {
      // Not by writing to SearchTap's store and not by rebuilding its query:
      // a click is the path a tap on the website takes, so it gets the same
      // state update, the same request and the same analytics event.
      const script = listing();
      expect(script).toContain("input[type=\"checkbox\"]");
      expect(script).toContain('box.click()');
    });

    it('applies a sort by clicking the site’s own button', () => {
      const script = listing();
      expect(script).toContain(".st-sorting-wrapper button[value]");
      expect(script).toContain('buttons[i].click()');
    });

    it('leaves a value with no count out, which is what drops the slider', () => {
      // SearchTap's price slider and its lone "Include Out Of Stock" toggle are
      // not chips, and the sheet the app draws is chips. Neither carries a
      // count, so neither survives the read -- no list of exclusions to keep.
      const script = listing();
      expect(script).toContain('if (count === null) { continue; }');
    });

    it('asks the site for its facets rather than waiting to be given them', () => {
      // A collection page fetches no facets until something opens Filter, so a
      // sheet opened before that would have nothing in it. The site's own pill
      // is clicked once, out of sight, while the app's cover is still up.
      const script = listing();
      expect(script).toContain(".querySelector('.filter_h')");
      expect(script).toContain('pill.click()');
      // And the drawer that opens is put back down through its own Apply.
      expect(script).toContain(".querySelector('.mobilesearch .apply-btn')");
    });

    it('keeps up with a re-render instead of polling for one', () => {
      // SearchTap replaces these components outright on every filter change,
      // so the counts move under the sheet that is open over them.
      const script = listing();
      expect(script).toContain('new MutationObserver');
      expect(script).toContain('childList: true, subtree: true');
      // Coalesced: one re-render is many records and each would cost a sweep.
      expect(script).toContain('if (pending) { return; }');
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });

    it('covers search results, not just collections', () => {
      // SearchTap draws that grid too, and the app shows the same bar there.
      // Bare /collections is excluded on purpose -- it is the card list, which
      // has no products to sort.
      const script = listing();
      LISTING_PATHS.forEach(path => expect(script).toContain(path));
      expect(LISTING_PATHS).toContain('/collections/');
      expect(LISTING_PATHS).toContain('/search');
    });

    it('asks the same question the app asks, from the same list', () => {
      /*
       * The app decides whether to draw the bar (showsSortFilterBar) and the
       * page decides whether to drive the engine, and a disagreement is either
       * a bar with nothing behind it or an engine nobody can reach. Both are
       * compiled from LISTING_PATHS now, so this checks the compile happened
       * rather than checking two hand-written copies still match.
       */
      const script = listing();
      expect(script).toContain('function ziglyIsListing()');
      expect(script).toContain(JSON.stringify(LISTING_PATHS));
      // And the market prefix is stripped, as the app strips it: a Shopify
      // market added in the admin would otherwise silently retire the bar.
      expect(script).toContain('function ziglyListingPath()');
      expect(script).toContain("first.charAt(2) === '-'");
    });

    it('does nothing at all off a listing page', () => {
      // The bridge tests the path itself, so a product page carries it inert
      // rather than carrying a different payload.
      const script = getInjectionForUrl(
        'https://zigly.com/products/x',
      ) as string;
      expect(script).toContain('if (!ziglyIsListing()) { return; }');
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
      expect(script).toContain('function ziglyIsListing()');
      expect(script).toContain('if (ziglyIsListing()) { flag(LISTING_FLAG); }');
      // Nothing keys the card rules on a product path.
      expect(script).not.toContain("indexOf('/products/') === 0");
    });

    describe('the flag the card fixes hang on', () => {
      /*
       * Run the real script against a page, and report whether it flagged it.
       *
       * The tests around this one read the script as text, which is enough to
       * prove a rule is scoped but cannot prove the scope is ever *set*
       * correctly -- the bug below lived under a passing text assertion for
       * exactly that reason. Enough of a DOM for what the script touches,
       * built by hand: this project's jest environment is node, and the
       * pattern is __tests__/breedPage.test.ts's.
       */
      const flagsOn = (pathname: string): string => {
        const body = {className: 'template-collection'};
        // eslint-disable-next-line no-new-func
        const run = new Function('window', 'document', LISTING_PAGE_SCRIPT);
        run({location: {pathname}}, {body});
        return body.className;
      };
      const flagged = (pathname: string): boolean =>
        flagsOn(pathname).indexOf(LISTING_FLAG) !== -1;
      const productFlagged = (pathname: string): boolean =>
        flagsOn(pathname).indexOf(PRODUCT_FLAG) !== -1;

      it('is set on the listings the card fixes are written for', () => {
        expect(flagged('/collections/dog-toys')).toBe(true);
        expect(flagged('/collections/dog-food/grain-free')).toBe(true);
        expect(flagged('/search')).toBe(true);
        // And behind a Shopify market prefix, which would otherwise retire the
        // card fixes silently on the day one is added in the admin.
        expect(flagged('/en-in/collections/dog-toys')).toBe(true);
      });

      it('is not set on a product opened from a collection', () => {
        /*
         * The bug this test exists for. Every card in a Zigly grid links to
         * /collections/{collection}/products/{handle}, so the ordinary way into
         * a product page starts with '/collections/' -- and the flag landed on
         * the one page the file above says it must never reach. There,
         * .mobile-atc-main IS the sticky Add to Bag bar, and the card fix
         * forces position:relative on it: the bar stopped floating and went
         * into the flow of the page.
         *
         * The bare form has always been unflagged; these are the same page.
         */
        expect(flagged('/collections/dog-toys/products/a-dog-bed')).toBe(false);
        expect(flagged('/products/a-dog-bed')).toBe(false);
        expect(flagged('/en-in/collections/dog-toys/products/a-dog-bed')).toBe(
          false,
        );
      });

      it('leaves the classes the page already carries alone', () => {
        // The flag is appended to <body>'s className, never assigned over it:
        // the theme keys its own layout off template-collection.
        const body = {className: 'template-collection gradient'};
        // eslint-disable-next-line no-new-func
        const run = new Function('window', 'document', LISTING_PAGE_SCRIPT);
        run({location: {pathname: '/collections/dog-toys'}}, {body});
        expect(body.className).toContain('template-collection gradient');
        expect(body.className).toContain(LISTING_FLAG);
      });

      it('marks a product page, by either route to it', () => {
        // The counterpart flag. Both ways in are the same page, so both carry
        // it -- and neither carries the listing flag.
        for (const path of [
          '/products/a-dog-bed',
          '/collections/dog-toys/products/a-dog-bed',
          '/en-in/collections/dog-toys/products/a-dog-bed',
        ]) {
          expect(productFlagged(path)).toBe(true);
          expect(flagged(path)).toBe(false);
        }
      });

      it('marks nothing a product that is not one', () => {
        expect(productFlagged('/collections/dog-toys')).toBe(false);
        expect(productFlagged('/search')).toBe(false);
        expect(productFlagged('/pages/dog')).toBe(false);
        expect(productFlagged('/')).toBe(false);
      });
    });

    describe('the second Add to Bag', () => {
      /*
       * The PDP draws the control twice: once in the flow under the quantity
       * stepper (.product__buy-buttons-container), and once in a bar pinned to
       * the foot of the screen (.sticky-bar-container) that also carries Buy
       * Now. Read off the served page on 2026-08-24. The pinned one is hidden.
       */
      const productPage = () =>
        getInjectionForUrl(
          'https://zigly.com/collections/dog-toys/products/bionic-bone-small-dog-chew-toy',
        ) as string;

      it('hides the pinned bar on a product page', () => {
        expect(productPage()).toContain(
          `body.${PRODUCT_FLAG} .sticky-bar-container`,
        );
      });

      it('hides the in-flow Add to Bag button, but not its container', () => {
        /*
         * The native ProductActionBar (see ../src/components/ProductActionBar
         * and ../src/webview/productActions) now presses this same button
         * from outside the page, so the button itself is hidden -- but the
         * container is not: the theme's own validation message for the form
         * (no size chosen, out of stock) is a sibling of the button inside
         * it, and hiding the container would take that message with it.
         * Matched with the opening brace so the prose above the rule does
         * not count.
         */
        const script = productPage();
        expect(script).not.toContain('.product__buy-buttons-container {');
        expect(script).not.toContain('product-form {');
        expect(script).toContain(
          `body.${PRODUCT_FLAG} .product__buy-buttons-container .product-form__submit {`,
        );
      });

      it('never hides a sticky bar off a product page', () => {
        /*
         * Unscoped, this would reach any page the theme pins a bar to. Every
         * rule for it carries the product flag -- counted rather than sampled,
         * because one unscoped copy added later is the whole of the bug.
         */
        const script = productPage();
        const count = (needle: string): number =>
          script.split(needle).length - 1;
        expect(count('.sticky-bar-container {')).toBe(1);
        expect(count(`body.${PRODUCT_FLAG} .sticky-bar-container {`)).toBe(1);
      });
    });

    it('makes SearchTap’s own grid read as the grid it replaces', () => {
      /*
       * A filter or a sort makes SearchTap empty .searchtap-temp and render the
       * results itself, so the customer gets a different card component for the
       * same products. These are the parts it draws differently.
       */
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      // A bordered, rounded, padded white card, against a theme card with no
      // edge of its own.
      expect(script).toContain('body.zigly-listing .st-product {');
      // The rating, out of its floating chip and back under the image.
      expect(script).toContain('body.zigly-listing .st-review');
      // Price above a full-width Add to Bag, rather than the two side by side.
      expect(script).toContain('body.zigly-listing .st-product-price');
      expect(script).toContain('flex-direction: column-reverse !important');
      // The red pill the button floats in, unfilled so the theme's own button
      // shows through it.
      expect(script).toContain('body.zigly-listing .atc-wrapper.st-atc');
    });

    it('leaves alone what the two cards already share', () => {
      /*
       * The theme's card renders product--brand--wrapper -- the same brand and
       * the same veg/non-veg mark SearchTap's does -- and its title is fw-700,
       * as SearchTap's is. Restyling either would be this block introducing the
       * difference it exists to remove, which is what the first draft did.
       */
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).not.toContain('.st-brand-wrapper');
      expect(script).not.toContain('.st-product-name');
    });

    it('does not reach a product page, where the same card also appears', () => {
      /*
       * SearchTap's autocomplete draws this card on every page, so an unscoped
       * rule would restyle a search suggestion on a product page. Every one of
       * them is behind the listing flag, which listingPage.ts sets on listing
       * paths only.
       */
      const script = getInjectionForUrl(
        'https://zigly.com/products/x',
      ) as string;
      for (const selector of [
        '.st-product {',
        '.st-review {',
        '.st-product-price {',
        '.st-swatches {',
      ]) {
        expect(script).toContain(`body.zigly-listing ${selector}`);
        // The same selector starting a line of its own would be unscoped. A
        // newline in front is what proves it is not.
        expect(script).not.toContain(`\n${selector}`);
      }
    });

    it('flags the page whether or not the bar ever appears', () => {
      // The card fixes are needed even if SearchTap never renders its controls.
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      expect(script).toContain('flagPage()');
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

    /**
     * The dashboard tail, in the order the customer asked for on 2026-08-24.
     *
     * Every needle is the section's DECLARATION in the SECTIONS chain, not its
     * bare id -- the stylesheet names several of those ids too, earlier in the
     * payload, so a bare indexOf would measure the CSS instead of the running
     * order. Declaration order in that chain is the render order: the
     * placeholders are created synchronously in a single pass before any fetch
     * resolves, so no section can be shuffled by the network.
     *
     * The headings beside each entry were read off the live sections on
     * 2026-08-24, so this list is checkable against the site rather than being
     * a restatement of the code it guards.
     */
    const TAIL = [
      ['"mark":"zigly-x-offer1"', 'Applod Food'],
      ['"mark":"zigly-x-offer2"', 'Applod Treats'],
      ['"mark":"zigly-x-coins"', 'Zigly Coins + discount cards'],
      ['"move":"home_shop_by_brand_section"', 'Top Pet Brands, One Spot!'],
      ['"mark":"zigly-x-price"', 'Find the Best Deals! (2x3 grid)'],
      ['"mark":"zigly-x-banner2"', 'Advanced Vet Care banner'],
      ['"mark":"zigly-x-concern"', 'Care by Concern'],
      ['"mark":"zigly-x-offer3"', 'Zigly Style Steals'],
      ['"slot":"zigly-x-bestsellers"', 'Bestsellers'],
      ['"slot":"zigly-x-everything"', 'Everything For Dogs / Cats'],
      ['"mark":"zigly-x-double"', "Let's Paw-ty! + Too Many Cute Options?"],
      ['"move":"helpful_tips"', 'Pet Parenting Made Easy'],
      ['"move":"custom_video_text_banner"', 'the YouTube video'],
      ['"move":"about_our_communities"', 'Real Pets. Real Stories. Real Community.'],
      ['"slot":"zigly-x-instagram"', 'From Our Instagram'],
      ['"mark":"zigly-x-logos"', 'the brand-claims strip'],
    ] as const;

    it('declares the whole tail in the requested order', () => {
      const s = home();
      const at = TAIL.map(([needle, label]) => {
        const i = s.indexOf(needle);
        expect(i).toBeGreaterThan(-1);
        return {i, label};
      });
      // Compared as a list of labels rather than pair by pair, so a failure
      // prints the order that was declared against the order asked for --
      // an index pair on its own does not say which two sections swapped.
      const declared = at.slice().sort((a, b) => a.i - b.i).map(e => e.label);
      expect(declared).toEqual(at.map(e => e.label));
    });

    it('opens the tail below Explore, with the coupon strip left under the banner', () => {
      // The coupon strip is the one entry anchored to the banner rather than to
      // the running tail, so it stays in the head of the dashboard (section f)
      // even though it is declared first in this chain.
      const s = home();
      expect(s).toContain("spec.key === 'coupon_slider' ? banner : tail");
      // Explore is what the tail hangs off; if that anchor ever goes, every
      // section below falls back to sitting under the banner.
      expect(s).toContain("document.getElementById('zigly-explore')");
    });

    it('lays Shop by price out as a grid rather than a scrolling rail', () => {
      // Six tiles, so there is nothing off-screen for a rail to reveal.
      const s = home();
      expect(s).toContain('#zigly-x-price .swiper-wrapper');
      expect(s).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
      // The generic transplant rule turns .swiper-wrapper into a horizontal
      // scroller; this section has to opt out of it.
      expect(s).toContain('scroll-snap-type: none');
    });

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

  it('reserves Bestsellers as a slot, and does not fill it from best_deals', () => {
    // Section names do not match their content here. best_deals holds the
    // Zigly Coins banner and offer cards, and the homepage's arrival sections
    // are "Best Deals" and "Trending Products" -- none of them is this rail.
    // The rail is built by bestsellers.ts from sort_by=best-selling, so this
    // entry reserves the position and nothing else.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('"slot":"zigly-x-bestsellers"');
    // The pet page's "Pet Parent Favourites" rail used to stand in here.
    expect(script).not.toContain('"key":"collection_product_section"');
    // best_deals is still used, but for Coins -- a different slot entirely.
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
      expect(s).toContain(
        "'initial-search-sort, initial-search-filters, .card-wrapper'",
      );
    });

    it('never reports an inner page ready while it is still unstyled', () => {
      // The deadline is a promise that nobody waits for ever, not permission to
      // show the mobile website: an unstyled page IS the mobile website. That
      // case is left to the app's own cap instead.
      const s = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(s).toContain('function styled()');
      expect(s).toContain('(tries > cap && styled())');
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
