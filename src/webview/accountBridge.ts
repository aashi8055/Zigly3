/**
 * The account, read out of the site.
 *
 * Everything here runs inside the dashboard WebView, for the same reason the
 * cart and the search suggestions do: that is where the session cookie is, and
 * the requirement this whole feature exists for is that the app and the website
 * are one signed-in customer, not two.
 *
 * What it reads, and why each source is the right one:
 *
 *   auth + profile + orders   `/account?sections=main-account`
 *       Shopify's Section Rendering API against the account template. Signed
 *       out, Shopify 302s the request to /account/login -- so the *redirect*
 *       is the login check, not a guess at a cookie. `pageCache.ts` already
 *       uses this API for the dashboard's sections; this is the same mechanism
 *       pointed at the customer's own page.
 *
 *   addresses                 `/account/addresses?sections=main-addresses`
 *       Not scraped as text. Dawn renders a complete *edit form* per saved
 *       address, so each address is read as the same named fields Shopify will
 *       accept back -- `address[address1]`, `address[province]` and the rest.
 *       Reading the form instead of the rendered address means editing an
 *       address round-trips through Shopify's own field names, and the list on
 *       screen is composed from data rather than from parsed prose.
 *
 *   countries and states      `/services/countries.js`
 *       The shop's own country dataset, same origin and no key: it carries the
 *       province list, the province *label* ("State" for India, "Region"
 *       elsewhere) and the postcode label. Bundling a country table into the
 *       app would have been a copy that drifts.
 *
 *   writes                    POST `/account/addresses[/{id}]`
 *       Shopify's documented `customer_address` form target, with `_method`
 *       for update and delete. No API token exists in this app and none is
 *       needed: the form post carries the session, exactly as the website's
 *       own form does.
 *
 * Deliberately absent: any request to auth.lucentcommerce.com. Login is
 * SimplyOTP's, with reCAPTCHA and fraud detection enabled, and driving it from
 * native code would mean building on a credential lifted out of Zigly's
 * storefront -- the objection that kept search off SearchTap and the wishlist
 * off Swym's API. Login runs in the site's own page; see ./loginRestyle.ts.
 *
 * Style notes for anyone editing this file:
 *   - No regular expressions. Not squeamishness: a backslash inside a template
 *     literal is eaten before the page ever sees the script, which has silently
 *     shipped a dead payload in this project before. Every check here is
 *     indexOf, split or a character loop, so there is no escape to lose.
 *   - Nothing throws. A selector that finds nothing reports "not found" and the
 *     screen shows less, which is always better than a broken account page.
 */

/** How many orders the account screen asks for. A bound, not an expectation. */
export const ORDER_LIMIT = 50;

/**
 * How long a write waits for its own confirmation before giving up.
 *
 * Every write here reports back, and every one of them verifies itself by
 * re-reading the list -- so a reply is two requests away, not one. If neither
 * arrives (the page navigated, the renderer was killed, the network went) the
 * screen has to stop spinning and say so: a Save button that turns into a
 * spinner and stays there is indistinguishable from an app that has crashed.
 */
export const WRITE_TIMEOUT_MS = 15000;

/**
 * Shared helpers, prepended to each script below.
 *
 * Every script is injected on its own, so they cannot rely on each other having
 * run -- hence one string, included by each, rather than a bootstrap.
 */
