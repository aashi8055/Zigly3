/**
 * The twelve category cards must be the theme's twelve, in the theme's order.
 *
 * ./collectionCards is a hand-written list transcribed from a theme template,
 * which is exactly the artefact that goes stale without anyone noticing. So
 * this suite reads `templates/list-collections.json` out of the read-only theme
 * source and checks the transcription against it: same cards, same order, same
 * colours, same wording, same destinations.
 *
 * That turns "the cards are Zigly's own" from something a comment claims into
 * something that fails when it stops being true -- if the merchant recolours a
 * card or adds a thirteenth, this test says so.
 *
 * WHAT THIS CANNOT CHECK: whether the screen *looks* like the website's. That
 * is a device question. This checks the content, which is the half that can be
 * checked here.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  COLLECTION_CARDS,
  COLLECTION_CARD_RAIL,
} from '../src/native/collectionCards';
import {matchesKey} from '../src/native/tileIcons';

/** The section the cards come from, in the template that declares them. */
const TEMPLATE = join(
  __dirname,
  '..',
  'zigly-website-code',
  'zigly-website',
  'templates',
  'list-collections.json',
);
const SECTION = 'collections_list_section_ridiUy';

type Block = {
  type: string;
  settings: {
    bg_color?: string;
    image?: string;
    heading?: string;
    sub_heading?: string;
    url?: string;
  };
};

/**
 * The theme's blocks, in `block_order`.
 *
 * The template carries a leading block comment (Shopify writes one into every
 * auto-generated template), which `JSON.parse` will not accept -- so it is
 * stripped first. Nothing else in these files uses `/* *\/`, and a comment
 * inside a string value would be a theme setting containing one, which none of
 * these do.
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
  return order.map(key => blocks[key]);
};

describe('the collections screen carries the themes own cards', () => {
  it('has one card per theme block, in the theme order', () => {
    const blocks = themeBlocks();
    expect(blocks.length).toBe(12);
    expect(COLLECTION_CARDS.length).toBe(blocks.length);
    expect(COLLECTION_CARDS.map(card => card.label)).toEqual(
      blocks.map(block => (block.settings.heading ?? '').trim()),
    );
  });

  it('carries the theme colour of each card, verbatim', () => {
    const blocks = themeBlocks();
    COLLECTION_CARDS.forEach((card, i) => {
      expect(card.color.toLowerCase()).toBe(
        (blocks[i].settings.bg_color ?? '').toLowerCase(),
      );
    });
  });

  it('carries the theme sub-heading of each card', () => {
    const blocks = themeBlocks();
    COLLECTION_CARDS.forEach((card, i) => {
      expect(card.subtitle).toBe((blocks[i].settings.sub_heading ?? '').trim());
    });
  });

  /**
   * The destination, with `shopify://collections/x` resolved to
   * `/collections/x`.
   *
   * This is the assertion that matters most: two of the twelve link to a handle
   * that does not match their heading -- Monsoon Essentials goes to
   * `monsoon-essentials-backup-27jul2026-151414` and Luxe Life to
   * `premium-pet-accessories-luxe`. A tidier-looking guess would 404 behind a
   * card that works on the website, so the odd handles are checked rather than
   * trusted.
   */
  it('points at the collection the theme links to', () => {
    const blocks = themeBlocks();
    COLLECTION_CARDS.forEach((card, i) => {
      const url = (blocks[i].settings.url ?? '').trim();
      expect(url.startsWith('shopify://collections/')).toBe(true);
      expect(card.path).toBe(
        `/collections/${url.slice('shopify://collections/'.length)}`,
      );
    });
  });

  it('gives every card a distinct artwork key', () => {
    const keys = COLLECTION_CARDS.map(card => card.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Each key must pair with its own block's image and with no other's.
   *
   * A stem that matched two blocks would hand both cards the first image found,
   * which is the silent mispairing ./tileIcons warns about -- a Cat Litter
   * photo on the Cat Food card.
   */
  it('pairs each artwork key to exactly one theme image', () => {
    const blocks = themeBlocks();
    const files = blocks.map(block =>
      (block.settings.image ?? '').replace('shopify://shop_images/', ''),
    );
    COLLECTION_CARDS.forEach((card, i) => {
      const matched = files.filter(file => matchesKey(file, card.key));
      expect(matched).toEqual([files[i]]);
    });
  });

  /**
   * The rail must ask `/collections` for its section.
   *
   * The Section Rendering API answers only with sections the requested page
   * renders, and this section is on no other page -- so a rail that defaulted
   * to `/` would return empty for ever and every card would silently lose its
   * picture.
   */
  it('reads its artwork from the page that has the section', () => {
    expect(COLLECTION_CARD_RAIL.page).toBe('/collections');
    expect(COLLECTION_CARD_RAIL.sectionId).toBe(SECTION);
    expect(SECTION.startsWith(COLLECTION_CARD_RAIL.fragment)).toBe(true);
    expect(COLLECTION_CARD_RAIL.tiles).toBe(COLLECTION_CARDS);
  });
});
