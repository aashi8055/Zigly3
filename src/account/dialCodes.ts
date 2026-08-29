/**
 * Dialling codes, for the login screen's country selector.
 *
 * Bundled rather than read off the site, which is a deliberate exception to this
 * project's usual rule. `/services/countries.js` -- what the address form's
 * pickers use, see ./accountData.ts -- carries provinces and postcode labels and
 * no dialling code at all, because Shopify has no use for one. A calling code is
 * an ITU standard rather than commerce data: it does not drift with Zigly's
 * catalogue, so there is nothing here that can go stale the way a bundled
 * country-and-province table would.
 *
 * Flags are emoji, built from the ISO code rather than shipped as images: this
 * app has no bitmaps anywhere (see ../components/glyphs.tsx for the same
 * reasoning applied to icons), and 240 flag PNGs at three densities would be the
 * largest thing in the bundle by a wide margin.
 *
 * Style note, the project rule: no regular expressions. A backslash inside a
 * template literal is eaten before an injected script ever sees it, and the
 * habit is kept in plain modules too so there is one rule and not two.
 */

/** One country, as the selector needs it. */
export interface DialCountry {
  /** ISO 3166-1 alpha-2. Also what the flag is derived from. */
  iso2: string;
  name: string;
  /** Calling code, without the plus. */
  dial: string;
}

/**
 * The table, as `iso2|name|dial`.
 *
 * A packed string rather than 200 object literals so the list stays scannable
 * and a missing comma cannot silently truncate it. Split once, below.
 */
