/**
 * The coupon strip's data, and the one filter that must not be lost.
 *
 * `sections/coupon_slider.liquid` renders an offer only when
 *
 *   {% if metaObjectElement.discount_code
 *         and metaObjectElement.show_offer_on_homepage == true %}
 *
 * and of the seven offers live on 2026-09-08, six pass it. The one that does
 * not -- "FREE Applod Dry Dog Food" -- is switched off by the merchant. So this
 * filter is the difference between showing Zigly's current offers and
 * advertising one they have deliberately withdrawn, which is worse than a
 * layout bug: it promises a customer something the store will not honour.
 *
 * The trap it sits on is a type. `show_offer_on_homepage` is a metaobject
 * boolean, and the Storefront API serialises it as the STRING "true" or
 * "false". Both are truthy in JavaScript, so the obvious check --
 * `if (fields.show_offer_on_homepage)` -- passes for a withdrawn offer and
 * shows all seven. Nothing throws, and the strip looks entirely correct. That
 * is the case this suite exists for.
 *
 * The fixtures below are the real field names and real values, taken from a
 * live Storefront query on 2026-09-08 (the query works from this environment;
 * plain GETs to zigly.com do not, which is why the section-parsing suites use
 * hand-written markup and this one does not have to).
 */
import {isVisible, parseCoupons} from '../src/native/coupons';
import {flattenFields} from '../src/native/storefront';

/** Shape one metaobject edge the way the API returns it. */
const edge = (
  handle: string,
  fields: Record<string, string>,
): {node: {handle: string; fields: {key: string; value: string}[]}} => ({
  node: {
    handle,
    fields: Object.entries(fields).map(([key, value]) => ({key, value})),
  },
});

/** The seven live offers, verbatim. */
const LIVE = {
  metaobjects: {
    edges: [
      edge('hfar-8', {
        code_description: 'No code required | First-time purchase only',
        discount_code: 'Extra 10% off on orders above ₹1,799',
        show_offer_on_homepage: 'true',
      }),
      edge('vew-3', {
        code_description: 'No code required',
        discount_code: 'INR 50 off on orders between INR 1500 - INR 1999',
        show_offer_on_homepage: 'true',
      }),
      edge('food3', {
        code_description: 'With any dog food purchase above ₹999 (Worth ₹199)',
        discount_code: 'FREE Applod Dry Dog Food',
        show_offer_on_homepage: 'false',
      }),
      edge('warmwelcome', {
        code_description: 'No code required',
        discount_code: 'INR 75 Off on orders between INR 2000 - INR 2999',
        show_offer_on_homepage: 'true',
      }),
      edge('mid-3', {
        code_description: 'No Code Required',
        discount_code: 'INR 150 off on orders between INR 3000 - INR 4999',
        show_offer_on_homepage: 'true',
      }),
      edge('high-5', {
        code_description: 'No Code Required',
        discount_code: 'INR 300 Off on orders between INR 5000 - INR 9999',
        show_offer_on_homepage: 'true',
      }),
      edge('top-10', {
        code_description: 'No Code Required',
        discount_code: 'INR 750 Off on orders between INR 10000 - INR 14999',
        show_offer_on_homepage: 'true',
      }),
    ],
  },
};

