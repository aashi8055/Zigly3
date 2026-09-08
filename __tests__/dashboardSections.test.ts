/**
 * The native dashboard must be the app's dashboard, section for section.
 *
 * ./dashboardSections is a hand-written list, and a hand-written list of
 * twenty-three things derived from five other files is exactly the artefact
 * that silently goes stale. So this suite reads the real placement modules and
 * checks the manifest against them: every section the web dashboard fetches
 * appears in the list, in the order those modules actually produce, and nothing
 * appears that the web dashboard does not show.
 *
 * That is the whole point of the manifest. "The native dashboard matches the
 * app" stops being a claim someone remembers and becomes a test that fails.
 *
 * WHAT THIS CANNOT CHECK, stated so nobody reads more into a pass than is
 * there: it compares declarations, not pixels. Whether a native section *looks*
 * like the web one it replaces is a device question, and the answer lives in
 * whoever runs the app -- not here.
 */
import {
  DASHBOARD_SECTIONS,
  HIDDEN_SECTIONS,
  nativeCount,
} from '../src/native/dashboardSections';
import {EXTRA_SECTIONS_SCRIPT} from '../src/webview/extraSections';

/**
 * The fragments ../src/webview/extraSections declares, in its own order.
 *
 * Read off the generated script rather than re-typing the array, so a section
 * added or reordered there is seen here. The script embeds the array as JSON,
 * which is what makes it readable at all.
 */
const extraSectionOrder = (): string[] => {
  const json = /var SECTIONS = (\[[\s\S]*?\]);/.exec(EXTRA_SECTIONS_SCRIPT);
  if (!json) {
    throw new Error('SECTIONS array not found in EXTRA_SECTIONS_SCRIPT');
  }
  const entries = JSON.parse(json[1]) as {
    key?: string;
    move?: string;
    hide?: string;
    slot?: string;
  }[];
  return entries.map(e => e.key || e.move || e.hide || e.slot || '?');
};

describe('the manifest is the web dashboard, in the same order', () => {
  /**
   * The order the customer sees, and the reason the manifest exists.
   *
   * extraSections declares its own entries in order, but four sections land
   * before them -- the two breed rails, hot picks and explore, each anchored by
   * its own module after the coupon strip. So the manifest's order is not
   * extraSections' order, and this checks the part that IS.
   */
  it('follows extraSections declaration order for the sections it declares', () => {
    const declared = extraSectionOrder();
    // Only the entries that produce a visible section: `hide` removes one.
    const visible = declared.filter(f => !HIDDEN_SECTIONS.includes(f));

    // The manifest fragments, in manifest order, restricted to those
    // extraSections is responsible for.
    const manifest = DASHBOARD_SECTIONS.map(s => s.fragment).filter(
      (f): f is string => f !== null && visible.includes(f),
    );

    // Slots and moves carry no fetchable fragment in the manifest
    // (bestsellers, instagram), so compare the intersection in order.
    const expected = visible.filter(f => manifest.includes(f));
    expect(manifest).toEqual(expected);
  });

  /**
   * Nothing the web dashboard fetches may be missing from the list. This is the
   * check that catches a section quietly dropped from the native rebuild.
   */
  it('accounts for every section extraSections places', () => {
    const declared = extraSectionOrder();
    const known = new Set<string>([
      ...DASHBOARD_SECTIONS.map(s => s.fragment).filter(
        (f): f is string => f !== null,
      ),
      ...HIDDEN_SECTIONS,
    ]);
    // The two reserved slots are filled by their own modules and carry no
    // fetchable fragment; they are in the manifest under their own keys.
    const slots = ['zigly-x-bestsellers', 'zigly-x-everything', 'zigly-x-instagram'];

    const unaccounted = declared.filter(f => !known.has(f) && !slots.includes(f));
    expect(unaccounted).toEqual([]);
  });

  /**
   * And nothing may be in the list that the web dashboard does not show. A
   * native section with no counterpart would be this app inventing a section.
   */
  it('invents no section the web dashboard does not have', () => {
    const declared = new Set(extraSectionOrder());
    // Sections placed outside extraSections, each by its own module.
    const placedElsewhere = new Set([
      'home_category_section', // homeLayout
      'homepage_banner', // homeLayout
      'home_shop_by_breed_section@dog', // breedSection
      'home_shop_by_breed_section@cat', // breedSection
      'home_arrival_section@dog', // hotPicks
      'explore_product@dog', // explorePicker
    ]);

    for (const section of DASHBOARD_SECTIONS) {
      if (section.fragment === null) {
        // The three the app assembles rather than fetches whole: bestsellers
        // (a GraphQL query), Instagram (frozen shortcodes), and Everything For
        // (two fetched sections merged under relabelled tabs).
        expect(['bestsellers', 'instagram', 'everything']).toContain(
          section.key,
        );
        continue;
      }
      const isKnown =
        declared.has(section.fragment) || placedElsewhere.has(section.fragment);
      expect(isKnown).toBe(true);
    }
  });

  /** The arrival sections are hidden on purpose, not forgotten. */
  it('records the hidden sections rather than omitting them silently', () => {
    const declared = extraSectionOrder();
    for (const hidden of HIDDEN_SECTIONS) {
      expect(declared).toContain(hidden);
    }
    // And none of them is also being drawn.
    const drawn = DASHBOARD_SECTIONS.map(s => s.fragment);
    expect(drawn).not.toContain('home_arrival_section');
  });
});

