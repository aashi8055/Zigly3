/**
 * The account section.
 *
 * Three things are worth pinning here, and they are the three that would fail
 * silently on a device:
 *
 *   1. **The parsers refuse half-known data.** Shopify's classic account page
 *      renders less about a customer than the reference app shows -- no email,
 *      no phone on a stock theme -- so every field is optional. The screen must
 *      leave a missing line out, never fill it in, and an order or address that
 *      arrived incomplete must not render at all.
 *   2. **The stack rules.** Signed out, the Account tab opens login and not the
 *      website's account page; signing out from three screens deep collapses to
 *      login; signing in swaps login for the account screen.
 *   3. **The injected scripts parse.** A lost escape in a template literal
 *      turns the whole payload into invalid JavaScript that the WebView then
 *      silently does not run -- which has cost this project build cycles before.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, Text} from 'react-native';
import {
  addressIsSavable,
  addressLines,
  defaultCountry,
  initialsFrom,
  parseAddresses,
  parseCountries,
  parseCustomer,
  parseOrders,
} from '../src/account/accountData';
import type {Address, AddressFields} from '../src/account/accountData';
import type {AccountStack} from '../src/navigation/accountStack';
import {
  EMPTY_ACCOUNT_STACK,
  closeAccount,
  openAccount,
  popScreen,
  pushScreen,
  resolveAuth,
  topScreen,
} from '../src/navigation/accountStack';
import {
  ACCOUNT_PROBE,
  ADDRESSES_PROBE,
  COUNTRIES_PROBE,
  LOGOUT_SCRIPT,
  deleteAddressScript,
  saveAddressScript,
} from '../src/webview/accountBridge';
import {LOGIN_RESTYLE, REQUEST_OTP_LABEL} from '../src/webview/loginRestyle';
import {isAccountUrl, showsSortFilterBar} from '../src/utils/urlUtils';
import AccountScreen from '../src/components/AccountScreen';
import OrdersScreen from '../src/components/OrdersScreen';
import AddressScreen from '../src/components/AddressScreen';
import AddressFormScreen from '../src/components/AddressFormScreen';
import BottomNav from '../src/components/BottomNav';
import {TABS} from '../src/constants/appConstants';

const ORIGIN = 'https://zigly.com';

const render = (ui: React.ReactElement) => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(ui);
  });
  return tree as ReactTestRenderer.ReactTestRenderer;
};

const flatten = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(flatten).join('')
    : children === null || children === undefined || children === false
    ? ''
    : typeof children === 'object'
    ? ''
    : String(children);

const textOf = (tree: ReactTestRenderer.ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => flatten(node.props.children))
    .join(' | ');

const press = (
  tree: ReactTestRenderer.ReactTestRenderer,
  label: string,
): void => {
  const target = tree.root
    .findAll(
      node =>
        node.props?.accessibilityLabel === label &&
        typeof node.props?.onPress === 'function',
    )
    .shift();
  if (!target) {
    throw new Error('no pressable labelled ' + label);
  }
  ReactTestRenderer.act(() => target.props.onPress());
};

const parses = (src: string): boolean => {
  try {
    // eslint-disable-next-line no-new-func
    new Function(src);
    return true;
  } catch {
    return false;
  }
};

const noop = () => {};

const fields = (over: Partial<AddressFields> = {}): AddressFields => ({
  first_name: 'Lux',
  last_name: 'Bhati',
  phone: '+917668319718',
  company: '',
  address1: '12 Green Park',
  address2: 'Flat 4',
  country: 'India',
  province: 'Delhi',
  city: 'New Delhi',
  zip: '110016',
  ...over,
});

// --------------------------------------------------------------- the profile

describe('the customer', () => {
  it('takes initials from the first and last word of the name', () => {
    expect(initialsFrom('Lux Bhati')).toBe('LB');
    expect(initialsFrom('lux')).toBe('L');
    expect(initialsFrom('Lux Kumar Bhati')).toBe('LB');
    expect(initialsFrom('')).toBe('');
  });

  it('never puts punctuation in the avatar', () => {
    // format_address can hand back a line with a stray separator on it.
    expect(initialsFrom('- Lux, Bhati')).toBe('LB');
  });

  it('leaves a field the theme did not render empty', () => {
    // The honest case, and the common one: Dawn's account section renders
    // neither an email nor a phone number.
    const who = parseCustomer({state: 'signedIn', name: 'Lux Bhati'});
    expect(who).toEqual({
      name: 'Lux Bhati',
      email: '',
      phone: '',
      initials: 'LB',
    });
  });

  it('keeps what the theme did render', () => {
    const who = parseCustomer({
      name: 'Lux Bhati',
      email: 'friendszone0071@gmail.com',
      phone: '+917668319718',
    });
    expect(who.email).toBe('friendszone0071@gmail.com');
    expect(who.phone).toBe('+917668319718');
  });
});

// ---------------------------------------------------------------- the orders

describe('the order history', () => {
  const row = {
    name: '#1042',
    url: '/account/orders/6543?key=abc',
    date: '21 August 2026',
    paymentStatus: 'Paid',
    fulfillmentStatus: 'Fulfilled',
    total: '₹1,235.60',
  };

  it('absolutises the order url so the layer can open it', () => {
    const [order] = parseOrders({items: [row]}, ORIGIN);
    expect(order.url).toBe(ORIGIN + '/account/orders/6543?key=abc');
  });

  it('passes the theme total through untouched', () => {
    // There is no /account/orders.json, so this string is the only source
    // there is. Reformatting a figure the app cannot recompute would be
    // inventing one.
    const [order] = parseOrders({items: [row]}, ORIGIN);
    expect(order.total).toBe('₹1,235.60');
  });

  it('drops a row with no order number or no link', () => {
    const parsed = parseOrders(
      {items: [row, {...row, name: ''}, {...row, url: ''}, 'nonsense']},
      ORIGIN,
    );
    expect(parsed).toHaveLength(1);
  });

  it('reads an absent history as no orders rather than as an error', () => {
    expect(parseOrders({state: 'signedIn'}, ORIGIN)).toEqual([]);
  });
});

// ------------------------------------------------------------- the addresses

describe('the addresses', () => {
  const raw = {id: '7788', fields: fields(), isDefault: false};

  it('reads Shopify field names straight through', () => {
    const [address] = parseAddresses({items: [raw]});
    expect(address.fields.address1).toBe('12 Green Park');
    expect(address.fields.province).toBe('Delhi');
    expect(address.id).toBe('7788');
  });

  it('composes the display lines from the fields', () => {
    expect(addressLines(fields())).toEqual([
      'Lux Bhati',
      '12 Green Park',
      'Flat 4',
      'New Delhi, Delhi - 110016',
      'India',
    ]);
  });

  it('leaves out lines the address does not have', () => {
    const lines = addressLines(
      fields({last_name: '', address2: '', province: '', zip: ''}),
    );
    expect(lines).toEqual(['Lux', '12 Green Park', 'New Delhi', 'India']);
  });

  it('drops a form with no street and no city', () => {
    // A delete form matches the same action as an edit form but carries no
    // fields; recording it would put an empty card on the screen.
    const parsed = parseAddresses({
      items: [raw, {id: '9', fields: {phone: '123'}}, {fields: fields()}],
    });
    expect(parsed).toHaveLength(1);
  });

  it('lists the default address first', () => {
    const parsed = parseAddresses({
      items: [raw, {id: '99', fields: fields({city: 'Pune'}), isDefault: true}],
    });
    expect(parsed[0].id).toBe('99');
  });

  it('will not save without a street, a city and a country', () => {
    expect(addressIsSavable(fields())).toBe(true);
    expect(addressIsSavable(fields({address1: ' '}))).toBe(false);
    expect(addressIsSavable(fields({city: ''}))).toBe(false);
    expect(addressIsSavable(fields({country: ''}))).toBe(false);
  });
});

// ------------------------------------------------------------- the countries

describe('the country list', () => {
  const items = [
    {
      name: 'India',
      code: 'IN',
      provinceLabel: 'State',
      provinces: ['Delhi', 'Goa'],
      zipLabel: 'PIN code',
    },
    {
      name: 'Singapore',
      code: 'SG',
      provinceLabel: '',
      provinces: [],
      zipLabel: 'Postal code',
    },
  ];

  it('keeps the shop’s own labels, which differ by country', () => {
    const [india, singapore] = parseCountries({items});
    expect(india.provinceLabel).toBe('State');
    expect(india.zipLabel).toBe('PIN code');
    // Shopify records no subdivisions for Singapore, so there is no label.
    expect(singapore.provinces).toEqual([]);
    expect(singapore.provinceLabel).toBe('State');
  });

  it('opens the form on India when the shop offers it', () => {
    expect(defaultCountry(parseCountries({items}))?.name).toBe('India');
    expect(defaultCountry([])).toBeNull();
  });
});

// ------------------------------------------------------------ the url policy

describe('url policy', () => {
  it('takes over the account pages the app now draws itself', () => {
    expect(isAccountUrl(ORIGIN + '/account')).toBe(true);
    expect(isAccountUrl(ORIGIN + '/account/login?return_url=%2Faccount')).toBe(
      true,
    );
    expect(isAccountUrl(ORIGIN + '/account/addresses')).toBe(true);
    expect(isAccountUrl(ORIGIN + '/collections/dog-food')).toBe(false);
  });

  it('leaves an order page to the website', () => {
    // Line items, tax, shipping and tracking: figures this app has no second
    // source for, so that one page stays Zigly's.
    expect(isAccountUrl(ORIGIN + '/account/orders/6543?key=abc')).toBe(false);
  });

  it('mirrors the sort/filter bar’s own path test exactly', () => {
    expect(showsSortFilterBar(ORIGIN + '/collections/dog-food')).toBe(true);
    expect(showsSortFilterBar(ORIGIN + '/search?q=dog')).toBe(true);
    // The bare collection *list* has no bar, so the tabs stay.
    expect(showsSortFilterBar(ORIGIN + '/collections')).toBe(false);
    expect(showsSortFilterBar(ORIGIN + '/')).toBe(false);
  });

  it('covers every shape of collection listing the site can serve', () => {
    // All of these are the same collection template, so all of them have the
    // engine: a tag listing, the everything collection, and a vendor listing.
    expect(showsSortFilterBar(ORIGIN + '/collections/all')).toBe(true);
    expect(showsSortFilterBar(ORIGIN + '/collections/dog-food/grain-free')).toBe(
      true,
    );
    expect(showsSortFilterBar(ORIGIN + '/collections/vendors?q=Sheba')).toBe(
      true,
    );
    // And the pages that carry product cards but no engine: a breed landing
    // page is carousels and themed rails, with nothing to sort.
    expect(showsSortFilterBar(ORIGIN + '/pages/dog')).toBe(false);
    expect(showsSortFilterBar(ORIGIN + '/pages/pet-breeds')).toBe(false);
    expect(showsSortFilterBar(ORIGIN + '/products/a-dog-bed')).toBe(false);
  });

  it('keeps the bar off a product opened from a collection', () => {
    /*
     * Every card in a Zigly grid links to
     * `/collections/{collection}/products/{handle}`, so the ordinary way into a
     * product page carries '/collections/' in front of it. That answered the
     * listing test, and the product page drew Sort and Filter along its foot --
     * two controls for a grid nobody is looking at. The bare `/products/` form
     * above has always been false; these are the same page.
     */
    expect(
      showsSortFilterBar(ORIGIN + '/collections/dog-toys/products/a-dog-bed'),
    ).toBe(false);
    expect(
      showsSortFilterBar(
        ORIGIN + '/collections/all/products/squeeezys-latex-monster?variant=42',
      ),
    ).toBe(false);
    // Including behind a market prefix, for the reason the next test gives.
    expect(
      showsSortFilterBar(
        ORIGIN + '/en-in/collections/dog-toys/products/a-dog-bed',
      ),
    ).toBe(false);
    // The collection itself still has its bar -- this removes it from the
    // product page only.
    expect(showsSortFilterBar(ORIGIN + '/collections/dog-toys')).toBe(true);
  });

  it('survives a Shopify market prefix on the path', () => {
    /*
     * zigly.com publishes no market today. One added in the admin would prefix
     * every url in the app at once -- and the failure would be silent: the bar
     * would simply never appear again, on any listing, with nothing to say why.
     */
    expect(showsSortFilterBar(ORIGIN + '/en-in/collections/dog-food')).toBe(
      true,
    );
    expect(showsSortFilterBar(ORIGIN + '/hi/search?q=dog')).toBe(true);
    // And a first segment that is merely short is not mistaken for one.
    expect(showsSortFilterBar(ORIGIN + '/en-in/pages/dog')).toBe(false);
    expect(showsSortFilterBar(ORIGIN + '/collections')).toBe(false);
  });
});