describe('the theme filter, reproduced', () => {
  it('shows the six offers the site shows, of the seven that exist', () => {
    const coupons = parseCoupons(LIVE);
    expect(LIVE.metaobjects.edges).toHaveLength(7);
    expect(coupons).toHaveLength(6);
  });

  /**
   * THE FAILURE THIS SUITE EXISTS FOR. Named after the offer, so a future
   * reader sees the consequence rather than the mechanism.
   */
  it('does not advertise the withdrawn "FREE Applod Dry Dog Food" offer', () => {
    const headlines = parseCoupons(LIVE).map(c => c.headline);
    expect(headlines).not.toContain('FREE Applod Dry Dog Food');
  });

  /**
   * The string/boolean trap, asserted directly on the predicate: "false" is a
   * truthy string, so a plain truthiness check passes here and shows a
   * withdrawn offer.
   */
  it('treats the string "false" as hidden, not as truthy', () => {
    expect(isVisible({discount_code: 'x', show_offer_on_homepage: 'false'})).toBe(
      false,
    );
    expect(isVisible({discount_code: 'x', show_offer_on_homepage: 'true'})).toBe(
      true,
    );
  });

  /** Anything that is not exactly "true" is not a yes. */
  it('requires the flag to be present and exactly "true"', () => {
    expect(isVisible({discount_code: 'x'})).toBe(false);
    expect(isVisible({discount_code: 'x', show_offer_on_homepage: 'True'})).toBe(
      false,
    );
    expect(isVisible({discount_code: 'x', show_offer_on_homepage: '1'})).toBe(
      false,
    );
  });

  /** The theme's first condition: no headline, no card. */
  it('drops an offer with no headline, however it is empty', () => {
    expect(isVisible({show_offer_on_homepage: 'true'})).toBe(false);
    expect(
      isVisible({discount_code: '', show_offer_on_homepage: 'true'}),
    ).toBe(false);
    expect(
      isVisible({discount_code: '   ', show_offer_on_homepage: 'true'}),
    ).toBe(false);
  });
});

describe('what a card is given to draw', () => {
  it('keeps the merchant order, sorting nothing', () => {
    const headlines = parseCoupons(LIVE).map(c => c.headline);
    expect(headlines[0]).toBe('Extra 10% off on orders above ₹1,799');
    expect(headlines[1]).toBe(
      'INR 50 off on orders between INR 1500 - INR 1999',
    );
    // The withdrawn offer is removed, so what followed it moves up -- the
    // remaining order is still the merchant's.
    expect(headlines[2]).toBe(
      'INR 75 Off on orders between INR 2000 - INR 2999',
    );
  });

  it('carries the headline and the terms separately', () => {
    const first = parseCoupons(LIVE)[0];
    expect(first.headline).toBe('Extra 10% off on orders above ₹1,799');
    expect(first.terms).toBe('No code required | First-time purchase only');
  });

  /**
   * The card keys on the handle. Terms repeat across offers -- four of the six
   * live ones say some casing of "No code required" -- so keying on text would
   * collide, and the theme's own marquee emits every offer twice.
   */
  it('identifies an offer by its handle, which is unique', () => {
    const ids = parseCoupons(LIVE).map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('hfar-8');
  });

  it('reports missing terms as null rather than an empty string', () => {
    const parsed = parseCoupons({
      metaobjects: {
        edges: [
          edge('bare', {
            discount_code: '20% off',
            show_offer_on_homepage: 'true',
          }),
        ],
      },
    });
    expect(parsed[0].terms).toBeNull();
  });
});

describe('a reply that is not the expected shape', () => {
  /** A failed query resolves null; the strip must draw nothing, not crash. */
  it('returns nothing for a null reply', () => {
    expect(parseCoupons(null)).toEqual([]);
  });

  it('returns nothing for a reply with no metaobjects', () => {
    expect(parseCoupons({})).toEqual([]);
    expect(parseCoupons({metaobjects: {}})).toEqual([]);
  });

  /** A malformed edge is skipped, and its neighbours still draw. */
  it('skips a malformed edge without losing the good ones', () => {
    const parsed = parseCoupons({
      metaobjects: {
        edges: [
          {},
          {node: {handle: 42 as unknown as string, fields: []}},
          edge('good', {
            discount_code: 'Real offer',
            show_offer_on_homepage: 'true',
          }),
        ],
      },
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0].headline).toBe('Real offer');
  });
});

describe('flattening a metaobject', () => {
  it('turns the API key/value list into a plain object', () => {
    expect(
      flattenFields([
        {key: 'a', value: '1'},
        {key: 'b', value: '2'},
      ]),
    ).toEqual({a: '1', b: '2'});
  });

  /** Fields whose value is null come back from the API on unset fields. */
  it('ignores entries that are not two strings', () => {
    expect(
      flattenFields([
        {key: 'ok', value: 'yes'},
        {key: 'novalue', value: null},
        {key: 7, value: 'x'},
        {},
      ] as {key?: unknown; value?: unknown}[]),
    ).toEqual({ok: 'yes'});
  });

  it('survives a missing or non-array field list', () => {
    expect(flattenFields(undefined)).toEqual({});
    expect(flattenFields(null)).toEqual({});
  });
});