const HELPERS = `
  var ZA = window.__ziglyAccount = window.__ziglyAccount || {};

  /** Post one reply. Never throws: the bridge is not worth a white screen. */
  ZA.send = function (tag, payload) {
    try {
      payload = payload || {};
      payload.tag = tag;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  };

  /** True when a url landed on the login page, i.e. there is no session. */
  ZA.isLoginUrl = function (url) {
    return String(url || '').indexOf('/account/login') !== -1;
  };

  /**
   * The html inside a Section Rendering reply.
   *
   * The key is the section's id, which carries a theme-generated suffix -- the
   * project rule is never to hardcode one -- so any string value long enough to
   * be markup is taken. Returns '' when the body was not JSON at all, which is
   * what a redirect to the login page looks like.
   */
  ZA.sectionHtml = function (text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return ''; }
    if (!data || typeof data !== 'object') { return ''; }
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      var value = data[keys[i]];
      if (typeof value === 'string' && value.indexOf('<') !== -1) {
        return value;
      }
    }
    return '';
  };

  /** Parse html into a detached document. Nothing here is ever inserted. */
  ZA.parse = function (html) {
    try {
      return new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return null;
    }
  };

  /**
   * Fetch a page and hand back its markup as a document, or the reason there
   * is none.
   *
   * Tries the section first because it is a fraction of the page, then the page
   * itself: the section route depends on the template being sectioned, and this
   * app must not assume the shape of a theme it does not control.
   */
  ZA.load = function (path, done) {
    fetch(path + (path.indexOf('?') === -1 ? '?' : '&') + 'sections=' + ZA.sectionOf(path), {
      credentials: 'same-origin'
    })
      .then(function (r) {
        return r.text().then(function (text) {
          return {url: r.url, status: r.status, text: text};
        });
      })
      .then(function (res) {
        if (ZA.isLoginUrl(res.url)) { done(null, 'signedOut', 'section'); return; }
        var html = ZA.sectionHtml(res.text);
        if (html) { done(ZA.parse(html), 'signedIn', 'section'); return; }
        // The section route gave us nothing usable. Read the real page.
        fetch(path, {credentials: 'same-origin'})
          .then(function (r) {
            return r.text().then(function (text) {
              return {url: r.url, text: text};
            });
          })
          .then(function (res2) {
            if (ZA.isLoginUrl(res2.url)) { done(null, 'signedOut', 'page'); return; }
            done(ZA.parse(res2.text), 'signedIn', 'page');
          })
          .catch(function () { done(null, 'error', 'page'); });
      })
      .catch(function () { done(null, 'error', 'section'); });
  };

  /** Dawn's section name for a customer path. */
  ZA.sectionOf = function (path) {
    return path.indexOf('/addresses') !== -1 ? 'main-addresses' : 'main-account';
  };

  /** The part of a document the customer's own content is in. */
  ZA.main = function (doc) {
    if (!doc) { return null; }
    return doc.querySelector('.customer') ||
      doc.querySelector('main') ||
      doc.querySelector('#MainContent') ||
      doc.body;
  };

  /** One line of text: non-breaking spaces, tabs and runs of space normalised. */
  ZA.norm = function (value) {
    var raw = String(value || '')
      .split(String.fromCharCode(160)).join(' ')
      .split(String.fromCharCode(9)).join(' ')
      .split(String.fromCharCode(10)).join(' ');
    while (raw.indexOf('  ') !== -1) { raw = raw.split('  ').join(' '); }
    return raw.trim();
  };

  ZA.text = function (node) {
    return node ? ZA.norm(node.textContent) : '';
  };

  /** How many digits a string contains. Used to recognise a phone number. */
  ZA.digits = function (value) {
    var n = 0;
    for (var i = 0; i < value.length; i++) {
      var c = value.charCodeAt(i);
      if (c >= 48 && c <= 57) { n++; }
    }
    return n;
  };

  /**
   * Whether a token is an email address.
   *
   * Character checks rather than a pattern, so there is no backslash to lose in
   * transit. Over-permissive on purpose: it is deciding whether a string the
   * theme already printed is the customer's email, not validating input.
   */
  ZA.looksLikeEmail = function (token) {
    var at = token.indexOf('@');
    if (at < 1 || token.indexOf(' ') !== -1) { return false; }
    var dot = token.indexOf('.', at + 2);
    return dot > at + 1 && dot < token.length - 1 && token.indexOf('@', at + 1) === -1;
  };

  /**
   * Whether a line is a phone number and nothing else.
   *
   * Ten digits or more, and no letters -- so a house number in an address line
   * cannot be mistaken for one, and neither can an order total.
   */
  ZA.looksLikePhone = function (line) {
    if (ZA.digits(line) < 10) { return false; }
    for (var i = 0; i < line.length; i++) {
      var c = line.charCodeAt(i);
      var letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
      if (letter) { return false; }
    }
    return true;
  };

  /**
   * A node's text as visual lines.
   *
   * Walked rather than split, because \`textContent\` does not see a \`<br>\` --
   * and \`format_address\`, which is how Shopify prints every address on these
   * pages, separates its lines with exactly that. Splitting the flat string
   * would have run the name, the street and the city together into one line
   * and made the name unfindable.
   */
  ZA.lines = function (node) {
    var BLOCK = {
      P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, TABLE: 1, TR: 1, TD: 1, TH: 1,
      H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SECTION: 1, HEADER: 1,
      FOOTER: 1, FORM: 1, FIELDSET: 1, LABEL: 1, BUTTON: 1, ADDRESS: 1
    };
    var out = [];
    var buf = '';
    function flush() {
      var line = ZA.norm(buf);
      if (line) { out.push(line); }
      buf = '';
    }
    function walk(node2) {
      var kids = node2.childNodes || [];
      for (var i = 0; i < kids.length; i++) {
        var child = kids[i];
        if (child.nodeType === 3) { buf += child.nodeValue || ''; continue; }
        if (child.nodeType !== 1) { continue; }
        var tag = child.tagName;
        if (tag === 'BR') { flush(); continue; }
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') { continue; }
        if (BLOCK[tag]) { flush(); walk(child); flush(); } else { walk(child); }
      }
    }
    if (!node) { return out; }
    walk(node);
    flush();
    return out;
  };
`;

