/**
 * "Care by Concern" — seven cards with real text, and two links that are not
 * what they look like.
 *
 * This is the first tile section whose cards carry visible copy, which makes it
 * the first where an unresolved image is harmless. The traps here are in the
 * destinations instead, and both are cases where the obvious derivation is
 * wrong:
 *
 * 1. ONE CARD GOES TO A BLOG POST. Deworming links to
 *    `/blogs/all/the-beginners-guide-to-puppy-feeding-…` while the other six go
 *    to collections. A rebuild that assumed `/collections/<handle>` for every
 *    card would send it to a collection that does not exist.
 *
 * 2. ONE HANDLE DOES NOT MATCH ITS HEADING. "Joint Pain" goes to
 *    `/collections/hip-joint`. Deriving the handle from the label -- which
 *    works for five of the seven -- would 404 it.
 *
 * The filename stems have their own trap: `Skin_-Coat` for "Skin & Coat Care",
 * an underscore where the heading has a space and then a hyphen. Read from the
 * theme, not derived, and asserted so a tidy-up cannot "correct" it.
 */
import {
  CONCERNS,
  CONCERNS_BUTTON,
  CONCERNS_RAIL,
  CONCERNS_TITLE,
} from '../src/native/concerns';
import {matchesKey} from '../src/native/tileIcons';

const CDN = 'https://cdn.shopify.com/s/files/1/0923/1204/3836/files';

/** The real image filename for each card, from page.dog.json. */
const FILENAMES: Record<string, string> = {
  Shedding: 'Shedding_660X405_f5a7dcb6-d03d-4834-ab69-8b54cf74adb1.png',
  'Dental-Care': 'Dental-Care_660X405_57c8482a-f312-4798-a835-ea621ba090bb.png',
  Deworming: 'Deworming_660X405_13cee561-feff-4a43-aa4a-6cf0f77197db.png',
  'Skin_-Coat': 'Skin_-Coat_660X405_3d160e35-b39b-4d16-a78e-aea4bdd6845a.png',
  'Dry-Skin-Issues':
    'Dry-Skin-Issues_660X405_b7753723-2a74-45f4-ac46-d3779a126d5f.png',
  'Weight-Management':
    'Weight-Management_660X405_0cc2f103-9aec-4305-9621-3a88a6bbed5d.png',
  'Joint-Pain': 'Joint-Pain_660X405_f43f8be3-b95b-4c35-aa32-2fde6d871614.png',
};

describe('the seven cards as the theme declares them', () => {
  it('is headed as the theme heads it', () => {
    expect(CONCERNS_TITLE).toBe('Care by Concern');
  });

  it('takes its button label from the section, not each block', () => {
    // The theme reads `button_text` off the section, so all seven share it.
    expect(CONCERNS_BUTTON).toBe('Shop Now');
  });

  it('carries all seven, in the theme’s block order', () => {
    expect(CONCERNS.map(c => c.heading)).toEqual([
      'Shedding',
      'Dental Care',
      'Deworming',
      'Skin & Coat Care',
      'Dry Skin Issues',
      'Weight Management',
      'Joint Pain',
    ]);
  });

  /** Zigly's own copy, exclamation marks and capitalisation included. */
  it('keeps the subheadings verbatim', () => {
    expect(CONCERNS[0].subheading).toBe('Less fur, more flair!');
    expect(CONCERNS[2].subheading).toBe('Stay Worm-Free, Stay Healthy!');
    expect(CONCERNS[6].subheading).toBe('Move easy, play hard!');
    for (const concern of CONCERNS) {
      expect(concern.subheading.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the destinations, which are not derivable', () => {
  /**
   * THE FIRST TRAP. Six collections and one blog post.
   */
  it('sends Deworming to a blog post, not a collection', () => {
    const deworming = CONCERNS.find(c => c.heading === 'Deworming');
    expect(deworming?.path).toBe(
      '/blogs/all/the-beginners-guide-to-puppy-feeding-best-practices-and-tips',
    );
    expect(deworming?.path.startsWith('/collections/')).toBe(false);
  });

  /**
   * THE SECOND TRAP. "Joint Pain" -> hip-joint. Deriving the handle from the
   * heading works for five of seven and 404s this one.
   */
  it('sends Joint Pain to hip-joint', () => {
    const joint = CONCERNS.find(c => c.heading === 'Joint Pain');
    expect(joint?.path).toBe('/collections/hip-joint');
    expect(joint?.path).not.toBe('/collections/joint-pain');
  });

  it('sends the other five to their own collections', () => {
    const byHeading = Object.fromEntries(CONCERNS.map(c => [c.heading, c.path]));
    expect(byHeading.Shedding).toBe('/collections/shedding');
    expect(byHeading['Dental Care']).toBe('/collections/dental-care');
    expect(byHeading['Skin & Coat Care']).toBe('/collections/skin-coat-care');
    expect(byHeading['Dry Skin Issues']).toBe('/collections/dry-skin-issues');
    expect(byHeading['Weight Management']).toBe(
      '/collections/weight-management',
    );
  });

  it('resolves the theme’s Liquid references to real paths', () => {
    for (const concern of CONCERNS) {
      expect(concern.path.startsWith('/')).toBe(true);
      expect(concern.path).not.toContain('shopify://');
    }
  });

  it('sends no two cards to the same place', () => {
    const paths = CONCERNS.map(c => c.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('every artwork key matches its real filename', () => {
  it.each(Object.entries(FILENAMES))('resolves %s', (key, filename) => {
    expect(matchesKey(`${CDN}/${filename}`, key)).toBe(true);
  });

  /**
   * The stem for "Skin & Coat Care" is `Skin_-Coat` -- an underscore where the
   * heading has a space, then a hyphen. It looks like a typo and is not.
   */
  it('keeps the theme’s odd Skin_-Coat stem', () => {
    const skin = CONCERNS.find(c => c.heading === 'Skin & Coat Care');
    expect(skin?.key).toBe('Skin_-Coat');
    expect(matchesKey(`${CDN}/${FILENAMES['Skin_-Coat']}`, skin!.key)).toBe(
      true,
    );
    // The "tidied" versions match nothing.
    expect(matchesKey(`${CDN}/${FILENAMES['Skin_-Coat']}`, 'Skin-Coat')).toBe(
      false,
    );
  });

  it('has a filename recorded for every card', () => {
    for (const concern of CONCERNS) {
      expect(FILENAMES[concern.key]).toBeDefined();
    }
    expect(CONCERNS).toHaveLength(Object.keys(FILENAMES).length);
  });

  it('gives every card a unique key', () => {
    const keys = CONCERNS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the artwork store', () => {
  it('declares one tile per card, carrying its own destination', () => {
    expect(CONCERNS_RAIL.tiles).toHaveLength(7);
    for (const concern of CONCERNS) {
      const tile = CONCERNS_RAIL.tiles.find(t => t.key === concern.key);
      expect(tile).toBeDefined();
      // The tile's path must be the card's, including the blog post.
      expect(tile?.path).toBe(concern.path);
      expect(tile?.label).toBe(concern.heading);
    }
  });

  it('names the section it is fetched from', () => {
    expect(CONCERNS_RAIL.sectionId).toContain('shop_of_concern');
    expect(CONCERNS_RAIL.fragment).toBe('shop_of_concern');
    expect(CONCERNS_RAIL.storeKey).toBe('zigly.concernIcons.v1');
  });
});
