/**
 * The coupon strip: the copy button works, and the strip stops moving on its
 * own.
 *
 * Both defects come from the same place. The strip is transplanted from
 * Zigly's own `coupon_slider` section (see extraSections.ts) and this app
 * deliberately does not run a transplanted section's scripts -- they start the
 * looping carousels this app lays out natively instead. That is the right call,
 * but this one section keeps a function in its script that its own markup calls
 * from an inline handler:
 *
 *   <div class="secondary_Svg" onclick="copyCodeCoupon(this,'INR 50 off ...')">
 *
 * With the script dropped, `copyCodeCoupon` is not defined, so tapping the copy
 * button on the right of each coupon did nothing at all. It is re-supplied here
 * with the same name, the same two arguments and the same `show_copy_message`
 * behaviour the site's own version has -- and only if the page has not defined
 * it, so on any page that does render the section itself, Zigly's own
 * implementation still wins. Verified against the live section on 2026-08-22.
 *
 * The auto-scroll is not JavaScript at all: the site's own drag/animate script
 * is commented out in the theme, and the movement is a CSS marquee --
 *
 *   .mySwiper_couponSlider .slider-track { animation: scroll 30s linear infinite }
 *   @keyframes scroll { from { translateX(0) } to { translateX(-50%) } }
 *
 * -- which is why it could not be stopped from here by cancelling a timer. It
 * is stopped in CSS (see injectedStyles.ts) and the container is made a native
 * horizontal scroller, so the strip moves only under the user's thumb. That
 * also stops a compositor animation that was running for the whole life of the
 * dashboard, on screen or not.
 *
 * `translateX(-50%)` is the marquee's tell: the theme emits every coupon twice
 * so the loop has somewhere to wrap to. Six coupons arrive as twelve slides.
 * Scrolled by hand that reads as the list repeating itself, so the second copy
 * of each coupon is removed here. Nothing is invented and nothing unique is
 * dropped -- a coupon is only removed when the identical one is already on the
 * strip.
 */

/**
 * The theme's own "copied" flag. Its CSS swaps the copy glyph for the tick
 * while this class is on the button's parent, and clears after 1.5s.
 */
const COPIED_CLASS = 'show_copy_message';
const COPIED_MS = 1500;

export const COUPON_STRIP_SCRIPT = `
(function () {
  if (window.__ziglyCouponStrip) { return; }
  window.__ziglyCouponStrip = true;

  var COPIED_CLASS = ${JSON.stringify(COPIED_CLASS)};
  var COPIED_MS = ${COPIED_MS};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  /**
   * Put the text on the clipboard.
   *
   * The async Clipboard API is what the site uses and is tried first. In an
   * Android WebView it can reject outright -- it needs a user gesture the
   * embedder has to have granted -- and a copy button that silently fails is
   * worse than one that looks unstyled, so the old execCommand path is kept as
   * a fallback. Resolves to whether the text actually landed.
   */
  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      // Off screen rather than hidden: a display:none field cannot be selected.
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      warn('coupon copy failed: ' + e);
      return false;
    }
  }

  /**
   * The site's own function, re-supplied. Same name, same arguments, same
   * feedback -- and defined only when the page has not defined its own.
   */
  if (typeof window.copyCodeCoupon !== 'function') {
    window.copyCodeCoupon = function (element, couponCode) {
      try {
        writeClipboard(String(couponCode)).then(function (ok) {
          if (!ok || !element) { return; }
          var host = element.parentNode;
          if (!host || !host.classList) { return; }
          host.classList.add(COPIED_CLASS);
          setTimeout(function () {
            try { host.classList.remove(COPIED_CLASS); } catch (e) {}
          }, COPIED_MS);
        });
      } catch (e) {
        warn('copyCodeCoupon failed: ' + e);
      }
    };
  }

  /** Collapse whitespace, so two spellings of one coupon still match. */
  function squash(str) {
    var out = '';
    var prevWs = true;
    for (var k = 0; k < str.length; k++) {
      var c = str.charCodeAt(k);
      var isWs = (c === 32 || c === 9 || c === 10 || c === 13);
      if (isWs) { if (!prevWs) { out += ' '; prevWs = true; } }
      else { out += str.charAt(k); prevWs = false; }
    }
    while (out.length && out.charAt(out.length - 1) === ' ') { out = out.slice(0, -1); }
    return out;
  }

  /**
   * Drop the marquee's second copy of every coupon.
   *
   * Keyed on the coupon's own text, not on position, so it is correct whether
   * the theme doubles the list, triples it, or stops doubling it altogether.
   */
  function dedupe(track) {
    if (track.getAttribute('data-zigly-deduped') === 'true') { return false; }

    var slides = track.querySelectorAll('.slide');
    // A strip that is on the page but not filled in yet is not finished with.
    // Returning false here rather than marking it done is what keeps the
    // observer watching until the coupons actually arrive.
    if (slides.length < 2) { return false; }

    var seen = {};
    var removed = 0;
    for (var i = 0; i < slides.length; i++) {
      var key = squash(slides[i].textContent || '');
      if (!key) { continue; }
      if (seen[key]) {
        if (slides[i].parentNode) {
          slides[i].parentNode.removeChild(slides[i]);
          removed++;
        }
      } else {
        seen[key] = 1;
      }
    }

    track.setAttribute('data-zigly-deduped', 'true');
    if (removed) { track.scrollLeft = 0; }
    return true;
  }

  /** True once at least one strip has actually been deduplicated. */
  function sweep() {
    var tracks = document.querySelectorAll('.mySwiper_couponSlider .slider-track');
    var done = false;
    for (var i = 0; i < tracks.length; i++) {
      if (dedupe(tracks[i])) { done = true; }
    }
    return done;
  }

  /**
   * The strip is transplanted asynchronously, so it is not on the page yet when
   * this runs. Watched rather than polled forever: the observer stops as soon as
   * a strip has actually been dealt with.
   *
   * The callback is coalesced into one task. The dashboard assembles itself by
   * inserting a dozen sections into the body, which is hundreds of mutation
   * records, and running a querySelectorAll for each of them is work during the
   * one part of the session where frames are scarcest.
   */
  if (!sweep() && window.MutationObserver) {
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(function () {
        pending = false;
        if (sweep()) { try { mo.disconnect(); } catch (e) {} }
      }, 0);
    });
    try {
      mo.observe(document.body, {childList: true, subtree: true});
      // A section that never arrives must not leave an observer on the whole
      // document for the life of the page.
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 20000);
    } catch (e) {}
  }
})();
true;
`;