/**
 * Read the account: whether there is a session, who it belongs to, and the
 * order history.
 *
 * One reply, because the account screen needs all of it at once and a second
 * round trip would only let the screen render half of itself first.
 */
export const ACCOUNT_PROBE = `
(function () {
  ${HELPERS}

  /**
   * The customer's own details, as far as the theme prints them.
   *
   * This is the honest weak point of the account screen, and it is worth
   * knowing why rather than discovering it on a device. Dawn's account section
   * renders a heading, the order table and \`customer.default_address |
   * format_address\`. It does not render \`customer.email\` or
   * \`customer.phone\`, and Shopify's classic storefront has no customer JSON
   * endpoint that would -- so on a stock theme the only name available is the
   * one on the default address, and a customer with no saved address has none.
   *
   * So each field is looked for in the places a theme might have put it, and
   * anything not found stays empty. The screen then shows less. What it must
   * never do is show a plausible-looking address that belongs to nobody.
   */
  function profile(root) {
    var found = {name: '', email: '', phone: '', nameFrom: 'none'};
    if (!root) { return found; }

    // Email: a mailto link is unambiguous, so it wins.
    var mail = root.querySelector('a[href^="mailto:"]');
    if (mail) {
      found.email = mail.getAttribute('href').slice(7).split('?')[0].trim();
    }
    var tel = root.querySelector('a[href^="tel:"]');
    if (tel) {
      found.phone = tel.getAttribute('href').slice(4).trim();
    }

    /**
     * The block holding the account details. Located by the link Dawn puts in
     * it rather than by a class name, because the link is a route and routes
     * are stable where class names are the theme author's business.
     */
    var link = root.querySelector('a[href*="/account/addresses"]');
    var block = link ? link.parentElement : null;
    // One step up if the link sits in its own wrapper, so the address that
    // precedes it is inside the block too.
    if (block && ZA.lines(block).length < 2 && block.parentElement) {
      block = block.parentElement;
    }

    var lines = ZA.lines(block);
    var linkText = link ? ZA.text(link) : '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (linkText && line.indexOf(linkText) !== -1) { continue; }
      if (!found.email && ZA.looksLikeEmail(line)) { found.email = line; continue; }
      if (!found.phone && ZA.looksLikePhone(line)) { found.phone = line; continue; }
      // format_address prints the name first, so the first line that is
      // neither a contact detail nor the link is the customer's name.
      if (!found.name && ZA.digits(line) === 0 && line.length < 60) {
        found.name = line;
        found.nameFrom = 'address';
      }
    }

    // Some themes greet the customer by name in the heading; take that in
    // preference, since it is the customer's name rather than an address's.
    var greeting = root.querySelector(
      '[class*="customer-name"], [class*="account-name"], [class*="greeting"]'
    );
    var greetingText = ZA.text(greeting);
    if (greetingText && greetingText.length < 60) {
      found.name = greetingText;
      found.nameFrom = 'greeting';
    }

    return found;
  }

  /** One cell of an order row, by what the theme says the column is. */
  function cell(row, want) {
    var cells = row.querySelectorAll('td, th');
    for (var i = 0; i < cells.length; i++) {
      var head = (cells[i].getAttribute('headers') || '') + ' ' +
        (cells[i].getAttribute('data-label') || '');
      if (head.toLowerCase().indexOf(want) !== -1) { return ZA.text(cells[i]); }
    }
    return '';
  }

  /**
   * The order history.
   *
   * Read by column *name*, not by position: Dawn labels every cell with the
   * \`headers\` attribute of its column, and a theme that reorders the table
   * would otherwise silently swap the date and the total. Positional order is
   * the fallback, and only that.
   */
  function orders(root) {
    var out = [];
    if (!root) { return out; }
    var rows = root.querySelectorAll('tr');
    for (var i = 0; i < rows.length && out.length < ${ORDER_LIMIT}; i++) {
      var row = rows[i];
      var link = row.querySelector('a[href*="/account/orders/"]');
      if (!link) { continue; }
      var cells = row.querySelectorAll('td');
      out.push({
        name: ZA.text(link),
        url: link.getAttribute('href') || '',
        date: cell(row, 'date') || (cells[1] ? ZA.text(cells[1]) : ''),
        paymentStatus: cell(row, 'payment') || (cells[2] ? ZA.text(cells[2]) : ''),
        fulfillmentStatus:
          cell(row, 'fulfil') || (cells[3] ? ZA.text(cells[3]) : ''),
        // The theme's own money string. Passed through, never parsed: there is
        // no /account/orders.json to check it against, and a total this app
        // cannot recompute is one it must not reformat either.
        total: cell(row, 'total') || (cells[4] ? ZA.text(cells[4]) : '')
      });
    }
    return out;
  }

  ZA.load('/account', function (doc, state, via) {
    if (state !== 'signedIn') {
      ZA.send('account', {state: state, via: via});
      return;
    }
    var root = ZA.main(doc);
    var who = profile(root);
    var list = orders(root);
    ZA.send('account', {
      state: 'signedIn',
      via: via,
      name: who.name,
      email: who.email,
      phone: who.phone,
      items: list,
      // Reported so one device run says what the theme actually gave us,
      // rather than leaving the weak fields above assumed. Logged, not shown.
      probe: {
        nameFrom: who.nameFrom,
        hasEmail: who.email.length > 0,
        hasPhone: who.phone.length > 0,
        orders: list.length
      }
    });
  });
})();
true;
`;

