/**
 * The two parsers that read Zigly's rendered sections, and the two stores that
 * keep what they read.
 *
 * These are the first native dashboard sections, and the whole approach rests
 * on a claim worth testing rather than assuming: that the icons and slides can
 * be lifted out of the site's own markup by regex, in a runtime with no
 * `DOMParser`, without going wrong quietly.
 *
 * "Quietly" is the operative word and it is what most of this suite is about.
 * A parser that returns nothing is a section that visibly does not draw, and
 * somebody notices within a minute. A parser that pairs the cat photo with the
 * "Dogs" label, or takes the 1920px desktop crop, or keeps a `javascript:` href
 * out of storage, fails in a way no smoke test would catch -- so those are the
 * cases written down here.
 *
 * The markup fixtures below are shaped after the real theme: the class names,
 * the `<picture>`/`srcset` pairs, the protocol-relative CDN URLs and the
 * optional `banner_link` anchor are all as
 * `zigly-website-code/zigly-website/sections/home-category-section.liquid` and
 * `homepage-banner.liquid` emit them. They are not the live bytes -- this
 * environment cannot reach zigly.com over GET -- so they are deliberately a
 * little untidy in the ways real Shopify output is: mixed casing, attributes in
 * varying order, a lazy-loaded image whose `src` is a placeholder.
 */
import {
  CATEGORIES,
  loadCategoryIcons,
  parseIconUrls,
  saveCategoryIcons,
} from '../src/native/categoryIcons';
import {
  loadBannerSlides,
  parseBannerSlides,
  saveBannerSlides,
} from '../src/native/bannerSlides';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

describe('the category rail is complete without a network', () => {
  /**
   * The reason the rail has no loading state at all. If the labels were learned
   * from the fetch, a first launch would show eight nameless circles; because
   * they are the theme's own block list, read at build time, the rail is
   * tappable on the first frame.
   */
  it('ships all eight of the theme blocks, in the theme order', () => {
    expect(CATEGORIES.map(c => c.label)).toEqual([
      'Dogs',
      'Cats',
      'Small Pets',
      'Pharmacy',
      'Vet Care',
      'Grooming',
      'All',
      'New Pet Parent',
    ]);
  });

  it('gives every circle a storefront path to open', () => {
    for (const item of CATEGORIES) {
      expect(item.path.startsWith('/')).toBe(true);
    }
  });

  /** `shopify://pages/x` is a Liquid reference and cannot be navigated. */
  it('resolves the theme Liquid references to real paths', () => {
    const dogs = CATEGORIES.find(c => c.label === 'Dogs');
    expect(dogs?.path).toBe('/pages/dog');
    expect(CATEGORIES.some(c => c.path.includes('shopify://'))).toBe(false);
  });
});