// ----------------------------------------------------------------- the stack

describe('the account stack', () => {
  it('opens login when signed out, which is the whole requirement', () => {
    expect(openAccount('signedOut')).toEqual(['login']);
  });

  it('opens the account screen when signed in', () => {
    expect(openAccount('signedIn')).toEqual(['account']);
  });

  it('opens the account screen while the answer is still unknown', () => {
    // Opening login on an unknown state would show the login form to a
    // customer who is already signed in, on every cold start.
    expect(openAccount('unknown')).toEqual(['account']);
  });

  it('collapses to login when the session goes, from any depth', () => {
    const deep = ['account', 'address', 'addressForm'] as const;
    expect(resolveAuth([...deep], 'signedOut')).toEqual(['login']);
  });

  it('swaps login for the account screen once signed in', () => {
    expect(resolveAuth(['login'], 'signedIn')).toEqual(['account']);
  });

  it('leaves a screen that is not login alone when signed in', () => {
    const stack: AccountStack = ['account', 'orders'];
    expect(resolveAuth(stack, 'signedIn')).toBe(stack);
  });

  it('does nothing to a closed section', () => {
    expect(resolveAuth(EMPTY_ACCOUNT_STACK, 'signedOut')).toEqual([]);
  });

  it('carries the change-password screen like any other', () => {
    // Nothing about it is special to the stack: it pushes, it pops, and losing
    // the session collapses it to login along with everything else.
    const stack = pushScreen(['account'], 'changePassword');
    expect(topScreen(stack)).toBe('changePassword');
    expect(popScreen(stack)).toEqual(['account']);
    expect(resolveAuth(['account', 'changePassword'], 'signedOut')).toEqual([
      'login',
    ]);
  });

  it('ignores a repeat push, so a double tap costs one Back', () => {
    const stack = pushScreen(['account'], 'address');
    expect(pushScreen(stack, 'address')).toBe(stack);
  });

  it('walks back one screen at a time and then closes', () => {
    let stack = pushScreen(pushScreen(['account'], 'address'), 'addressForm');
    stack = popScreen(stack);
    expect(topScreen(stack)).toBe('address');
    stack = popScreen(popScreen(stack));
    expect(topScreen(stack)).toBeNull();
    expect(closeAccount()).toEqual([]);
  });
});

