/**
 * "Top Pet Brands, One Spot!" — the brand metaobject, and its two traps.
 *
 * THE FIELDS ARE PER-PET, AND THE WRONG ONE LOOKS RIGHT. The
 * `brand_navigation` metaobject carries five variants of each list -- no
 * suffix, `_cat`, `_dog`, `_newpawrent`, `_smallpets` -- and
 * `home-shop-by-brand-section-dog.liquid` reads the `_dog` pair. The dashboard
 * is the dog page, so reading `home_feature_brand_images` instead of
 * `home_feature_brand_images_dog` would draw a different brand list under the
 * same heading, with real logos and real links, and nothing would look broken.
 * That is asserted against the query text below, which is unusual and is the
 * point: there is no other way to catch it before a device.
 *
 * IMAGES AND LINKS ARE TWO PARALLEL LISTS PAIRED BY INDEX. That is the theme's
 * own scheme (`feature_content_url[forloop.index0]`) and the one place index
 * pairing is correct rather than a shortcut, because the merchant maintains
 * them as a pair. It also means their lengths can disagree, and a logo with no
 * destination is a card that does nothing.
 *
 * Fixtures are the live shapes, read from the Storefront API on 2026-09-08:
 * labels "Popular " (with the merchant's trailing space) and "Emerging", 12
 * brands in each tab.
 */
import {
  BRANDS_TITLE,
  brandNameFromLink,
  pairBrands,
  parseBrands,
} from '../src/native/brands';
import * as brandsModule from '../src/native/brands';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** Shape a `list.file_reference` field the way the API returns one. */
const images = (...names: string[]) => ({
  references: {
    edges: names.map(n => ({node: {image: {url: `${CDN}/${n}`}}})),
  },
});

/** Shape a `list.url` field: a JSON-encoded array in `value`. */
const links = (...urls: string[]) => ({value: JSON.stringify(urls)});

/** The live reply, trimmed to four brands a tab. */
const LIVE = {
  metaobject: {
    featureLabel: {value: 'Popular '},
    otherLabel: {value: 'Emerging'},
    featureImages: images(
      '475X268_Applod_1.png',
      '475X268_ZL_1.png',
      '475X268_Furpro_1.png',
      '475X268_Farmina_1_2edca04d.png',
    ),
    featureLinks: links(
      'https://zigly.com/collections/applod-dogs',
      'https://zigly.com/collections/zigly-lifestyle',
      'https://zigly.com/collections/furpro',
      'https://zigly.com/collections/farmina-dogs',
    ),
    otherImages: images(
      'PurpleTails_ddfa8037.png',
      'Goodies_18444d39.png',
      'ArdenGrange_3926f372.png',
    ),
    otherLinks: links(
      'https://zigly.com/collections/purple-tails',
      'https://zigly.com/collections/goodies',
      'https://zigly.com/collections/arden-grange-dogs',
    ),
  },
};

describe('the dog page’s fields, not another pet’s', () => {
  /**
   * THE TEST THIS SUITE EXISTS FOR. Asserted against the query source because
   * the failure has no other signature: the unsuffixed fields return real
   * logos and real links, so the section would draw perfectly and show the
   * wrong brands.
   */
  it('queries the _dog variant of every per-pet field', () => {
    // The module's query is private; read it off the source it was built from.
    const source = require('fs').readFileSync(
      require.resolve('../src/native/brands'),
      'utf8',
    ) as string;
    const query = /const QUERY = `([\s\S]*?)`;/.exec(source)?.[1] ?? '';
    expect(query).toContain('home_feature_brand_images_dog');
    expect(query).toContain('home_feature_brand_link_dog');
    expect(query).toContain('home_other_brand_images_dog');
    expect(query).toContain('home_other_brand_image_url_dog');
  });

  it('does not read the unsuffixed or another pet’s fields', () => {
    const source = require('fs').readFileSync(
      require.resolve('../src/native/brands'),
      'utf8',
    ) as string;
    const query = /const QUERY = `([\s\S]*?)`;/.exec(source)?.[1] ?? '';
    for (const wrong of ['_cat', '_newpawrent', '_smallpets']) {
      expect(query).not.toContain(`home_feature_brand_images${wrong}`);
      expect(query).not.toContain(`home_other_brand_images${wrong}`);
    }
    // The unsuffixed field is a prefix of the _dog one, so check the exact
    // key followed by the quote the query closes it with.
    expect(query).not.toContain('"home_feature_brand_images"');
    expect(query).not.toContain('"home_other_brand_images"');
  });

  /** The dog page's heading, not the homepage's or the cat page's. */
  it('is headed as the dog page heads it', () => {
    expect(BRANDS_TITLE).toBe('Top Pet Brands, One Spot!');
    expect(BRANDS_TITLE).not.toBe('Shop By Brands');
    expect(BRANDS_TITLE).not.toBe('Top Pet Brands, One Place');
  });
});

