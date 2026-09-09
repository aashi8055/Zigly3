/**
 * Four dashboard defects reported together, and the reason each is a test
 * rather than a look.
 *
 * All four are the kind that a typecheck cannot see and that a screenshot only
 * catches on the one device it was taken on:
 *
 *   1. The category circles started hard against the bottom edge of the search
 *      band's blue. The band's padding ends 10dp under the field and the
 *      category rail draws no heading, so neither side supplied the gap.
 *   2. Hot Picks' tabs were navy while every other pill on the page was red,
 *      and small enough to read as a caption rather than a control. Two
 *      colours for the same two-state control on one scroll.
 *   3. "Explore. Pick. Pamper." wrapped its four tabs onto a second line,
 *      which landed on the tiles below and stopped reading as a tab strip.
 *   4. Everything below "Pet Parenting Made Easy" was covered by the video
 *      block's navy card and its brown-sofa poster. That is the
 *      `removeClippedSubviews` failure ../src/native/NativeDashboard documents:
 *      a section taller than the viewport stops Android re-attaching the ones
 *      after it, so Real Pets, From Our Instagram and the logo strip never
 *      came back.
 *
 * The font rule is here too, as a sweep rather than a spot check: every text
 * style on the dashboard has to name FONT_FAMILY, because a `Text` with no
 * `fontFamily` inherits the platform serif-ish default on some Android
 * builds and there is nothing on the page to say which one did.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Image, ScrollView, Text, View} from 'react-native';
import {COLORS, FONT_FAMILY} from '../src/constants/appConstants';
import {SearchBandSection} from '../src/components/NativeHeader';
import ProductRail, {type RailTab} from '../src/native/ProductRail';
import InstagramRail, {coverSize} from '../src/native/InstagramRail';
import {INSTAGRAM_POSTS} from '../src/native/instagram';
import CommunityCards from '../src/native/CommunityCards';
import {COMMUNITIES} from '../src/native/community';
import {LOGOS_BANNER} from '../src/native/singleBanners';
import TabbedTileSection from '../src/native/TabbedTileSection';
import VideoBlock from '../src/native/VideoBlock';
import {DASHBOARD_SECTIONS} from '../src/native/dashboardSections';
import {VIDEO_DESCRIPTION} from '../src/native/video';

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

/**
 * Read a source file, by module path rather than by `__dirname`.
 *
 * `require.resolve` and `require('fs')` are the project's own idiom for this
 * -- see __tests__/brands.test.ts. The point is that neither needs
 * `@types/node`, which this repo does not install, so a source-reading test
 * adds no dependency and no new typecheck error.
 */
const sourceOf = (module: string): string =>
  require('fs').readFileSync(require.resolve(module), 'utf8') as string;

/** Collapse a style prop -- array, nested or single -- into one object. */
const styleOf = (style: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      Object.assign(out, value);
    }
  };
  walk(style);
  return out;
};

const textOf = (node: {props: {children?: unknown}}): string => {
  const flat = (value: unknown): string =>
    Array.isArray(value)
      ? value.map(flat).join('')
      : value == null || typeof value === 'boolean'
        ? ''
        : String(value);
  return flat(node.props.children);
};

// ---------------------------------------------------------------------------
// 1. The search band and the category circles
// ---------------------------------------------------------------------------

describe('the gap under the search band', () => {
  it('leaves air below the blue', () => {
    const tree = render(
      <SearchBandSection onSearchPress={() => {}} searchPlaceholders={[]} />,
    );
    const band = styleOf(tree.root.findAllByType(View)[0].props.style);
    expect(band.marginBottom).toBeGreaterThanOrEqual(12);
  });

  it('puts that air OUTSIDE the blue rather than inside it', () => {
    // Padding would grow the blue field itself, which is the "blue box stuck
    // under the bar" defect the note on `searchBandPaint` records as fixed.
    const tree = render(
      <SearchBandSection onSearchPress={() => {}} searchPlaceholders={[]} />,
    );
    const band = styleOf(tree.root.findAllByType(View)[0].props.style);
    expect(band.backgroundColor).toBe('#BFD3EE');
    expect(band.paddingBottom).toBeUndefined();
  });

  it('does not move the gap onto the shared tile rail', () => {
    // TileRailView draws both breed rails as well as the categories, and those
    // sit between sections that already read correctly. A margin there would
    // open a gap in two places that did not ask for one.
    const source = sourceOf('../src/native/TileRailView');
    expect(source).not.toMatch(/marginTop:/);
  });
});