/**
 * The saved addresses, read as the fields Shopify will take back.
 *
 * Dawn renders an edit form per address, so this reads inputs rather than
 * rendered prose: the list on screen is then composed from the same values that
 * an edit would post, and no address is ever a parsed string.
 */
export const ADDRESSES_PROBE = `
(function () {
  ${HELPERS}

  var NAMES = ['first_name', 'last_name', 'company', 'address1', 'address2',
    'city', 'province', 'country', 'zip', 'phone'];

  /**
   * The value of one \`address[...]\` control inside a form.
   *
   * The select case is the one that matters and the one that is easy to get
   * wrong. Dawn does not mark the customer's country with a \`selected\`
   * attribute -- it prints \`data-default="India"\` on the select and applies it
   * with its own script at runtime. This document was parsed, so no script has
   * run: \`selectedIndex\` is 0, which is Afghanistan. So \`data-default\` is
   * read *before* the current selection, and every saved address would
   * otherwise come back living in the alphabetically first country on earth.
   */
  function field(form, name) {
    var node = form.querySelector('[name="address[' + name + ']"]');
    if (!node) { return ''; }
    if (node.tagName === 'SELECT') {
      var marked = node.querySelector('option[selected]');
      if (marked) { return String(marked.value || '').trim(); }
      var fallback = node.getAttribute('data-default');
      if (fallback) { return String(fallback).trim(); }
      var chosen = node.options ? node.options[node.selectedIndex] : null;
      return chosen ? String(chosen.value || '').trim() : '';
    }
    return String(node.value || '').trim();
  }

  /**
   * Shopify's id for an address, from whatever carries it.
   *
   * The edit form's own action is \`/account/addresses/{id}\`, and Dawn also
   * wraps each in \`#EditAddress_{id}\`. Either will do; both are routes rather
   * than presentation, which is why they are trusted over class names.
   */
  function idOf(form) {
    var action = form.getAttribute('action') || '';
    var marker = '/account/addresses/';
    var at = action.indexOf(marker);
    if (at !== -1) {
      var tail = action.slice(at + marker.length).split('?')[0].split('/')[0];
      if (tail && ZA.digits(tail) === tail.length) { return tail; }
    }
    var box = form.closest ? form.closest('[id^="EditAddress_"]') : null;
    if (box) { return box.id.slice('EditAddress_'.length); }
    return '';
  }

  function addresses(root) {
    var out = [];
    var seen = {};
    if (!root) { return out; }
    var forms = root.querySelectorAll('form[action*="/account/addresses/"]');
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      var id = idOf(form);
      if (!id || seen[id]) { continue; }
      // A delete form carries no fields; only the edit form describes the
      // address, so a form with no address1 is skipped rather than recorded
      // as an empty address.
      var fields = {};
      for (var f = 0; f < NAMES.length; f++) {
        fields[NAMES[f]] = field(form, NAMES[f]);
      }
      if (!fields.address1 && !fields.city) { continue; }
      seen[id] = true;
      var def = form.querySelector('[name="address[default]"]');
      out.push({
        id: id,
        fields: fields,
        isDefault: !!(def && def.checked)
      });
    }
    return out;
  }

  ZA.load('/account/addresses', function (doc, state, via) {
    if (state !== 'signedIn') {
      ZA.send('addresses', {state: state, via: via, items: []});
      return;
    }
    var list = addresses(ZA.main(doc));
    ZA.send('addresses', {state: 'signedIn', via: via, items: list});
  });
})();
true;
`;

