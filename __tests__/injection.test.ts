/**
 * Injection guard tests.
 *
 * The critical property is negative: nothing is ever injected into a checkout
 * or payment page. A stray rule there could hide a payment control.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {EARLY_HEADER_CSS} from '../src/webview/headerBridge';

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
      const script = getInjectionForUrl('https://zigly.com/') as string;
      const couponBlock = script.slice(script.indexOf('coupon_slider'));
      expect(couponBlock).not.toContain("warn('coupon");
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
    });
  });

  describe('hot picks section', () => {
    const home = () => getInjectionForUrl('https://zigly.com/') as string;

    it('sources products from real Zigly sections, not hardcoded data', () => {
      const s = home();
      // Sections resolve by id from '/', with @dog / @cat selecting which
      // page template's copy to request.
      expect(s).toContain('home_arrival_section@dog');
      expect(s).toContain('home_arrival_section@cat');
      expect(s).toContain('/collections/new-arrivals');
      // No product titles, prices or handles baked in.
      expect(s).not.toMatch(/₹\s?\d/);
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

  it('verifies a combined collection exists before linking to it', () => {
    // Several combined handles that follow the obvious naming pattern are
    // 404s, so each candidate is checked with a HEAD request; a category
    // without one keeps its two working species tiles rather than gaining a
    // single dead one.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain("method: 'HEAD'");
    expect(script).toContain('handleFor');
    // Handles are derived from the visible label, never written here.
    expect(script).not.toContain('/collections/dry-food');
    expect(script).not.toContain('/collections/wet-food');
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
      expect(script).toContain('bar.appendChild(parts[i])');
      expect(script).toContain('initial-search-sort');
      expect(script).not.toContain('cloneNode');
    });

    it('is not injected into checkout', () => {
      expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
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
    // The one exception is /account, a documented Zigly route that already
    // handles both signed-in and signed-out.
    expect(script).toContain("'/account'");
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

  it('shows four combined categories per explore tab', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('MAX_TILES = 4');
    // Categories without a combined collection fall back to Zigly's own
    // search, which returns both pets, rather than a dog-only collection.
    expect(script).toContain("'/search?q=' + encodeURIComponent(label)");
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
  });

  it('relocates sections the homepage already has rather than copying them', () => {
    // Top Pets Brands, Pet Parenting and Real Pets are already on the page.
    // Transplanting copies would show each of them twice.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    for (const frag of [
      'home_shop_by_brand_section',
      'helpful_tips',
      'about_our_communities',
      'home_arrival_section',
      'custom_video_text_banner',
    ]) {
      expect(script).toContain(`"move":"${frag}"`);
      expect(script).not.toContain(`"key":"${frag}"`);
    }
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

  it('uses the arrival section for Bestsellers, not best_deals', () => {
    // Section names do not match their content here: best_deals holds the
    // Zigly Coins banner and offer cards, while the products the reference
    // shows under "Bestsellers" live in the homepage's arrival section.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('"move":"home_arrival_section"');
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

  it('places the logos strip last, above the footer', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    const logos = script.indexOf('zigly-x-logos');
    const communities = script.indexOf('about_our_communities');
    expect(logos).toBeGreaterThan(-1);
    // Declared after Real Pets, so it lands directly above the footer.
    expect(logos).toBeGreaterThan(communities);
  });

  it('takes Bestsellers from the arrival section that has those products', () => {
    // The homepage has two: "Best Deals" first, "Trending Products" second.
    // The reference's products are in the second.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('"index":1');
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

    it('reports immediately on pages with nothing to assemble', () => {
      // Inner pages must not sit behind the splash waiting for a dashboard.
      const s = getInjectionForUrl('https://zigly.com/collections/x') as string;
      expect(s).toContain('if (!isHome()) { send(); return; }');
    });

    it('reports even if a section never arrives', () => {
      // A missing section must delay the splash, never trap the user.
      expect(getInjectionForUrl('https://zigly.com/')).toContain('tries > 40');
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
    expect(at('"move":"about_our_communities"')).toBeLessThan(at('zigly-x-logos'));
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

  it('constrains the footer wave so it cannot stretch', () => {
    // A 2000px desktop image opens the footer; unconstrained it scaled with
    // the page and read as the footer stretching.
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('wave-image-wrapper');
    expect(script).toContain('object-fit: cover');
  });

  it('shows the footer on the dashboard only', () => {
    const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
    expect(script).toContain('zigly-inner-page');
    // Marked from the live path, so it is right on every navigation rather
    // than baked in per injected copy.
    expect(script).toContain('window.location.pathname');
  });

  it('moves the toolbox wrapper, where the visible pills actually live', () => {
    // initial-search-* ship empty; SearchTap renders the pills into
    // .st-filter-count-sort-wrap, which an earlier version left at the top.
    const script = getInjectionForUrl('https://zigly.com/collections/x') as string;
    expect(script).toContain('st-filter-count-sort-wrap');
  });
});