const TABLE = [
  'AF|Afghanistan|93',
  'AL|Albania|355',
  'DZ|Algeria|213',
  'AD|Andorra|376',
  'AO|Angola|244',
  'AG|Antigua and Barbuda|1268',
  'AR|Argentina|54',
  'AM|Armenia|374',
  'AW|Aruba|297',
  'AU|Australia|61',
  'AT|Austria|43',
  'AZ|Azerbaijan|994',
  'BS|Bahamas|1242',
  'BH|Bahrain|973',
  'BD|Bangladesh|880',
  'BB|Barbados|1246',
  'BY|Belarus|375',
  'BE|Belgium|32',
  'BZ|Belize|501',
  'BJ|Benin|229',
  'BM|Bermuda|1441',
  'BT|Bhutan|975',
  'BO|Bolivia|591',
  'BA|Bosnia and Herzegovina|387',
  'BW|Botswana|267',
  'BR|Brazil|55',
  'BN|Brunei|673',
  'BG|Bulgaria|359',
  'BF|Burkina Faso|226',
  'BI|Burundi|257',
  'KH|Cambodia|855',
  'CM|Cameroon|237',
  'CA|Canada|1',
  'CV|Cape Verde|238',
  'KY|Cayman Islands|1345',
  'CF|Central African Republic|236',
  'TD|Chad|235',
  'CL|Chile|56',
  'CN|China|86',
  'CO|Colombia|57',
  'KM|Comoros|269',
  'CG|Congo|242',
  'CD|Congo (DRC)|243',
  'CR|Costa Rica|506',
  'CI|Ivory Coast|225',
  'HR|Croatia|385',
  'CU|Cuba|53',
  'CW|Curacao|599',
  'CY|Cyprus|357',
  'CZ|Czechia|420',
  'DK|Denmark|45',
  'DJ|Djibouti|253',
  'DM|Dominica|1767',
  'DO|Dominican Republic|1809',
  'EC|Ecuador|593',
  'EG|Egypt|20',
  'SV|El Salvador|503',
  'GQ|Equatorial Guinea|240',
  'ER|Eritrea|291',
  'EE|Estonia|372',
  'ET|Ethiopia|251',
  'FJ|Fiji|679',
  'FI|Finland|358',
  'FR|France|33',
  'GA|Gabon|241',
  'GM|Gambia|220',
  'GE|Georgia|995',
  'DE|Germany|49',
  'GH|Ghana|233',
  'GI|Gibraltar|350',
  'GR|Greece|30',
  'GL|Greenland|299',
  'GD|Grenada|1473',
  'GT|Guatemala|502',
  'GN|Guinea|224',
  'GW|Guinea-Bissau|245',
  'GY|Guyana|592',
  'HT|Haiti|509',
  'HN|Honduras|504',
  'HK|Hong Kong|852',
  'HU|Hungary|36',
  'IS|Iceland|354',
  'IN|India|91',
  'ID|Indonesia|62',
  'IR|Iran|98',
  'IQ|Iraq|964',
  'IE|Ireland|353',
  'IL|Israel|972',
  'IT|Italy|39',
  'JM|Jamaica|1876',
  'JP|Japan|81',
  'JO|Jordan|962',
  'KZ|Kazakhstan|7',
  'KE|Kenya|254',
  'KI|Kiribati|686',
  'KW|Kuwait|965',
  'KG|Kyrgyzstan|996',
  'LA|Laos|856',
  'LV|Latvia|371',
  'LB|Lebanon|961',
  'LS|Lesotho|266',
  'LR|Liberia|231',
  'LY|Libya|218',
  'LI|Liechtenstein|423',
  'LT|Lithuania|370',
  'LU|Luxembourg|352',
  'MO|Macao|853',
  'MG|Madagascar|261',
  'MW|Malawi|265',
  'MY|Malaysia|60',
  'MV|Maldives|960',
  'ML|Mali|223',
  'MT|Malta|356',
  'MH|Marshall Islands|692',
  'MR|Mauritania|222',
  'MU|Mauritius|230',
  'MX|Mexico|52',
  'FM|Micronesia|691',
  'MD|Moldova|373',
  'MC|Monaco|377',
  'MN|Mongolia|976',
  'ME|Montenegro|382',
  'MA|Morocco|212',
  'MZ|Mozambique|258',
  'MM|Myanmar|95',
  'NA|Namibia|264',
  'NR|Nauru|674',
  'NP|Nepal|977',
  'NL|Netherlands|31',
  'NZ|New Zealand|64',
  'NI|Nicaragua|505',
  'NE|Niger|227',
  'NG|Nigeria|234',
  'KP|North Korea|850',
  'MK|North Macedonia|389',
  'NO|Norway|47',
  'OM|Oman|968',
  'PK|Pakistan|92',
  'PW|Palau|680',
  'PS|Palestine|970',
  'PA|Panama|507',
  'PG|Papua New Guinea|675',
  'PY|Paraguay|595',
  'PE|Peru|51',
  'PH|Philippines|63',
  'PL|Poland|48',
  'PT|Portugal|351',
  'PR|Puerto Rico|1787',
  'QA|Qatar|974',
  'RO|Romania|40',
  'RU|Russia|7',
  'RW|Rwanda|250',
  'KN|Saint Kitts and Nevis|1869',
  'LC|Saint Lucia|1758',
  'VC|Saint Vincent and the Grenadines|1784',
  'WS|Samoa|685',
  'SM|San Marino|378',
  'ST|Sao Tome and Principe|239',
  'SA|Saudi Arabia|966',
  'SN|Senegal|221',
  'RS|Serbia|381',
  'SC|Seychelles|248',
  'SL|Sierra Leone|232',
  'SG|Singapore|65',
  'SK|Slovakia|421',
  'SI|Slovenia|386',
  'SB|Solomon Islands|677',
  'SO|Somalia|252',
  'ZA|South Africa|27',
  'KR|South Korea|82',
  'SS|South Sudan|211',
  'ES|Spain|34',
  'LK|Sri Lanka|94',
  'SD|Sudan|249',
  'SR|Suriname|597',
  'SE|Sweden|46',
  'CH|Switzerland|41',
  'SY|Syria|963',
  'TW|Taiwan|886',
  'TJ|Tajikistan|992',
  'TZ|Tanzania|255',
  'TH|Thailand|66',
  'TL|Timor-Leste|670',
  'TG|Togo|228',
  'TO|Tonga|676',
  'TT|Trinidad and Tobago|1868',
  'TN|Tunisia|216',
  'TR|Turkey|90',
  'TM|Turkmenistan|993',
  'TV|Tuvalu|688',
  'UG|Uganda|256',
  'UA|Ukraine|380',
  'AE|United Arab Emirates|971',
  'GB|United Kingdom|44',
  'US|United States|1',
  'UY|Uruguay|598',
  'UZ|Uzbekistan|998',
  'VU|Vanuatu|678',
  'VA|Vatican City|379',
  'VE|Venezuela|58',
  'VN|Vietnam|84',
  'YE|Yemen|967',
  'ZM|Zambia|260',
  'ZW|Zimbabwe|263',
];

