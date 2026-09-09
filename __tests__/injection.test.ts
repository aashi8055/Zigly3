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
import {CARD_SURFACES, PRODUCT_CARD_CSS} from '../src/webview/productCard';

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

    /**
     * One rule: nothing the bridge drives is ever display:none.
     *
     * Not because display:none breaks a click -- it does not, `.click()`
     * dispatches straight at the node and never hit-tests, and `.st-sidebar`
     * is hidden by the theme's own CSS while the bridge reads the checkboxes
     * inside it. The rule exists because these elements ARE the engine, and
     * the one property that would break them the moment anything needed layout
     * is the wrong tool for hiding them. Off-screen keeps them laid out.
     *
     * This is a whole-payload check on purpose: productCard.test.ts asserts the
     * same thing about PRODUCT_CARD_CSS alone, which stayed green while this
     * file's own hand-written block hid five of those selectors.
     */
    it('never display:nones a control the bridge reads or clicks', () => {
      const script = listing();
      for (const driven of [
        '.st-sorting-wrapper',
        '.st-overlay-active',
        '.filter_h',
        '.sort_h',
      ]) {
        // The rule that names it, up to the end of its declaration block.
        const at = script.indexOf('body.zigly-listing ' + driven);
        expect(at).toBeGreaterThan(-1);
        const block = script.slice(at, script.indexOf('}', at));
        expect(block).not.toContain('display: none');
      }
      // And the dimming layer, which is position:fixed and so escapes an
      // off-screen parent, must still be taken out.
      expect(script).toContain('.st-overlay-active::before');
    });

    /**
     * No backtick in the STYLESHEET.
     *
     * MOBILE_CSS is itself a template literal, and it is then embedded in the
     * injected script as a second one -- so a backtick anywhere in it, even
     * inside a CSS comment, closes a literal early and silently drops
     * everything after it. That is not hypothetical: writing `.click()` in one
     * of the comments in this very block took twenty test suites down at load
     * time, and the unlucky version of the same mistake ships a payload that is
     * valid JavaScript carrying half a stylesheet.
     *
     * Scoped to the CSS rather than the whole payload, because the JavaScript
     * modules legitimately contain backticks inside comments in code that has
     * already been interpolated and so never re-enters a literal.
     */
    it('carries no backtick in the css, which would close its literal', () => {
      expect(MOBILE_CSS.indexOf(String.fromCharCode(96))).toBe(-1);
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
      /*
       * A collection page fetches no facets until something opens Filter, so a
       * sheet opened before that would have nothing in it. The request is made
       * out of sight, while the app's cover is still up.
       *
       * THIS TEST USED TO ASSERT THE BUG. It required
       * `querySelector('.filter_h')` and `pill.click()` -- one pill, clicked
       * once. Both halves were wrong, and the app shipped with an empty filter
       * sheet on every listing page because of them:
       *
       *   ONE PILL. There are TWO .filter_h pills in SearchTap's bundle. One
       *   is `onClick: isFilterOpen = true`, which opens the drawer and never
       *   fetches; the other is `openFilter()`, which calls setMobileFilter(true)
       *   and is the one that does. They cannot be told apart from the DOM, and
       *   querySelector takes whichever is first -- on a collection page, the
       *   drawer-only one. So every candidate is clicked now; clicking the
       *   harmless one costs nothing, because closeSite() puts the drawer back
       *   down.
       *
       *   ONCE. SearchTap is a deferred script, so a click dispatched before
       *   <initial-toolbox-bar> has hydrated is silently lost -- and the latch
       *   was set on the attempt rather than on facets arriving, so there was
       *   no second try for the life of the page. It retries until the facets
       *   are actually there, bounded so a page that will never produce any is
       *   not clicked at for ever.
       */
      const script = listing();
      // Every candidate pill, not just the first.
      expect(script).toContain(
        ".querySelectorAll(\n      '.filter_h, .mobile-toggle-filter, .st-filter-btn'\n    )",
      );
      // And the store, which is the state change the real pill makes.
      expect(script).toContain('store.setMobileFilter(true)');
      // Retried until the facets arrive, rather than latched on one attempt.
      expect(script).toContain('function warmDone()');
      expect(script).toContain('.st-widget .st-widget-title');
      expect(script).toContain('warmClicks >= WARM_TRIES');
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
       *
       * Matched on the selector rather than on one scope's spelling of it: the
       * rules are generated across every surface now (src/webview/productCard.ts),
       * so `body.zigly-listing` heads a four-line selector list rather than
       * always sitting immediately before the brace.
       */
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      // A bordered, rounded, padded white card, against a theme card with no
      // edge of its own.
      expect(script).toContain('body.zigly-listing .st-product,');
      // The rating, out of its floating chip and back under the image.
      expect(script).toContain('body.zigly-listing .st-review');
      // Price above a full-width Add to Bag, rather than the two side by side.
      expect(script).toContain('body.zigly-listing .st-product-price');
      expect(script).toContain('flex-direction: column-reverse !important');
      // The red pill the button floats in, unfilled so the theme's own button
      // shows through it.
      expect(script).toContain('body.zigly-listing .atc-wrapper.st-atc');
    });

    it('trims SearchTap’s card wherever it trims the theme’s', () => {
      /*
       * This test used to assert the OPPOSITE -- that .st-brand-wrapper and
       * .st-product-name were never named -- and the reasoning was sound when
       * it was written: both cards rendered the brand line, so restyling one
       * of them would have INTRODUCED the difference the block exists to
       * remove.
       *
       * That premise expired. The card trim added later hides
       * .product--brand--wrapper on the theme's card, and the two cards stopped
       * sharing the row. The old assertion then held the inconsistency in
       * place: the brand line was hidden before a sort and back the moment one
       * was applied, on the same products, because SearchTap's card was the one
       * surface the trim was forbidden to reach.
       *
       * The rule the two versions actually share is "the cards must match".
       * What changed is which card is the reference. See src/webview/productCard.ts.
       */
      const script = getInjectionForUrl(
        'https://zigly.com/collections/x',
      ) as string;
      // The brand row comes off both cards, or off neither.
      expect(script).toContain('.product--brand--wrapper');
      expect(script).toContain('.st-brand-wrapper');
      /*
       * The title's fixed 38px is released so a one-line title can shorten the
       * card. That is a height, not a restyle -- the weight, size and colour of
       * the title text are still SearchTap's, which is what the original note
       * was right to protect. Asserted on the card block itself rather than on
       * the whole payload, which carries font-weight for plenty of things that
       * are not this card.
       */
      expect(PRODUCT_CARD_CSS).toContain('.st-product-name');
      expect(PRODUCT_CARD_CSS).toContain('height: auto !important');
      expect(PRODUCT_CARD_CSS).not.toContain('font-weight');
      expect(PRODUCT_CARD_CSS).not.toContain('font-size');
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
        '.st-product',
        '.st-review',
        '.st-product-price',
        '.st-swatches',
      ]) {
        // Present, and never on a line of its own: every occurrence carries one
        // of the surface scopes in front of it. A selector starting a line
        // would be unscoped, and would restyle SearchTap's autocomplete card
        // here on the product page.
        expect(script).toContain(selector);
        expect(script).not.toContain(`\n${selector} {`);
        expect(script).not.toContain(`\n${selector},`);
      }
      /*
       * And every rule in the card block is scoped by one of them. The listing
       * flag is set on listing paths only; the other three name sections this
       * app builds on the dashboard, none of which exists on a product page.
       */
      for (const line of PRODUCT_CARD_CSS.split('\n')) {
        const head = line.trim();
        if (!head.endsWith(',') && !head.endsWith('{')) {
          continue;
        }
        if (head.startsWith('/*') || head.startsWith('*')) {
          continue;
        }
        expect(
          CARD_SURFACES.some(scope => head.startsWith(scope)),
        ).toBe(true);
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