describe('reading the icons out of a rendered rail', () => {
  /**
   * Shaped after the real section: protocol-relative CDN URLs, a `srcset`, and
   * the filename hashes Shopify appends on re-upload.
   */
  const RAIL = `
    <div id="shopify-section-template--123__home_category_section_ej8trH">
    <div class="home-category-swiper"><div class="swiper-wrapper">
      <div class="home-category-list-card swiper-slide">
        <div class="home-category-list-image-wrapper">
          <img src="//cdn.shopify.com/s/files/1/0923/1204/3836/files/Dog_194aa273-849a-45df-a399-7c4eb88c40b1.png?v=1" alt="Dogs">
        </div><h5>Dogs</h5></div>
      <div class="home-category-list-card swiper-slide">
        <div class="home-category-list-image-wrapper">
          <img alt="Cats" src="${CDN}/Cat_1_de1ed9cd-e97a-4d9c-8e2e-d8d0028e104b.png">
        </div><h5>Cats</h5></div>
      <div class="home-category-list-card swiper-slide">
        <IMG SRCSET="${CDN}/Small-Pets_option-2_1_39a67fdb.png 70w, ${CDN}/Small-Pets_option-2_1_39a67fdb.png 140w" src="data:image/gif;base64,R0lGOD">
        <h5>Small Pets</h5></div>
      <div class="home-category-list-card swiper-slide">
        <img src="${CDN}/Pharmacy_Icon_Transparent_6a228e03.png"><h5>Pharmacy</h5></div>
      <div class="home-category-list-card swiper-slide">
        <img src="${CDN}/Vet-Care_4756b6a8-b8a9-4859-a0e5-1d01bd2adf28.png"><h5>Vet Care</h5></div>
      <div class="home-category-list-card swiper-slide">
        <img src="${CDN}/Grooming_32a60d0f-459f-4db6-bc43-40b5ec5602a2.png"><h5>Grooming</h5></div>
      <div class="home-category-list-card swiper-slide">
        <img src="${CDN}/All_1.png"><h5>All</h5></div>
      <div class="home-category-list-card swiper-slide">
        <img src="${CDN}/petparent_option_1_47775eae.png"><h5>New Pet Parent</h5></div>
    </div></div></div>`;

  it('finds an icon for every one of the eight blocks', () => {
    const icons = parseIconUrls(RAIL);
    for (const item of CATEGORIES) {
      expect(icons[item.key]).toBeDefined();
    }
  });

  /** Shopify's most common form, and it is not a usable `Image` source. */
  it('makes protocol-relative URLs absolute', () => {
    const icons = parseIconUrls(RAIL);
    expect(icons.Dog.startsWith('https://')).toBe(true);
    expect(icons.Dog).toContain('Dog_194aa273');
  });

  /**
   * A lazy image's `src` is a 1x1 placeholder and the real address is in
   * `srcset`. Taking `src` blindly would store a data: URI, which `clean`
   * then drops -- so the circle would silently lose its picture.
   */
  it('falls back to srcset when src is a data placeholder', () => {
    const icons = parseIconUrls(RAIL);
    expect(icons['Small-Pets']).toContain('Small-Pets_option-2');
    expect(icons['Small-Pets'].startsWith('https://')).toBe(true);
  });

  /** Attribute order and tag casing are Shopify's, not ours. */
  it('does not depend on attribute order or tag case', () => {
    const icons = parseIconUrls(RAIL);
    expect(icons.Cat).toContain('Cat_1_de1ed9cd');
  });

  /**
   * THE FAILURE THIS SUITE EXISTS FOR.
   *
   * Pairing by position is shorter and reads fine. It also mislabels every
   * circle after any insertion -- a cat photo over "Dogs" -- and nothing
   * throws. So a rail with a new block in the middle must still pair the rest
   * correctly.
   */
  it('pairs by filename, so a new block in the middle mislabels nothing', () => {
    const withExtra = RAIL.replace(
      '<h5>Cats</h5></div>',
      `<h5>Cats</h5></div>
       <div class="home-category-list-card swiper-slide">
         <img src="${CDN}/Birds_new_block.png"><h5>Birds</h5></div>`,
    );
    const icons = parseIconUrls(withExtra);
    expect(icons.Dog).toContain('Dog_194aa273');
    expect(icons.Cat).toContain('Cat_1_de1ed9cd');
    expect(icons.Grooming).toContain('Grooming_32a60d0f');
    // An unknown block is simply not ours to draw.
    expect(Object.keys(icons)).not.toContain('Birds');
  });

  /**
   * `All` must not claim `allergy.png`, and `Cat` must not claim
   * `Cat_Scratchers` from a neighbouring section that happened to be in the
   * same response.
   */
  it('matches a whole filename stem, not a prefix of a longer word', () => {
    const icons = parseIconUrls(
      `<img src="${CDN}/allergy-banner.png"><img src="${CDN}/Catalogue_hero.png">`,
    );
    expect(icons.All).toBeUndefined();
    expect(icons.Cat).toBeUndefined();
  });

  it('returns nothing for markup with no images, rather than throwing', () => {
    expect(parseIconUrls('<div>no images here</div>')).toEqual({});
    expect(parseIconUrls('')).toEqual({});
  });
});

describe('the icon store', () => {
  it('round-trips through storage', async () => {
    const saved = await saveCategoryIcons({Dog: `${CDN}/Dog_x.png`});
    expect(saved.Dog).toBe(`${CDN}/Dog_x.png`);
    expect((await loadCategoryIcons()).Dog).toBe(`${CDN}/Dog_x.png`);
  });

  /**
   * A fetch that resolved six of eight must not discard two an earlier launch
   * had already found -- which is why icons merge and slides do not.
   */
  it('merges over what is already stored', async () => {
    const known = await saveCategoryIcons({Cat: `${CDN}/Cat_a.png`});
    const merged = await saveCategoryIcons({Grooming: `${CDN}/Grooming_b.png`}, known);
    expect(merged.Cat).toBe(`${CDN}/Cat_a.png`);
    expect(merged.Grooming).toBe(`${CDN}/Grooming_b.png`);
  });

  /**
   * The value is read off disk and handed to an `<Image source>`. A stored
   * string must not be able to decide what the app loads.
   */
  it('refuses anything that is not an https URL', async () => {
    const saved = await saveCategoryIcons({
      Dog: 'javascript:alert(1)',
      Cat: 'file:///etc/passwd',
      All: '/relative/path.png',
      Grooming: `${CDN}/Grooming_ok.png`,
    } as Record<string, string>);
    expect(saved.Dog).toBeUndefined();
    expect(saved.Cat).toBeUndefined();
    expect(saved.All).toBeUndefined();
    expect(saved.Grooming).toBe(`${CDN}/Grooming_ok.png`);
  });
});

