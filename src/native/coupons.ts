/**
 * The coupon strip's offers, read from Shopify metaobjects.
 *
 * The third native dashboard section, and the first whose data is not in the
 * theme files at all. `sections/coupon_slider.liquid` opens with
 *
 *   {% if shop.metaobjects.offers.values != blank %}
 *
 * so the coupons are `offers` metaobjects the merchant edits in Shopify admin,
 * not section settings. Verified live 2026-09-08: the Storefront API returns
 * them to the public token, seven of them, with the three fields the theme
 * reads -- `discount_code`, `code_description` and `show_offer_on_homepage`.
 *
 * THE THEME'S FILTER IS LOAD-BEARING AND IS REPRODUCED EXACTLY:
 *
 *   {% if metaObjectElement.discount_code
 *         and metaObjectElement.show_offer_on_homepage == true %}
 *
 * Of the seven live offers, six pass it. The one that does not is "FREE Applod
 * Dry Dog Food", switched off by the merchant. Dropping the filter would put a
 * withdrawn offer on the dashboard -- the app advertising something Zigly has
 * deliberately stopped advertising, which is the one class of drift that costs
 * a customer something rather than merely looking wrong.
 *
 * `discount_code` IS NOT A CODE, DESPITE THE NAME. Every live value is offer
 * copy: "INR 50 off on orders between INR 1500 - INR 1999", "Extra 10% off on
 * orders above ₹1,799". And every `code_description` currently reads "No code
 * required". So the field is a headline, and it is drawn as one. This decides
 * the copy button below.
 *
 * NOT CACHED, and this is the deliberate difference from ./bannerSlides. An
 * offer is a commercial term with a threshold and a discount in it. A stale
 * banner shows last week's campaign art; a stale offer tells the customer they
 * will get ₹50 off at ₹1,500 when the merchant has changed it, which is the
 * "wrong storefront" ../webview/sectionIdStore refuses to persist markup for.
 * The strip is cheap (one small query) and it holds its shape while loading, so
 * there is nothing to buy by keeping it.
 */
import {flattenFields, storefront} from './storefront';
import {warn} from '../utils/logger';

/**
 * How many offers to ask for.
 *
 * Seven exist today. Twenty is room for the merchant to add more without a code
 * change, and a bound so a runaway metaobject list cannot become an unbounded
 * response on a phone.
 */
const LIMIT = 20;

export type Coupon = {
  /** The offer headline -- the theme's `discount_code`. See the note above. */
  readonly headline: string;
  /** The qualifying terms, or null. The theme's `code_description`. */
  readonly terms: string | null;
  /**
   * A stable identity for React's key.
   *
   * The metaobject handle, which is the merchant's own and unique. Two offers
   * can carry identical text -- the theme emits every coupon twice for its
   * marquee and ../webview/couponStrip has to de-duplicate them by content --
   * so keying on the headline would collide.
   */
  readonly id: string;
};

const QUERY = `
  query Offers($first: Int!) {
    metaobjects(type: "offers", first: $first) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

type Response = {
  metaobjects?: {
    edges?: {
      node?: {
        handle?: unknown;
        fields?: {key?: unknown; value?: unknown}[];
      };
    }[];
  };
};

/**
 * Whether the theme would render this offer.
 *
 * Exported for its own test. `show_offer_on_homepage` is a metaobject boolean,
 * which the Storefront API serialises as the *string* `"true"` -- so a
 * truthiness check on it would pass for `"false"` as well and show every
 * withdrawn offer on the dashboard. Compared to the literal for that reason.
 */
export const isVisible = (fields: Record<string, string>): boolean =>
  Boolean(fields.discount_code?.trim()) &&
  fields.show_offer_on_homepage === 'true';

/**
 * Turn the API's reply into the strip's offers.
 *
 * Exported for its own test: this is where the theme's filter is reproduced,
 * and a change to it is a change to what the customer is promised.
 *
 * Order is the API's, which is the merchant's own metaobject order and the same
 * order `shop.metaobjects.offers.values` iterates in the theme. Nothing is
 * sorted here -- a strip that ordered offers by value would be this app
 * merchandising on Zigly's behalf.
 */
export const parseCoupons = (data: Response | null): Coupon[] => {
  const edges = data?.metaobjects?.edges;
  if (!Array.isArray(edges)) {
    return [];
  }
  const out: Coupon[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!node || typeof node.handle !== 'string') {
      continue;
    }
    const fields = flattenFields(node.fields);
    if (!isVisible(fields)) {
      continue;
    }
    const terms = fields.code_description?.trim();
    out.push({
      id: node.handle,
      headline: fields.discount_code.trim(),
      terms: terms || null,
    });
  }
  return out;
};

/** Ask for the offers. `[]` on any failure, so a caller can retry. */
export const fetchCoupons = async (signal?: AbortSignal): Promise<Coupon[]> => {
  const data = await storefront<Response>(QUERY, {first: LIMIT}, signal);
  if (!data) {
    return [];
  }
  const coupons = parseCoupons(data);
  if (!coupons.length) {
    // Not an error: the merchant may have switched every offer off, and the
    // theme's own `{% if ... != blank %}` drops the whole section in that case.
    warn('no visible offers');
  }
  return coupons;
};
