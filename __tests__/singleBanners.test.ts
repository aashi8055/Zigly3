/**
 * The dashboard's full-width banners: three `custom-single-banner` instances
 * and the two halves of `redesign-custom-double-banner`.
 *
 * Small sections with four ways to get them wrong, all of which produce
 * something that looks plausible:
 *
 * 1. TAKE THE DESKTOP CROP. Each banner carries both a 1680x324 and a 600x210
 *    asset and the theme picks by media query. Taking the first image in the
 *    rendered section gets the desktop one -- three times the bytes, cut for a
 *    shape a phone does not have. The keys are full filenames so they cannot.
 *
 * 2. TREAT AN UNLINKED BANNER AS A LINK. Two of them have no path. The
 *    brand-claims strip's `button_link` is empty in the theme: it is a
 *    statement, not a destination. The gift-card block's is not empty, and is
 *    emptied here anyway -- its artwork says "Coming Soon" while the theme's
 *    link points at the whole catalogue, so the tap promised the one thing it
 *    could not deliver. A banner that announces itself as a link and then does
 *    nothing useful is worse than one that does not announce itself.
 *
 * 3. DRAW THE HEADING AND BUTTON. The section supports `banner_heading`,
 *    `banner_description` and `button_text` over the artwork, and all three
 *    are EMPTY on all three instances, so that branch never renders. A rebuild
 *    that implemented it would draw an empty heading and a red button labelled
 *    nothing.
 *
 * 4. GIVE THEM ALL ONE SHAPE. The single-banner crops are 600x210 and the
 *    double banner's are 1350x535, so a hardcoded ratio letterboxes one pair
 *    or crops the other -- and a crop takes the lettering with it, since these
 *    banners' words are inside the picture.
 */
