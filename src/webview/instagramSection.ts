/**
 * "From Our Instagram" -- the rail that closes the dashboard.
 *
 * Every other section on this page is Zigly's own markup, fetched from
 * zigly.com and transplanted. This one cannot be: the site has no Instagram
 * section to lift, and nothing on it pulls a feed. So this is the one section
 * the app draws itself.
 *
 * WHERE THE POSTS CAME FROM
 *
 * They are real, and they are Zigly's. The list below was read from their own
 * public account, @ziglypetcare, on 2026-08-23 -- their posts, their captions,
 * their ordering. Nothing here is invented; what it is, is frozen. The app does
 * not call Instagram at runtime, so the rail shows these eight until someone
 * edits this file.
 *
 * That is a deliberate trade, chosen over a live feed:
 *
 *   + no network call, so the section cannot be slow, cannot fail halfway and
 *     cannot be rate-limited by a third party mid-scroll;
 *   + no dependency on an undocumented endpoint that can change without notice;
 *   - the rail ages. These are posts from August 2026, and by the time someone
 *     reads this they will not be "recent" in any sense the heading implies.
 *
 * REFRESHING THE LIST
 *
 * Read the account and replace POSTS. The only field that has to be right is
 * `id`, the shortcode out of the post's own URL; `isVideo` decides whether the
 * card gets the reel badge, and `alt` is the post's caption, used as alt text.
 * Both the cover and the link are derived from the shortcode, so there is
 * nothing else to look up.
 *
 * THE COVERS
 *
 * instagram.com/p/<shortcode>/media/ is a permanent, unsigned URL that
 * redirects to a freshly signed CDN image on every request. That is what makes
 * a hardcoded list possible at all: the signed CDN URLs the API hands out
 * expire within hours, so writing one of those down would guarantee a grid of
 * broken images, while this one keeps working with no code of ours and no
 * image bytes shipped in the APK.
 *
 * It is still Instagram's endpoint, so it is treated as something that can
 * fail -- but the card FAILS IN PLACE. It used to take itself down, and the
 * section took itself down with the last card, and that is what made this
 * section disappear from the dashboard: /media/ stopped serving an
 * unauthenticated third-party request, so every cover errored and the code did
 * exactly what it was written to do. A card whose cover will not load now keeps
 * its tile, its badge and its link to the real post; see the note on `drop`.
 */

/**
 * Zigly's eight most recent posts, read from @ziglypetcare on 2026-08-31.
 *
 * NEWEST FIRST, in the account's own order -- not grouped. An earlier version
 * of this list put every reel ahead of every photo, and that has been dropped:
 * the heading says "From Our Instagram", so the order the account shows is the
 * order that is true, and re-sorting it was the app editing Zigly's feed.
 *
 * These eight replaced a stale set. Every shortcode in the previous list was
 * from an older run of the reader and no longer matched a current post, and one
 * of them -- 'DbASndEhY4' -- was only ten characters where an Instagram
 * shortcode is eleven, so its cover URL could never have resolved at all. Each
 * of the eight below was verified on 2026-08-31 by fetching its own cover and
 * confirming a 200 with image/jpeg bytes.
 *
 * The captions are the posts' own, trimmed to their first sentence with
 * hashtags, @-mentions and emoji removed: the whole caption is a paragraph and
 * this is alt text, read aloud one card at a time.
 */
const POSTS: {id: string; isVideo: boolean; alt: string}[] = [
  {
    id: "DckoBPbsv7S",
    isVideo: true,
    alt: "The only sibling who never steals your clothes, just your entire bed",
  },
  {
    id: "DcivNaap81K",
    isVideo: true,
    alt: "Gurgaon pet parents, there’s a new pet spot you should know about!",
  },
  {
    id: "Dcim_m3uAF_",
    isVideo: true,
    alt: "Pet Pampering Credits: Zigly Pet Care Surat, get ready to tag us along on your pet parenting journey",
  },
  {
    id: "DcdyTRxgdyu",
    isVideo: true,
    alt: "Surat, get ready to pamper your furry besties!",
  },
  {
    id: "DcbTqEBA5lX",
    isVideo: false,
    alt: "Your pet’s bowl of nutrition is incomplete without hydration",
  },
  {
    id: "DcYOOO2K6_N",
    isVideo: false,
    alt: "Taking care of those pearly whites means fresher puppy breath, stronger bites, and way fewer vet worries down the road",
  },
  {
    id: "DcTeBeggVFK",
    isVideo: true,
    alt: "Tell me your dog loves playing in puddles without telling me they love puddles",
  },
  {
    id: "DcSsGr8Td5R",
    isVideo: true,
    alt: "Some moments are extra special when they combine what you love with what you believe in",
  },
];

