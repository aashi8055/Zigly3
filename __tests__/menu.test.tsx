/**
 * The menu drawer.
 *
 * Two halves, pinned separately.
 *
 * The bridge reads Zigly's own `menu-drawer` and must keep reading it: the
 * shape it walks was verified against the live header section on 2026-08-22 --
 * `<li><details><summary>Dogs</summary><div class="menu-drawer__submenu">
 * <ul>…</ul></div></details></li>` for a branch, `<li><a href>` for a leaf,
 * with a `menu-drawer__utility-links` block of support contacts below. What
 * these tests refuse to allow is a category list written *here*: the whole
 * point of reading the page is that Zigly's menu is Zigly's to change.
 *
 * The drawer itself is a view over that reply, so the things worth pinning are
 * the three the web drawer got wrong: it covers two thirds of the screen, it
 * drills down instead of expanding, and the page beside it closes it.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import MenuDrawer from '../src/components/MenuDrawer';
import type {MenuDrawerHandle} from '../src/components/MenuDrawer';
import {
  MENU_MAX_DEPTH,
  MENU_MAX_ROWS,
  READ_MENU_SCRIPT,
} from '../src/webview/menuBridge';
import {
  absoluteUrl,
  isDrawableIcon,
  levelsFor,
  nodesFor,
  parseAccent,
  parseMenu,
} from '../src/menu/menuTree';
import type {MenuNode} from '../src/menu/menuTree';

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

const labels = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root.findAllByType(Text).map(node => flatten(node.props.children));

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
  ReactTestRenderer.act(() => {
    target.props.onPress();
  });
};

/**
 * The reply as the bridge posts it, shaped exactly like the live drawer:
 * a branch two levels deep, plain leaves beside it, the red Sale row, and the
 * support block that sits under the list.
 */
const RAW = {
  tag: 'menu',
  found: true,
  items: [
    {
      id: 'm1',
      label: 'Dogs',
      href: null,
      icon: null,
      color: null,
      children: [
        {
          id: 'm2',
          label: 'Food',
          href: null,
          icon: 'https://cdn.shopify.com/s/files/1/0923/Dog_Food.svg?v=1748264684',
          color: null,
          children: [
            {
              id: 'm3',
              label: 'Dry Food',
              href: '/collections/dog-dry-food',
              icon: null,
              color: null,
              children: [],
            },
          ],
        },
      ],
    },
    {
      id: 'm4',
      label: 'Vetcare',
      href: '/pages/vet-care-page',
      icon: null,
      color: null,
      children: [],
    },
    {
      id: 'm5',
      label: 'Sale',
      href: 'https://zigly.com/collections/sale?utm_source=online',
      icon: null,
      color: 'rgb(237, 36, 39)',
      children: [],
    },
    {
      id: 'support',
      label: 'Customer Support',
      href: null,
      icon: null,
      color: null,
      children: [
        {
          id: 'support0',
          label: '9999922020',
          href: 'tel:9999922020',
          icon: null,
          color: null,
          children: [],
        },
      ],
    },
  ],
};

describe('reading the menu out of the page', () => {
  it('is valid JavaScript', () => {
    // The injected scripts are built from template literals, and a lost escape
    // makes the WebView execute nothing at all, silently. `new Function`
    // parses without running, which is exactly the check.
    // eslint-disable-next-line no-new-func
    expect(() => new Function(READ_MENU_SCRIPT)).not.toThrow();
  });

  it('walks the site’s own drawer and writes no categories of its own', () => {
    // The selectors are Dawn's, and the tree under them is Zigly's.
    expect(READ_MENU_SCRIPT).toContain('menu-drawer__menu');
    expect(READ_MENU_SCRIPT).toContain('menu-drawer__submenu');
    expect(READ_MENU_SCRIPT).toContain('menu-drawer__utility-links');
    // Not one category, handle or label is authored here.
    expect(READ_MENU_SCRIPT).not.toContain('/collections/');
    expect(READ_MENU_SCRIPT).not.toContain('Pharmacy');
    expect(READ_MENU_SCRIPT).not.toContain('Vetcare');
  });

  it('re-reads on demand rather than answering once', () => {
    // drawerExtras appends Store Locator, Blogs and About Us a second or two
    // after load; a one-shot read would miss them for the whole session.
    expect(READ_MENU_SCRIPT).toContain('window.__ziglyReadMenu();');
    expect(MENU_MAX_DEPTH).toBeGreaterThanOrEqual(3);
    expect(MENU_MAX_ROWS).toBeGreaterThan(200);
  });

  it('has no regex mangled by a lost backslash', () => {
    expect(READ_MENU_SCRIPT).not.toContain('/s+/g');
    expect(READ_MENU_SCRIPT).not.toContain('replace(//');
  });
});

