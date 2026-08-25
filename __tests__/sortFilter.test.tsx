/**
 * The app's own Sort / Filter bar and its two panels.
 *
 * The bar replaced one pinned inside the page with CSS, and the panels replaced
 * SearchTap's own -- a bottom sheet of the site's design and a drawer that slid
 * in from the left. What is tested here is the frontend only: what is drawn,
 * what a tap reports, and the three arrangements that were asked for by name --
 * the bar in the tab bar's slot, the sort as a sheet with the applied option
 * ticked, and the filter as a full screen of chips over one Apply.
 *
 * There is nothing here about what a filter *does*. That is SearchTap's, driven
 * through ../src/webview/facetBridge, and the tests for the join are in
 * ./facets.test.ts.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, Modal, Text} from 'react-native';
import SortFilterBar from '../src/components/SortFilterBar';
import SortSheet from '../src/components/SortSheet';
import FilterSheet from '../src/components/FilterSheet';
import {EMPTY_FACETS, SEED_SORT_OPTIONS} from '../src/listing/facets';
import type {Facets} from '../src/listing/facets';

const noop = () => {};

const render = (node: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  return tree;
};

const labels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root.findAllByType(Text).map(node => {
    const children = node.props.children;
    return (Array.isArray(children) ? children.flat() : [children])
      .map(part => (part === null || part === undefined ? '' : String(part)))
      .join('');
  });

/**
 * The control carrying an accessibility label, as the customer finds it.
 *
 * By props rather than by type: `Pressable` is a forwardRef wrapper, and
 * findAllByType does not match the node that actually carries the handler.
 */
const button = (tree: ReactTestRenderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];

/** Every control that reports a selected state -- a sort row, a filter chip. */
const stateful = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityState !== undefined,
  );

const facets: Facets = {
  ready: true,
  sortLabel: 'Best selling',
  sortOptions: SEED_SORT_OPTIONS,
  groups: [
    {
      title: 'Pet type',
      options: [
        {label: 'cat', count: 63, on: false},
        {label: 'dog', count: 22, on: true},
      ],
    },
    {
      title: 'Brands',
      options: [{label: 'royal canin', count: 10, on: false}],
    },
  ],
};

describe('the Sort / Filter bar', () => {
  it('offers exactly two controls, named as the reference names them', () => {
    const tree = render(
      <SortFilterBar onSortPress={noop} onFilterPress={noop} />,
    );
    expect(labels(tree)).toEqual(['Sort', 'Filter']);
  });

  it('reports which one was tapped', () => {
    const taps: string[] = [];
    const tree = render(
      <SortFilterBar
        onSortPress={() => taps.push('sort')}
        onFilterPress={() => taps.push('filter')}
      />,
    );
    ReactTestRenderer.act(() => {
      button(tree, 'Sort')?.props.onPress();
      button(tree, 'Filter')?.props.onPress();
    });
    expect(taps).toEqual(['sort', 'filter']);
  });

  it('is not a Modal: it takes its own space, as the tab bar does', () => {
    // The whole point of the slot it sits in. A floating bar would need the
    // page padded out from under it, which is the arrangement this replaced.
    const tree = render(
      <SortFilterBar onSortPress={noop} onFilterPress={noop} />,
    );
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  });
});

describe('the sort sheet', () => {
  const sheet = (
    selected = 'Best selling',
    onSelect: (label: string) => void = noop,
  ) =>
    render(
      <SortSheet
        visible
        options={SEED_SORT_OPTIONS}
        selected={selected}
        onSelect={onSelect}
        onClose={noop}
      />,
    );

  it('lists the site’s own sorts, in the site’s own order', () => {
    const shown = labels(sheet());
    expect(shown[0]).toBe('Sort');
    expect(shown.slice(1)).toEqual(SEED_SORT_OPTIONS);
  });

  it('covers the whole screen, header included, while it is up', () => {
    // A sheet that dims only part of the screen reads as a panel inside the
    // page rather than as a decision the app is waiting on.
    const modal = sheet().root.findByType(Modal);
    expect(modal.props.visible).toBe(true);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
  });

  it('marks the applied sort as selected', () => {
    const tree = sheet('New Release');
    expect(button(tree, 'Close')).toBeDefined();
    const on = stateful(tree).filter(
      node => node.props.accessibilityState.selected,
    );
    expect(on).toHaveLength(1);
  });

  it('reports the site’s own label, untouched', () => {
    // The sheet title-cases "Best selling" for display, because the site draws
    // it that way -- but what goes back to SearchTap has to be its own string
    // or the button will not be found.
    const chosen: string[] = [];
    const tree = sheet('New Release', label => chosen.push(label));
    const row = stateful(tree).find(
      node => !node.props.accessibilityState.selected,
    );
    ReactTestRenderer.act(() => {
      row?.props.onPress();
    });
    expect(SEED_SORT_OPTIONS).toContain(chosen[0]);
  });

  it('does not re-apply the sort that is already applied', () => {
    // It would be a wasted request and a wasted scroll to the top.
    const chosen: string[] = [];
    const tree = sheet('Best selling', label => chosen.push(label));
    const applied = stateful(tree).find(
      node => node.props.accessibilityState.selected === true,
    );
    ReactTestRenderer.act(() => {
      applied?.props.onPress();
    });
    expect(chosen).toEqual([]);
  });
});

