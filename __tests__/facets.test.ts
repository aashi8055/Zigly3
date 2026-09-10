/**
 * Sort and filter: the parser, and the optimistic updates.
 *
 * The engine is the site's, so there is nothing here about *what* a filter
 * means. What is worth testing is the join: that a malformed report costs one
 * facet rather than the sheet, that the two facets Zigly both call "Flavor"
 * cannot be crossed, and that the price slider and the out-of-stock toggle stay
 * out of a screen the app draws as chips.
 */
import {
  DEFAULT_SORT,
  EMPTY_FACETS,
  parseFacets,
  SEED_SORT_OPTIONS,
  selectedCount,
  selectSort,
  toggleOption,
  type Facets,
} from '../src/listing/facets';

const message = (extra: object = {}) => ({
  tag: 'facets',
  ready: true,
  sortLabel: 'Price: Low to High',
  sortOptions: ['Best selling', 'Price: Low to High'],
  groups: [
    {
      title: 'Pet type',
      options: [
        {label: 'cat', count: 63, on: false},
        {label: 'dog', count: 22, on: true},
      ],
    },
  ],
  ...extra,
});

describe('parseFacets', () => {
  it('reads a report from the page', () => {
    const facets = parseFacets(message());
    expect(facets).not.toBeNull();
    expect(facets?.ready).toBe(true);
    expect(facets?.sortLabel).toBe('Price: Low to High');
    expect(facets?.groups).toHaveLength(1);
    expect(facets?.groups[0].options[1]).toEqual({
      label: 'dog',
      count: 22,
      on: true,
    });
  });

  it('ignores anything that is not one', () => {
    // The page posts for its own reasons, and other bridges post on this
    // channel: a message that is not ours must not replace the sheet's data.
    expect(parseFacets(null)).toBeNull();
    expect(parseFacets('facets')).toBeNull();
    expect(parseFacets({tag: 'cart-count', n: 2})).toBeNull();
  });

  it('drops a facet with no values rather than showing an empty heading', () => {
    // This is also what keeps SearchTap's price slider out: it renders a
    // heading and no counted checkbox, so it arrives as a group with nothing
    // in it. No list of exclusions to keep in step with their config.
    const facets = parseFacets(
      message({
        groups: [
          {title: 'Price', options: []},
          {title: 'Pet type', options: [{label: 'cat', count: 63}]},
        ],
      }),
    );
    expect(facets?.groups.map(group => group.title)).toEqual(['Pet type']);
  });

  it('drops a value with no label but keeps its neighbours', () => {
    const facets = parseFacets(
      message({
        groups: [
          {
            title: 'Brands',
            options: [
              {label: '', count: 4},
              {label: 'sheba', count: 13},
              'not an option',
            ],
          },
        ],
      }),
    );
    expect(facets?.groups[0].options).toEqual([
      {label: 'sheba', count: 13, on: false},
    ]);
  });

  it('falls back to the site’s own five sorts, never to none', () => {
    // An empty sort sheet is worse than a stale one, and these five are read
    // out of SearchTap's own configuration rather than invented.
    const facets = parseFacets(message({sortOptions: [], sortLabel: ''}));
    expect(facets?.sortOptions).toEqual(SEED_SORT_OPTIONS);
    expect(facets?.sortLabel).toBe(DEFAULT_SORT);
  });

  it('treats a missing count as zero rather than as no value', () => {
    // A count is what says a value is a chip. Zero is a real answer; absent is
    // handled a level down, in the bridge, where a value with no count at all
    // is never reported.
    const facets = parseFacets(
      message({groups: [{title: 'Sizes', options: [{label: '70g'}]}]}),
    );
    expect(facets?.groups[0].options[0].count).toBe(0);
  });
});

describe('the empty value', () => {
  it('is not ready, and still offers the sorts', () => {
    // Which is what puts the filter sheet on a spinner and the sort sheet on a
    // full list: a collection page fetches no facets until something asks.
    expect(EMPTY_FACETS.ready).toBe(false);
    expect(EMPTY_FACETS.groups).toEqual([]);
    expect(EMPTY_FACETS.sortOptions).toEqual(SEED_SORT_OPTIONS);
  });
});

