/**
 * "Find the Best Deals!" — the six price tiles.
 *
 * Section twelve, and the only section in the whole dashboard that needs no
 * network at all. Every tile is text and a colour: a heading ("Under"), a price
 * ("₹599"), a background and a link, all of them theme block settings. There is
 * no artwork to resolve, so unlike every tile rail above it this one is complete
 * on the first frame of a first launch with no connection.
 *
 * READ FROM `templates/page.dog.json`, section `shop_by_price_KEMKVQ`. Thirteen
 * blocks, of which SIX are enabled and seven are `"disabled": true` -- and the
 * disabled ones are visibly unfinished: three carry the subheading "Lorem
 * Ipsum", one prices at "₹999.00" where the live ones use "₹999", and every one
 * of the seven links to "/" rather than to a collection. Shopify never renders
 * a disabled block, and neither does this; they are recorded here because a
 * rebuild that read the block list wholesale would put "Lorem Ipsum" on the
 * dashboard, linking to the homepage.
 *
 * THE PRICE IS A STRING, NOT A NUMBER, AND IS NOT PARSED. "₹599" is what the
 * merchant typed, currency symbol and all, and it is drawn exactly as typed.
 * Nothing here goes near ../utils/money: that formatter is for prices in paise
 * read off a product, and there is no product behind these tiles -- the figure
 * is a threshold in a collection's name. Parsing it to reformat it would be
 * inventing a number the merchant did not write, and would break the moment one
 * of these reads "₹999.00" as the disabled blocks do.
 *
 * THE COLOURS ARE THE MERCHANT'S. Six pastels, one per tile, with black text on
 * all of them. Kept verbatim -- they are the section's identity, and they are
 * the one place in this migration where the app takes a colour from theme data
 * rather than from ../constants/appConstants. The text colour is taken too
 * rather than assumed, because a merchant who changes a background to something
 * dark will change this alongside it.
 */

/** One price tile. */
export type PriceTile = {
  /** The word above the price. "Under" on every live tile. */
  readonly heading: string;
  /**
   * The price, as the merchant typed it -- symbol included, never parsed.
   * See the note above.
   */
  readonly price: string;
  /** Where a tap goes. */
  readonly path: string;
  /** The card's background, from `shop_by_price_block_backgorund`. */
  readonly background: string;
  /** The card's text colour, from `shop_by_price_block_text_color`. */
  readonly text: string;
};

/** The section heading, from `shop_by_price_heading`. */
export const PRICE_TILES_TITLE = 'Find the Best Deals!';

/**
 * The six enabled tiles, in the theme's own block order.
 *
 * Note the collection handles are NOT uniform: the first is `dogs-under-599`
 * (plural "dogs") and the rest are `dog-under-N` (singular). That is the
 * merchant's own naming and both resolve; a rebuild that "corrected" the first
 * to match the others would 404 it.
 */
export const PRICE_TILES: readonly PriceTile[] = [
  {
    heading: 'Under',
    price: '₹599',
    // Plural, unlike the five below. The merchant's own handle.
    path: '/collections/dogs-under-599',
    background: '#f3b75c',
    text: '#000000',
  },
  {
    heading: 'Under',
    price: '₹999',
    path: '/collections/dog-under-999',
    background: '#8eb8fa',
    text: '#000000',
  },
  {
    heading: 'Under',
    price: '₹1499',
    path: '/collections/dog-under-1499',
    background: '#b7e394',
    text: '#000000',
  },
  {
    heading: 'Under',
    price: '₹2499',
    path: '/collections/dog-under-2499',
    background: '#ffa2cb',
    text: '#000000',
  },
  {
    heading: 'Under',
    price: '₹3499',
    path: '/collections/dog-under-3499',
    background: '#c791e1',
    text: '#000000',
  },
  {
    heading: 'Under',
    price: '₹5999',
    path: '/collections/dog-under-5999',
    background: '#b8e3f8',
    text: '#000000',
  },
];