describe('reading the two tabs', () => {
  it('returns both tabs with the merchant’s labels', () => {
    const tabs = parseBrands(LIVE);
    expect(tabs).toHaveLength(2);
    expect(tabs[0].label).toBe('Popular');
    expect(tabs[1].label).toBe('Emerging');
  });

  /**
   * The live `feature_brand_label` is `"Popular "`. Untrimmed it draws a wider
   * pill than its neighbour, which reads as a rendering bug.
   */
  it('trims the merchant’s trailing space off a label', () => {
    expect(parseBrands(LIVE)[0].label).toBe('Popular');
  });

  it('pairs each logo with its own collection', () => {
    const [popular] = parseBrands(LIVE);
    expect(popular.brands[0].image).toContain('475X268_Applod_1.png');
    expect(popular.brands[0].link).toBe(
      'https://zigly.com/collections/applod-dogs',
    );
    expect(popular.brands[3].image).toContain('Farmina');
    expect(popular.brands[3].link).toContain('farmina-dogs');
  });

  /**
   * A metaobject with one list emptied must show one tab, not an empty second
   * one -- which is what the theme's own `{% if other_brand_label != blank %}`
   * amounts to.
   */
  it('drops a tab with no brands rather than showing it empty', () => {
    const tabs = parseBrands({
      metaobject: {
        ...LIVE.metaobject,
        otherImages: images(),
        otherLinks: links(),
      },
    });
    expect(tabs).toHaveLength(1);
    expect(tabs[0].label).toBe('Popular');
  });

  it('falls back to the observed label when the merchant clears it', () => {
    const tabs = parseBrands({
      metaobject: {...LIVE.metaobject, featureLabel: {value: '   '}},
    });
    expect(tabs[0].label).toBe('Popular');
  });
});

describe('pairing images with links by index', () => {
  /**
   * The lists can disagree in length. A logo with no destination is a card
   * that does nothing; a destination with no logo has nothing to draw.
   */
  it('drops the unpaired tail on either side', () => {
    expect(
      pairBrands(
        [`${CDN}/a.png`, `${CDN}/b.png`, `${CDN}/c.png`],
        ['https://zigly.com/collections/a'],
      ),
    ).toHaveLength(1);
    expect(
      pairBrands(
        [`${CDN}/a.png`],
        ['https://zigly.com/collections/a', 'https://zigly.com/collections/b'],
      ),
    ).toHaveLength(1);
  });

  /**
   * The link comes from admin data the app does not control, and it is
   * navigated. A brand logo is not a reason to leave the app.
   */
  it('drops a brand whose link leaves zigly.com', () => {
    const paired = pairBrands(
      [`${CDN}/a.png`, `${CDN}/b.png`],
      ['https://evil.example.com/x', 'https://zigly.com/collections/ok'],
    );
    expect(paired).toHaveLength(1);
    expect(paired[0].link).toContain('zigly.com');
  });

  it('accepts a site-relative link', () => {
    expect(
      pairBrands([`${CDN}/a.png`], ['/collections/applod'])[0].link,
    ).toBe('/collections/applod');
  });

  it('drops an image that is not https', () => {
    // imageUrls filters these out before pairing, so the pair is unmade.
    const tabs = parseBrands({
      metaobject: {
        ...LIVE.metaobject,
        featureImages: {
          references: {
            edges: [
              {node: {image: {url: 'javascript:alert(1)'}}},
              {node: {image: {url: `${CDN}/ok.png`}}},
            ],
          },
        },
        featureLinks: links(
          'https://zigly.com/collections/a',
          'https://zigly.com/collections/b',
        ),
      },
    });
    // One image survived, so one brand -- and it pairs with the FIRST link,
    // which is the honest consequence of index pairing and worth pinning.
    expect(tabs[0].brands).toHaveLength(1);
    expect(tabs[0].brands[0].image).toContain('ok.png');
  });
});

describe('the brand name derived from its collection handle', () => {
  it('title-cases a hyphenated handle', () => {
    expect(brandNameFromLink('https://zigly.com/collections/purple-tails')).toBe(
      'Purple Tails',
    );
    expect(brandNameFromLink('/collections/chip-chops')).toBe('Chip Chops');
  });

  /**
   * The `-dogs`/`-cats` suffix scopes a brand's collection to one pet and is
   * not part of the brand's name -- otherwise the rail reads "Farmina Dogs"
   * beside "Applod Dogs".
   */
  it('strips the pet suffix', () => {
    expect(brandNameFromLink('/collections/farmina-dogs')).toBe('Farmina');
    expect(brandNameFromLink('/collections/arden-grange-dogs')).toBe(
      'Arden Grange',
    );
    expect(brandNameFromLink('/collections/trixie-dogs')).toBe('Trixie');
  });

  it('ignores a query string and a trailing slash', () => {
    expect(brandNameFromLink('/collections/applod?sort=x')).toBe('Applod');
    expect(brandNameFromLink('/collections/applod/')).toBe('Applod');
  });

  /** A screen reader's label, so it must never be empty. */
  it('gives every live brand a non-empty name', () => {
    for (const tab of parseBrands(LIVE)) {
      for (const brand of tab.brands) {
        expect(brand.name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('a reply that is not the expected shape', () => {
  it('returns nothing rather than throwing', () => {
    expect(parseBrands(null)).toEqual([]);
    expect(parseBrands({})).toEqual([]);
    expect(parseBrands({metaobject: null})).toEqual([]);
  });

  /** `list.url` arrives as a JSON string; a malformed one must not throw. */
  it('survives an unparseable link list', () => {
    const tabs = parseBrands({
      metaobject: {
        ...LIVE.metaobject,
        featureLinks: {value: 'not json'},
      },
    });
    // The feature tab is lost, the other tab still draws.
    expect(tabs).toHaveLength(1);
    expect(tabs[0].label).toBe('Emerging');
  });

  it('exports the fetcher the component uses', () => {
    expect(typeof brandsModule.fetchBrands).toBe('function');
  });
});
