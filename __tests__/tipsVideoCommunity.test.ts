/**
 * Three sections read from the HOMEPAGE rather than the dog page: the article
 * cards, the video block and the community partners.
 *
 * These three are `{move: …}` entries in ../src/webview/extraSections -- the
 * WebView relocates them because they are already on the page it is showing --
 * so they are the only sections in the set whose data comes from
 * `templates/index.json`. That has a consequence worth pinning: the homepage's
 * section-id prefix is `template--26530973548860__`, NOT the dog page's
 * `template--26530973942076__` and NOT `sections--26530985181500__` (which is
 * the header's). Picking the wrong one gives an id that never resolves and a
 * section that silently draws nothing.
 *
 * THE ARTICLE CARDS ARE THE ONE SECTION PARSED FROM HTML. Verified against both
 * public tokens: `blog`, `articleByHandle` and `articles` all return "Access
 * denied … `unauthenticated_read_content`". So the titles, covers and dates are
 * not readable as data and the section reads its own rendered markup. The
 * parser is therefore the risk surface, and most of this suite is about it.
 */
import {
  COMMUNITIES,
  COMMUNITY_RAIL,
  COMMUNITY_TITLE,
} from '../src/native/community';
import {
  parseTips,
  TIPS_TITLE,
  TIPS_VIEW_ALL,
  TIPS_VIEW_ALL_PATH,
  TIP_HANDLES,
} from '../src/native/tips';
import {
  VIDEO_BACKGROUND,
  VIDEO_DESCRIPTION,
  VIDEO_ID,
  VIDEO_POSTER,
  VIDEO_POSTER_FALLBACK,
  VIDEO_TITLE,
  VIDEO_WATCH_URL,
} from '../src/native/video';
import {parseIcons} from '../src/native/tileIcons';
import {INTERNAL_HOSTS} from '../src/constants/appConstants';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** The homepage's own template prefix, from DATA-SOURCES.md §3. */
const HOME_PREFIX = 'template--26530973548860__';

describe('all three read the homepage, not the dog page', () => {
  /**
   * THE ID TRAP. Three prefixes appear in the captured list and only one is
   * right for a homepage template section.
   */
  /*
   * The video block is no longer in this list: it fetches no section at all.
   * See the poster tests below -- its artwork comes from the YouTube video id,
   * so it has no sectionId to get wrong.
   */
  it('uses the homepage template prefix', () => {
    expect(COMMUNITY_RAIL.sectionId.startsWith(HOME_PREFIX)).toBe(true);
  });

  it('does not use the dog page’s prefix', () => {
    expect(COMMUNITY_RAIL.sectionId).not.toContain('26530973942076');
  });

  /** `sections--` is the header and announcement bar, not a template section. */
  it('does not use the layout’s sections-- prefix', () => {
    expect(COMMUNITY_RAIL.sectionId.startsWith('sections--')).toBe(false);
  });
});

