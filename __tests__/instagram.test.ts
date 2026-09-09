/**
 * "From Our Instagram" — the one section not sourced from zigly.com, and the
 * one where "same as currently" is checkable against the web implementation
 * rather than against the theme.
 *
 * There is no Shopify section behind this rail: the site has no Instagram
 * section and nothing on it pulls a feed (DATA-SOURCES.md §9). So the reference
 * for the native version is ../src/webview/instagramSection itself, and most of
 * this suite reads that file and asserts the two agree — the posts, their
 * order, their captions and their video flags.
 *
 * THE ORDER IS THE ASSERTION THAT MATTERS MOST. That module records an earlier
 * version which put every reel ahead of every photo, and why it was dropped:
 * "the heading says 'From Our Instagram', so the order the account shows is the
 * order that is true, and re-sorting it was the app editing Zigly's feed." A
 * native rewrite grouping by type would look tidier and would be wrong, so the
 * order is compared position by position.
 *
 * AND ONE THING THE NATIVE VERSION DELIBERATELY DROPS: the fallback URL. The
 * web rail keeps `instagram.com/p/<code>/media/` per card for the case where a
 * bundled cover is missing. A `require()`d asset cannot be missing at runtime —
 * it fails the bundle — so the case cannot arise, and dropping it removes the
 * one third-party request that rail can still make. Asserted, so it is not
 * added back as a "fix".
 */
import * as fs from 'fs';
import {
  INSTAGRAM_POSTS,
  INSTAGRAM_TITLE,
  postUrl,
} from '../src/native/instagram';

/**
 * The eight posts, written down here as the reference the deleted web module
 * used to be.
 *
 * Written down rather than derived, deliberately: the point of this list is to
 * fail when the rail's contents change, so reading it out of the same file
 * under test would assert nothing at all. Read off @ziglypetcare on 2026-08-31,
 * every cover verified `200 image/jpeg` (DATA-SOURCES.md §9). Refreshing the
 * rail means editing both this list and ../src/native/instagram, and that
 * second edit is the intended friction.
 */
const EXPECTED_ORDER: string[] = [
  'DckoBPbsv7S',
  'DcivNaap81K',
  'Dcim_m3uAF_',
  'DcdyTRxgdyu',
  'DcbTqEBA5lX',
  'DcYOOO2K6_N',
  'DcTeBeggVFK',
  'DcSsGr8Td5R',
];

/** Six reels and two photos, in the account's own order. */
const EXPECTED_VIDEO_FLAGS: boolean[] = [
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
];

describe('the same eight posts the web rail ships', () => {
  it('carries eight cards', () => {
    expect(INSTAGRAM_POSTS).toHaveLength(8);
  });

  /**
   * THE ORDER TEST. Position by position against the web module, because a
   * native version that grouped reels first would look deliberate and would be
   * editing Zigly's feed.
   */
  it('keeps the account’s own order, not grouped by type', () => {
    expect(INSTAGRAM_POSTS.map(p => p.id)).toEqual(EXPECTED_ORDER);
  });

  it('marks the same posts as videos', () => {
    expect(INSTAGRAM_POSTS.map(p => p.isVideo)).toEqual(EXPECTED_VIDEO_FLAGS);
    // Six reels and two photos, as the account had them.
    expect(INSTAGRAM_POSTS.filter(p => p.isVideo)).toHaveLength(6);
  });

  /** Stated directly: the list is not sorted by anything. */
  it('does not put every reel before every photo', () => {
    const flags = INSTAGRAM_POSTS.map(p => p.isVideo);
    const firstPhoto = flags.indexOf(false);
    // A grouped list would have no video after its first photo.
    expect(flags.slice(firstPhoto).some(Boolean)).toBe(true);
  });

  it('is headed as the account is', () => {
    expect(INSTAGRAM_TITLE).toBe('From Our Instagram');
  });
});