/** What the rail renders, derived from the shortcodes above. */
export interface InstagramCard {
  id: string;
  /**
   * The permalink. Opens outside the app: instagram.com is in EXTERNAL_HOSTS,
   * so the WebView hands it to the Instagram app or the browser rather than
   * loading a login wall inside the customer's shopping session.
   *
   * /reel/ and /p/ both resolve for either kind of post, but the one that
   * matches opens the right screen in the Instagram app.
   */
  url: string;
  /** The permanent cover URL -- see the note on /media/ above. */
  image: string;
  /**
   * Further cover URLs to try, in order, if `image` will not load.
   *
   * Not redundancy for its own sake. The covers were reported missing on device
   * while the same URLs returned 200 image/jpeg from a desktop on the same
   * network, and every app-side cause was ruled out -- no CSP is set by this
   * app, there is no request interceptor or ServiceWorker anywhere in the
   * project, `mixedContentMode: 'never'` is scheme-based and cannot affect an
   * https-to-https redirect, and on Android
   * `onShouldStartLoadWithRequest` is never called for an image subresource.
   * What is left is the request context: the WebView sends Instagram's shared
   * cookies, an Android WebView user-agent and `Sec-Fetch-*` headers that a
   * plain fetch does not, and any of those can route the request into
   * Instagram's logged-out path, which answers with HTML instead of an image.
   *
   * That is not something this app can fix from the outside, so it is retried
   * instead: each of these is a genuinely different request -- a different host
   * or a different crop -- and one of them getting through is a cover shown.
   * All were verified to return image/jpeg on 2026-08-31.
   */
  fallbacks: string[];
  isVideo: boolean;
  alt: string;
}

export const INSTAGRAM_CARDS: InstagramCard[] = POSTS.map(post => ({
  id: post.id,
  url:
    'https://www.instagram.com/' +
    (post.isVideo ? 'reel' : 'p') +
    '/' +
    post.id +
    '/',
  // size=m is Instagram's 320px square crop, which is what a card this wide
  // shows on a phone. The full-size original would be several times the bytes
  // for pixels nothing can display.
  image: 'https://www.instagram.com/p/' + post.id + '/media/?size=m',
  fallbacks: [
    // The apex host. A different origin, so it carries its own cookies -- which
    // is the most likely discriminator between a request that is served and one
    // that is sent to the logged-out path.
    'https://instagram.com/p/' + post.id + '/media/?size=m',
    // No size parameter: the plainest form of the endpoint.
    'https://www.instagram.com/p/' + post.id + '/media/',
    // The large crop, as a last try. More bytes than a card needs, which is why
    // it is last rather than absent -- a heavier cover still beats no cover.
    'https://www.instagram.com/p/' + post.id + '/media/?size=l',
  ],
  isVideo: post.isVideo,
  alt: post.alt,
}));

/**
 * The reel marker, drawn over the top-right of a video card.
 *
 * Inline rather than an <img>: this is the only asset the section needs, it is
 * a dozen bytes as a path, and a remote icon would be one more request that can
 * fail independently of the cover it sits on.
 */
const REEL_GLYPH =
  '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" ' +
  'focusable="false"><path fill="#FFFFFF" d="M9.5 7.8v8.4c0 .5.6.9 1 .6l6.7-4.2c' +
  '.4-.2.4-.8 0-1L10.5 7.2c-.4-.3-1 .1-1 .6z"/></svg>';

/**
 * The slot extraSections reserves for this section.
 *
 * Reserved there rather than anchored here so the dashboard's running order is
 * stated in one place. It sits where the "Happy Moments" photo grid used to,
 * directly above the brand-claims icons strip that ends the page.
 */
export const INSTAGRAM_SLOT = 'zigly-x-instagram';

/**
 * Embed a value as JavaScript source.
 *
 * U+2028 and U+2029 are escaped by hand because JSON.stringify does not: they
 * are legal inside a JSON string and are line terminators inside a JavaScript
 * one. Modern engines accept them in a string literal, but the WebView version
 * belongs to the device -- this app supports Android 7 -- and an older one
 * rejects the whole payload, silently. The captions above are pasted out of
 * Instagram, which is exactly where such a character arrives from.
 *
 * The replacements carry two backslashes because these are ordinary string
 * literals: one backslash would BE the character being escaped, and the join
 * would quietly put back what the split took out.
 */
const embed = (value: unknown): string =>
  JSON.stringify(value)
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');

