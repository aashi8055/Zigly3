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
import {MOBILE_CSS} from '../src/webview/injectedStyles';

describe('the posts', () => {
  it('carries a full rail', () => {
    // Eight is what the rail was built to hold. Fewer is not a failure, but it
    // is a decision, and it should be a visible one rather than the result of
    // someone half-refreshing the list.
    expect(INSTAGRAM_CARDS).toHaveLength(8);
  });

  it("keeps the account's own order, rather than grouping reels first", () => {
    // This used to require every reel ahead of every photo. That has been
    // deliberately dropped: the heading says "From Our Instagram", so the order
    // the account actually shows is the order that is true, and re-sorting it
    // was the app editing Zigly's feed to look tidier than it is.
    //
    // Asserted as "the groups are interleaved", which is what the real feed
    // gives: a run of reels, two photos, then more reels. A list that happened
    // to be sorted would pass a weaker check, so this pins the actual shape.
    const flags = INSTAGRAM_CARDS.map(c => c.isVideo);
    const firstPhoto = flags.indexOf(false);
    const lastReel = flags.lastIndexOf(true);
    expect(firstPhoto).toBeGreaterThan(-1);
    // A photo appears before the last reel: proof nothing re-grouped them.
    expect(firstPhoto).toBeLessThan(lastReel);
  });

  it('carries the current shortcodes, not the stale set', () => {
    // Every code in the previous list was from an older run of the reader and
    // no longer matched a live post, and 'DbASndEhY4' was ten characters where
    // a shortcode is eleven -- so its cover could never have resolved. That is
    // what actually emptied the rail, not the endpoint.
    const ids = INSTAGRAM_CARDS.map(c => c.id);
    expect(ids).not.toContain('DbASndEhY4');
    for (const id of ids) {
      expect(id).toHaveLength(11);
    }
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

  it('shows bytes that ship with the app, not a live request', () => {
    // The point of the change: no card makes a third-party request from inside
    // the customer's shopping session just to draw itself.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.image.startsWith('data:image/jpeg;base64,')).toBe(true);
    });
  });

  it('bundles a real JPEG for every post', () => {
    // Guards the failure the generator is written to avoid: an entry that
    // exists but decodes to nothing, which is a blank card on the dashboard.
    // ffd8ff is the JPEG start-of-image marker.
    // The first three bytes of a JPEG are ff d8 ff, and base64 packs three
    // bytes into its first four characters -- so a JPEG always begins '/9j/'.
    // Asserted on the encoded text because neither Buffer nor atob is typed
    // in this suite, and decoding is not what is being tested.
    INSTAGRAM_CARDS.forEach(card => {
      const b64 = card.image.split(',')[1];
      expect(b64.length).toBeGreaterThan(1024);
      expect(b64.slice(0, 4)).toBe('/9j/');
    });
  });

  it('keeps Instagram-s own endpoint as the fallback', () => {
    // Used only when a shortcode has no bundled cover -- i.e. POSTS was edited
    // without re-running tools/fetch-instagram-covers.js.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.fallback).toBe(
        'https://www.instagram.com/p/' + card.id + '/media/?size=m',
      );
    });
  });

  it('has no signed CDN URL written down anywhere', () => {
    // The failure this guards is slow and silent: a pasted fbcdn link works
    // for an afternoon and is a broken image by the next day. The bundled
    // cover is bytes, so this is really about `fallback` staying unsigned.
    INSTAGRAM_CARDS.forEach(card => {
      expect(card.fallback).not.toContain('cdninstagram');
      expect(card.fallback).not.toContain('fbcdn');
      expect(card.fallback).not.toContain('oe=');
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

  it('marks a card whose cover will not load, rather than removing it', () => {
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('img.onerror');
    expect(INSTAGRAM_SECTION_SCRIPT).toContain('data-zigly-ig-cover');
  });

  it('never removes the section when covers fail', () => {
    // This is why the section went missing from the dashboard.
    // instagram.com/p/<code>/media/ no longer serves an unauthenticated
    // third-party request, so ALL EIGHT covers error -- and the old code
    // counted survivors and removed the section when the count hit zero. It did
    // exactly what it was written to do, which is why nothing reported a fault.
    //
    // Asserted on the absence of the removal, not on a happy path: any
    // reintroduced "remove the section when the covers fail" is the same bug
    // back, however it is spelled.
    expect(INSTAGRAM_SECTION_SCRIPT).not.toContain(
      'section.parentNode.removeChild(section)',
    );
    expect(INSTAGRAM_SECTION_SCRIPT).not.toContain('alive');
  });

  it('keeps the failed card tappable, so it still opens the real post', () => {
    // The card loses its picture, not its link: the <img> is hidden and the
    // anchor -- which is the card -- is untouched.
    expect(INSTAGRAM_SECTION_SCRIPT).toContain("img.style.display = 'none'");
    expect(INSTAGRAM_SECTION_SCRIPT).not.toContain('card.parentNode.removeChild(card)');
  });

  it('styles the failed tile so it does not read as a bug', () => {
    // An untouched placeholder ground next to loaded covers reads as broken.
    expect(MOBILE_CSS).toContain("data-zigly-ig-cover='failed'");
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
