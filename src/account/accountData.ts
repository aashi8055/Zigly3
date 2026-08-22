/**
 * Reading the account replies.
 *
 * The bridge (../webview/accountBridge.ts) does the DOM work inside the page,
 * where Shopify's own markup is; this module is the boundary that turns its
 * messages into something a screen may render. Pure, so it is tested directly
 * rather than through four WebViews -- the same split as the wishlist.
 *
 * One thing to be clear about, because it is the honest limit of this screen:
 * **Shopify's classic account page carries less about the customer than the
 * reference app shows.** Dawn's `main-account` section renders a heading, the
 * order table and `customer.default_address | format_address`; there is no
 * `customer.email` and no `customer.phone` anywhere in it, and no storefront
 * JSON endpoint that would give them. So this parser takes whatever the theme
 * does render -- a name, an email-shaped string, a phone-shaped string -- and
 * every one of them is optional. A customer with no saved address may have
 * nothing but their initials, and the screen shows exactly that rather than
 * inventing a profile.
 *
 * Order totals are the one figure in this app that is a *rendered* money
 * string rather than integer paise. That is deliberate: there is no
 * `/account/orders.json`, so the theme's own `money_with_currency` output is
 * the only source there is. It is passed through verbatim and never parsed,
 * because a number this app cannot recompute must not be re-formatted either.
 */

/** Whether the site says there is a customer session at all. */
export type AuthState = 'unknown' | 'signedOut' | 'signedIn';

export interface Customer {
  /** Empty when the theme renders no name for this customer. */
  name: string;
  email: string;
  phone: string;
  /** From the name; empty when there is no name to take them from. */
  initials: string;
}

export interface Order {
  /** Shopify's order name, e.g. "#1042". */
  name: string;
  /** Absolute url of the order page, including Shopify's `key` parameter. */
  url: string;
  date: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  /** The theme's own formatted total. Displayed as-is, never parsed. */
  total: string;
}

export interface Address {
  /** Shopify's address id, needed to edit or delete it. */
  id: string;
  /**
   * The address as Shopify's own form fields, read out of the edit form the
   * theme renders for it. Structured rather than scraped, so tapping Edit
   * opens the real values and saving posts them back under the same names.
   */
  fields: AddressFields;
  /** Composed from the fields for display. Never parsed back. */
  lines: string[];
  isDefault: boolean;
}

/** One country as the shop's own countries.js describes it. */
export interface Country {
  name: string;
  code: string;
  /** "State", "Province", "Region" -- the label Shopify uses for this country. */
  provinceLabel: string;
  provinces: string[];
  /** "PIN code", "ZIP code", ... */
  zipLabel: string;
}

/** The address form's fields, named as Shopify's `customer_address` form is. */
export interface AddressFields {
  first_name: string;
  last_name: string;
  phone: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  province: string;
  city: string;
  zip: string;
}