import {
  DASHBOARD_BANNERS,
  FURPRO_BANNER,
  GIFT_CARD_BANNER,
  LOGOS_BANNER,
  PAWTY_BANNER,
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

  /**
   * IT IS ALSO THE INSET ONE, AND ../src/native/SingleBanner NOW READS THAT
   * FIELD RATHER THAN THIS ONE.
   *
   * The component picks `contain` over `cover` for the strip, because its
   * artwork is a row of separate marks and `cover`'s trim lands on the
   * outermost two -- which is what was clipping the end claims. The obvious
   * way to spell "the strip" was "the banner with no path", since it was the
   * only one; the gift-card banner joined it there when its coming-soon block
   * stopped being tappable, and that one IS a single campaign image that
   * should still cover.
   *
   * So `inset` is the field that actually names the odd one out. Pinned here
   * because the component's behaviour now depends on exactly one banner having
   * it: a second banner given an inset would silently change how its artwork
   * is fitted.
   */
  it('insets the brand-claims strip and nothing else', () => {
    const inset = DASHBOARD_BANNERS.filter(b => b.inset);
    expect(inset).toEqual([LOGOS_BANNER]);
  });

  /**
   * And it is inset by less than it was. At 28dp a side the strip drew inside
   * 304dp of a 360dp phone, and every dp came off all four claim marks at
   * once. 12 is the page's own gutter, so the strip lines up with the rails
   * above it rather than standing further in than anything else.
   */
  it('insets it by the page’s own gutter, not more', () => {
    expect(LOGOS_BANNER.inset).toBe(12);
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
   * Four blocks in dashboard order: Vet Care under the price tiles, the two
   * halves of the double banner, and the brand-claims strip last.
   *
   * Furpro is declared but not placed: extraSections seeds its id and no entry
   * uses it, so the app does not show it while the dog page does. Asserted so
   * its absence stays a decision rather than becoming something that looks
   * missed.
   */
  it('draws four banners, in dashboard order', () => {
    expect(DASHBOARD_BANNERS).toEqual([
      VET_CARE_BANNER,
      PAWTY_BANNER,
      GIFT_CARD_BANNER,
      LOGOS_BANNER,
    ]);
  });

  it('does not draw the Furpro banner', () => {
    expect(DASHBOARD_BANNERS).not.toContain(FURPRO_BANNER);
  });
});

describe('the double banner is one section drawn as two blocks', () => {
  /**
   * `redesign-custom-double-banner` carries both banners in numbered settings
   * and drops both to `width: 100%` below 749px, so on a phone they stack --
   * which is why they are two entries here rather than one side-by-side block.
   */
  it('shares one section and one store between the two halves', () => {
    expect(PAWTY_BANNER.sectionId).toBe(GIFT_CARD_BANNER.sectionId);
    expect(PAWTY_BANNER.storeKey).toBe(GIFT_CARD_BANNER.storeKey);
    expect(PAWTY_BANNER.fragment).toBe('redesign_custom_double_banner');
  });

  /** Different artwork, so one fetch fills both without either overwriting. */
  it('gives each half its own artwork', () => {
    expect(PAWTY_BANNER.tiles[0].key).not.toBe(GIFT_CARD_BANNER.tiles[0].key);
    expect(PAWTY_BANNER.tiles[0].key).toContain('Birthday_Dog');
    expect(GIFT_CARD_BANNER.tiles[0].key).toContain('GiftCard');
  });

  /**
   * THE PLACEHOLDER THAT IS STILL DRAWN. The gift-card artwork is literally
   * named `…Coming-Soon.png`. Zigly ship it that way; suppressing it would be
   * this app deciding a merchant's placement was a mistake. Asserted so it is
   * not "fixed" away.
   */
  it('keeps Zigly’s coming-soon gift-card block as they ship it', () => {
    expect(GIFT_CARD_BANNER.tiles[0].key).toContain('Coming-Soon');
  });

  /**
   * AND IT IS NOT TAPPABLE, WHICH IS THIS APP'S OWN DECISION.
   *
   * This test used to assert the opposite -- `path` was `/collections`, the
   * theme's own `button_link_2` resolved from `shopify://collections`, and the
   * note above called the odd link something not to be read as a bug. It was
   * not a bug, but it was a bad tap: the artwork says "Coming Soon" and the
   * link went to the entire catalogue, so the one destination the banner
   * promises is the one place the tap could not go.
   *
   * An empty path is this codebase's own spelling of "not a control" -- the
   * brand-claims strip above uses it, and ../src/native/SingleBanner draws
   * such a banner as an image with no press state and no link role. So the
   * block still draws exactly as Zigly ship it and simply does nothing when
   * touched, which is the honest rendering of a thing that does not exist yet.
   *
   * WHEN THE GIFT CARDS SHIP, this test and the `path` in ../src/native/
   * singleBanners move back together.
   */
  it('gives the coming-soon block no destination', () => {
    expect(GIFT_CARD_BANNER.tiles[0].path).toBe('');
  });

  it('sends the Paw-ty banner to the birthday collection', () => {
    expect(PAWTY_BANNER.tiles[0].path).toBe('/collections/birthday-dog');
  });
});

describe('each banner carries its own aspect ratio', () => {
  /**
   * One hardcoded ratio would letterbox one pair or crop the other, and the
   * crop would take the lettering with it -- these banners' words are inside
   * the picture.
   */
  it('uses 20:7 for the custom-single-banner crops', () => {
    for (const banner of [VET_CARE_BANNER, LOGOS_BANNER, FURPRO_BANNER]) {
      expect(banner.ratio).toBeCloseTo(600 / 210, 5);
    }
  });

  it('uses the double banner’s own 1350x535', () => {
    for (const banner of [PAWTY_BANNER, GIFT_CARD_BANNER]) {
      expect(banner.ratio).toBeCloseTo(1350 / 535, 5);
    }
  });

  /** The two shapes must actually differ, or the field buys nothing. */
  it('does not give every banner the same shape', () => {
    expect(VET_CARE_BANNER.ratio).not.toBeCloseTo(PAWTY_BANNER.ratio, 2);
  });
});