/**
 * Where the section leaves the customer, on the three ways out of it.
 *
 * Source assertions, because all three are decisions taken inside one screen
 * component that owns eleven WebViews and cannot be rendered in a test. What
 * they pin is the rule, and the rule is that a *completed* sign-in and an
 * *asked-for* sign-out both end on the dashboard, while a session that merely
 * expired still ends on the login screen -- see signOutReason.
 */
describe('where the section leaves you', () => {
  const src = (): string =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

  /**
   * The body of one useCallback, from its name to the next declaration at the
   * component's own indentation -- two spaces, so the `const`s inside the body
   * do not end the slice early.
   */
  const handler = (name: string): string => {
    const s = src();
    const at = s.indexOf('const ' + name + ' = useCallback');
    expect(at).toBeGreaterThan(-1);
    const next = s.indexOf('\n  const ', at + 20);
    return s.slice(at, next > at ? next : at + 2000);
  };

  it('lands a completed login on the dashboard, not on the account screen', () => {
    // The customer came to the Account tab to sign in; signing in is the end of
    // that, and the app's home is where the app starts.
    const nav = handler('handleLoginNav');
    expect(nav).toContain("applyAuth('signedIn')");
    expect(nav).toContain('closeAccountSection()');
  });

  it('still swaps login for the account screen when a probe corrects it', () => {
    // The other way a signedIn answer arrives: the tab was opened on a stale
    // signed-out state and the probe put it right. That customer never asked to
    // log in and must not be thrown out of the section for tapping Account.
    expect(resolveAuth(['login'], 'signedIn')).toEqual(['account']);
  });

  it('says what it is doing before the site has answered', () => {
    // The request is a round trip and the screen does not change until it
    // comes back, so without this the button does nothing for a second.
    const out = handler('signOut');
    expect(out).toContain('setToastMessage(SIGN_OUT_MESSAGE[reason])');
    expect(out).toContain("injectInto('home', LOGOUT_SCRIPT)");
    expect(src()).toContain("logout: 'Logging out");
  });

  it('closes the section once the site confirms the sign-out', () => {
    const s = src();
    const at = s.indexOf("case 'auth': {");
    expect(at).toBeGreaterThan(-1);
    const arm = s.slice(at, at + 1600);
    // Asked for -> the dashboard. applyAuth has just collapsed the stack to
    // the login screen, which is the right end for an expired session only.
    expect(arm).toContain('signOutReason.current');
    expect(arm).toContain("applyAuth('signedOut')");
    expect(arm).toContain('setAccountScreens(closeAccount())');
  });

  it('keeps a failed sign-out on the account screen, and says so there', () => {
    // The one case where the customer must not be moved: they are still signed
    // in, and the screen they are on is the one that can tell them.
    const s = src();
    const at = s.indexOf("case 'auth': {");
    const arm = s.slice(at, at + 1600);
    const failed = arm.slice(arm.indexOf("data.from === 'logout'"));
    expect(failed).toContain('setAccountNotice(');
    expect(failed).not.toContain('closeAccount(');
  });

  it('leaves an expired session on the login screen, as it always did', () => {
    expect(resolveAuth(['account', 'address'], 'signedOut')).toEqual(['login']);
  });
});