export const INSTAGRAM_SECTION_SCRIPT = `
(function () {
  var SLOT = '${INSTAGRAM_SLOT}';
  var POSTS = ${embed(INSTAGRAM_CARDS)};

  function warn(msg) {
    if (window.console && console.warn) { console.warn('[ZiglyWebView] ' + msg); }
  }

  try {
    // The slot is reserved by extraSections, so the dashboard's running order
    // is fixed there rather than recomputed here from whichever siblings
    // happen to exist yet.
    var slot = document.getElementById(SLOT);
    if (!slot) { return; }

    // The re-injection guard. The whole bundle is re-applied on a timer (see
    // RESTYLE_DELAYS in ZiglyWebViewScreen), so this runs several times per
    // page load and must not stack up several rails.
    if (slot.getAttribute('data-zigly-ig') === 'true') { return; }
    slot.setAttribute('data-zigly-ig', 'true');

    var section = document.createElement('section');
    section.className = 'zigly-ig';

    var title = document.createElement('h2');
    title.className = 'zigly-ig__title';
    title.textContent = 'From Our Instagram';
    section.appendChild(title);

    var rail = document.createElement('div');
    rail.className = 'zigly-ig__rail';

    /**
     * A cover that will not load is RETRIED, and only then given up on.
     *
     * Two separate mistakes were made here, and both are worth stating because
     * each looked like the fix for the other.
     *
     * First, this removed the card, and removed the whole section once the last
     * card had gone -- reasoning that a row of broken-image glyphs under
     * Zigly's name is worse than no row at all. Sound about glyphs, wrong as a
     * remedy: every cover was failing, so the count reached zero and the
     * section deleted itself. The dashboard simply had no Instagram rail, and
     * nothing reported a fault, because removing it was what the code was for.
     *
     * Second, the cause was recorded as the endpoint having stopped serving
     * unauthenticated requests. That was wrong: instagram.com/p/<code>/media/
     * returns 200 with image/jpeg bytes, verified for all eight of these on
     * 2026-08-31. What was actually broken was the DATA -- the shortcodes were
     * stale, and one was ten characters where a shortcode is eleven -- so the
     * URLs were fine and the posts behind them were not.
     *
     * What remains genuinely uncertain is why a device saw failures where a
     * plain fetch does not; see the note on the fallbacks field above. So a failed
     * cover walks that list before the card gives up, and a card that runs out
     * of URLs keeps its place and loses only the image: the tile is the card's
     * own ground with the reel badge still on it, and it still opens the real
     * post. A card that looks deliberate and works, rather than no section.
     */
    function drop(card, img) {
      try {
        // Next URL in the chain, if this card has one left. The index lives on
        // the element so a re-entrant error event cannot restart the walk.
        var tried = parseInt(img.getAttribute('data-zigly-try') || '0', 10);
        var list = img.__ziglyFallbacks || [];
        if (tried < list.length) {
          img.setAttribute('data-zigly-try', String(tried + 1));
          img.setAttribute('src', list[tried]);
          return;
        }
        card.setAttribute('data-zigly-ig-cover', 'failed');
        img.style.display = 'none';
      } catch (e) {}
    }

    for (var i = 0; i < POSTS.length; i++) {
      (function (post) {
        // A plain anchor, deliberately. instagram.com is in EXTERNAL_HOSTS, so
        // the navigation is caught natively and handed to the Instagram app --
        // no window.open, which this app disables, and no login wall opening
        // inside the customer's shopping session.
        var card = document.createElement('a');
        card.className = 'zigly-ig__card';
        card.setAttribute('href', post.url);
        card.setAttribute('rel', 'noopener noreferrer');

        var img = document.createElement('img');
        img.className = 'zigly-ig__img';
        img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
        // The covers come from Instagram and this page is zigly.com. Sending
        // Zigly's URL along as the referrer would tell Instagram where their
        // customers are browsing, which is not ours to disclose -- and the
        // redirect does not ask for it.
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.setAttribute('alt', post.alt);
        // The retry chain, parked on the element rather than closed over, so
        // drop() can be a plain function shared by every card.
        img.__ziglyFallbacks = post.fallbacks || [];
        img.onerror = function () { drop(card, img); };
        img.setAttribute('src', post.image);
        card.appendChild(img);

        if (post.isVideo) {
          var badge = document.createElement('span');
          badge.className = 'zigly-ig__badge';
          // Static markup of ours, with no post data in it.
          badge.innerHTML = ${embed(REEL_GLYPH)};
          card.appendChild(badge);
        }

        rail.appendChild(card);
      })(POSTS[i]);
    }

    if (!rail.firstChild) { return; }

    section.appendChild(rail);
    slot.appendChild(section);
  } catch (e) {
    warn('instagram section failed: ' + e);
  }
})();
true;
`;