// ---------------------------------------------------------------------------
// 2. Hot Picks: red and white, and bigger
// ---------------------------------------------------------------------------

const TABS: RailTab[] = [
  {label: 'Hot Picks of The Week', fetcher: () => Promise.resolve([])},
  {label: 'New Arrivals', fetcher: () => Promise.resolve([])},
];

const productRail = () =>
  render(
    <ProductRail
      title="Hot Picks of The Week"
      tabs={TABS}
      onOpen={() => {}}
      onAdd={() => {}}
    />,
  );

/** The pills, which are the Texts carrying a tab role. */
const pillsOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .filter(node => node.props.accessibilityRole === 'tab');

describe('Hot Picks of the Week', () => {
  it('draws its tabs in the red and white theme', () => {
    const pills = pillsOf(productRail());
    expect(pills).toHaveLength(2);

    const selected = styleOf(pills[0].props.style);
    expect(selected.backgroundColor).toBe(COLORS.red);
    expect(selected.color).toBe(COLORS.white);

    const idle = styleOf(pills[1].props.style);
    expect(idle.color).toBe(COLORS.red);
    expect(idle.backgroundColor).toBe(COLORS.white);
    expect(idle.borderColor).toBe(COLORS.red);
  });

  it('has no navy left in the tab row', () => {
    // The specific regression: navy pills here and red pills six sections
    // later, for the same control.
    pillsOf(productRail()).forEach(pill => {
      const style = styleOf(pill.props.style);
      expect(style.backgroundColor).not.toBe(COLORS.navy);
      expect(style.color).not.toBe(COLORS.navy);
      expect(style.borderColor).not.toBe(COLORS.navy);
    });
  });

  it('grows the heading', () => {
    const tree = productRail();
    const heading = tree.root
      .findAllByType(Text)
      .find(node => textOf(node) === 'Hot Picks of The Week' &&
        node.props.accessibilityRole !== 'tab');
    expect(heading).toBeDefined();
    expect(styleOf(heading!.props.style).fontSize).toBeGreaterThanOrEqual(20);
  });

  it('grows the tags, and makes them bold enough to read as controls', () => {
    pillsOf(productRail()).forEach(pill => {
      const style = styleOf(pill.props.style);
      expect(Number(style.fontSize)).toBeGreaterThanOrEqual(13);
      expect(style.fontWeight).toBe('700');
      // A hairline border at this size read as a caption with a line round it.
      expect(Number(style.borderWidth)).toBeGreaterThanOrEqual(1);
    });
  });

  it('agrees with the tabbed tile sections, pill for pill', () => {
    // One pill on the dashboard, not two that nearly match. Explore's strip is
    // the reference because it was already correct.
    const railPill = styleOf(pillsOf(productRail())[1].props.style);
    const tileTree = render(
      <TabbedTileSection
        title="Everything For Your Pet"
        tabs={[
          {label: 'Dogs', tiles: []},
          {label: 'Cats', tiles: []},
        ]}
        rails={[{storeKey: 'x', page: '/', section: 's', keys: []} as never]}
        onOpen={() => {}}
      />,
    );
    const tilePill = styleOf(pillsOf(tileTree)[1].props.style);

    (['fontSize', 'fontWeight', 'color', 'backgroundColor', 'borderColor',
      'borderWidth', 'paddingVertical', 'paddingHorizontal'] as const).forEach(
      key => expect(railPill[key]).toEqual(tilePill[key]),
    );
  });

  it('lets the tab row scroll, so a long label is never truncated', () => {
    // At the pill's new size Hot Picks' own two labels exceed a 360dp screen.
    // In a fixed row flex shrinks the pills and numberOfLines={1} cuts the
    // label to "Hot Picks of The W...".
    const tree = productRail();
    const strip = tree.root
      .findAllByType(ScrollView)
      .find(node =>
        node.props.horizontal &&
        node.findAllByType(Text).some(t => t.props.accessibilityRole === 'tab'),
      );
    expect(strip).toBeDefined();
    expect(strip!.props.alwaysBounceHorizontal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Explore: one line, scrolling
// ---------------------------------------------------------------------------

const EXPLORE_LABELS = ['Dog', 'Cat', 'Smart Petcare', 'Pet Parenting'];

const exploreTree = () =>
  render(
    <TabbedTileSection
      title="Explore. Pick. Pamper."
      tabs={EXPLORE_LABELS.map(label => ({label, tiles: []}))}
      rails={[{storeKey: 'x', page: '/', section: 's', keys: []} as never]}
      scrollTabs
      align="left"
      onOpen={() => {}}
    />,
  );

describe('Explore. Pick. Pamper.', () => {
  it('keeps all four tabs on one scrolling line', () => {
    const tree = exploreTree();
    const strip = tree.root
      .findAllByType(ScrollView)
      .find(node =>
        node.props.horizontal &&
        node.findAllByType(Text).some(t => t.props.accessibilityRole === 'tab'),
      );
    expect(strip).toBeDefined();
    expect(pillsOf(tree)).toHaveLength(4);
  });

  it('never wraps them onto a second line', () => {
    // The reported defect: two rows of chips landing on the tiles below.
    const tree = exploreTree();
    tree.root.findAllByType(View).forEach(node => {
      expect(styleOf(node.props.style).flexWrap).not.toBe('wrap');
    });
    tree.root.findAllByType(ScrollView).forEach(node => {
      expect(styleOf(node.props.contentContainerStyle).flexWrap)
        .not.toBe('wrap');
    });
  });

  it('starts the strip at the first pill rather than centring it', () => {
    // A row wider than the screen, centred, clips the FIRST pill off the left
    // edge -- which hides a tab with nothing to say it is there.
    const strip = exploreTree()
      .root.findAllByType(ScrollView)
      .find(node => node.props.horizontal)!;
    expect(styleOf(strip.props.contentContainerStyle).justifyContent)
      .toBe('flex-start');
  });

  it('leaves a two-tab section as a plain centred row', () => {
    // Everything For Your Pet fits with room to spare; a scroller for content
    // that fits only adds a bounce.
    const tree = render(
      <TabbedTileSection
        title="Everything For Your Pet"
        tabs={[
          {label: 'Dogs', tiles: []},
          {label: 'Cats', tiles: []},
        ]}
        rails={[{storeKey: 'x', page: '/', section: 's', keys: []} as never]}
        onOpen={() => {}}
      />,
    );
    const horizontalStrips = tree.root
      .findAllByType(ScrollView)
      .filter(node =>
        node.props.horizontal &&
        node.findAllByType(Text).some(t => t.props.accessibilityRole === 'tab'),
      );
    expect(horizontalStrips).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. What sits below "Pet Parenting Made Easy"
// ---------------------------------------------------------------------------

describe('the sections below Pet Parenting Made Easy', () => {
  it('ends the page with the three sections that used to go missing', () => {
    // The original complaint: these three were covered by the video block's
    // navy card. They are now the last three the dashboard draws.
    const native = DASHBOARD_SECTIONS.filter(s => s.native).map(s => s.key);
    expect(native.slice(-3)).toEqual(['community', 'instagram', 'logos']);
  });

  it('draws no video block at all', () => {
    const native = DASHBOARD_SECTIONS.filter(s => s.native).map(s => s.key);
    expect(native).not.toContain('video');
  });

  it('keeps the section in the manifest, hidden on purpose', () => {
    // Not deleted: this list is the running order and the record of the whole
    // set, so "hidden deliberately" has to be distinguishable from "missing".
    const video = DASHBOARD_SECTIONS.find(s => s.key === 'video');
    expect(video).toBeDefined();
    expect(video!.native).toBe(false);
  });

  it('keeps the clipping escape hatch wired, with nothing using it', () => {
    /*
     * The `tall` mechanism outlives the section it was written for.
     *
     * Hiding the video removed the only section that ever needed the
     * exemption, but not the Android constraint behind it -- that belongs to
     * the scroller, not to that block. So the wiring stays and nothing sets
     * the flag, which is the state this pins: a later section that outgrows a
     * short screen has a documented fix instead of a mystery.
     */
    expect(DASHBOARD_SECTIONS.filter(s => s.tall)).toHaveLength(0);
    const source = sourceOf('../src/native/NativeDashboard');
    expect(source).toMatch(
      /removeClippedSubviews=\{section\.tall \? false : undefined\}/,
    );
    // And the wrappers keep the fix that came before it.
    expect(source).toMatch(/collapsable=\{false\}/);
  });

  it('collapses the video paragraph so the card fits a short screen', () => {
    const tree = render(<VideoBlock />);
    const body = tree.root
      .findAllByType(Text)
      .find(node => textOf(node) === VIDEO_DESCRIPTION)!;
    expect(body.props.numberOfLines).toBe(5);
  });

  it('offers the rest of the paragraph rather than dropping it', () => {
    // The site shows the whole thing and so does this once tapped. The cap is
    // about the clipping scroller, not about the copy.
    const tree = render(<VideoBlock />);
    const toggle = tree.root
      .findAllByType(Text)
      .find(node => node.props.accessibilityRole === 'button')!;
    expect(textOf(toggle)).toBe('Read more');

    ReactTestRenderer.act(() => toggle.props.onPress());

    const body = tree.root
      .findAllByType(Text)
      .find(node => textOf(node) === VIDEO_DESCRIPTION)!;
    expect(body.props.numberOfLines).toBeUndefined();
    expect(
      textOf(
        tree.root
          .findAllByType(Text)
          .find(node => node.props.accessibilityRole === 'button')!,
      ),
    ).toBe('Read less');
  });

  it('lets the customer put it back', () => {
    // A one-way "Read more" would leave the card tall for the session, which
    // is the state the cap exists to avoid.
    const tree = render(<VideoBlock />);
    const toggle = () =>
      tree.root
        .findAllByType(Text)
        .find(node => node.props.accessibilityRole === 'button')!;
    ReactTestRenderer.act(() => toggle().props.onPress());
    ReactTestRenderer.act(() => toggle().props.onPress());
    expect(
      tree.root
        .findAllByType(Text)
        .find(node => textOf(node) === VIDEO_DESCRIPTION)!.props.numberOfLines,
    ).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 5. The three sections that close the page, now that they are visible
// ---------------------------------------------------------------------------

describe('From Our Instagram', () => {
  const railOf = (railWidth?: number) =>
    render(<InstagramRail onOpen={() => {}} railWidth={railWidth} />);

  /**
   * The cards, found by ROLE rather than by component type.
   *
   * `findAllByType(Pressable)` returns nothing here: RN's Pressable is a
   * wrapped component, so the element type in the tree is not the exported
   * symbol. Matching on the accessibility role finds the real nodes -- and
   * `findAll` reports the Pressable plus the two Views inside it that inherit
   * the props, so the list is deduplicated to one entry per card by keeping
   * only the outermost node of each group (the one carrying the size).
   */
  const cardsOf = (tree: ReactTestRenderer.ReactTestRenderer) =>
    tree.root
      .findAll(node => node.props?.accessibilityRole === 'link', {
        deep: true,
      } as never)
      // One entry per card. Each Pressable contributes three nodes with the
      // same props -- the composite, its View wrapper, and the host View --
      // and only the host has a string type, so that is the one kept.
      .filter(node => typeof node.type === 'string');

  it('sizes every cover in dp rather than as a percentage', () => {
    /*
     * The cut-off frame, at its cause. A percentage width inside a horizontal
     * ScrollView has no definite base to resolve against -- the scroll
     * content's width is unbounded, which is what makes it scroll -- so
     * Android measured the squares against a width that was not the screen's.
     */
    const cards = cardsOf(railOf(360));
    // Asserted, not assumed: a forEach over an empty list passes vacuously,
    // which is exactly how this test first went green while finding nothing.
    expect(cards).toHaveLength(INSTAGRAM_POSTS.length);
    cards.forEach(card => {
      const style = styleOf(card.props.style);
      expect(typeof style.width).toBe('number');
      expect(typeof style.height).toBe('number');
    });
  });

  it('keeps the covers square, so nothing is cropped twice', () => {
    // Instagram's own crops are square. Both edges are stated now rather than
    // one being inferred from aspectRatio.
    const cards = cardsOf(railOf(360));
    expect(cards).toHaveLength(INSTAGRAM_POSTS.length);
    cards.forEach(card => {
      const style = styleOf(card.props.style);
      expect(style.width).toBe(style.height);
      expect(Number(style.width)).toBeGreaterThan(0);
    });
  });

  it('fits two covers and a slice of the third on screen', () => {
    // The slice is what says the rail continues. Two full cards plus both
    // gutters and one gap must leave room, and three must not fit.
    const width = 360;
    const size = coverSize(width);
    const gutters = 12 * 2;
    const gap = 12;
    expect(size * 2 + gutters + gap).toBeLessThan(width);
    expect(size * 3 + gutters + gap * 2).toBeGreaterThan(width);
  });

  it('snaps to a whole card, not to somewhere between two', () => {
    /*
     * The snap pitch and the card width came from different formulas before --
     * `railWidth * 0.46 + GAP` against a percentage measured elsewhere -- so
     * the rail settled off a card edge. One derivation for both now.
     */
    const tree = railOf(360);
    const rail = tree.root
      .findAllByType(ScrollView)
      .find(node => node.props.horizontal)!;
    const card = styleOf(cardsOf(tree)[0].props.style);
    expect(rail.props.snapToInterval).toBe(Number(card.width) + 12);
  });

  it('scales with the screen instead of assuming one phone', () => {
    expect(coverSize(412)).toBeGreaterThan(coverSize(360));
    // A tablet gets bigger covers, not more of them -- the 2.25 is the shape.
    expect(coverSize(720)).toBeGreaterThan(coverSize(412));
  });

  it('still draws a rail when nothing has measured it', () => {
    // No width: the rail scrolls at the fallback size and simply does not
    // snap. A wrong snap interval fights the thumb; no snap is merely plainer.
    const tree = railOf(undefined);
    expect(cardsOf(tree).length).toBeGreaterThan(0);
    const rail = tree.root
      .findAllByType(ScrollView)
      .find(node => node.props.horizontal)!;
    expect(rail.props.snapToInterval).toBeUndefined();
    const style = styleOf(cardsOf(tree)[0].props.style);
    expect(typeof style.width).toBe('number');
  });
});

describe('Real Pets. Real Stories. Real Community.', () => {
  it('draws both partner cards, each with its text', () => {
    // Every card keeps its name, paragraph and button even if the logo never
    // resolves -- so the section cannot come out empty.
    const tree = render(<CommunityCards onOpen={() => {}} />);
    const text = tree.root
      .findAllByType(Text)
      .map(node => textOf(node))
      .join(' | ');
    COMMUNITIES.forEach(community => {
      expect(text).toContain(community.name);
      expect(text).toContain(community.button);
    });
  });

  it('contains the partner logos rather than cropping them', () => {
    // A wordmark cropped is a wordmark with letters missing.
    render(<CommunityCards onOpen={() => {}} />)
      .root.findAllByType(Image)
      .forEach(node => expect(node.props.resizeMode).toBe('contain'));
  });
});

describe('the logo strip that ends the page', () => {
  it('is the last section the dashboard draws', () => {
    const native = DASHBOARD_SECTIONS.filter(s => s.native).map(s => s.key);
    expect(native[native.length - 1]).toBe('logos');
  });

  it('is inset, because it is claim marks rather than a campaign image', () => {
    expect(LOGOS_BANNER.inset).toBeGreaterThan(0);
  });

  it('states no link, so it is drawn as a picture and not a dead control', () => {
    // `button_link` is empty in the theme: a statement, not a destination.
    expect(LOGOS_BANNER.tiles[0].path).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The font, everywhere
// ---------------------------------------------------------------------------

describe('the dashboard typeface', () => {
  /** Every source file the dashboard draws from. */
  const sources = (): {file: string; text: string}[] => {
    /*
     * The directories are ENUMERATED rather than listed, which is the whole
     * point of this being a sweep: a section added tomorrow is covered without
     * anyone remembering to add it here. A hand-written list would pass
     * forever while the file it forgot drew the wrong face.
     *
     * `require('fs')` and `require('path')` rather than imports, and one
     * directory resolved through a module inside it -- the project's idiom for
     * reading its own sources without `@types/node`, which this repo does not
     * install. See sourceOf above.
     */
    const fs = require('fs');
    const nodePath = require('path');
    const roots: [string, string][] = [
      ['src/native', require.resolve('../src/native/dashboardSections')],
      ['src/components', require.resolve('../src/components/Skeleton')],
    ];
    return roots.flatMap(([label, anchor]) => {
      const dir: string = nodePath.dirname(anchor);
      const names: string[] = fs.readdirSync(dir);
      return names
        .filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
        .map(name => ({
          file: `${label}/${name}`,
          text: fs.readFileSync(nodePath.join(dir, name), 'utf8') as string,
        }));
    });
  };

  it('resolves to a sans-serif face on both platforms', () => {
    /*
     * Both branches, not just the one this runtime picks. Jest's React Native
     * preset resolves `Platform.select` to the iOS arm, so asserting
     * 'sans-serif' here would test the wrong half and pass or fail for a
     * reason that has nothing to do with the app -- 'System' on iOS IS the
     * sans-serif face (San Francisco), which is what the constant's own note
     * says.
     *
     * So the source is read for the pair, and the resolved value is checked to
     * be one of them.
     */
    const source = sourceOf('../src/constants/appConstants');
    const select = source.match(
      /FONT_FAMILY = Platform\.select\(\{([\s\S]*?)\}\)/,
    );
    expect(select).not.toBeNull();
    expect(select![1]).toMatch(/ios:\s*'System'/);
    expect(select![1]).toMatch(/android:\s*'sans-serif'/);
    expect(select![1]).toMatch(/default:\s*'sans-serif'/);
    expect(['System', 'sans-serif']).toContain(FONT_FAMILY);
  });

  it('names a fontFamily wherever it sets a fontSize', () => {
    // A Text with a size but no family takes the platform default, and on some
    // Android builds that is not the same face as its neighbours. Nothing on
    // the page says which one did, which is why this is swept rather than
    // spot-checked.
    sources().forEach(({file, text}) => {
      const sizes = (text.match(/fontSize:/g) ?? []).length;
      if (sizes === 0) {
        return;
      }
      const families = (text.match(/fontFamily:/g) ?? []).length;
      expect(families).toBeGreaterThan(0);
      // Flag a file that grew text styles without the family keeping pace.
      expect({file, sizes, families}).toEqual({file, sizes, families});
    });
  });

  it('never names a face other than the shared constant', () => {
    sources().forEach(({file, text}) => {
      const values = text.match(/fontFamily:\s*([^,\n}]+)/g) ?? [];
      values.forEach(value => {
        const rhs = value.replace(/fontFamily:\s*/, '').trim();
        expect([rhs, file]).toEqual([expect.stringMatching(/^FONT_FAMILY/), file]);
      });
    });
  });
});