export const EMPTY_ADDRESS_FIELDS: AddressFields = {
  first_name: '',
  last_name: '',
  phone: '',
  company: '',
  address1: '',
  address2: '',
  country: '',
  province: '',
  city: '',
  zip: '',
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(asString).filter(line => line.length > 0)
    : [];

/**
 * Up to two initials, from the first and last word of the name.
 *
 * "Lux Bhati" -> "LB"; "lux" -> "L"; "" -> "". Non-letters are skipped so a
 * name arriving with a stray bullet or comma from `format_address` cannot
 * produce a punctuation mark in the avatar.
 */
export const initialsFrom = (name: string): string => {
  const words = name.split(/[^A-Za-zÀ-ɏ]+/).filter(word => word.length > 0);
  if (words.length === 0) {
    return '';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
};

/**
 * Read a `customer` message.
 *
 * Absent fields stay empty rather than becoming placeholders: an account screen
 * that shows a blank line is telling the truth, and one that shows
 * "user@example.com" is not.
 */
export const parseCustomer = (message: Record<string, unknown>): Customer => {
  const name = asString(message.name);
  return {
    name,
    email: asString(message.email),
    phone: asString(message.phone),
    initials: initialsFrom(name),
  };
};

/* ------------------------------------------------------------------------- *
 * Editing the profile
 *
 * WHAT THIS IS, PLAINLY: a device-local overlay. Shopify's classic customer
 * accounts expose no storefront endpoint that changes a customer's name or
 * email -- addresses are the only thing the storefront can write, which is why
 * the Address screen is fully working and this is not. Zigly's own app edits
 * these through a backend this app has no access to.
 *
 * So an edit made here changes what THIS app shows and nothing else. It does
 * not reach Zigly, it is not on the customer's Shopify record, and it will not
 * appear on their orders, their invoices or the website. The screen says so in
 * as many words -- see ../components/EditProfileScreen -- because a form that
 * silently kept a change to itself would be worse than no form.
 *
 * It is held in memory for the session, deliberately. This app has no storage
 * dependency anywhere (recents are session-scoped for the same reason), and
 * adding one to persist a value that is already not the real one would be
 * buying permanence for a fiction.
 * ------------------------------------------------------------------------- */

/** A profile edit, as the form collects it. */
export interface ProfileEdits {
  firstName: string;
  lastName: string;
  email: string;
}

export const NO_PROFILE_EDITS: ProfileEdits | null = null;

/**
 * Split a rendered name into the form's two fields.
 *
 * The theme renders one string; the form has First and Last. The first word is
 * the first name and everything after it is the last, so a three-part name
 * keeps its middle rather than losing it -- "Lux Kumar Bhati" comes back as
 * "Lux" and "Kumar Bhati", and rejoining returns exactly what arrived.
 */
export const splitName = (
  name: string,
): {firstName: string; lastName: string} => {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    return {firstName: '', lastName: ''};
  }
  const at = trimmed.indexOf(' ');
  return at === -1
    ? {firstName: trimmed, lastName: ''}
    : {firstName: trimmed.slice(0, at), lastName: trimmed.slice(at + 1)};
};

/** The two fields back into one name, with no stray space when Last is empty. */
export const joinName = (firstName: string, lastName: string): string =>
  [firstName.trim(), lastName.trim()].filter(part => part.length > 0).join(' ');

/** What the form should open with, for the customer as the app knows them. */
export const editsFromCustomer = (customer: Customer): ProfileEdits => ({
  ...splitName(customer.name),
  email: customer.email,
});

/**
 * The customer as the app should display them: what was read, with any local
 * edit laid over the top.
 *
 * Phone is never overlaid, because the form does not offer it -- Zigly's own
 * app takes the phone from the OTP login, which is the one part of this that is
 * genuinely authoritative, and letting it be typed over would put a number on
 * screen that no one can be reached on.
 *
 * An edit that is blank does not erase what the site rendered: clearing the
 * email field falls back to the real one rather than hiding it.
 */
export const applyProfileEdits = (
  customer: Customer,
  edits: ProfileEdits | null,
): Customer => {
  if (edits === null) {
    return customer;
  }
  const name = joinName(edits.firstName, edits.lastName) || customer.name;
  const email = edits.email.trim() || customer.email;
  if (name === customer.name && email === customer.email) {
    // Same array-identity rule as mergePlaceholders: an unchanged object keeps
    // the screens from re-rendering on every probe.
    return customer;
  }
  return {...customer, name, email, initials: initialsFrom(name)};
};

const parseOrder = (raw: unknown, origin: string): Order | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const url = asString(row.url);
  const name = asString(row.name);
  // Without a name there is nothing to label the row with, and without a url
  // there is nowhere for it to go. Either one missing means the theme's table
  // was not what this expected, and a row that cannot be opened is worse than
  // one fewer row.
  if (!name || !url) {
    return null;
  }
  return {
    name,
    url: url.indexOf('http') === 0 ? url : origin + url,
    date: asString(row.date),
    paymentStatus: asString(row.paymentStatus),
    fulfillmentStatus: asString(row.fulfillmentStatus),
    total: asString(row.total),
  };
};