describe('reading the slides out of a rendered banner', () => {
  /**
   * Two slides with links and one without -- the theme wraps a slide in
   * `<a class="banner_link">` only when the block has one, so the anchor is
   * optional and a slide missing it must not steal its neighbour's link.
   */
  const BANNER = `
    <section class="homepage_banner" id="shopify-section-template--123__homepage_banner_xCbpfX">
    <div class="swiper homepageMainBanner"><div class="swiper-wrapper">
      <div class="swiper-slide homepageMainBanner_slide">
        <a class="banner_link" href="https://zigly.com/collections/dog-food?utm_source=website">
          <picture>
            <source media="(min-width: 750px)" srcset="//cdn.shopify.com/s/files/1/0923/1204/3836/files/1920X741_Zigly_Dog-Food_1.webp">
            <img src="${CDN}/600X400_DogFood_1_4e3c42f2.webp" alt="">
          </picture>
        </a>
      </div>
      <div class="swiper-slide homepageMainBanner_slide">
        <a class="banner_link" href="shopify://pages/grooming">
          <picture>
            <source srcset="${CDN}/desktop-Zigly_Grooming.png">
            <img src="${CDN}/Grooming-mobile.png">
          </picture>
        </a>
      </div>
      <div class="swiper-slide homepageMainBanner_slide">
        <img src="${CDN}/Mob_1.png">
      </div>
    </div></div></section>`;

  it('reads one slide per rendered block, in the site order', () => {
    const slides = parseBannerSlides(BANNER);
    expect(slides).toHaveLength(3);
    expect(slides[0].image).toContain('600X400_DogFood');
    expect(slides[1].image).toContain('Grooming-mobile');
    expect(slides[2].image).toContain('Mob_1');
  });

  /**
   * The desktop crop is 1920px wide and four times the bytes for the same
   * picture. Taking "the first src in the slide" would take it every time,
   * because `<source>` precedes `<img>` in a `<picture>`.
   */
  it('takes the mobile crop, never the 1920px desktop one', () => {
    const slides = parseBannerSlides(BANNER);
    for (const slide of slides) {
      expect(slide.image).not.toContain('1920X741');
      expect(slide.image).not.toContain('desktop-');
    }
  });

  it('keeps the campaign query string, which changes what the customer sees', () => {
    const slides = parseBannerSlides(BANNER);
    expect(slides[0].link).toContain('utm_source=website');
  });

  it('resolves a shopify:// link to a storefront path', () => {
    expect(parseBannerSlides(BANNER)[1].link).toBe('/pages/grooming');
  });

  /** A slide with no anchor is still a slide; it just is not a control. */
  it('keeps an unlinked slide, with a null link', () => {
    const slides = parseBannerSlides(BANNER);
    expect(slides[2].link).toBeNull();
    expect(slides[2].image).toContain('Mob_1');
  });

  /** The theme supports video blocks; this rail draws stills. */
  it('skips a slide that carries no drawable image', () => {
    const withVideo = BANNER.replace(
      '<img src="' + CDN + '/Mob_1.png">',
      '<div class="banner_video_div"><iframe src="https://youtube.com/embed/x"></iframe></div>',
    );
    const slides = parseBannerSlides(withVideo);
    expect(slides).toHaveLength(2);
  });

  it('returns nothing for markup with no slides, rather than throwing', () => {
    expect(parseBannerSlides('<section>empty</section>')).toEqual([]);
    expect(parseBannerSlides('')).toEqual([]);
  });
});

describe('the slide store', () => {
  it('round-trips through storage', async () => {
    const slides = [{image: `${CDN}/a.png`, link: '/collections/x'}];
    expect(await saveBannerSlides(slides)).toEqual(slides);
    expect(await loadBannerSlides()).toEqual(slides);
  });

  /**
   * Slides REPLACE rather than merge, and this is the difference from the icon
   * store. The list means "the campaigns running right now"; merging would
   * accumulate retired banners forever with no way to tell which the merchant
   * had switched off.
   */
  it('replaces the stored list rather than accumulating retired banners', async () => {
    await saveBannerSlides([
      {image: `${CDN}/valentines.png`, link: '/collections/vday'},
    ]);
    const now = await saveBannerSlides([
      {image: `${CDN}/monsoon.png`, link: '/collections/monsoon'},
    ]);
    expect(now).toHaveLength(1);
    expect(now[0].image).toContain('monsoon');
  });

  /**
   * A failed fetch must leave the previous banner on screen rather than
   * blanking the section -- so an empty save is not allowed to clear the store.
   */
  it('an empty result does not wipe what is stored', async () => {
    const good = [{image: `${CDN}/live.png`, link: null}];
    await saveBannerSlides(good);
    expect(await saveBannerSlides([])).toEqual(good);
    expect(await loadBannerSlides()).toEqual(good);
  });

  /** Both fields are acted on, so both are checked coming off disk. */
  it('drops a slide whose image is not https, and neutralises a bad link', async () => {
    const saved = await saveBannerSlides([
      {image: 'javascript:alert(1)', link: '/ok'},
      {image: `${CDN}/fine.png`, link: 'javascript:alert(2)'},
      {image: `${CDN}/also-fine.png`, link: 'https://evil.example.com/x'},
    ] as {image: string; link: string | null}[]);
    expect(saved).toHaveLength(2);
    expect(saved[0].image).toContain('fine.png');
    // Kept as a slide, but not as a link.
    expect(saved[0].link).toBeNull();
    expect(saved[1].link).toBeNull();
  });
});
