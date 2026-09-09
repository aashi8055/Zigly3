/**
 * The 32 breed cards must be the theme's 32, in the theme's order.
 *
 * ../src/native/breedVerse is a hand-written list transcribed from a theme
 * template, which is exactly the artefact that goes stale without anyone
 * noticing. So this suite reads `templates/page.all-breeds.json` out of the
 * read-only theme source and checks the transcription against it: same cards,
 * same order, same species, same destinations, same artwork keys.
 *
 * That turns "the breeds are Zigly's own" from something a comment claims into
 * something that fails when it stops being true -- if the merchant adds a
 * thirty-third breed, renames one, or repoints a card, this test says so.
 *
 * The same shape as ./collectionCards.test.ts, for the same reason.
 *
 * WHAT THIS CANNOT CHECK: whether the screen *looks* like the website's. That
 * is a device question. This checks the content, which is the half that can be
 * checked here.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  BREED_CARDS,
  BREED_TABS,
  BREED_VERSE_RAIL,
  cardsForTab,
} from '../src/native/breedVerse';
import {matchesKey} from '../src/native/tileIcons';
import {isBreedVerseUrl} from '../src/utils/urlUtils';
import {BREED_VERSE_PATH, ZIGLY_ORIGIN} from '../src/constants/appConstants';

/** The section the cards come from, in the template that declares them. */
const TEMPLATE = join(
  __dirname,
  '..',
  'zigly-website-code',
  'zigly-website',
  'templates',
  'page.all-breeds.json',
);
const SECTION = 'all_breeds_aman_BtKp3Q';

type Block = {
  type: string;
  disabled?: boolean;
  settings: {
    title?: string;
    labels?: string;
    category?: string;
    image?: string;
    link?: string;
  };
};

/**
 * The theme's blocks, in `block_order`.
 *
 * The template carries a leading block comment (Shopify writes one into every
 * auto-generated template), which `JSON.parse` will not accept -- so it is
 * stripped first, exactly as ./collectionCards.test.ts does.
 *
 * Disabled blocks are dropped, which is what Liquid's `{% for block in
 * section.blocks %}` does -- Shopify does not render a disabled block at all.
 * None are disabled today; the filter is here so that switching one off in the
 * admin makes this test agree with the website rather than fail against it.
 */
