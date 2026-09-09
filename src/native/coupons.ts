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
  /**
   * A real, copyable discount code, or null when the headline is offer copy.
   *
   * Null for every live offer today -- see `looksLikeCode` for what has to be
   * true before this is set, and the note at the top of this file for why the
   * field it comes from cannot simply be trusted to hold one.
   */
  readonly code: string | null;
};

/**
 * Does this `discount_code` value actually look like a discount code?
 *
 * THE WHOLE POINT IS THAT IT USUALLY DOES NOT. The field is named
 * `discount_code` and every live value is a sentence of offer copy -- "INR 50
 * off on orders between INR 1500 - INR 1999" -- with "No code required" beside
 * it. The theme renders a copy button regardless, wired to an inline
 * `copyCodeCoupon(...)`, so on zigly.com today that button puts a sentence on
 * the clipboard and calls it a coupon code.
 *
 * The app will not do that. A copy affordance is offered only when the value
 * has the shape a code actually has, so the strip is honest by construction:
 * no code, no button, and nothing to mislead a customer into pasting at
 * checkout.
 *
 * A code here is: one word (no whitespace), 4-24 characters, letters digits
 * hyphens and underscores only, and containing at least one letter -- so a bare
 * "10" or "1500" is copy, not a code. Exported for its own test, because this
 * predicate is the entire difference between a useful button and a misleading
 * one, and it is the thing that will need revisiting the day Zigly starts
 * issuing real codes.
 */
export const looksLikeCode = (value: string): boolean => {
  const trimmed = value.trim();
  return (
    trimmed.length >= 4 &&
    trimmed.length <= 24 &&
    /^[A-Za-z0-9_-]+$/.test(trimmed) &&
    /[A-Za-z]/.test(trimmed)
  );
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
    const headline = fields.discount_code.trim();
    out.push({
      id: node.handle,
      headline,
      terms: terms || null,
      // Only when the value has a code's shape. Null for every live offer.
      code: looksLikeCode(headline) ? headline : null,
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
