/**
 * Transplant the rest of the dashboard onto the homepage.
 *
 * Zigly removed these sections from their homepage template, but the sections
 * themselves are still live in the theme and render by id from any page. Their
 * app still shows them, so this restores the dashboard from the reference
 * video, section for section, using Zigly's own rendered markup.
 *
 * Order follows the reference. Placeholders are created synchronously in that
 * order before any fetch resolves, so the network cannot shuffle them.
 *
 * Every entry self-disables if the site is already rendering that section --
 * so if Zigly restores their homepage, these quietly stop doing anything and
 * the page loads in a single request again, with no code change.
 *
 * Re-entrant by requirement, not by accident: the payload is injected once on
 * load and then six more times on a timer. See the note on the loop for what
 * that demands of every branch in it.
 */

/**
 * The dashboard, in the order the reference recording shows it.
 *
 * `key` is what to fetch (numbered where a fragment repeats on the source
 * page); `check` is the fragment used to detect that the site is already
 * rendering that section, in which case the entry does nothing.
 *
 * Only the coupon strip loads eagerly -- everything else waits until it nears
 * the viewport, so first paint stays cheap.
 */
const SECTIONS = [
  {key: 'coupon_slider', check: 'coupon_slider', mark: 'zigly-x-coupon', eager: true},
  // breed rails, hot picks and explore are placed by their own modules here
  // "Applod Food" -- the fresh-food rail.
  {key: 'offer_section#1', check: '', mark: 'zigly-x-offer1', eager: false},
  // "Applod Treats" -- biscuits, chews and toys.
  {key: 'offer_section#2', check: '', mark: 'zigly-x-offer2', eager: false},
  // Zigly Coins plus the discount offer cards. Despite the name, best_deals
  // is not a product section -- it holds the coins banner and the category
  // offer tiles, which is exactly this slot in the reference.
  {key: 'best_deals', check: '', mark: 'zigly-x-coins', eager: false},
  // "Top Pet Brands, One Spot!" -- already on the homepage; move it, do not
  // copy it.
  {move: 'home_shop_by_brand_section'},
  // "Find the Best Deals!" -- the six price tiles. Laid out as a 2x3 grid
  // rather than a rail; see the #zigly-x-price rules in ./injectedStyles.
  {key: 'shop_by_price', check: 'shop_by_price', mark: 'zigly-x-price', eager: false},
  /**
   * The Vet Care banner ("Advanced Vet Care, Anytime You Need It!").
   *
   * Directly under the price tiles, which is where it sits on Zigly's own pet
   * pages and where it has sat here since it was transplanted. It is the one
   * block in this chain that is a standing placement rather than a match to a
   * named section in the dashboard order -- recorded so it does not read as a
   * stray and get tidied away.
   */
  {key: 'custom_single_banner#2', check: '', mark: 'zigly-x-banner2', eager: false},
  // "Care by Concern".
  {key: 'shop_of_concern', check: 'shop_of_concern', mark: 'zigly-x-concern', eager: false},
  // "Zigly Style Steals".
  {key: 'offer_section#3', check: '', mark: 'zigly-x-offer3', eager: false},
  /**
   * The bestsellers rail.
   *
   * Slot only: bestsellers.ts fills it. Reserved here so the position is
   * decided by declaration order like every other entry, and no fetch
   * resolving early or late can move it.
   *
   * Two earlier occupants, recorded so neither gets tried again:
   *
   * 1. The homepage's second arrival section, relocated here on the belief that
   *    it held these products. It does not -- read 2026-08-22, the homepage's
   *    two arrival sections are "Best Deals" (4 cards) and "Trending Products"
   *    (3 cards), and neither is the rail in this position in the reference.
   *
   * 2. The pet page's `collection_product_section`, transplanted whole. By
   *    position and by content that is the right rail -- ten real product cards,
   *    sitting exactly here on /pages/dog -- and it was kept under Zigly's own
   *    heading, "Pet Parent Favourites", on the grounds that calling somebody
   *    else's curated rail "Bestsellers" would be this app making a sales claim
   *    on their behalf. That reasoning was sound for a relabelled rail.
   *
   * It is now a real bestseller list rather than a relabelled one: the products
   * come from Zigly's own `sort_by=best-selling`, so the heading describes the
   * store's ordering instead of adding a claim to it. See bestsellers.ts, which
   * carries the source, the measurements and the fallback.
   */
  {slot: 'zigly-x-bestsellers'},
  // Neither of the homepage's own arrival sections appears in the reference
  // dashboard: the picks rail is built from the pet pages by hotPicks.ts. They
  // used to be suppressed as a side effect of relocating one of them, so with
  // that relocation gone they are marked for hiding explicitly.
  {hide: 'home_arrival_section'},
  // Slot only: everythingSection.ts fills this. Reserving it here keeps the
  // order deterministic -- anchoring itself put it above Bestsellers.
  {slot: 'zigly-x-everything'},
  /**
   * The double banner: "Let's Paw-ty!" and "Too Many Cute Options?".
   *
   * One section, two cards. Its own stylesheet drops both to width:100% below
   * 749px, so on a phone they stack and read as two blocks in this order --
   * which is how they appear in the dashboard order, one after the other.
   */
  {key: 'redesign_custom_double_banner', check: 'redesign_custom_double_banner', mark: 'zigly-x-double', eager: false},
  // "Pet Parenting Made Easy" -- the article cards.
  {move: 'helpful_tips'},
  // The video. video_swiper renders "Shop from Feed", which the reference does
  // not show; the video section is custom_video_text_banner, already on the
  // homepage, so it is moved rather than transplanted.
  {move: 'custom_video_text_banner'},
  // "Real Pets. Real Stories. Real Community."
  {move: 'about_our_communities'},
  /**
   * The photo grid that closes the dashboard.
   *
   * The reference app heads this "From Our Instagram", and until now that could
   * not be built: no section on zigly.com is called that and none pulls a feed,
   * so the theme's own six-photo grid -- `gallery` on
   * /pages/store-home-page-section, headed "Happy Moments" -- stood in for it.
   * That was the honest choice while the only alternative was retitling Zigly's
   * store photography as a feed the customer could go and follow.
   *
   * It is now the real thing. instagramSection.ts draws Zigly's actual recent
   * posts, read live from their own account, so the heading says what the cards
   * are and the stand-in is no longer needed. The grid is dropped rather than
   * kept above it: two photo grids back to back is what the reference does not
   * show, and this is the slot the reference puts Instagram in.
   *
   * Slot only, like Everything For: the position is fixed here and the filling
   * happens in instagramSection.ts, which carries the posts itself. An unfilled
   * slot has no height, so if that section ever declines to draw -- every cover
   * failing to load is the way it can -- the dashboard simply ends one block
   * earlier and the icons strip below does not move.
   */
  {slot: 'zigly-x-instagram'},
  // The brand-claims strip (1680X324_BrandClaims) -- the logos. Last, so it
  // sits directly above the footer as the reference shows.
  {key: 'custom_single_banner#3', check: '', mark: 'zigly-x-logos', eager: false},
];