/**
 * The shop's own country and province lists.
 *
 * Asked for once, when the address form first opens. 240-odd countries is not
 * a small payload, so it is trimmed to the four things the form needs before
 * it crosses the bridge.
 */
export const COUNTRIES_PROBE = `
(function () {
  ${HELPERS}

  fetch('/services/countries.js', {credentials: 'same-origin'})
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (text) {
      // The file is \`var Countries = {...};\`. Taking the object literal by
      // its braces avoids evaluating a script to read data out of it.
      var open = text.indexOf('{');
      var close = text.lastIndexOf('}');
      if (open === -1 || close <= open) { ZA.send('countries', {items: []}); return; }
      var data;
      try { data = JSON.parse(text.slice(open, close + 1)); } catch (e) { data = null; }
      if (!data) { ZA.send('countries', {items: []}); return; }
      var names = Object.keys(data);
      var items = [];
      for (var i = 0; i < names.length; i++) {
        var entry = data[names[i]] || {};
        items.push({
          name: names[i],
          code: entry.code || '',
          provinceLabel: entry.province_label || '',
          provinces: Array.isArray(entry.provinces) ? entry.provinces : [],
          zipLabel: entry.zip_label || ''
        });
      }
      ZA.send('countries', {items: items});
    })
    .catch(function () { ZA.send('countries', {items: []}); });
})();
true;
`;