// --------------------------------------------------------------- the screens

describe('the account screen', () => {
  const screen = (
    props: Partial<React.ComponentProps<typeof AccountScreen>> = {},
  ) => (
    <AccountScreen
      customer={parseCustomer({name: 'Lux Bhati', email: 'lux@example.com'})}
      notice={null}
      onOpenRow={noop}
      onEditProfile={noop}
      onLogOut={noop}
      onDeleteAccount={noop}
      {...props}
    />
  );

  it('shows the rows the reference app shows', () => {
    const text = textOf(render(screen()));
    expect(text).toContain('Orders');
    expect(text).toContain('Manage your orders');
    expect(text).toContain('Address');
    expect(text).toContain('Manage your addresses');
    expect(text).toContain('Change Password');
    expect(text).toContain('Change your password');
    expect(text).toContain('Favorites');
    expect(text).toContain('Manage your favorite products');
    expect(text).toContain('Delete Account');
    expect(text).toContain('Log Out');
  });

  it('draws Change Password, because the reference app draws it', () => {
    // This test used to assert the opposite, and the reason it was inverted is
    // worth keeping next to it: classic Shopify has no change-password page for
    // a signed-in customer, only POST /account/recover, and an OTP-first
    // store's customers mostly have no password for that link to change. The
    // row is drawn anyway, because the reference app draws it -- and what sits
    // behind it is flagged UNCONFIRMED at CHANGE_PASSWORD_URL rather than
    // quietly presented as a working change-password screen.
    const text = textOf(render(screen()));
    expect(text).toContain('Change Password');
    expect(text).toContain('Change your password');
  });

  it('opens the change-password screen when the row is tapped', () => {
    let opened: string | null = null;
    const tree = render(screen({onOpenRow: row => (opened = row)}));
    press(tree, 'Change Password. Change your password');
    expect(opened).toBe('changePassword');
  });

  it('offers Edit Profile, as Zigly’s own app does', () => {
    expect(textOf(render(screen()))).toContain('Edit Profile');
  });

  it('opens the form when it is tapped', () => {
    let opened = false;
    const tree = render(screen({onEditProfile: () => (opened = true)}));
    const [button] = tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Edit profile' &&
        typeof node.props.onPress === 'function',
    );
    ReactTestRenderer.act(() => button.props.onPress());
    expect(opened).toBe(true);
  });

  it('shows no contact line the site did not give it', () => {
    const text = textOf(
      render(screen({customer: parseCustomer({name: 'Lux Bhati'})})),
    );
    expect(text).toContain('Hi, Lux Bhati');
    // No blank line, no placeholder, no invented address.
    expect(text).not.toContain('@');
  });

  it('falls back to a person glyph when there is no name at all', () => {
    const text = textOf(render(screen({customer: parseCustomer({})})));
    expect(text).toContain('Your account');
  });

  it('reports a sign-out that did not take', () => {
    const text = textOf(render(screen({notice: 'Sign out did not go through.'})));
    expect(text).toContain('Sign out did not go through.');
  });

  it('routes Favorites to the wishlist', () => {
    const rows: string[] = [];
    const tree = render(screen({onOpenRow: row => rows.push(row)}));
    press(tree, 'Favorites. Manage your favorite products');
    expect(rows).toEqual(['favorites']);
  });
});

