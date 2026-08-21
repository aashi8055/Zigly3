/**
 * One money formatter for the whole app, and one unit: integer paise.
 *
 * Shopify reports money in two different shapes depending on the endpoint --
 * `/cart.js` and `/products/{handle}.js` give integer minor units
 * (`price: 39900` is ₹399.00), while `/search/suggest.json` gives decimal
 * strings (`"2807.00"`). Mixing them up is the classic way a Shopify client
 * ends up showing ₹28.07 or ₹3,990,000, so everything is converted to paise at
 * the edge and formatted here.
 */

/** Renders paise as the site does: no decimals unless the price has them. */
export const money = (paise: number): string => {
  const value = paise / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return '₹' + text;
};

/**
 * Convert one of Shopify's decimal money strings to paise.
 *
 * Returns 0 for anything unparseable rather than NaN: a suggestion row with a
 * missing price should be dropped by the caller, never rendered as "₹NaN".
 */
export const paiseFromDecimal = (raw: unknown): number => {
  if (typeof raw === 'number') {
    return Math.round(raw * 100);
  }
  if (typeof raw !== 'string') {
    return 0;
  }
  // Strip anything that is not part of the number: some Shopify fields arrive
  // pre-formatted with a currency symbol and thousands separators.
  const value = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

/** Whole-percent discount, or 0 when there is nothing to advertise. */
export const percentOff = (original: number, current: number): number =>
  original > current && original > 0
    ? Math.round(((original - current) / original) * 100)
    : 0;