describe('the manifest is well formed', () => {
  it('gives every section a unique key', () => {
    const keys = DASHBOARD_SECTIONS.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The dashboard opens on the circles, then the banner, then the coupons --
   * ../webview/homeLayout is explicit that this is a reorder of the live site,
   * which ships the banner first. Pinned because it is the first screen and the
   * one ../components/Skeleton draws a placeholder for.
   */
  it('opens on categories, banner, coupons, in that order', () => {
    expect(DASHBOARD_SECTIONS.slice(0, 3).map(s => s.key)).toEqual([
      'categories',
      'banner',
      'coupons',
    ]);
  });

  /** The logo strip is last so it sits directly above the footer. */
  it('closes on Instagram then the logo strip', () => {
    expect(DASHBOARD_SECTIONS.slice(-2).map(s => s.key)).toEqual([
      'instagram',
      'logos',
    ]);
  });

  /**
   * The breed rails are both "Breed Ready Picks" on their source pages;
   * ../webview/breedSection suffixes them because the app shows them together
   * and the site never does. Two identical headings back to back is the defect
   * that would reappear if a native rewrite took the titles from the theme.
   */
  it('disambiguates the two breed rails', () => {
    const titles = DASHBOARD_SECTIONS.filter(s =>
      s.key.startsWith('breeds-'),
    ).map(s => s.title);
    expect(titles).toEqual([
      'Breed Ready Picks - Dogs',
      'Breed Ready Picks - Cats',
    ]);
    expect(new Set(titles).size).toBe(2);
  });

  /** Instagram is the one section not read from zigly.com. */
  it('marks Instagram as the only frozen source', () => {
    const frozen = DASHBOARD_SECTIONS.filter(s => s.source === 'frozen');
    expect(frozen.map(s => s.key)).toEqual(['instagram']);
  });

  /**
   * A section with no fetchable fragment must be one the app assembles.
   *
   * Three qualify, for three different reasons: bestsellers is a GraphQL query,
   * Instagram is frozen shortcodes, and Everything For merges two fetched
   * sections under tab labels no template has. The last is why this rule cannot
   * simply be "graphql or frozen" -- it is `section`-sourced and still has no
   * single fragment to name.
   */
  it('only allows a null fragment where the app assembles the section', () => {
    const assembled = DASHBOARD_SECTIONS.filter(s => s.fragment === null);
    expect(assembled.map(s => s.key).sort()).toEqual([
      'bestsellers',
      'everything',
      'instagram',
    ]);
  });
});

describe('migration progress', () => {
  /**
   * Deliberately a floor and not an equality.
   *
   * A test that pinned the exact count would fail on every section added,
   * training whoever adds one to edit the number without reading why -- which
   * is how a guard rail becomes a formality. What matters is that finished work
   * does not silently regress.
   */
  it('has at least the three finished sections marked native', () => {
    expect(nativeCount()).toBeGreaterThanOrEqual(3);
    const native = DASHBOARD_SECTIONS.filter(s => s.native).map(s => s.key);
    expect(native).toContain('categories');
    expect(native).toContain('banner');
    expect(native).toContain('coupons');
  });

  /**
   * Native sections must be a run from the top, with no gaps.
   *
   * The chosen plan is to build every section and then switch over, so a gap
   * would not break anything today. It is still worth holding: a contiguous run
   * is what makes a partial switch-over possible at any point -- native
   * sections above, WebView below -- which is the fallback if the full
   * migration needs to ship in halves.
   */
  it('keeps the native sections contiguous from the top', () => {
    const flags = DASHBOARD_SECTIONS.map(s => s.native);
    const firstWeb = flags.indexOf(false);
    if (firstWeb !== -1) {
      expect(flags.slice(firstWeb).some(Boolean)).toBe(false);
    }
  });
});
