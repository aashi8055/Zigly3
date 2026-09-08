/**
 * "Real Pets. Real Stories. Real Community." — two partner cards.
 *
 * Section twenty-one. Two blocks, each a logo, a paragraph and a "Know More"
 * button: the Zigly Foundation and Petsfamilia. All theme settings, so this
 * section needs nothing but its artwork.
 *
 * Read from `templates/index.json` -- the HOMEPAGE, not the dog page, because
 * ../webview/extraSections places this with `{move: 'about_our_communities'}`
 * rather than a fetch: the section is already on the homepage the WebView is
 * showing, so the web version relocates it instead of asking for a copy. The
 * dog page has no such section, which is why this is the first data module in
 * the set to read index.json.
 *
 * BOTH BUTTONS LEAVE ZIGLY.COM, AND NEITHER IS AN INTERNAL HOST:
 *
 *   Zigly Foundation  https://ziglyfoundation.com/
 *   Petsfamilia       https://www.instagram.com/petsfamilia_community/
 *
 * `ziglyfoundation.com` is Zigly's own, and DATA-SOURCES.md §5 lists it under
 * "separate properties -- out of app scope"; the Instagram one is plainly
 * somebody else's. ../constants/appConstants lists neither in `INTERNAL_HOSTS`,
 * so the screen's existing rules will send both to the browser -- which is
 * right, and is what the WebView dashboard does today. That is the difference
 * from the Zigly Coins banner, which IS an internal host on purpose because its
 * flow asks for a mobile number.
 *
 * So these are the first two links in the native dashboard that deliberately
 * leave the app, and they are passed up as absolute URLs for the screen to
 * decide. Nothing here forces a browser: that decision belongs in one place.
 */
import type {Tile} from './tileIcons';

/**
 * The homepage's template prefix, from DATA-SOURCES.md §3's captured id list.
 *
 * NOT `sections--26530985181500__`, which is the prefix for the header and the
 * announcement bar. Shopify uses `sections--<id>__` for sections defined in the
 * layout and `template--<id>__` for those in a template's own JSON, and this
 * section is the homepage template's. Worth stating because the two prefixes
 * appear side by side in that list and picking the wrong one gives a section id
 * that simply never resolves.
 */
const HOME = 'template--26530973548860__';

/** One partner card. */
export type Community = {
  /** The partner's name, as the heading. */
  readonly name: string;
  /** The paragraph under it. Zigly's own copy. */
  readonly description: string;
  /** The button's label. Taken per block, though both currently match. */
  readonly button: string;
  /** Absolute URL. Both leave zigly.com -- see the note above. */
  readonly link: string;
  /** The card's background, from `brand_color`. */
  readonly background: string;
  /** Filename stem for the logo; see ./tileIcons. */
  readonly key: string;
};

/** The section heading, from `section_title`. */
export const COMMUNITY_TITLE = 'Real Pets. Real Stories. Real Community.';

export const COMMUNITIES: readonly Community[] = [
  {
    name: 'Zigly Foundation',
    description:
      'Initiative driven by 6k+ compassionate student that has impacted the lives of 5k+ community animals through feeding drives, vaccination camps, awareness sessions.',
    button: 'Know More',
    link: 'https://ziglyfoundation.com/',
    background: '#eef8fd',
    key: 'ZF-300X200',
  },
  {
    name: 'Petsfamilia',
    description:
      'India’s largest online community for pet parents, with over 6L+ members. It offers a space for advice, resources, and support through expert Q&As, peer groups, and webinars.',
    button: 'Know More',
    link: 'https://www.instagram.com/petsfamilia_community/',
    background: '#eef8fd',
    key: 'Logo-Petsfamilia_Light',
  },
];

/**
 * The section's artwork store.
 *
 * `sectionId` is the homepage's instance. The web version moves this section
 * rather than fetching it, so there is no seeded id in
 * ../webview/pageCache to reuse -- this is read from the homepage's own
 * `index.json` section key, and a miss falls back to fragment rediscovery like
 * every other rail.
 */
export const COMMUNITY_RAIL = {
  storeKey: 'zigly.communityIcons.v1',
  sectionId: HOME + 'about_our_communities_Rjb873',
  fragment: 'about_our_communities',
  tiles: COMMUNITIES.map(
    (c): Tile => ({label: c.name, path: c.link, key: c.key}),
  ) as readonly Tile[],
};