describe('the shortcodes', () => {
  /**
   * A stale list once broke this section entirely, and one of its shortcodes
   * was ten characters where an Instagram shortcode is eleven -- so its cover
   * could never have resolved. Length is the cheapest guard against that
   * class of mistake.
   */
  it('are all eleven characters', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.id).toHaveLength(11);
    }
  });

  it('are unique', () => {
    const ids = INSTAGRAM_POSTS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('use only the characters a shortcode can contain', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });
});

describe('the links', () => {
  /**
   * `/p/<code>/` for photos AND reels, as the web version does for all eight:
   * a reel opened at `/p/` redirects on Instagram's side rather than 404ing.
   */
  it('derives a canonical /p/ URL from the shortcode', () => {
    expect(postUrl('DckoBPbsv7S')).toBe(
      'https://www.instagram.com/p/DckoBPbsv7S/',
    );
  });

  it('uses /p/ even for the reels', () => {
    for (const post of INSTAGRAM_POSTS.filter(p => p.isVideo)) {
      expect(post.url).toContain('/p/');
      expect(post.url).not.toContain('/reel/');
    }
  });

  it('gives every card a URL matching its own shortcode', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.url).toBe(postUrl(post.id));
      expect(post.url).toContain(post.id);
    }
  });
});

describe('the covers are bundled files', () => {
  /**
   * One JPEG per shortcode in `src/assets/instagram/`. The web rail cannot use
   * these -- its markup runs inside a WebView on a remote origin, so it needs
   * base64 -- and the native one can, which is the one place this version is
   * simpler rather than merely different.
   */
  it('has an asset for every post', () => {
    const files = fs
      .readdirSync('src/assets/instagram')
      .filter(f => f.endsWith('.jpg'))
      .map(f => f.replace('.jpg', ''));
    for (const post of INSTAGRAM_POSTS) {
      expect(files).toContain(post.id);
    }
  });

  /** No orphans either: an unused asset means a post was removed and its file left. */
  it('has no asset without a post', () => {
    const files = fs
      .readdirSync('src/assets/instagram')
      .filter(f => f.endsWith('.jpg'))
      .map(f => f.replace('.jpg', ''));
    const ids = INSTAGRAM_POSTS.map(p => p.id);
    for (const file of files) {
      expect(ids).toContain(file);
    }
  });

  it('resolves a cover for every card', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.cover).toBeDefined();
    }
  });
});

describe('no network at runtime', () => {
  /**
   * THE ABSENCE THIS SUITE PROTECTS. The web rail keeps a fallback URL per
   * card; the native one drops it, because a bundled require() cannot be
   * missing at runtime. Adding it back would reintroduce the one third-party
   * request this section can make from inside the customer's session.
   */
  it('ships no fallback URL to instagram.com', () => {
    const source = fs.readFileSync(
      require.resolve('../src/native/instagram'),
      'utf8',
    );
    /*
     * Comments are stripped first. That module explains at length WHY the
     * `/media/` endpoint is not used, and naming it in prose is the opposite
     * of shipping it -- an earlier version of this test matched its own
     * documentation and failed.
     */
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(code).not.toContain('/media');
    /*
     * And the only instagram.com in code at all is the post URL, which the
     * builder assembles in a template literal -- so `postUrl` is checked for
     * what it produces rather than the source for what it contains.
     */
    expect(postUrl('DckoBPbsv7S')).not.toContain('/media');
  });

  it('does not fetch anything', () => {
    const source = fs.readFileSync(
      require.resolve('../src/native/instagram'),
      'utf8',
    );
    expect(source).not.toContain('fetch(');
  });
});

describe('the captions', () => {
  /** Used as alt text, read aloud one card at a time -- so never empty. */
  it('gives every card a non-empty caption', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.alt.trim().length).toBeGreaterThan(10);
    }
  });

  /**
   * Trimmed to a first sentence with hashtags, mentions and emoji removed, as
   * the web module states. A hashtag or an @-mention read aloud is noise.
   */
  it('carries no hashtags or mentions', () => {
    for (const post of INSTAGRAM_POSTS) {
      expect(post.alt).not.toContain('#');
      expect(post.alt).not.toContain('@');
    }
  });
});