const themeBlocks = (): Block[] => {
  const raw = readFileSync(TEMPLATE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const template = JSON.parse(raw) as {
    sections: Record<
      string,
      {blocks?: Record<string, Block>; block_order?: string[]}
    >;
  };
  const section = template.sections[SECTION];
  expect(section).toBeDefined();
  const blocks = section.blocks ?? {};
  const order = section.block_order ?? Object.keys(blocks);
  return order.map(key => blocks[key]).filter(block => !block.disabled);
};

describe('the breed-verse screen carries the themes own cards', () => {
  it('has one card per theme block, in the theme order', () => {
    const blocks = themeBlocks();
    expect(blocks.length).toBe(32);
    expect(BREED_CARDS.length).toBe(blocks.length);
    expect(BREED_CARDS.map(card => card.label)).toEqual(
      blocks.map(block => (block.settings.title ?? '').trim()),
    );
  });

  /**
   * The species, which is what the tabs filter on.
   *
   * The theme writes it capitalised ("Dog") and lower-cases it in Liquid before
   * comparing, so the card's own value is the lower-cased one.
   */
  it('carries the theme category of each card', () => {
    const blocks = themeBlocks();
    BREED_CARDS.forEach((card, i) => {
      expect(card.kind).toBe((blocks[i].settings.category ?? '').toLowerCase());
    });
  });

  /**
   * The destination, with `shopify://pages/x` resolved to `/pages/x`.
   *
   * Checked rather than derived from the label, because two of the 32 disagree
   * with their own heading: "English Cocker Spaniel" and "French Bulldog" are
   * fine, but a label-to-handle guess is exactly the kind of tidy assumption
   * that 404s behind a card that works on the website.
   */
  it('points at the page the theme links to', () => {
    const blocks = themeBlocks();
    BREED_CARDS.forEach((card, i) => {
      const url = (blocks[i].settings.link ?? '').trim();
      expect(url.startsWith('shopify://pages/')).toBe(true);
      expect(card.path).toBe(
        `/pages/${url.slice('shopify://pages/'.length)}`,
      );
    });
  });

  it('carries the theme traits of each card, verbatim', () => {
    const blocks = themeBlocks();
    BREED_CARDS.forEach((card, i) => {
      const raw = (blocks[i].settings.labels ?? '').trim();
      const expected = raw ? raw.split(',').map(s => s.trim()) : [];
      expect(card.traits).toEqual(expected);
    });
  });

  it('gives every card a distinct artwork key', () => {
    const keys = BREED_CARDS.map(card => card.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Each key must pair with its own block's image and with no other's.
   *
   * A stem matching two blocks would hand both cards the first image found,
   * which is the silent mispairing ../src/native/tileIcons warns about -- a Pug
   * photograph over "Beagle", with nothing thrown.
   */
  it('pairs each key with its own block image and no other', () => {
    const blocks = themeBlocks();
    const files = blocks.map(block =>
      (block.settings.image ?? '').replace('shopify://shop_images/', ''),
    );
    BREED_CARDS.forEach((card, i) => {
      const matched = files
        .map((file, j) => (matchesKey(`https://x/${file}`, card.key) ? j : -1))
        .filter(j => j !== -1);
      expect(matched).toEqual([i]);
    });
  });
});

describe('the tabs', () => {
  /**
   * "All" plus one per species, in the order Liquid produces -- it derives them
   * with `map: 'category' | uniq`, so first appearance wins.
   */
  it('are All plus each species in first-appearance order', () => {
    const seen: string[] = [];
    BREED_CARDS.forEach(card => {
      if (!seen.includes(card.kind)) {
        seen.push(card.kind);
      }
    });
    expect(BREED_TABS.map(tab => tab.id)).toEqual(['all', ...seen]);
    expect(BREED_TABS.map(tab => tab.label)).toEqual(['All', 'Dog', 'Cat']);
  });

  it('shows every card on All, and splits them without loss', () => {
    expect(cardsForTab('all')).toEqual(BREED_CARDS);
    const dogs = cardsForTab('dog');
    const cats = cardsForTab('cat');
    expect(dogs.length).toBe(25);
    expect(cats.length).toBe(7);
    expect(dogs.length + cats.length).toBe(BREED_CARDS.length);
  });

  /** A filtered tab keeps the block order, which is what makes it read A-Z. */
  it('keeps the theme order within a tab', () => {
    const dogs = cardsForTab('dog').map(card => card.label);
    const inOrder = BREED_CARDS.filter(c => c.kind === 'dog').map(c => c.label);
    expect(dogs).toEqual(inOrder);
  });
});

describe('the artwork rail', () => {
  /**
   * The rail must ask the page the section is actually on.
   *
   * The Section Rendering API answers with an empty body for a section the
   * requested page does not render, which ../src/native/tileIcons cannot tell
   * from a stale id -- so a rail that forgot `page` would silently lose every
   * photograph and still look like a cache miss.
   */
  it('fetches from the breed-verse page, and seeds a matching id', () => {
    expect(BREED_VERSE_RAIL.page).toBe(BREED_VERSE_PATH);
    expect(BREED_VERSE_RAIL.sectionId).toContain(SECTION);
    expect(BREED_VERSE_RAIL.sectionId).toContain(BREED_VERSE_RAIL.fragment);
    expect(BREED_VERSE_RAIL.tiles).toBe(BREED_CARDS);
  });
});

describe('which urls the native screen claims', () => {
  it('claims the index, with or without a trailing slash', () => {
    expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}${BREED_VERSE_PATH}`)).toBe(true);
    expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}${BREED_VERSE_PATH}/`)).toBe(true);
    expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}${BREED_VERSE_PATH}?x=1`)).toBe(true);
  });

  /**
   * A breed's own page is the WebView's, and must stay so: it carries the Book
   * An Appointment button ../src/webview/breedPage pins, and 200-odd products
   * in themed rails that this screen does not draw.
   */
  it('does not claim a breeds own page', () => {
    BREED_CARDS.forEach(card => {
      expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}${card.path}`)).toBe(false);
    });
  });

  it('does not claim another site, or another page', () => {
    expect(isBreedVerseUrl(`https://example.com${BREED_VERSE_PATH}`)).toBe(
      false,
    );
    expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}/pages/pet-breeds-2026`)).toBe(false);
    expect(isBreedVerseUrl(`${ZIGLY_ORIGIN}/collections`)).toBe(false);
  });
});
