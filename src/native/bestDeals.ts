/**
 * Zigly Coins and the six category offer tiles — the `best_deals` section.
 *
 * Section ten. NOT A PRODUCT SECTION, despite the name, and
 * ../webview/extraSections carries the same warning for the same reason: the
 * name invites exactly the wrong assumption. Read from
 * `templates/page.dog.json`, section `best_deals_b8xpdj`, it holds
 *
 *   - one banner, from the section's own `right-div-image-mobile` setting,
 *     linking to Zigly Prime, and
 *   - six `best_deals_blocks`, each an image linking to a collection.
 *
 * Not one product, not one price.
 *
 * THE COINS BANNER LEAVES ZIGLY.COM AND MUST STAY IN THE APP. Its link is
 * `https://ziglyprime.erlpaas.com/Login Microsite`, which is not a zigly.com
 * domain -- and ../constants/appConstants lists that host in `INTERNAL_HOSTS`
 * on purpose, with the note that it "was first treated as external -- but the
 * reference app keeps it in-app, where it asks for a mobile number. Sending it
 * to the browser broke that flow." So this tile hands up an absolute URL rather
 * than a storefront path, and the screen's existing host rules decide the rest.
 *
 * AND THAT URL HAS A SPACE IN IT. `/Login Microsite`, verbatim from the theme.
 * A raw space in a URL is not valid and React Native's `fetch`/`Linking` handle
 * it inconsistently, so it is percent-encoded here -- once, at the source,
 * rather than left for each caller to remember.
 *
 * THE TILES CARRY NO LABEL, like the offer rails. Every block's
 * `best_deal_block_title` is empty on the live page, so the words are lettering
 * inside the artwork and there is nothing to fall back to when an image does
 * not resolve. The same consequence follows: see ./OfferRail's note, and
 * ./BestDeals draws only what resolved.
 *
 * `best_deal_block_heading_color` is read and ignored, deliberately: it colours
 * a title that is blank on every block, so applying it would style nothing.
 * Recorded so it does not look overlooked.
 */
import type {Tile} from './tileIcons';

/** ../webview/pageCache's own template prefix for the dog page. */
const DOG = 'template--26530973942076__';

/**
 * The Zigly Prime destination.
 *
 * Encoded from the theme's `right-div-btn-link`, which is
 * `https://ziglyprime.erlpaas.com/Login Microsite` -- a real space, in a real
 * setting. Exported so the test can assert the encoding rather than trusting
 * it, because a URL with a raw space fails in a way that looks like a dead
 * link rather than a malformed one.
 */
export const COINS_LINK =
  'https://ziglyprime.erlpaas.com/Login%20Microsite';

/**
 * The coins banner.
 *
 * `right-div-image-mobile` is taken, not `right-div-image`: the theme ships
 * both and picks between them by media query, and on a phone the answer is
 * always the mobile crop. `zigly-coin-mobile-dog.png` is the dog page's; the
 * cat page has its own, and the dashboard is the dog page (see
 * ../webview/pageCache).
 */
export const COINS_BANNER = {
  /** Filename stem, for pairing the rendered `<img>`; see ./tileIcons. */
  key: 'zigly-coin-mobile-dog',
  /** Absolute, because it leaves zigly.com. See the note at the top. */
  link: COINS_LINK,
  /**
   * The accessibility name. The banner shows no text of its own -- the
   * lettering is in the artwork -- so this is the only description a screen
   * reader gets.
   */
  label: 'Zigly Coins',
};

/**
 * The six category tiles, in the theme's own block order.
 *
 * `label` is the accessibility name, read from each tile's artwork, because
 * `best_deal_block_title` is blank on all six.
 */
const tile = (label: string, handle: string, key: string): Tile => ({
  label,
  path: `/collections/${handle}`,
  key,
});

export const BEST_DEALS_TILES: readonly Tile[] = [
  tile('Dog Food', 'dog-food', '620X540_Dog-Food'),
  tile('Dog Treats', 'dog-treats', '620X540_DogTreats'),
  tile('Dog Toys', 'dog-toys', '620X540_DogToys'),
  tile('Dog Bowls', 'dog-bowls', '620X540_Dog-Bowls'),
  tile(
    'Walk Essentials',
    'dog-collars-harnesses-leashes',
    '620X540_WE',
  ),
  tile('Grooming', 'dog-grooming', '620X540_Grooming'),
];

/**
 * The section's artwork store.
 *
 * The banner and the six tiles come from one rendered section, so they share
 * one fetch and one store -- the banner is declared as a tile here purely so
 * ./tileIcons can resolve it alongside the others.
 */
export const BEST_DEALS_RAIL = {
  storeKey: 'zigly.bestDealsIcons.v1',
  sectionId: DOG + 'best_deals_b8xpdj',
  fragment: 'best_deals',
  tiles: [
    ...BEST_DEALS_TILES,
    // Resolved with the rest; drawn separately by ./BestDeals.
    {
      label: COINS_BANNER.label,
      path: COINS_BANNER.link,
      key: COINS_BANNER.key,
    },
  ] as readonly Tile[],
};
