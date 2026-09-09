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

/**
 * The sections the app assembles rather than fetching whole, and why each one
 * has no single section fragment to name.
 *
 * Kept as one list because two tests need it, and because the reasons differ --
 * a rule like "graphql or frozen" would not hold: Everything For is
 * section-sourced and still has nothing to name.
 *
 *   hot-picks    two of Zigly's own collections behind a tab. Its manifest
 *                entry used to name `home_arrival_section@dog`, which is the
 *                source ../src/webview/hotPicks abandoned as "the wrong
 *                products under the right heading".
 *   bestsellers  a GraphQL query against sort_by=best-selling.
 *   everything   TWO fetched sections merged under tab labels no template has
 *                (the dog page ships Puppy/Adult, the cat page Kitten/Cat).
 *   instagram    frozen shortcodes; not read from zigly.com at all.
 *   video        the promotional block. Its entry used to name
 *                `custom_video_text_banner`, fetched to learn a poster image
 *                that does not exist: the dog page's copy of that section sets
 *                `video_link` to a YouTube URL and no `video_poster`, so it
 *                renders a bare `<iframe>` with no image in it. The heading and
 *                copy are theme settings held in the app and the poster is
 *                derived from the video id, so there is nothing to fetch.
 */
const ASSEMBLED = [
  'bestsellers',
  'everything',
  'hot-picks',
  'instagram',
  'video',
];

/**
 * The fragments the web dashboard declared, in its own order.
 *
 * THIS USED TO BE READ OUT OF `EXTRA_SECTIONS_SCRIPT` AND THAT MODULE IS GONE.
 * It, and the twelve other in-page section builders, were deleted when
 * ../src/native/NativeDashboard took over -- they existed to assemble a
 * dashboard inside a WebView nobody looks at any more.
 *
 * So the reference is frozen here instead. That is a real loss and worth
 * naming: the old helper re-read the live array, so a section reordered in the
 * web module was seen here automatically, and this list has to be edited by
 * hand. It is kept rather than dropped because of what these three tests
 * actually catch -- a section silently missing from the native rebuild, or one
 * invented that the site never had -- which is exactly the class of drift the
 * standing design rule (CLAUDE.md) exists to prevent, and which nothing else
 * in this suite checks.
 *
 * Captured from `extraSections.ts` at commit 257879c, the switch-over, by
 * running the module and reading its generated `var SECTIONS` array. The order
 * is the declaration order, with `move`/`hide`/`slot` entries resolved to their
 * key exactly as the old helper did.
 */
const WEB_SECTION_ORDER: string[] = [
  'coupon_slider',
  'offer_section#1',
  'offer_section#2',
  'best_deals',
  'home_shop_by_brand_section',
  'shop_by_price',
  'custom_single_banner#2',
  'shop_of_concern',
  'offer_section#3',
  'zigly-x-bestsellers',
  'home_arrival_section',
  'zigly-x-everything',
  'redesign_custom_double_banner',
  'helpful_tips',
  'custom_video_text_banner',
  'about_our_communities',
  'zigly-x-instagram',
  'custom_single_banner#3',
];

const extraSectionOrder = (): string[] => WEB_SECTION_ORDER;

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
    /*
     * Sections the manifest carries under their own key with no fetchable
     * fragment. Three are reserved slots filled by their own modules.
     *
     * `custom_video_text_banner` is the fourth and is different in kind: the
     * web dashboard really did fetch that section, and the native one does not
     * need to. It was fetched to learn a poster image the section does not
     * contain -- the dog page sets `video_link` to a YouTube URL and no
     * `video_poster`, so the markup is a bare `<iframe>`. The native block
     * derives its poster from the video id instead, which is why the fragment
     * left the manifest. See ../src/native/video.
     */
    const slots = [
      'zigly-x-bestsellers',
      'zigly-x-everything',
      'zigly-x-instagram',
      'custom_video_text_banner',
    ];

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
        // The app assembles these rather than fetching a section whole; see
        // ASSEMBLED below for what each one is and why.
        expect(ASSEMBLED).toContain(section.key);
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

  /**
   * The two sections not read from zigly.com at runtime.
   *
   * Instagram was the only one until the video block joined it: that section's
   * poster is derived from a YouTube video id rather than fetched, and its
   * heading, copy and ground are theme settings held in the app -- so no part
   * of it touches the store. See ../src/native/video for why, and note that
   * the two are frozen for different reasons: Instagram because the site has
   * no feed to read, the video because the section it would read carries no
   * image at all.
   */
  it('marks Instagram and the video block as the frozen sources', () => {
    const frozen = DASHBOARD_SECTIONS.filter(s => s.source === 'frozen');
    expect(frozen.map(s => s.key).sort()).toEqual(['instagram', 'video']);
  });

  /**
   * A section with no fetchable fragment must be one the app assembles.
   *
   * They qualify for different reasons: bestsellers is a GraphQL query,
   * Instagram is frozen shortcodes, the video block derives its poster from a
   * YouTube id, and Everything For merges two fetched sections under tab labels
   * no template has. The last is why this rule cannot simply be "graphql or
   * frozen" -- it is `section`-sourced and still has no single fragment to
   * name.
   */
  it('only allows a null fragment where the app assembles the section', () => {
    const assembled = DASHBOARD_SECTIONS.filter(s => s.fragment === null);
    expect(assembled.map(s => s.key).sort()).toEqual(ASSEMBLED);
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
   * WAS: native sections must be a run from the top, with no gaps.
   *
   * That guard existed for a migration that has since finished, and it is
   * retired rather than quietly weakened. Its reasoning was that a contiguous
   * run "is what makes a partial switch-over possible at any point -- native
   * sections above, WebView below -- which is the fallback if the full
   * migration needs to ship in halves". Every section became native in
   * 257879c, so there is no half left to ship and no WebView tail to keep
   * below the run.
   *
   * `native: false` now means something the old test could not distinguish: a
   * section the app draws NOTHING for on purpose. The video block is the first
   * -- see its entry in ../src/native/dashboardSections for why -- and a
   * deliberately hidden section sits wherever the running order puts it, which
   * is mid-list. Under the old rule, hiding it would have read as a regression
   * in a migration that is already complete.
   *
   * What is still worth holding is the part that catches a real mistake: a
   * section drawn by nothing must be hidden ON PURPOSE, with the manifest
   * saying so, rather than by omission.
   */
  it('draws every section it does not deliberately hide', () => {
    const hidden = DASHBOARD_SECTIONS.filter(s => !s.native).map(s => s.key);
    // The one section the app deliberately draws nothing for. Adding another
    // means saying so here, which is the point -- a section that silently
    // stopped drawing is the failure this replaces.
    expect(hidden).toEqual(['video']);
  });

  it('still draws the three sections that close the page', () => {
    // The regression that prompted the video block being hidden: its card was
    // taller than the viewport, and Android's clipping stopped re-attaching
    // everything after it. These three are what went missing.
    const native = DASHBOARD_SECTIONS.filter(s => s.native).map(s => s.key);
    expect(native.slice(-3)).toEqual(['community', 'instagram', 'logos']);
  });
});