describe('the orders screen', () => {
  it('waits rather than claiming the customer has never ordered', () => {
    const tree = render(<OrdersScreen orders={null} onOpenOrder={noop} />);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('shows the empty state once it knows there are none', () => {
    const text = textOf(render(<OrdersScreen orders={[]} onOpenOrder={noop} />));
    expect(text).toContain('No Items');
  });

  it('lists an order with the site’s own figures', () => {
    const orders = parseOrders(
      {
        items: [
          {
            name: '#1042',
            url: '/account/orders/6543?key=abc',
            date: '21 August 2026',
            paymentStatus: 'Paid',
            fulfillmentStatus: 'Fulfilled',
            total: '₹1,235.60',
          },
        ],
      },
      ORIGIN,
    );
    const opened: string[] = [];
    const tree = render(
      <OrdersScreen orders={orders} onOpenOrder={o => opened.push(o.url)} />,
    );
    const text = textOf(tree);
    expect(text).toContain('#1042');
    expect(text).toContain('₹1,235.60');
    expect(text).toContain('Fulfilled');
    press(tree, 'Order #1042');
    expect(opened).toEqual([ORIGIN + '/account/orders/6543?key=abc']);
  });
});

describe('the address screen', () => {
  const address: Address = parseAddresses({
    items: [{id: '7788', fields: fields(), isDefault: true}],
  })[0];

  it('waits before saying there is nothing saved', () => {
    const tree = render(
      <AddressScreen
        addresses={null}
        notice={null}
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('shows the reference app’s empty state', () => {
    const text = textOf(
      render(
        <AddressScreen
          addresses={[]}
          notice={null}
          onAdd={noop}
          onEdit={noop}
          onDelete={noop}
        />,
      ),
    );
    expect(text).toContain('No saved addresses');
    expect(text).toContain('Add New Address');
  });

  it('shows a saved address and offers the form', () => {
    let added = 0;
    const tree = render(
      <AddressScreen
        addresses={[address]}
        notice={null}
        onAdd={() => {
          added += 1;
        }}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    const text = textOf(tree);
    expect(text).toContain('Lux Bhati');
    expect(text).toContain('12 Green Park');
    expect(text).toContain('New Delhi, Delhi - 110016');
    expect(text).toContain('Default');
    press(tree, 'Add new address');
    expect(added).toBe(1);
  });

  it('says so when a removal could not be confirmed', () => {
    const text = textOf(
      render(
        <AddressScreen
          addresses={[address]}
          notice={'That address could not be removed.'}
          onAdd={noop}
          onEdit={noop}
          onDelete={noop}
        />,
      ),
    );
    expect(text).toContain('could not be removed');
  });
});

describe('the address form', () => {
  const countries = parseCountries({
    items: [
      {
        name: 'India',
        code: 'IN',
        provinceLabel: 'State',
        provinces: ['Delhi', 'Goa'],
        zipLabel: 'PIN code',
      },
      {
        name: 'Singapore',
        code: 'SG',
        provinceLabel: '',
        provinces: [],
        zipLabel: 'Postal code',
      },
    ],
  });

  const form = (
    props: Partial<React.ComponentProps<typeof AddressFormScreen>> = {},
  ) => (
    <AddressFormScreen
      initial={{
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
      }}
      countries={countries}
      saving={false}
      error={null}
      onSave={noop}
      {...props}
    />
  );

  it('asks for every field the reference app asks for', () => {
    const tree = render(form());
    const labels = tree.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => String(node.props.accessibilityLabel));
    for (const label of [
      'First Name',
      'Last Name',
      'Phone Number',
      'Company',
      'Address',
      'Apartment, suite, etc. (optional)',
      'City',
      'Save address',
    ]) {
      expect(labels).toContain(label);
    }
    // Country arrived with a value, so its label carries it.
    expect(labels.some(label => label.indexOf('Country') === 0)).toBe(true);
  });

  it('opens on the shop’s home country once the list arrives', () => {
    expect(textOf(render(form()))).toContain('India');
  });

  it('uses the country’s own words for its subdivision and postcode', () => {
    // Both are field labels rather than rendered copy: India calls them State
    // and PIN code, and Shopify's own dataset is what says so.
    const tree = render(form());
    const labels = tree.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => String(node.props.accessibilityLabel));
    expect(labels).toContain('PIN code');
    expect(textOf(tree)).toContain('State');
  });

  it('opens on the values of the address being edited', () => {
    const text = textOf(render(form({initial: fields()})));
    expect(text).toContain('Delhi');
  });

  it('refuses to post an address Shopify would reject', () => {
    const saved: unknown[] = [];
    const tree = render(form({onSave: value => saved.push(value)}));
    press(tree, 'Save address');
    expect(saved).toHaveLength(0);
    expect(textOf(tree)).toContain('Address, City and Country are needed');
  });

  it('posts the fields once they are there', () => {
    const saved: AddressFields[] = [];
    const tree = render(
      form({initial: fields(), onSave: value => saved.push(value)}),
    );
    press(tree, 'Save address');
    expect(saved).toEqual([fields()]);
  });

  it('says what happened when Shopify would not take it', () => {
    const text = textOf(render(form({error: 'Zigly did not accept that.'})));
    expect(text).toContain('Zigly did not accept that.');
  });
});

describe('the bottom navigation', () => {
  it('carries the five tabs the reference app carries', () => {
    const text = textOf(render(<BottomNav active="home" onSelect={noop} />));
    for (const tab of TABS) {
      expect(text).toContain(tab.label);
    }
    expect(text).toContain('Account');
  });

  it('reports the tab that was tapped', () => {
    const picked: string[] = [];
    const tree = render(
      <BottomNav active="home" onSelect={key => picked.push(key)} />,
    );
    press(tree, 'Account');
    press(tree, 'Wishlist');
    expect(picked).toEqual(['account', 'wishlist']);
  });

  it('marks exactly one tab selected', () => {
    const tree = render(<BottomNav active="account" onSelect={noop} />);
    const selected = [
      ...new Set(
        tree.root
          .findAll(node => node.props?.accessibilityState?.selected === true)
          .map(node => String(node.props.accessibilityLabel)),
      ),
    ];
    expect(selected).toEqual(['Account']);
  });
});

// -------------------------------------------------------- the injected scripts

describe('the injected account scripts', () => {
  const scripts: [string, string][] = [
    ['ACCOUNT_PROBE', ACCOUNT_PROBE],
    ['ADDRESSES_PROBE', ADDRESSES_PROBE],
    ['COUNTRIES_PROBE', COUNTRIES_PROBE],
    ['LOGOUT_SCRIPT', LOGOUT_SCRIPT],
    ['LOGIN_RESTYLE', LOGIN_RESTYLE],
    ['saveAddressScript', saveAddressScript(fields(), null)],
    ['saveAddressScript (update)', saveAddressScript(fields(), '7788')],
    ['deleteAddressScript', deleteAddressScript('7788')],
  ];

  it.each(scripts)('%s parses as JavaScript', (_name, script) => {
    // `new Function` parses without executing, which is exactly the check
    // wanted: a payload mangled by a lost escape is invalid JavaScript, and the
    // WebView runs invalid JavaScript by silently doing nothing at all.
    expect(parses(script)).toBe(true);
  });

  it.each(scripts)('%s uses no regular expression at all', (_name, script) => {
    // The rule for this file: character checks, not patterns. A pattern in a
    // template literal is one eaten backslash away from matching nothing.
    expect(script).not.toContain('replace(//');
    expect(script).not.toContain('/s+/');
    expect(script).not.toContain('[s]+');
  });

  it('posts the field names Shopify’s own form uses', () => {
    const script = saveAddressScript(fields(), null);
    expect(script).toContain("body.append('form_type', 'customer_address')");
    expect(script).toContain("'address[' + keys[i] + ']'");
    expect(script).toContain('"address1":"12 Green Park"');
    // Create posts to the collection, update to the address: one script, and
    // the id it was built with is what decides which.
    expect(script).toContain('var ID = null');
    expect(saveAddressScript(fields(), '7788')).toContain('var ID = "7788"');
    expect(script).toContain("if (ID) { body.append('_method', 'put'); }");
  });

  it('deletes through the same form, never through an api', () => {
    const script = deleteAddressScript('7788');
    expect(script).toContain("body.append('_method', 'delete')");
    expect(script).toContain('/account/addresses/');
    expect(script).not.toContain('X-Shopify');
  });

  it('reads the account with the session and nothing else', () => {
    expect(ACCOUNT_PROBE).toContain("credentials: 'same-origin'");
    expect(ACCOUNT_PROBE).toContain('sections=');
    // No token, no third-party host, no storage.
    expect(ACCOUNT_PROBE).not.toContain('lucentcommerce');
    expect(ACCOUNT_PROBE).not.toContain('localStorage');
  });

  it('signs out through the site’s own route', () => {
    expect(LOGOUT_SCRIPT).toContain("fetch('/account/logout'");
    // And then checks, rather than reporting success on a request going out.
    expect(LOGOUT_SCRIPT).toContain("fetch('/account'");
    expect(LOGOUT_SCRIPT).not.toContain('document.cookie');
  });

  it('restyles the login widget without driving it', () => {
    expect(LOGIN_RESTYLE).toContain(JSON.stringify(REQUEST_OTP_LABEL));
    // Not one synthesised click, and no call to the provider's api: the
    // customer presses the site's own button, with its own reCAPTCHA.
    expect(LOGIN_RESTYLE).not.toContain('.click()');
    expect(LOGIN_RESTYLE).not.toContain('lucentcommerce');
    // The consent notice is styled, never hidden.
    expect(LOGIN_RESTYLE).toContain('.sotp-consent-wrapper');
    expect(LOGIN_RESTYLE).not.toContain(
      'sotp-consent-wrapper,\n  display: none',
    );
  });
});