describe('parsing the reply', () => {
  it('keeps the site’s order and resolves its paths', () => {
    const items = parseMenu(RAW, ORIGIN);
    expect(items.map(node => node.label)).toEqual([
      'Dogs',
      'Vetcare',
      'Sale',
      'Customer Support',
    ]);
    expect(items[1].href).toBe(ORIGIN + '/pages/vet-care-page');
    // Already absolute, and its query string is part of the destination.
    expect(items[2].href).toBe(
      'https://zigly.com/collections/sale?utm_source=online',
    );
  });

  it('leaves a support link in the scheme the site gave it', () => {
    const support = parseMenu(RAW, ORIGIN)[3];
    expect(support.href).toBeNull();
    expect(support.children[0].href).toBe('tel:9999922020');
    expect(absoluteUrl('mailto:support@zigly.com', ORIGIN)).toBe(
      'mailto:support@zigly.com',
    );
  });

  it('drops a row that neither goes anywhere nor opens anything', () => {
    const items = parseMenu(
      {
        items: [
          {id: 'a', label: 'Nowhere', href: '#', children: []},
          {id: 'b', label: '', href: '/collections/x', children: []},
          {id: 'c', label: 'Real', href: '/collections/x', children: []},
        ],
      },
      ORIGIN,
    );
    expect(items.map(node => node.label)).toEqual(['Real']);
  });

  it('survives a reply that is not one', () => {
    expect(parseMenu(null, ORIGIN)).toEqual([]);
    expect(parseMenu({}, ORIGIN)).toEqual([]);
    expect(parseMenu({items: 'no'}, ORIGIN)).toEqual([]);
  });

  it('keeps only a colour the site meant as a highlight', () => {
    // The bridge compares the label's colour with the row's own and reports it
    // only when they differ, so an ordinary row arrives with no colour at all
    // rather than with the theme's ink to be repainted in.
    expect(READ_MENU_SCRIPT).toContain('mine !== own');
    expect(parseAccent('rgb(237, 36, 39)')).toBe('#ed2427');
    expect(parseAccent('rgba(237, 36, 39, 0)')).toBeNull();
    expect(parseAccent('inherit')).toBeNull();
    expect(parseAccent(null)).toBeNull();
    expect(parseMenu(RAW, ORIGIN)[2].accent).toBe('#ed2427');
    expect(parseMenu(RAW, ORIGIN)[1].accent).toBeNull();
  });

  it('will not ask Image to draw an svg', () => {
    // Zigly serves the category icons as .svg, which Android's decoder returns
    // blank for. The url is still carried, so a png would just work.
    const food = parseMenu(RAW, ORIGIN)[0].children[0];
    expect(food.icon).toContain('Dog_Food.svg');
    expect(isDrawableIcon(food.icon)).toBe(false);
    expect(isDrawableIcon('https://cdn.shopify.com/a.png?v=1')).toBe(true);
    expect(isDrawableIcon(null)).toBe(false);
  });
});

describe('following a path into the tree', () => {
  const items = parseMenu(RAW, ORIGIN);

  it('returns one level per step', () => {
    expect(levelsFor(items, []).length).toBe(1);
    expect(levelsFor(items, ['m1']).length).toBe(2);
    expect(levelsFor(items, ['m1', 'm2'])[2].map(n => n.label)).toEqual([
      'Dry Food',
    ]);
    expect(nodesFor(items, ['m1', 'm2']).map(n => n.label)).toEqual([
      'Dogs',
      'Food',
    ]);
  });

  it('stops where the tree stops', () => {
    // A re-read can retire the branch the drawer was standing in; it must
    // follow the tree back down rather than render a blank level.
    expect(levelsFor(items, ['gone']).length).toBe(1);
    expect(levelsFor(items, ['m1', 'gone']).length).toBe(2);
    // A leaf is not a level.
    expect(levelsFor(items, ['m5']).length).toBe(1);
  });
});