export const DIAL_COUNTRIES: DialCountry[] = TABLE.map(row => {
  const parts = row.split('|');
  return {iso2: parts[0], name: parts[1], dial: parts[2]};
});

/**
 * The flag, from the ISO code.
 *
 * Two regional-indicator symbols -- 'IN' becomes the pair at U+1F1EE U+1F1F3,
 * which the platform draws as India's flag. Anything that is not two letters
 * comes back empty rather than as a pair of stray boxes.
 */
export const emojiFlag = (iso2: string): string => {
  if (iso2.length !== 2) {
    return '';
  }
  const base = 0x1f1e6;
  const first = iso2.toUpperCase().charCodeAt(0) - 65;
  const second = iso2.toUpperCase().charCodeAt(1) - 65;
  if (first < 0 || first > 25 || second < 0 || second > 25) {
    return '';
  }
  return String.fromCodePoint(base + first, base + second);
};

/** India, which the reference screen opens on. */
export const DEFAULT_COUNTRY: DialCountry =
  DIAL_COUNTRIES.find(country => country.iso2 === 'IN') ?? DIAL_COUNTRIES[0];

/**
 * The list, filtered by what was typed.
 *
 * Matched against the name, the ISO code and the dialling code, with or without
 * its plus, so "+44", "44", "gb" and "united" all find the United Kingdom.
 * indexOf rather than a pattern, per the note at the top of this file.
 */
export const filterCountries = (
  countries: DialCountry[],
  query: string,
): DialCountry[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return countries;
  }
  const bare = trimmed.charAt(0) === '+' ? trimmed.slice(1) : trimmed;
  return countries.filter(
    country =>
      country.name.toLowerCase().indexOf(trimmed) !== -1 ||
      country.iso2.toLowerCase().indexOf(trimmed) !== -1 ||
      country.dial.indexOf(bare) === 0,
  );
};

/* ---------------------------------------------------------------- validation

   What "the selected country's dialling rules" can honestly mean here.

   A full national numbering plan per country is libphonenumber's job, and it is
   1.2 MB of metadata that would be by far the largest thing in this bundle for
   a screen with one field on it. What is both small and true is the *length* of
   a mobile national number, which is what actually rejects the two mistakes a
   customer makes -- a digit short, or a digit over.

   So there are two tiers, and the second is deliberately generous:

     - a table below, for the markets whose mobile length is fixed and settled.
       Zigly ships to India, and India is the default, so it is first;
     - E.164 for everything else. The standard caps a number at 15 digits
       including the country code, which is the one rule that holds everywhere.
       A country absent from the table is not rejected on a guess -- it is
       checked against the only rule that is certainly its own.

   Nothing here decides whether a number is *reachable*. That is SimplyOTP's to
   answer, in its own words, and ../webview/otpDriver.ts forwards its verdict
   verbatim. This only stops a request that could not possibly succeed.
*/

/** The most digits E.164 allows in a whole number, country code included. */
const E164_MAX = 15;
/** The fewest a national number can plausibly be. Below this it is a typo. */
const NATIONAL_MIN = 4;

