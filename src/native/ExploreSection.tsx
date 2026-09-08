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
 * The tabs wrap: four labels including "Smart Petcare" will not fit one line on
 * a narrow phone.
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
};

const ExploreSection = ({onOpen}: Props) => (
  <TabbedTileSection
    title={EXPLORE_TITLE}
    tabs={EXPLORE_TABS}
    rails={RAILS}
    wrapTabs
    onOpen={onOpen}
  />
);

export default ExploreSection;