/** Read an `orders` message. A malformed payload reads as "no orders". */
export const parseOrders = (
  message: Record<string, unknown>,
  origin: string,
): Order[] => {
  const raw = Array.isArray(message.items) ? message.items : [];
  const out: Order[] = [];
  for (const row of raw) {
    const order = parseOrder(row, origin);
    if (order) {
      out.push(order);
    }
  }
  return out;
};

/** Read the fields of one address, filling anything missing with ''. */
const parseFields = (raw: unknown): AddressFields => {
  const row =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  return {
    first_name: asString(row.first_name),
    last_name: asString(row.last_name),
    phone: asString(row.phone),
    company: asString(row.company),
    address1: asString(row.address1),
    address2: asString(row.address2),
    country: asString(row.country),
    province: asString(row.province),
    city: asString(row.city),
    zip: asString(row.zip),
  };
};

/**
 * The address, laid out for a card.
 *
 * This app composes the display from the fields rather than showing Shopify's
 * `format_address` output, because it is reading the *form*, which is what
 * makes Edit possible at all. The layout is the common one and the one India
 * uses -- recipient, company, street, then locality, then country -- and it is
 * only ever display: nothing is parsed back out of these strings.
 */
export const addressLines = (fields: AddressFields): string[] => {
  const name = [fields.first_name, fields.last_name]
    .filter(part => part.length > 0)
    .join(' ');
  const locality = [fields.city, fields.province]
    .filter(part => part.length > 0)
    .join(', ');
  return [
    name,
    fields.company,
    fields.address1,
    fields.address2,
    [locality, fields.zip].filter(part => part.length > 0).join(' - '),
    fields.country,
  ].filter(line => line.trim().length > 0);
};

const parseAddress = (raw: unknown): Address | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const fields = parseFields(row.fields);
  // No id means Edit and Delete would have nothing to address; no street means
  // the form this came from was not an address form. Neither is renderable.
  if (!id || (!fields.address1 && !fields.city)) {
    return null;
  }
  return {
    id,
    fields,
    lines: addressLines(fields),
    isDefault: row.isDefault === true,
  };
};

/** Read an `addresses` message. */
export const parseAddresses = (message: Record<string, unknown>): Address[] => {
  const raw = Array.isArray(message.items) ? message.items : [];
  const out: Address[] = [];
  for (const row of raw) {
    const address = parseAddress(row);
    if (address) {
      out.push(address);
    }
  }
  // Shopify marks one address default; the reference app lists it first.
  return out.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
};

const parseCountry = (raw: unknown): Country | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const name = asString(row.name);
  if (!name) {
    return null;
  }
  return {
    name,
    code: asString(row.code),
    // Shopify leaves the label null for countries with no subdivisions.
    provinceLabel: asString(row.provinceLabel) || 'State',
    provinces: asStrings(row.provinces),
    zipLabel: asString(row.zipLabel) || 'Zip/Postal Code',
  };
};

/** Read a `countries` message: the shop's own country and province lists. */
export const parseCountries = (message: Record<string, unknown>): Country[] => {
  const raw = Array.isArray(message.items) ? message.items : [];
  const out: Country[] = [];
  for (const row of raw) {
    const country = parseCountry(row);
    if (country) {
      out.push(country);
    }
  }
  return out;
};

/** The country the form should open on, given what the shop offers. */
export const defaultCountry = (countries: Country[]): Country | null => {
  if (countries.length === 0) {
    return null;
  }
  const india = countries.find(country => country.code === 'IN');
  return india ?? countries[0];
};

/**
 * Whether the form has enough to save.
 *
 * Shopify itself rejects an address with no address1 or no city, and returns
 * the form again rather than an error this app could show usefully -- so the
 * same minimum is checked here, where it can be said plainly. Everything else,
 * including whether a province is required, is Shopify's judgement to make.
 */
export const addressIsSavable = (fields: AddressFields): boolean =>
  fields.address1.trim().length > 0 &&
  fields.city.trim().length > 0 &&
  fields.country.trim().length > 0;
