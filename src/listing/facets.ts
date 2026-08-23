/**
 * Sort and filter, as the app's own screens see them.
 *
 * The engine is the site's. zigly.com runs SearchTap (a Vue app mounted over
 * the theme's collection and search templates), and every option, every count
 * and every result on this screen is SearchTap's answer -- read out of the page
 * by ../webview/facetBridge and applied by clicking SearchTap's own controls.
 * Nothing here queries anything, and nothing here decides what a filter means.
 *
 * What is ours is the *frontend*: a bar, a sort sheet and a filter sheet the
 * app draws itself (see ../components/SortFilterBar, SortSheet, FilterSheet),
 * because the site's are a blue pill pair, a left-sliding drawer and a
 * two-column accordion, and none of that is what this app looks like.
 *
 * This module is the join between the two: the shape the bridge posts, the
 * parser that refuses anything malformed, and the optimistic updates that let a
 * tap register on the frame it happened rather than on the frame SearchTap's
 * round trip comes back.
 */

/** One value inside a facet -- "cat (63)". */
export interface FacetOption {
  /** SearchTap's own label, and the value its checkbox carries. */
  label: string;
  /** How many products remain if this is applied. Always shown, as the site does. */
  count: number;
  /** Applied right now. */
  on: boolean;
}

/** One facet: a heading and its values. Titles are Zigly's own. */
export interface FacetGroup {
  title: string;
  options: FacetOption[];
}

export interface Facets {
  /**
   * SearchTap has rendered its facets.
   *
   * False means "not yet", never "none": on a collection page SearchTap does
   * not fetch facets until something asks for them, so the filter sheet opens
   * on a spinner rather than on an empty screen. See facetBridge's warm().
   */
  ready: boolean;
  groups: FacetGroup[];
  /** In the site's own order. */
  sortOptions: string[];
  /** Which of them is applied. */
  sortLabel: string;
}

/**
 * The five sorts, as SearchTap's own configuration lists them.
 *
 * Read from `collectionSortValues` in assets/searchtap.js on 2026-08-23, in
 * that order. They are seeded here so the sort sheet is never empty -- the
 * bridge replaces them with whatever the page actually offers, which is what
 * keeps this from freezing a list Zigly may change.
 */
export const SEED_SORT_OPTIONS: string[] = [
  'Best selling',
  'Price: Low to High',
  'Price: High to Low',
  'New Release',
  'Discount: High to Low',
];

/** The site's own default, and the label SearchTap starts on. */
export const DEFAULT_SORT = 'Best selling';

export const EMPTY_FACETS: Facets = {
  ready: false,
  groups: [],
  sortOptions: SEED_SORT_OPTIONS,
  sortLabel: DEFAULT_SORT,
};

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asCount = (value: unknown): number =>
  typeof value === 'number' && isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;

const parseOption = (raw: unknown): FacetOption | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const item = raw as Record<string, unknown>;
  const label = asText(item.label);
  if (!label) {
    return null;
  }
  return {label, count: asCount(item.count), on: item.on === true};
};

const parseGroup = (raw: unknown): FacetGroup | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const group = raw as Record<string, unknown>;
  const title = asText(group.title);
  const options = Array.isArray(group.options)
    ? (group.options.map(parseOption).filter(Boolean) as FacetOption[])
    : [];
  // A heading with nothing under it is not a filter. This is also what keeps
  // SearchTap's price slider and its single "Include Out Of Stock" toggle out:
  // neither offers counted values, so neither survives the read.
  if (!title || options.length === 0) {
    return null;
  }
  return {title, options};
};

/**
 * The bridge's message, or null if it is not one.
 *
 * Deliberately forgiving about content and strict about shape: a page that
 * renders one malformed facet should cost that facet, not the sheet.
 */
export const parseFacets = (raw: unknown): Facets | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (data.tag !== 'facets') {
    return null;
  }
  const groups = Array.isArray(data.groups)
    ? (data.groups.map(parseGroup).filter(Boolean) as FacetGroup[])
    : [];
  const sortOptions = Array.isArray(data.sortOptions)
    ? data.sortOptions.map(asText).filter(Boolean)
    : [];
  const sortLabel = asText(data.sortLabel);
  return {
    ready: data.ready === true,
    groups,
    // Never empty: an empty sort sheet is worse than a stale one, and the five
    // labels are SearchTap's own configuration rather than a guess.
    sortOptions: sortOptions.length ? sortOptions : SEED_SORT_OPTIONS,
    sortLabel: sortLabel || DEFAULT_SORT,
  };
};

/** How many filter values are applied, across every facet. */
export const selectedCount = (facets: Facets): number =>
  facets.groups.reduce(
    (total, group) =>
      total + group.options.reduce((n, option) => n + (option.on ? 1 : 0), 0),
    0,
  );

/**
 * Flip one value, before the site has been told.
 *
 * The tap is a click on SearchTap's checkbox and a round trip to its API, so
 * the chip would otherwise stay unfilled for a few hundred milliseconds -- long
 * enough to read as a tap that missed. This paints the chip immediately; the
 * next message from the page replaces the lot, so a flip the site rejects
 * corrects itself rather than sticking.
 *
 * By position, which is how the bridge addresses it too. Two facets on this
 * store are both called "Flavor" and both offer "chicken", so flipping by
 * heading and label would fill in a chip the customer did not tap.
 */
export const toggleOption = (
  facets: Facets,
  groupIndex: number,
  label: string,
): Facets => ({
  ...facets,
  groups: facets.groups.map((group, index) =>
    index !== groupIndex
      ? group
      : {
          ...group,
          options: group.options.map(option =>
            option.label === label ? {...option, on: !option.on} : option,
          ),
        },
  ),
});

/** The same, for the sort: the tick moves now, the results follow. */
export const selectSort = (facets: Facets, label: string): Facets => ({
  ...facets,
  sortLabel: label,
});
