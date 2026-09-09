/**
 * "Explore. Pick. Pamper." — four tabs, each a rail of category tiles.
 *
 * Section seven. ./explore carries the data and the reasoning behind the
 * dog/cat merge; ./TabbedTileSection draws it, shared with
 * ./EverythingSection.
 *
 * Artwork comes from both pet pages and merges into one store -- see the note
 * in ./TabbedTileSection. All 32 tiles are declared to both rails deliberately:
 * each fetch resolves whatever its own page's section carries and the filenames
 * decide which, so neither needs to know which tiles are "its own".
 *
 * The tabs stay on ONE LINE and scroll sideways: four labels including "Smart
 * Petcare" will not fit a narrow phone. They used to wrap onto a second line,
 * which read as a block of chips landing on the tiles rather than as a tab
 * strip -- see `scrollTabs` in ./TabbedTileSection.
 */
import React from 'react';
import TabbedTileSection from './TabbedTileSection';
import {
  EXPLORE_CAT_RAIL,
  EXPLORE_DOG_RAIL,
  EXPLORE_TABS,
  EXPLORE_TITLE,
} from './explore';
import type {TileRail} from './tileIcons';

const RAILS: readonly TileRail[] = [
  EXPLORE_DOG_RAIL as TileRail,
  EXPLORE_CAT_RAIL as TileRail,
];

type Props = {
  onOpen: (path: string) => void;
  /** The screen's width, for the `wide` tile. See ./TileRow. */
  width?: number;
};

const ExploreSection = ({onOpen, width}: Props) => (
  <TabbedTileSection
    title={EXPLORE_TITLE}
    tabs={EXPLORE_TABS}
    rails={RAILS}
    scrollTabs
    /*
     * `wide`, not the default square: these tiles are photographs of a whole
     * category and at 104dp they were thumbnails. Two and a quarter now fit the
     * row, which is what the heading and the tab strip above them are sized
     * against. See ./TileRow.
     */
    variant="wide"
    /*
     * Heading and pills ranged left, which is where every other section
     * heading in the dashboard sits -- the rails and tile rows all range left
     * at the same gutter, so a centred heading here was the odd one out.
     * "Everything For Your Pet" keeps the centred default. See
     * ./TabbedTileSection's `align`.
     */
    align="left"
    width={width}
    onOpen={onOpen}
  />
);

export default ExploreSection;
