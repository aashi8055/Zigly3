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
 * fail: a cover that will not load takes its own card down, and if every card
 * goes so does the heading. A row of broken-image glyphs under Zigly's name is
 * worse than no row at all.
 */

/**
 * Zigly's posts, read from @ziglypetcare on 2026-08-23.
 *
 * Reels lead, photos follow. Filtering to video only would have been the
 * literal reading of "reels" and is the wrong one -- it leaves the rail short
 * whenever the account has had a quiet week -- so the photos sit behind the
 * reels rather than being dropped. Zigly's own ordering is kept inside each
 * group: newest first, exactly as the account showed them.
 */
const POSTS: {id: string; isVideo: boolean; alt: string}[] = [
  {
    id: 'Db-zqY4gkas',
    isVideo: true,
    alt: 'Tell me your dog loves playing in puddles without telling me they love puddles',
  },
  {
    id: 'Dbxb4Zdu_0D',
    isVideo: true,
    alt: '5 ways to take care of your pets during monsoon, with our Head Vet',
  },
  {
    id: 'Db3WIPCAN0E',
    isVideo: true,
    alt: 'High pet care bills do not stand a chance during Zigly Prime Week',
  },
  {
    id: 'DbiR4bCzd2G',
    isVideo: true,
    alt: 'True care belongs to every street corner, every neighbourhood, and every stray friend who greets us with a wag',
  },
  {
    id: 'DbGVo8iDoO2',
    isVideo: true,
    alt: 'Is your pet’s ear trying to tell you something?',
  },
  {
    id: 'DbASndEhY4',
    isVideo: true,
    alt: 'Celebrating the love, joy and freedom that make India feel like home',
  },
  {
    id: 'DbAqPUDDgZt',
    isVideo: true,
    alt: 'Is your fur baby scratching their ears or licking their paws more than usual this monsoon?',
  },
  {
    id: 'DbaQHxpOCRW',
    isVideo: false,
    alt: 'Taking care of those pearly whites means fresher puppy breath, stronger bites, and way fewer vet worries down the road',
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
     * A cover that will not load takes its own card down.
     *
     * \`alive\` is counted from the cards actually built, after the loop, and
     * setting it afterwards is safe: an image error cannot be delivered while
     * the loop still holds the thread.
     */
    var alive = 0;
    function drop(card) {
      if (card.parentNode) { card.parentNode.removeChild(card); }
      alive = alive - 1;
      if (alive <= 0 && section.parentNode) {
        section.parentNode.removeChild(section);
      }
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
        img.onerror = function () { drop(card); };
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
    alive = rail.childNodes.length;

    section.appendChild(rail);
    slot.appendChild(section);
  } catch (e) {
    warn('instagram section failed: ' + e);
  }
})();
true;
`;