export const EXTRA_SECTIONS_SCRIPT = `
(function () {
  var SECTIONS = ${JSON.stringify(SECTIONS)};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  function isHome() {
    var p = window.location.pathname;
    while (p.length > 1 && p.charAt(p.length - 1) === '/') { p = p.slice(0, -1); }
    return p === '' || p === '/' || p === '/index';
  }

  if (!isHome()) { return; }

  function whenNear(el, run) {
    if (!window.IntersectionObserver) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); run(); return; }
      }
    }, {rootMargin: '700px 0px'});
    io.observe(el);
  }

  /**
   * The coupon strip belongs directly under the banner; everything else goes
   * after the last block we have already placed, keeping the reference order.
   */
  var banner = document.querySelector('[id*="homepage_banner"]');
  if (!banner || !banner.parentNode) { warn('no anchor for extra sections'); return; }

  var tail = document.getElementById('zigly-explore')
          || document.getElementById('zigly-hot-picks')
          || document.getElementById('zigly-breed-cats')
          || banner;

  /*
   * This loop runs SEVEN times per page load, and every pass has to end with
   * the page in the same shape.
   *
   * ../screens/ZiglyWebViewScreen re-injects the whole payload on
   * RESTYLE_DELAYS -- [0, 500, 1500, 3000, 6000, 10000]ms -- because the page
   * keeps pulling in third-party scripts long after onLoadEnd and a single pass
   * loses to whichever of them restyles the header last. That is the right call
   * for a stylesheet. It is only safe for this loop because of what follows.
   *
   * The rule: an entry that finds its work already done must carry tail
   * past it, never just return. A bare return leaves tail behind at
   * zigly-explore while the loop keeps walking, and the move entries -- the
   * only ones with no placeholder of their own to find -- then re-insert
   * themselves after it. That put Top Pets Brands, Pet Parenting, the video and
   * Real Pets directly under Explore on the second pass, ahead of the eleven
   * sections declared before them, and it held there for every pass after.
   *
   * The order was right on the first pass and wrong from the second, which is
   * why reading this file, or running it once, does not show it.
   */
  for (var i = 0; i < SECTIONS.length; i++) {
    (function (spec) {
      // Sections the homepage already carries are relocated into the reference
      // order rather than transplanted, so they never appear twice.
      if (spec.move) {
        var matches = document.querySelectorAll('[id*="' + spec.move + '"]');
        // Some fragments match more than one section; index picks which.
        var wanted = spec.index || 0;
        var existing = matches.length > wanted ? matches[wanted] : matches[0];
        if (existing && existing.parentNode && tail.parentNode) {
          tail.parentNode.insertBefore(existing, tail.nextSibling);
          tail = existing;

          // The homepage carries another arrival section the reference does
          // not show; mark the spares so CSS can hide them.
          if (spec.hideOthers) {
            for (var m = 0; m < matches.length; m++) {
              if (matches[m] !== existing) {
                matches[m].setAttribute('data-zigly-extra', 'true');
              }
            }
          }
        } else if (!existing) {
          warn('cannot reorder, not on page: ' + spec.move);
        }
        return;
      }

      /**
       * Sections the homepage renders that the reference dashboard does not
       * show. Marked, never removed: the theme's own scripts look these up on
       * navigation, and an element a script cannot find is how a script starts
       * throwing on every page. The CSS hides anything carrying the mark.
       */
      if (spec.hide) {
        var spares = document.querySelectorAll('[id*="' + spec.hide + '"]');
        for (var sp = 0; sp < spares.length; sp++) {
          spares[sp].setAttribute('data-zigly-extra', 'true');
        }
        return;
      }

      // A reserved slot: create the container and move on. Another module
      // fills it, but its position in the order is fixed here.
      if (spec.slot) {
        var standing = document.getElementById(spec.slot);
        // Already reserved, so this is a re-run: carry the tail past it. See
        // the note on the loop -- returning from under the tail here is what
        // let the moved sections climb the page.
        if (standing) { tail = standing; return; }
        var reserved = document.createElement('div');
        reserved.id = spec.slot;
        if (tail.parentNode) {
          tail.parentNode.insertBefore(reserved, tail.nextSibling);
          tail = reserved;
        }
        return;
      }

      /*
       * Already placed, so this is a re-run: carry the tail past it.
       *
       * This check stays FIRST, ahead of spec.check, and that ordering is load
       * bearing. Several of these sections carry their own fragment as their
       * check -- shop_by_price checks for 'shop_by_price' -- and once the
       * transplant has landed, that fragment is on the page: inside our own
       * slot. Reaching spec.check on a re-run would find our own work and read
       * it as Zigly having restored the section.
       */
      var done = document.getElementById(spec.mark);
      if (done) {
        if (spec.key !== 'coupon_slider') { tail = done; }
        return;
      }

      // Already on the page: nothing to do, and never duplicate it. Banners and
      // offer sections repeat, so those carry no check and are always placed.
      if (spec.check && document.querySelector('[id*="' + spec.check + '"]')) { return; }

      var slot = document.createElement('div');
      slot.id = spec.mark;

      var after = spec.key === 'coupon_slider' ? banner : tail;
      after.parentNode.insertBefore(slot, after.nextSibling);
      if (spec.key !== 'coupon_slider') { tail = slot; }

      function load() {
        // Every section resolves from '/', so they all share one batched
        // request. \`path\` is kept for the section that does not: the photo
        // gallery had to ask its own page, and dropping the mechanism along
        // with that entry would mean rebuilding it for the next such section.
        window.__ziglyFetchSection(spec.path || '/', spec.key)
          .then(function (sec) {
            if (!sec) { warn('unavailable: ' + spec.key); return; }
            var imported = document.importNode(sec, true);

            var scripts = imported.querySelectorAll('script');
            for (var k = 0; k < scripts.length; k++) {
              scripts[k].parentNode.removeChild(scripts[k]);
            }
            var tracks = imported.querySelectorAll('.swiper-wrapper');
            for (var t = 0; t < tracks.length; t++) {
              tracks[t].removeAttribute('style');
            }

            // Several of these carry two .tab-content blocks and mark one
            // 'active' -- not always the one with content.
            var tabs = imported.querySelectorAll('.tab-content');
            if (tabs.length > 1) {
              var filled = null;
              for (var f = 0; f < tabs.length; f++) {
                if (tabs[f].querySelector('.swiper-slide')) { filled = tabs[f]; break; }
              }
              if (filled) {
                for (var g = 0; g < tabs.length; g++) {
                  var parts = tabs[g].className.split(' ');
                  var kept = [];
                  for (var h = 0; h < parts.length; h++) {
                    if (parts[h] && parts[h] !== 'active') { kept.push(parts[h]); }
                  }
                  if (tabs[g] === filled) { kept.push('active'); }
                  tabs[g].className = kept.join(' ');
                }
              }
            }

            slot.appendChild(imported);
          })
          .catch(function (e) { warn('failed ' + spec.key + ': ' + e); });
      }

      if (spec.eager) { load(); } else { whenNear(slot, load); }
    })(SECTIONS[i]);
  }

})();
true;
`;