describe('the article cards, parsed from rendered markup', () => {
  /**
   * Shaped after `snippets/new-article-card.liquid`: the card anchor, a
   * `<picture>` whose metafield image precedes the featured one, a time stamp
   * and a two-line-clamped title.
   */
  const RENDERED = `
    <div id="shopify-section-${HOME_PREFIX}helpful_tips_CEYEgg">
    <div class="swiper-wrapper">
      <div class="swiper-slide">
        <a class="main-collection-article no-underline" href="/blogs/all/bond-better-together-with-your-pet">
          <div class="main-collection-article-image-container">
            <picture>
              <source srcset="//cdn.shopify.com/s/files/1/0923/1204/3836/files/card-image.jpg 800w">
              <img src="${CDN}/featured.jpg" alt="main-article-featured_image">
            </picture>
          </div>
          <div class="article-meta">
            <span class="time-stamp">August 21, 2026</span>
            <p class="blog-card-tags">Pet Care</p>
          </div>
          <p class="article-title line-clamp" style="--line-clamp-count:2">Bond Better Together With Your Pet</p>
        </a>
      </div>
      <div class="swiper-slide">
        <a class="main-collection-article no-underline" href="/blogs/all/tick-season-is-here">
          <img src="${CDN}/ticks.jpg">
          <span class="time-stamp">July 3, 2026</span>
          <p class="article-title line-clamp">Tick Season Is Here &amp; What To Know</p>
        </a>
      </div>
    </div></div>`;

  it('reads one card per rendered article, in order', () => {
    const tips = parseTips(RENDERED);
    expect(tips).toHaveLength(2);
    expect(tips[0].path).toBe('/blogs/all/bond-better-together-with-your-pet');
    expect(tips[1].path).toBe('/blogs/all/tick-season-is-here');
  });

  it('reads the title and the date the theme printed', () => {
    const [first] = parseTips(RENDERED);
    expect(first.title).toBe('Bond Better Together With Your Pet');
    expect(first.date).toBe('August 21, 2026');
  });

  /** Titles carry entities; a raw `&amp;` on screen is the tell. */
  it('decodes HTML entities in a title', () => {
    expect(parseTips(RENDERED)[1].title).toBe(
      'Tick Season Is Here & What To Know',
    );
  });

  /**
   * The snippet prefers a `blog_card_image` metafield over the article's
   * featured image, and emits the metafield's first. Taking the first CDN
   * address honours the theme's own preference.
   */
  it('takes the theme’s preferred cover image', () => {
    const [first] = parseTips(RENDERED);
    expect(first.image).toContain('card-image.jpg');
    expect(first.image?.startsWith('https://')).toBe(true);
  });

  /**
   * A card with no title is dropped -- the title is the only thing that says
   * what an article is, and a photo with a date is a mystery link. A card with
   * no image is KEPT, because the title still says what it is.
   */
  it('drops a card with no title but keeps one with no image', () => {
    const noTitle = parseTips(
      `<a class="main-collection-article" href="/blogs/all/x"><img src="${CDN}/a.jpg"></a>`,
    );
    expect(noTitle).toHaveLength(0);

    const noImage = parseTips(
      '<a class="main-collection-article" href="/blogs/all/y">' +
        '<p class="article-title">A Title</p></a>',
    );
    expect(noImage).toHaveLength(1);
    expect(noImage[0].image).toBeNull();
  });

  /** An off-origin href is dropped rather than followed. */
  it('drops a card linking off zigly.com', () => {
    const tips = parseTips(
      '<a class="main-collection-article" href="https://evil.example.com/x">' +
        '<p class="article-title">Nope</p></a>',
    );
    expect(tips).toHaveLength(0);
  });

  it('returns nothing for markup with no cards, rather than throwing', () => {
    expect(parseTips('<section>empty</section>')).toEqual([]);
    expect(parseTips('')).toEqual([]);
  });

  /**
   * The handles are shipped for the placeholder count, not to draw the cards.
   * Seven, from the section's blocks.
   */
  it('ships the seven declared handles', () => {
    expect(TIP_HANDLES).toHaveLength(7);
    expect(TIP_HANDLES[0]).toBe('all/bond-better-together-with-your-pet');
  });

  it('carries the theme’s heading and View All control', () => {
    expect(TIPS_TITLE).toBe('Pet Parenting Made Easy');
    expect(TIPS_VIEW_ALL).toBe('View All');
    expect(TIPS_VIEW_ALL_PATH).toBe('/blogs/all');
  });
});