/**
 * Mobile national-number lengths, as `iso2|lengths`.
 *
 * Lengths are separated by commas where a country has more than one. Packed as
 * a string for the reason the country table above is: a missing comma in a
 * literal truncates the list silently, and this one is scanned by eye.
 */
const LENGTH_TABLE = [
  'IN|10',
  'AE|9',
  'AR|10',
  'AT|10,11',
  'AU|9',
  'BD|10',
  'BE|9',
  'BH|8',
  'BR|10,11',
  'CA|10',
  'CH|9',
  'CL|9',
  'CN|11',
  'CO|10',
  'DE|10,11',
  'DK|8',
  'EG|10',
  'ES|9',
  'FI|9,10',
  'FR|9',
  'GB|10',
  'GR|10',
  'HK|8',
  'ID|9,10,11,12',
  'IE|9',
  'IL|9',
  'IT|9,10',
  'JP|10',
  'KE|9',
  'KR|9,10',
  'KW|8',
  'LK|9',
  'MA|9',
  'MX|10',
  'MY|9,10',
  'NG|10',
  'NL|9',
  'NO|8',
  'NP|10',
  'NZ|8,9,10',
  'OM|8',
  'PE|9',
  'PH|10',
  'PK|10',
  'PL|9',
  'PT|9',
  'QA|8',
  'RU|10',
  'SA|9',
  'SE|9',
  'SG|8',
  'TH|9',
  'TR|10',
  'TW|9',
  'UA|9',
  'US|10',
  'VN|9',
  'ZA|9',
];

const LENGTHS: Record<string, number[]> = (() => {
  const out: Record<string, number[]> = {};
  LENGTH_TABLE.forEach(row => {
    const parts = row.split('|');
    out[parts[0]] = parts[1].split(',').map(one => Number(one));
  });
  return out;
})();

/**
 * The leading digits a mobile number may start with, where the plan fixes them.
 *
 * India only, and on purpose. It is the default country, its mobile series is
 * settled at 6-9, and a landline typed into this field is the mistake the
 * length check alone cannot catch -- an eight-digit Delhi landline with its STD
 * code is ten digits too. Every other country is left to the length rule: a
 * leading-digit table that is even slightly out of date rejects real customers,
 * which is a worse failure than letting the provider answer.
 */
const LEADING: Record<string, string[]> = {IN: ['6', '7', '8', '9']};

/** Digits only, in order. A character loop, per the note at the top. */
export const digitsOnly = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      out += value.charAt(i);
    }
  }
  return out;
};

/**
 * The national-number lengths this country accepts.
 *
 * Null where the table has no entry, which is the caller's cue to fall back to
 * E.164 rather than to invent a length.
 */
export const phoneLengths = (country: DialCountry): number[] | null =>
  LENGTHS[country.iso2] ?? null;

/**
 * Why this number cannot be sent to, or null when there is nothing to say.
 *
 * The message is the one the screen shows. It names the length when the country
 * has exactly one, because "enter a valid mobile number" in front of a
 * nine-digit Indian number tells the customer nothing they did not know.
 */
export const validatePhone = (
  country: DialCountry,
  value: string,
): string | null => {
  const digits = digitsOnly(value);
  if (digits.length === 0) {
    return 'Enter your mobile number';
  }

  const lengths = phoneLengths(country);
  if (lengths !== null) {
    if (lengths.indexOf(digits.length) === -1) {
      return lengths.length === 1
        ? `Enter a valid ${lengths[0]}-digit mobile number`
        : 'Enter a valid mobile number';
    }
  } else {
    // E.164, which is the only rule that is certainly this country's own.
    const room = E164_MAX - country.dial.length;
    if (digits.length < NATIONAL_MIN || digits.length > room) {
      return 'Enter a valid mobile number';
    }
  }

  const starts = LEADING[country.iso2];
  if (starts && starts.indexOf(digits.charAt(0)) === -1) {
    return 'Enter a valid mobile number';
  }

  return null;
};
