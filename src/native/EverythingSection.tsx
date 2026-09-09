/**
 * "Everything For Your Pet" — two tabs, Dogs and Cats.
 *
 * Section seventeen. ./everything carries the data and the argument for the
 * merge; ./TabbedTileSection draws it, shared with ./ExploreSection.
 *
 * The tabs here are the app's own: no template ships Dogs/Cats. The dog page
 * ships Puppy/Adult and the cat page Kitten/Cat, so the Dogs tab is the dog
 * page's two tabs together and the Cats tab is the cat page's two together.
 * ./everything states that in full, because it is an editorial decision rather
 * than a rendering detail.
 *
 * Two short labels, so the tab row does not wrap.
 */
import React from 'react';
import TabbedTileSection from './TabbedTileSection';
import {
  EVERYTHING_CAT_RAIL,
  EVERYTHING_DOG_RAIL,
  EVERYTHING_TABS,
  EVERYTHING_TITLE,
} from './everything';
import type {TileRail} from './tileIcons';

const RAILS: readonly TileRail[] = [
  EVERYTHING_DOG_RAIL as TileRail,
  EVERYTHING_CAT_RAIL as TileRail,
];

type Props = {
  onOpen: (path: string) => void;
  /** The screen's width, for the `wide` tile. See ./TileRow. */
  width?: number;
};

const EverythingSection = ({onOpen, width}: Props) => (
  <TabbedTileSection
    title={EVERYTHING_TITLE}
    tabs={EVERYTHING_TABS}
    rails={RAILS}
    /*
     * `wide`, like ./ExploreSection: these tiles are photographs of a category
     * with no label of their own, so the picture has to carry the meaning and a
     * 104dp thumbnail could not. Two and a quarter fill the row.
     */
    variant="wide"
    width={width}
    onOpen={onOpen}
  />
);

export default EverythingSection;