describe('the drawer', () => {
  const items = parseMenu(RAW, ORIGIN);
  const props = {
    items,
    auth: 'signedOut' as const,
    customer: null,
    onClose: jest.fn(),
    onNavigate: jest.fn(),
    onAccountPress: jest.fn(),
  };

  beforeEach(() => {
    props.onClose.mockClear();
    props.onNavigate.mockClear();
    props.onAccountPress.mockClear();
  });

  it('draws nothing while it is closed', () => {
    const tree = render(<MenuDrawer open={false} {...props} />);
    expect(tree.toJSON()).toBeNull();
  });

  it('takes two thirds of the screen, leaving the store visible', () => {
    const tree = render(<MenuDrawer open {...props} />);
    // react-native's test window is 750 wide.
    const panel = tree.root
      .findAll(node => {
        const style = node.props?.style;
        return Array.isArray(style) && style.some(s => s?.width === 500);
      })
      .shift();
    expect(panel).toBeDefined();
  });

  it('shows the site’s top level and closes on the page beside it', () => {
    const tree = render(<MenuDrawer open {...props} />);
    expect(labels(tree)).toEqual(
      expect.arrayContaining(['Dogs', 'Vetcare', 'Sale', 'Customer Support']),
    );
    // Not the level below it: this is a drawer, not an accordion.
    expect(labels(tree)).not.toContain('Food');

    press(tree, 'Close menu');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('drills into a category and comes back out', () => {
    const ref = React.createRef<MenuDrawerHandle>();
    const tree = render(<MenuDrawer ref={ref} open {...props} />);

    press(tree, 'Dogs');
    // The level opened, with the parent's name above it to go back by.
    expect(labels(tree)).toContain('Food');
    expect(labels(tree)).toContain('Dogs');

    // Which is what the hardware Back button steps out through, one level at a
    // time, before it closes the drawer.
    let stepped = false;
    ReactTestRenderer.act(() => {
      stepped = ref.current?.stepBack() ?? false;
    });
    expect(stepped).toBe(true);
    ReactTestRenderer.act(() => {
      stepped = ref.current?.stepBack() ?? true;
    });
    expect(stepped).toBe(false);
  });

  it('opens a leaf rather than drilling into it', () => {
    const tree = render(<MenuDrawer open {...props} />);
    press(tree, 'Vetcare');
    expect(props.onNavigate).toHaveBeenCalledWith(
      ORIGIN + '/pages/vet-care-page',
    );
  });

  it('offers Login/Register when nobody is signed in', () => {
    const tree = render(<MenuDrawer open {...props} />);
    expect(labels(tree)).toContain('Login/Register');
    press(tree, 'Login or register');
    expect(props.onAccountPress).toHaveBeenCalled();
  });

  it('greets the customer the site says is signed in', () => {
    const customer = {
      name: 'Lux Bhati',
      email: 'lux@example.com',
      phone: '',
      initials: 'LB',
    };
    const tree = render(
      <MenuDrawer open {...props} auth="signedIn" customer={customer} />,
    );
    const shown = labels(tree);
    expect(shown).toContain('Hi, Lux Bhati');
    expect(shown).toContain('lux@example.com');
    expect(shown).not.toContain('Login/Register');
  });

  it('says nothing about a customer it has not read yet', () => {
    // 'unknown' is not 'signed out'; a dropped probe must not offer to log in
    // someone who already is.
    const tree = render(
      <MenuDrawer open {...props} auth="signedIn" customer={null} />,
    );
    expect(labels(tree)).toContain('My Account');
  });

  it('waits rather than inventing a menu it has not been given', () => {
    const tree = render(<MenuDrawer open {...props} items={[]} />);
    const shown = labels(tree);
    expect(shown).not.toContain('Dogs');
    expect(shown.filter(text => text.length > 0)).toEqual(['Login/Register']);
  });
});

/** A node built by hand, for the shapes the live reply does not cover. */
const node = (over: Partial<MenuNode>): MenuNode => ({
  id: 'x',
  label: 'X',
  href: null,
  icon: null,
  accent: null,
  children: [],
  ...over,
});

describe('urls the drawer must not mangle', () => {
  it('resolves a bare handle against the origin', () => {
    expect(absoluteUrl('collections/sale', ORIGIN)).toBe(
      ORIGIN + '/collections/sale',
    );
  });

  it('gives a protocol-relative url a scheme Android will load', () => {
    expect(absoluteUrl('//cdn.shopify.com/a.png', ORIGIN)).toBe(
      'https://cdn.shopify.com/a.png',
    );
  });

  it('refuses a theme control', () => {
    expect(absoluteUrl('#', ORIGIN)).toBeNull();
    expect(absoluteUrl('', ORIGIN)).toBeNull();
    expect(node({href: null}).href).toBeNull();
  });
});

/**
 * The hamburger, which is the drawer's other half.
 *
 * The drawer is deliberately drawn *under* the header, so the button that
 * opened it never moves -- and a button that stays put has to undo itself when
 * it is pressed again, because that is the first thing anyone tries. The other
 * half of that is the search band: it belongs to the page, and the page is what
 * the drawer is covering.
 *
 * Asserted against the screen's source, as the page cover's deadline is: the
 * wiring is the claim, and the screen is 2,000 lines of WebView plumbing that
 * cannot be mounted in a unit test.
 */
describe('the hamburger', () => {
  const src = (): string =>
    require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

  it('closes the drawer when it is pressed again', () => {
    const s = src();
    const at = s.indexOf('const toggleMenu');
    expect(at).toBeGreaterThan(-1);
    const body = s.slice(at, at + 260);
    expect(body).toContain('menuOpenRef.current');
    expect(body).toContain('closeMenu()');
    // And it is the toggle the header is given, not the bare open.
    expect(s).toContain('onMenuPress={toggleMenu}');
    expect(s).not.toContain('onMenuPress={openMenu}');
  });

  it('leaves no search band standing above the drawer panel', () => {
    /*
     * This used to need arranging: the native band was drawn above the WebView,
     * outside anything the drawer covered, so it had to be folded away by hand
     * (`searchCollapsed={searchCollapsed || menuOpen}`) or it stood over the
     * panel as a pale blue strip belonging to a page nobody was looking at.
     *
     * The band is a section of the page now -- ../src/webview/searchBandSection
     * -- so it is inside the WebView the drawer draws over, and there is
     * nothing left to fold. What is checked instead is that the native band is
     * genuinely not drawn, because that is what makes the arranging
     * unnecessary.
     */
    expect(src()).toContain('showSearch={false}');
  });
});
