/**
 * "From Our Instagram" -- the rail that closes the dashboard.
 *
 * The posts are hardcoded, so what needs defending is not a parse. It is the
 * three things a frozen list can quietly get wrong:
 *
 *   - the shortcodes. Every cover and every link is derived from one, so a
 *     typo is a card that shows a broken image and sends the tap nowhere, and
 *     nothing at build time would notice.
 *   - the cover URL. Instagram's signed CDN links expire within hours; the
 *     whole list only works because /p/<code>/media/ is unsigned and permanent.
 *     A signed URL pasted in here would look fine for an afternoon.
 *   - the payload. The captions are pasted out of Instagram and reach the page
 *     as JavaScript source, so the characters a caption can carry have to
 *     survive the trip.
 *
 * The posts themselves were read from @ziglypetcare on 2026-08-23. Whether they
 * are still recent is not something a test can tell anyone -- see the note in
 * instagramSection.ts about the list ageing.
 */
import {
  INSTAGRAM_CARDS,
  INSTAGRAM_SECTION_SCRIPT,
  INSTAGRAM_SLOT,
} from '../src/webview/instagramSection';

describe('the posts', () => {
  it('carries a full rail', () => {
    // Eight is what the rail was built to hold. Fewer is not a failure, but it
    // is a decision, and it should be a visible one rather than the result of
    // someone half-refreshing the list.
    expect(INSTAGRAM_CARDS).toHaveLength(8);
  });

  it('leads with the reels', () => {
    // Filtering to video only would leave the rail short after a quiet week,
    // so photos sit behind the reels rather than being dropped. The heading
    // still wants a reel under it first.
    const firstPhoto = INSTAGRAM_CARDS.findIndex(c => !c.isVideo);
    const lastReel = INSTAGRAM_CARDS.map(c => c.isVideo).lastIndexOf(true);
    if (firstPhoto !== -1) {
      expect(firstPhoto).toBeGreaterThan(lastReel);
    }
    expect(INSTAGRAM_CARDS[0].isVideo).toBe(true);
  });

  it('has a plausible shortcode on every card', () => {
    // Instagram shortcodes are base64url. A space, a slash or a full URL
    // pasted into the id field would build a cover URL that 404s and a link
    // that goes nowhere, and neither would be obvious from reading the list.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.id).toMatch(/^[A-Za-z0-9_-]{5,}$/);
    });
  });

  it('shows each post once', () => {
    const ids = INSTAGRAM_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every card alt text', () => {
    // The cards are images and nothing else -- no caption is rendered -- so
    // the alt attribute is the only thing describing them.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.alt.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('the links and covers derived from them', () => {
  it('sends a reel to /reel/ and a photo to /p/', () => {
    // Both paths resolve for either kind, but only the matching one opens the
    // right screen in the Instagram app.
    INSTAGRAM_CARDS.forEach(card => {
      const kind = card.isVideo ? 'reel' : 'p';
      expect(card.url).toBe(
        'https://www.instagram.com/' + kind + '/' + card.id + '/',
      );
    });
  });

  it('takes covers from the unsigned permanent endpoint', () => {
    // This is the whole reason a hardcoded list is possible. /p/<code>/media/
    // redirects to a freshly signed image on every request; the signed CDN
    // URLs the API hands out expire within hours.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.image).toBe(
        'https://www.instagram.com/p/' + card.id + '/media/?size=m',
      );
    });
  });

  it('has no signed CDN URL written down anywhere', () => {
    // The failure this guards is slow and silent: a pasted fbcdn link works
    // for an afternoon and is a broken image by the next day.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.image).not.toContain('cdninstagram');
      expect(card.image).not.toContain('fbcdn');
      expect(card.image).not.toContain('oe=');
    });
  });

  it('leaves the app when a card is tapped', () => {
    // instagram.com is in EXTERNAL_HOSTS, so these are handed to the Instagram
    // app rather than loaded inside the customer's shopping session. That only
    // holds while the host is exactly the one on that list.
    const {EXTERNAL_HOSTS} = require('../src/constants/appConstants');
    INSTAGRAM_CARDS.forEach(card => {
      expect(new URL(card.url).host).toBe('www.instagram.com');
    });
    expect(EXTERNAL_HOSTS).toContain('www.instagram.com');
  });
});

describe('the injected section', () => {
  const parses = (src: string): boolean => {
    try {
      // eslint-disable-next-line no-new-func
      new Function(src);
      return true;
    } catch {
      return false;
    }
  };

  it('parses, with the captions embedded in it', () => {
    expect(parses(INSTAGRAM_SECTION_SCRIPT)).toBe(true);
  });

  it('escapes the line terminators JSON.stringify leaves raw', () => {
    // U+2028 and U+2029 are legal inside a JSON string and are line breaks
    // inside a JavaScript one. Modern engines tolerate them in a string
    // literal; the WebView belongs to the device, and an older one rejects the
    // whole payload silently. The captions are pasted out of Instagram, which
    // is exactly where such a character would arrive from.
    expect(INSTAGRAM_SECTION_SCRIPT).not.toContain(String.fromCharCode(0x2028));
    expect(INSTAGRAM_SECTION_SCRIPT).not.toContain(String.fromCharCode(0x2029));
  });

  it('draws into the slot extraSections reserves, and nowhere else', () => {
    // The dashboard's running order is stated once, in extraSections. A
    // section that anchored itself would be a second place to state it.
    expect(INSTAGRAM_SLOT).toBe('zigly-x-instagram');
    expect(INSTAGRAM_SECTION_SCRIPT).toContain("getElementById(SLOT)");
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('if (!slot) { return; }');
  });

  it('draws once however many times it is injected', () => {
    // The whole bundle is re-applied on a timer, so this script runs several
    // times per page load. Without the guard that is several rails.
    expect(INSTAGRAM_SECTION_SCRIPT).toContain("data-zigly-ig");
  });

  it('takes a card down when its cover will not load', () => {
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('img.onerror');
  });

  it('builds the cards without innerHTML', () => {
    // The captions are third-party text. They go in through setAttribute and
    // textContent; the one innerHTML in the file is the reel glyph, which is
    // our own static markup with no post data in it.
    const uses = INSTAGRAM_SECTION_SCRIPT.match(/innerHTML/g) ?? [];
    expect(uses).toHaveLength(1);
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('badge.innerHTML');
    expect(INSTAGRAM_SECTION_SCRIPT).toContain("img.setAttribute('alt', post.alt)");
  });

  it('does not send Zigly URLs to Instagram as a referrer', () => {
    // Where Zigly's customers are browsing is not ours to disclose, and the
    // cover redirect does not ask for it.
    expect(INSTAGRAM_SECTION_SCRIPT).toContain("'referrerpolicy', 'no-referrer'");
  });

  it('never throws into the page', () => {
    // The rule for every injected script in this app: a failed selector is a
    // warning, not a broken store.
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('catch (e)');
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('instagram section failed');
  });
});