describe('the filter sheet', () => {
  it('draws every heading and every value with its count', () => {
    const tree = render(
      <FilterSheet
        visible
        facets={facets}
        busy={false}
        onToggle={noop}
        onClose={noop}
      />,
    );
    const shown = labels(tree);
    expect(shown).toContain('Filters');
    expect(shown).toContain('Pet type');
    expect(shown).toContain('Brands');
    expect(shown).toContain('cat (63)');
    expect(shown).toContain('royal canin (10)');
    // One Apply, and nothing else at the foot: no Clear All, because a chip
    // that is on turns off when it is tapped again.
    expect(shown.filter(label => label === 'Apply')).toHaveLength(1);
    expect(shown).not.toContain('Clear all');
  });

  it('reports which facet the chip was in, not just its label', () => {
    // Two facets on this store are both called "Flavor" and both offer
    // "chicken", so neither the label nor the heading alone says which chip
    // was tapped. The position does, and the bridge applies by it.
    const taps: unknown[][] = [];
    const tree = render(
      <FilterSheet
        visible
        facets={facets}
        busy={false}
        onToggle={(index, title, label) => taps.push([index, title, label])}
        onClose={noop}
      />,
    );
    ReactTestRenderer.act(() => {
      button(tree, 'cat, 63')?.props.onPress();
      button(tree, 'royal canin, 10')?.props.onPress();
    });
    expect(taps).toEqual([
      [0, 'Pet type', 'cat'],
      [1, 'Brands', 'royal canin'],
    ]);
  });

  it('shows an applied value as applied', () => {
    const tree = render(
      <FilterSheet
        visible
        facets={facets}
        busy={false}
        onToggle={noop}
        onClose={noop}
      />,
    );
    expect(button(tree, 'dog, 22')?.props.accessibilityState.selected).toBe(
      true,
    );
    expect(button(tree, 'cat, 63')?.props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('waits rather than claiming there are no filters', () => {
    // A collection page fetches no facets until something asks for them, so
    // "nothing yet" is the normal first frame and it is a wait, not an absence.
    const tree = render(
      <FilterSheet
        visible
        facets={EMPTY_FACETS}
        busy={false}
        onToggle={noop}
        onClose={noop}
      />,
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(labels(tree)).not.toContain('No filters for this listing');
  });

  it('stops waiting once the site has answered with nothing', () => {
    // A listing can genuinely publish no filters. A spinner nothing will ever
    // replace is worse than saying so.
    const tree = render(
      <FilterSheet
        visible
        facets={{...EMPTY_FACETS, ready: true}}
        busy={false}
        onToggle={noop}
        onClose={noop}
      />,
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(labels(tree)).toContain('No filters for this listing');
  });

  it('says when the site is still answering a tap', () => {
    const tree = render(
      <FilterSheet
        visible
        facets={facets}
        busy
        onToggle={noop}
        onClose={noop}
      />,
    );
    // In the header, beside the close -- not over the chips, which are usable.
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(labels(tree)).toContain('cat (63)');
  });

  it('closes on Apply, because the site has already applied everything', () => {
    // Each chip applies on the tap, exactly as the site's own filter does, so
    // Apply is a way out of the screen rather than a commit.
    let closed = 0;
    const tree = render(
      <FilterSheet
        visible
        facets={facets}
        busy={false}
        onToggle={noop}
        onClose={() => {
          closed += 1;
        }}
      />,
    );
    ReactTestRenderer.act(() => {
      button(tree, 'Apply')?.props.onPress();
    });
    expect(closed).toBe(1);
  });
});
