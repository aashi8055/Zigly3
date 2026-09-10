/**
 * Turning the LAST filter off, and the two late reports that used to undo it.
 *
 * THE GAP. ../src/webview/resultsBridge reads SearchTap's rendered grid and
 * posts the handles in it. That grid is SearchTap's whether or not a filter is
 * applied, so after the final chip is cleared the bridge goes on reporting --
 * now the unfiltered set, in exactly the shape a filtered answer arrives in.
 * Nothing in the message tells the two apart.
 *
 * `toggleFacet` drops the results entry on the frame the last chip comes off,
 * and that alone was not enough: facetBridge re-reports 300ms and 1200ms after
 * EVERY toggle, so those two reports landed after the delete and put the entry
 * back -- pinning the native grid to a fixed handle list with no paging for a
 * collection that no longer had a filter on it.
 *
 * The app's own facet record is the only thing that knows, so these tests pin
 * the rule the screen now applies: a `results` message is accepted only while
 * something is applied. Modelled on the real state shapes rather than by
 * rendering the screen, because the ordering being tested is between a state
 * updater and a WebView message -- see ../src/screens/ZiglyWebViewScreen.tsx.
 */
import {
  EMPTY_FACETS,
  selectedCount,
  toggleOption,
} from '../src/listing/facets';
import type {Facets} from '../src/listing/facets';

/** One facet with two values, as the bridge reports a listing. */
const listing: Facets = {
  ready: true,
  groups: [
    {
      title: 'Brand',
      options: [
        {label: 'royal canin', count: 63, on: false},
        {label: 'pedigree', count: 21, on: false},
      ],
    },
  ],
  sortOptions: ['Best selling'],
  sortLabel: 'Best selling',
};

/**
 * The screen's rule for a `results` message, exactly as the branch applies it:
 * the handles are stored only while the app's record says a filter is on.
 */
const acceptResults = (
  results: Record<number, readonly string[]>,
  facets: Facets | undefined,
  key: number,
  handles: string[],
): Record<number, readonly string[]> =>
  selectedCount(facets ?? EMPTY_FACETS) > 0
    ? {...results, [key]: handles}
    : results;

/** `toggleFacet`'s own half: flip, and drop the entry when nothing is left. */
const tap = (
  facets: Facets,
  results: Record<number, readonly string[]>,
  key: number,
  group: number,
  label: string,
) => {
  const next = toggleOption(facets, group, label);
  const anyOn = next.groups.some(g => g.options.some(o => o.on));
  const without = {...results};
  if (!anyOn) {
    delete without[key];
  }
  return {facets: next, results: without};
};

describe('the last filter coming off', () => {
  const KEY = 4;

  it('drops the handle list, and the late reports cannot put it back', () => {
    // A chip is on and SearchTap has answered with a filtered grid.
    let facets = toggleOption(listing, 0, 'royal canin');
    let results = acceptResults({}, facets, KEY, ['a', 'b']);
    expect(results[KEY]).toEqual(['a', 'b']);

    // The same chip is tapped off. The entry goes on that frame.
    ({facets, results} = tap(facets, results, KEY, 0, 'royal canin'));
    expect(KEY in results).toBe(false);

    // Now the two reports facetBridge always sends after a toggle. Before the
    // gate these restored the entry and the grid stayed pinned; the whole bug
    // was that the delete above was real and lasted 300ms.
    results = acceptResults(results, facets, KEY, ['a', 'b', 'c', 'd']);
    results = acceptResults(results, facets, KEY, ['a', 'b', 'c', 'd']);
    expect(KEY in results).toBe(false);
  });

  it('still accepts a filtered answer while a chip is on', () => {
    // The gate must not cost the case it sits in front of: the optimistic flip
    // is written before the bridge's report arrives, so the record says "on"
    // by the time the handles land.
    const facets = toggleOption(listing, 0, 'pedigree');
    const results = acceptResults({}, facets, KEY, ['x']);
    expect(results[KEY]).toEqual(['x']);
  });

  it('keeps an empty filtered answer, which is not the same as no filter', () => {
    // A filter that matched nothing must stay an entry -- falling back to the
    // collection query here would draw a full grid to a customer who had just
    // filtered it down to none.
    const facets = toggleOption(listing, 0, 'pedigree');
    const results = acceptResults({}, facets, KEY, []);
    expect(KEY in results).toBe(true);
    expect(results[KEY]).toEqual([]);
  });

  it('ignores a report on a listing the app has no record of yet', () => {
    // First load: SearchTap's grid is on the page and nothing is applied, so
    // the handles are the unfiltered set and the native grid keeps its own
    // query and its paging.
    expect(acceptResults({}, undefined, KEY, ['a', 'b'])).toEqual({});
  });

  it('leaves other layers alone when one of them clears', () => {
    // A collection kept alive behind a product must be found as it was left.
    let facets = toggleOption(listing, 0, 'royal canin');
    let results: Record<number, readonly string[]> = {
      9: ['kept'],
      ...acceptResults({}, facets, KEY, ['a']),
    };
    ({facets, results} = tap(facets, results, KEY, 0, 'royal canin'));
    expect(results[9]).toEqual(['kept']);
    expect(KEY in results).toBe(false);
  });

  it('clears only after the LAST chip, not the first of two', () => {
    let facets = toggleOption(listing, 0, 'royal canin');
    facets = toggleOption(facets, 0, 'pedigree');
    let results = acceptResults({}, facets, KEY, ['a', 'b']);

    // One of two off: still filtered, so the entry stays and reports land.
    ({facets, results} = tap(facets, results, KEY, 0, 'royal canin'));
    expect(results[KEY]).toEqual(['a', 'b']);
    results = acceptResults(results, facets, KEY, ['b']);
    expect(results[KEY]).toEqual(['b']);

    // The last one off: now it goes.
    ({facets, results} = tap(facets, results, KEY, 0, 'pedigree'));
    expect(KEY in results).toBe(false);
  });
});