describe('the video block', () => {
  it('carries the theme’s heading and its navy ground', () => {
    expect(VIDEO_TITLE).toBe('Zigly: India’s Complete Pet Care Ecosystem');
    expect(VIDEO_BACKGROUND).toBe('#183761');
  });

  /**
   * Zigly's own statement about their business, kept whole -- trimming it would
   * be this app editing what a company says about itself.
   */
  it('keeps the description verbatim and complete', () => {
    expect(VIDEO_DESCRIPTION.startsWith('Powered by Cosmo First Limited')).toBe(
      true,
    );
    expect(
      VIDEO_DESCRIPTION.endsWith('your ultimate partner in pet parenting.'),
    ).toBe(true);
    // No ellipsis: it is not truncated.
    expect(VIDEO_DESCRIPTION).not.toContain('…');
  });

  /**
   * THE SECTION IS A YOUTUBE EMBED, AND HAS NO POSTER IMAGE TO FIND.
   *
   * These four tests replace four that asserted the opposite -- that
   * `video_poster` was `shopify://shop_images/zigly-thumbnail.jpg` and that
   * ../src/native/tileIcons had to read it off a `<video poster>` attribute.
   * That was the HOMEPAGE's copy of the section. The dashboard is the dog page
   * (see ../src/native/dashboardSections), whose copy sets `video_link` to a
   * YouTube URL and no poster at all, so the section renders a bare `<iframe>`
   * and there is no image in its markup for any parser to reach.
   *
   * The consequence was not a missing picture but a missing SECTION: with no
   * candidate resolved, VideoBlock's `poster ? ... : null` returned null and
   * the heading and copy went with it. So this describe block now pins the
   * derived-URL contract instead.
   */
  it('derives the poster from the video id, with no section fetch', () => {
    expect(VIDEO_ID).toBe('1vIjfkud5MQ');
    expect(VIDEO_POSTER).toBe(
      'https://i.ytimg.com/vi/1vIjfkud5MQ/maxresdefault.jpg',
    );
  });

  /**
   * `maxresdefault` is the one YouTube still that is not guaranteed -- it is
   * generated only for uploads above 720p. `hqdefault` exists for every video,
   * so it is what VideoBlock falls back to on an image error.
   */
  it('carries an hqdefault fallback for a video with no HD still', () => {
    expect(VIDEO_POSTER_FALLBACK).toBe(
      'https://i.ytimg.com/vi/1vIjfkud5MQ/hqdefault.jpg',
    );
    expect(VIDEO_POSTER_FALLBACK).not.toBe(VIDEO_POSTER);
  });

  /** Both stills come from YouTube's own image host, which needs no API key. */
  it('reads the stills from i.ytimg.com', () => {
    for (const url of [VIDEO_POSTER, VIDEO_POSTER_FALLBACK]) {
      expect(url.startsWith('https://i.ytimg.com/vi/')).toBe(true);
      expect(url).toContain(VIDEO_ID);
    }
  });

  /**
   * The watch URL carries the same id as the poster.
   *
   * Asserted together because they are two derivations of one setting: an id
   * updated in one place and not the other would show the still from one video
   * above a tap that opens a different one.
   */
  it('points the tap at the same video the poster shows', () => {
    expect(VIDEO_WATCH_URL).toBe(
      'https://www.youtube.com/watch?v=1vIjfkud5MQ',
    );
    expect(VIDEO_WATCH_URL).toContain(VIDEO_ID);
  });
});

describe('the community partners', () => {
  it('carries both partners and the theme’s heading', () => {
    expect(COMMUNITY_TITLE).toBe('Real Pets. Real Stories. Real Community.');
    expect(COMMUNITIES.map(c => c.name)).toEqual([
      'Zigly Foundation',
      'Petsfamilia',
    ]);
  });

  /**
   * BOTH LINKS LEAVE THE APP, and neither host is internal -- unlike the Zigly
   * Coins banner, which IS listed internal on purpose. Asserted so a future
   * change to INTERNAL_HOSTS that swept these in would fail here: Petsfamilia
   * is somebody else's Instagram, and ziglyfoundation.com is listed in
   * DATA-SOURCES.md §5 as out of app scope.
   */
  it('links off-site, to hosts the app does not keep in-app', () => {
    expect(COMMUNITIES[0].link).toBe('https://ziglyfoundation.com/');
    expect(COMMUNITIES[1].link).toBe(
      'https://www.instagram.com/petsfamilia_community/',
    );
    for (const community of COMMUNITIES) {
      const host = community.link.replace('https://', '').split('/')[0];
      expect(INTERNAL_HOSTS).not.toContain(host);
    }
  });

  /** Every card has its own text, so a missing logo costs only the picture. */
  it('gives every card a name, a description and a button label', () => {
    for (const community of COMMUNITIES) {
      expect(community.name.trim().length).toBeGreaterThan(0);
      expect(community.description.trim().length).toBeGreaterThan(20);
      expect(community.button).toBe('Know More');
    }
  });

  it('carries each block’s own background colour', () => {
    for (const community of COMMUNITIES) {
      expect(community.background).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('declares one artwork tile per card', () => {
    expect(COMMUNITY_RAIL.tiles).toHaveLength(2);
    const keys = COMMUNITY_RAIL.tiles.map(t => t.key);
    expect(new Set(keys).size).toBe(2);
  });
});
