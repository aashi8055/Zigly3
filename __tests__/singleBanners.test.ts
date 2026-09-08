/**
 * The three `custom-single-banner` instances.
 *
 * Small sections with three ways to get them wrong, all of which produce
 * something that looks plausible:
 *
 * 1. TAKE THE DESKTOP CROP. Each banner carries both a 1680x324 and a 600x210
 *    asset and the theme picks by media query. Taking the first image in the
 *    rendered section gets the desktop one -- three times the bytes, cut for a
 *    shape a phone does not have. The keys are full filenames so they cannot.
 *
 * 2. TREAT THE UNLINKED BANNER AS A LINK. The brand-claims strip's
 *    `button_link` is empty in the theme: it is a statement, not a
 *    destination. A banner that announces itself as a link and then does
 *    nothing is worse than one that does not announce itself.
 *
 * 3. DRAW THE HEADING AND BUTTON. The section supports `banner_heading`,
 *    `banner_description` and `button_text` over the artwork, and all three
 *    are EMPTY on all three instances, so that branch never renders. A rebuild
 *    that implemented it would draw an empty heading and a red button labelled
 *    nothing.
 */
import {
  DASHBOARD_BANNERS,
  FURPRO_BANNER,
  LOGOS_BANNER,
  VET_CARE_BANNER,
} from '../src/native/singleBanners';
import {matchesKey} from '../src/native/tileIcons';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** Each banner's mobile and desktop assets, verbatim from page.dog.json. */
const ASSETS = {
  vetCare: {
    mobile: '600X210_VetCare_1.png',
    desktop: '1680X324_VetCare_3.png',
  },
  logos: {
    mobile: '600X210_BrandClaims_1_bc7011c7-2cc8-47a6-ab90-7de4d1357bc9.png',
    desktop: '1680X324_BrandClaims_1_1.png',
  },
  furpro: {
    mobile: '600X210_Furpro_mobile.png',
    desktop: '1680X324_furpro_1_2_f31285fa-2ac9-4a74-a7ff-1f6306e1c906.png',
  },
};

describe('the mobile crop, never the desktop one', () => {
  /**
   * THE TEST THIS SUITE EXISTS FOR. Each key must match its own mobile asset
   * and reject the desktop asset beside it in the same section.
   */
  const cases: Array<[string, {mobile: string; desktop: string}, string]> = [
    ['Vet Care', ASSETS.vetCare, VET_CARE_BANNER.tiles[0].key],
    ['brand claims', ASSETS.logos, LOGOS_BANNER.tiles[0].key],
    ['Furpro', ASSETS.furpro, FURPRO_BANNER.tiles[0].key],
  ];

  it.each(cases)('resolves the %s banner’s mobile asset', (_name, asset, key) => {
    expect(matchesKey(`${CDN}/${asset.mobile}`, key)).toBe(true);
  });

  it.each(cases)('rejects the %s banner’s desktop asset', (_name, asset, key) => {
    expect(matchesKey(`${CDN}/${asset.desktop}`, key)).toBe(false);
  });

  /** Stated directly too: no key may name the desktop size. */
  it('names no 1680X324 asset', () => {
    for (const banner of [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER]) {
      expect(banner.tiles[0].key).toContain('600X210');
      expect(banner.tiles[0].key).not.toContain('1680X324');
    }
  });
});

describe('the banner with no link', () => {
  /**
   * The brand-claims strip is a row of claim icons with an empty
   * `button_link`. It draws, and it is not a control.
   */
  it('gives the brand-claims strip no path', () => {
    expect(LOGOS_BANNER.tiles[0].path).toBe('');
  });

  it('gives the other two a real destination', () => {
    expect(VET_CARE_BANNER.tiles[0].path).toBe('/pages/vet-care-page');
    expect(FURPRO_BANNER.tiles[0].path).toBe('/collections/furpro');
  });

  it('resolves the theme’s Liquid references to real paths', () => {
    for (const banner of [VET_CARE_BANNER, FURPRO_BANNER]) {
      expect(banner.tiles[0].path.startsWith('/')).toBe(true);
      expect(banner.tiles[0].path).not.toContain('shopify://');
    }
  });
});

describe('every banner has an accessibility name', () => {
  /**
   * The words are lettering inside the artwork -- the section's own text
   * settings are all empty -- so this is the only description available, and
   * it is needed even by the unlinked strip, which is announced as an image.
   */
  it('names all three', () => {
    expect(VET_CARE_BANNER.tiles[0].label).toBe(
      'Advanced Vet Care, Anytime You Need It',
    );
    expect(LOGOS_BANNER.tiles[0].label).toBe('Zigly brand promises');
    expect(FURPRO_BANNER.tiles[0].label).toBe('Furpro grooming range');
  });

  it('leaves none blank', () => {
    for (const banner of [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER]) {
      expect(banner.tiles[0].label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the three are kept apart', () => {
  /** Sharing a store would make one banner overwrite another's artwork. */
  it('gives each its own store and section id', () => {
    const all = [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER];
    expect(new Set(all.map(b => b.storeKey)).size).toBe(3);
    expect(new Set(all.map(b => b.sectionId)).size).toBe(3);
  });

  it('fetches each from its own section instance', () => {
    expect(VET_CARE_BANNER.sectionId).toContain('custom_single_banner_WGCJEB');
    expect(LOGOS_BANNER.sectionId).toContain('custom_single_banner_kKkUwL');
    expect(FURPRO_BANNER.sectionId).toContain('custom_single_banner_QYTfgc');
  });

  it('rediscovers by the shared fragment', () => {
    for (const banner of [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER]) {
      expect(banner.fragment).toBe('custom_single_banner');
    }
  });

  it('holds exactly one tile each', () => {
    for (const banner of [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER]) {
      expect(banner.tiles).toHaveLength(1);
    }
  });
});

describe('what the dashboard draws', () => {
  /**
   * Two of the three. Furpro is declared but not placed: extraSections seeds
   * its id and no entry uses it, so the app does not show it while the dog
   * page does. Asserted so its absence stays a decision rather than becoming
   * something that looks missed.
   */
  it('draws the Vet Care banner and the brand-claims strip, in that order', () => {
    expect(DASHBOARD_BANNERS).toHaveLength(2);
    expect(DASHBOARD_BANNERS[0]).toBe(VET_CARE_BANNER);
    expect(DASHBOARD_BANNERS[1]).toBe(LOGOS_BANNER);
  });

  it('does not draw the Furpro banner', () => {
    expect(DASHBOARD_BANNERS).not.toContain(FURPRO_BANNER);
  });
});