/** The fields a write may set, in the order Shopify's own form lists them. */
export interface AddressPost {
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

/**
 * Save an address: create when `id` is null, update otherwise.
 *
 * Posted as Shopify's own `customer_address` form, then **verified** by reading
 * the list back -- the same rule the wishlist follows. Shopify answers a
 * rejected address with the form again rather than an error code, so "the POST
 * returned 200" means nothing on its own; the only honest confirmation is that
 * the address is now in the customer's list.
 */
export const saveAddressScript = (
  fields: AddressPost,
  id: string | null,
): string => `
(function () {
  ${HELPERS}

  var FIELDS = ${JSON.stringify(fields)};
  var ID = ${JSON.stringify(id)};
  var path = ID ? '/account/addresses/' + encodeURIComponent(ID) : '/account/addresses';

  var body = new URLSearchParams();
  body.append('form_type', 'customer_address');
  body.append('utf8', String.fromCharCode(10003));
  if (ID) { body.append('_method', 'put'); }
  var keys = Object.keys(FIELDS);
  for (var i = 0; i < keys.length; i++) {
    body.append('address[' + keys[i] + ']', FIELDS[keys[i]] || '');
  }

  /** Did the write land? Ask the list, not the response code. */
  function verify(reason) {
    fetch('/account/addresses', {credentials: 'same-origin'})
      .then(function (r) {
        return r.text().then(function (text) { return {url: r.url, text: text}; });
      })
      .then(function (res) {
        if (ZA.isLoginUrl(res.url)) {
          ZA.send('address-saved', {ok: false, reason: 'signedOut'});
          return;
        }
        var doc = ZA.parse(res.text);
        /*
         * Both the rendered address and the markup behind it.
         *
         * A theme prints the address as text (format_address) *and* carries it
         * in the edit form's value attributes, and textContent cannot see an
         * attribute. Looking at only one of the two would report a perfectly
         * saved address as a failure on any theme that happens to render the
         * other -- and a false "that did not save" is the worse error here: it
         * invites the customer to save it twice.
         */
        var hay = (
          (doc ? ZA.text(ZA.main(doc)) : '') + ' ' + res.text
        ).toLowerCase();
        var needle = String(FIELDS.address1 || '').trim().toLowerCase();
        var present = needle.length > 0 && hay.indexOf(needle) !== -1;
        ZA.send('address-saved', {
          ok: present,
          reason: present ? '' : (reason || 'not in list after save')
        });
      })
      .catch(function () {
        ZA.send('address-saved', {ok: false, reason: 'could not re-read list'});
      });
  }

  fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString()
  })
    .then(function (r) { verify(r.ok ? '' : 'status ' + r.status); })
    .catch(function () { verify('request failed'); });
})();
true;
`;

/**
 * Delete an address.
 *
 * Verified the same way, and for the same reason: an address that quietly
 * survived its own deletion would leave the app showing a list that is not the
 * customer's.
 */
export const deleteAddressScript = (id: string): string => `
(function () {
  ${HELPERS}

  var ID = ${JSON.stringify(id)};
  var body = new URLSearchParams();
  body.append('_method', 'delete');
  body.append('form_type', 'customer_address');
  body.append('utf8', String.fromCharCode(10003));

  fetch('/account/addresses/' + encodeURIComponent(ID), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString()
  })
    .then(function () {
      return fetch('/account/addresses', {credentials: 'same-origin'})
        .then(function (r) {
          return r.text().then(function (text) { return {url: r.url, text: text}; });
        });
    })
    .then(function (res) {
      if (ZA.isLoginUrl(res.url)) {
        ZA.send('address-deleted', {id: ID, ok: false, reason: 'signedOut'});
        return;
      }
      // Gone means gone: the id no longer appears in any form on the page.
      var gone = res.text.indexOf('/account/addresses/' + ID) === -1;
      ZA.send('address-deleted', {
        id: ID,
        ok: gone,
        reason: gone ? '' : 'still listed after delete'
      });
    })
    .catch(function () {
      ZA.send('address-deleted', {id: ID, ok: false, reason: 'request failed'});
    });
})();
true;
`;

/**
 * Sign out.
 *
 * `/account/logout` is the site's own route and clearing the session cookie is
 * its job -- the app must not try to clear cookies itself, which is the one
 * way to end up with the WebView and the app disagreeing about who is signed
 * in. Fetched rather than navigated to, because the dashboard WebView is never
 * navigated away from; the cookie jar is shared, so the clearing lands anyway.
 *
 * Then it is checked. A logout that failed and reported success would leave the
 * app showing a signed-out account screen over a signed-in website.
 */
export const LOGOUT_SCRIPT = `
(function () {
  ${HELPERS}

  fetch('/account/logout', {credentials: 'same-origin'})
    .then(function () {
      return fetch('/account', {credentials: 'same-origin'});
    })
    .then(function (r) {
      var out = ZA.isLoginUrl(r.url);
      ZA.send('auth', {state: out ? 'signedOut' : 'signedIn', from: 'logout'});
    })
    .catch(function () {
      // Unknown rather than signed out: the screen keeps what it had and the
      // next probe settles it.
      ZA.send('auth', {state: 'error', from: 'logout'});
    });
})();
true;
`;