describe('optimistic updates', () => {
  const facets = parseFacets(
    message({
      groups: [
        {title: 'Flavor', options: [{label: 'chicken', count: 27, on: false}]},
        {title: 'Flavor', options: [{label: 'chicken', count: 20, on: false}]},
      ],
    }),
  )!;

  it('flips the value that was tapped, and leaves its neighbour alone', () => {
    const flipped = toggleOption(parseFacets(message())!, 0, 'cat');
    expect(flipped.groups[0].options[0].on).toBe(true);
    // 'dog' arrived applied and was not tapped.
    expect(flipped.groups[0].options[1].on).toBe(true);
    expect(selectedCount(flipped)).toBe(2);
  });

  it('flips only the facet that was tapped, not the one with the same name', () => {
    /*
     * Two facets on this store are both called "Flavor" -- meta_flavour and
     * st_meta_flavor -- and both offer "chicken". They are different filters,
     * so a tap on one must not fill in the other; the position is what tells
     * them apart, and it is the same address the bridge applies with.
     */
    const next = toggleOption(facets, 1, 'chicken');
    expect(next.groups.map(group => group.options[0].on)).toEqual([false, true]);
    expect(selectedCount(next)).toBe(1);
  });

  it('changes nothing when the value is not in the facet named', () => {
    expect(selectedCount(toggleOption(facets, 0, 'beef'))).toBe(0);
    expect(selectedCount(toggleOption(facets, 9, 'chicken'))).toBe(0);
  });

  it('moves the tick before the site has answered', () => {
    expect(selectSort(facets, 'New Release').sortLabel).toBe('New Release');
    // And changes nothing else: the results are still the ones on screen.
    expect(selectSort(facets, 'New Release').groups).toBe(facets.groups);
  });
});

describe('a value repeated inside one facet', () => {
  /*
   * THE DOUBLE-FLIP, and it came from the two halves of one tap disagreeing.
   *
   * Nothing dedupes the values within a group. facetBridge's `facets()` pushes
   * every checkbox carrying a non-empty `value`, and `parseOption` never
   * compares one option to another -- so a group whose metafield repeats a
   * value arrives with that label twice.
   *
   * `toggleOption` used to `map` over `option.label === label`, flipping BOTH
   * chips. The write half of the same tap clicks exactly ONE checkbox --
   * facetBridge's `boxIn` returns on its first match -- so the app claimed two
   * filters had changed while the page changed one, and the next report ~300ms
   * later quietly corrected the second chip. The customer saw a chip light up
   * and go out again.
   */
  const repeated = parseFacets({
    tag: 'facets',
    ready: true,
    groups: [
      {
        title: 'Brands',
        options: [
          {label: 'royal canin', count: 10, on: false},
          {label: 'royal canin', count: 4, on: false},
          {label: 'farmina', count: 7, on: false},
        ],
      },
    ],
    sortOptions: ['Best selling'],
    sortLabel: 'Best selling',
  });

  it('is reported as two options, not silently deduped', () => {
    // The premise. Were these collapsed, the counts would not add up to what
    // the site shows against each row.
    expect(repeated?.groups[0].options).toHaveLength(3);
  });

  it('flips one chip per tap, matching the one checkbox that is clicked', () => {
    const next = toggleOption(repeated as Facets, 0, 'royal canin');
    expect(next.groups[0].options.map(option => option.on)).toEqual([
      true,
      false,
      false,
    ]);
    // The number the grid keys off: two would have claimed a filter the page
    // never applied.
    expect(selectedCount(next)).toBe(1);
  });

  it('turns that same chip back off rather than flipping its twin', () => {
    const on = toggleOption(repeated as Facets, 0, 'royal canin');
    const off = toggleOption(on, 0, 'royal canin');
    expect(selectedCount(off)).toBe(0);
    expect(off.groups[0].options.map(option => option.on)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('leaves the group untouched when the label is absent', () => {
    // Identity, not a rebuilt array: an out-of-range tap must not churn state.
    const same = toggleOption(repeated as Facets, 0, 'orijen');
    expect(same.groups[0].options).toBe(repeated?.groups[0].options);
  });
});
