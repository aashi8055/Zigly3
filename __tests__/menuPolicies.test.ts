/**
 * Customer Policies in the drawer.
 *
 * The site keeps its policies in a footer `link_list` block headed "Customer
 * Policies" -- Terms Of Use, Privacy Policy, Refund Policy, Shipping Policy,
 * FAQ's -- and the drawer's own list has none of them. The app shows them as a
 * branch directly above Customer Support, which is where the reference app
 * puts them.
 *
 * Two things are worth pinning, and they are the two that would be easy to get
 * wrong:
 *
 *   **The destinations are read, not written.** The titles look like Shopify's
 *   stock `shop.policies` set and they are NOT: Zigly points each one at a page
 *   of its own (`/pages/privacy-and-cookie-policy`, not
 *   `/policies/privacy-policy`). A hardcoded list would be four broken links
 *   that looked right in review.
 *
 *   **The block is found by its heading.** Its class carries a theme-editor
 *   block id (`link_list_MBqNnH`) that changes whenever the block is re-added
 *   in the admin, so matching on it would break silently on a content edit.
 *   The heading is what a person set and what the customer reads.
 *
 * The script is executed here rather than grepped, against a hand-built DOM --
 * jsdom is not a dependency of this project, the same as ./productPage.test.ts
 * and ./facetBridge.test.ts. Only what the reader touches is implemented.
 */
import {READ_MENU_SCRIPT} from '../src/webview/menuBridge';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 * -------------------------------------------------------------------------- */

class El {
  tag: string;
  className = '';
  children: El[] = [];
  parentNode: El | null = null;
  attrs: {[k: string]: string} = {};
  /** This node's own text, excluding its children's. */
  text = '';

  constructor(tag: string) {
    this.tag = tag.toLowerCase();
  }

  appendChild(child: El): El {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'class') {
      return this.className || null;
    }
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  get textContent(): string {
    return this.text + this.children.map(c => c.textContent).join('');
  }

  /** The drawer walk reads `tagName` and `childNodes` directly. */
  get tagName(): string {
    return this.tag.toUpperCase();
  }

  get nodeType(): number {
    return 1;
  }

  /**
   * Element children plus this node's own text as a text node, which is what
   * `labelOf` walks to build a row's label.
   */
  get childNodes(): {nodeType: number; nodeValue?: string}[] {
    const nodes: {nodeType: number; nodeValue?: string}[] = [];
    if (this.text) {
      nodes.push({nodeType: 3, nodeValue: this.text});
    }
    return nodes.concat(this.children as unknown as {nodeType: number}[]);
  }

  /** Every node below this one, in document order. */
  descend(out: El[]): El[] {
    for (const child of this.children) {
      out.push(child);
      child.descend(out);
    }
    return out;
  }

  /** Enough of a matcher for the selectors the reader actually uses. */
  matches(sel: string): boolean {
    if (sel.charAt(0) === '.') {
      return (
        (' ' + this.className + ' ').indexOf(' ' + sel.slice(1) + ' ') !== -1
      );
    }
    if (sel === 'a[href]') {
      return this.tag === 'a' && typeof this.attrs.href === 'string';
    }
    if (sel.indexOf('.') > 0) {
      // `ul.menu-drawer__menu`
      const [tag, cls] = sel.split('.');
      return (
        this.tag === tag &&
        (' ' + this.className + ' ').indexOf(' ' + cls + ' ') !== -1
      );
    }
    return this.tag === sel;
  }

  querySelectorAll(selector: string): El[] {
    const parts = selector.trim().split(/\s+/);
    let scope: El[] = [this];
    let found: El[] = [];
    for (let i = 0; i < parts.length; i++) {
      found = [];
      for (const root of scope) {
        for (const node of root.descend([])) {
          if (node.matches(parts[i])) {
            found.push(node);
          }
        }
      }
      scope = found;
    }
    return found;
  }

  querySelector(selector: string): El | null {
    for (const sel of selector.split(',')) {
      const hit = this.querySelectorAll(sel.trim())[0];
      if (hit) {
        return hit;
      }
    }
    return null;
  }
}

const el = (tag: string, className = ''): El => {
  const node = new El(tag);
  node.className = className;
  return node;
};

const link = (href: string, label: string): El => {
  const a = new El('a');
  a.setAttribute('href', href);
  a.text = label;
  return a;
};

/**
 * The footer block as the live homepage serves it, verified 2026-09-13.
 *
 * The whitespace around each label is the theme's own: the reader has to
 * squash it, and a fixture with tidy labels would not prove that it does.
 */
const policiesBlock = (heading = 'Customer Policies'): El => {
  const block = el('div', 'footer-block grid__item footer-block--menu');

  const h2 = el('h2', 'footer-block__heading inline-richtext');
  const strong = new El('strong');
  strong.text = heading;
  h2.appendChild(strong);
  // The theme puts a plus/minus svg wrapper inside the heading too.
  h2.appendChild(el('div', 'svg-wrapper large-up-hide medium-hide'));
  block.appendChild(h2);

  const ul = el('ul', 'footer-block__details-content list-unstyled');
  const rows: [string, string][] = [
    ['/pages/terms-of-use', '\n    Terms Of Use\n  '],
    ['/pages/privacy-and-cookie-policy', '\n    Privacy Policy\n  '],
    [
      '/pages/cancellation-and-return-replacement-policy',
      '\n    Refund Policy\n  ',
    ],
    ['/pages/shipping-and-delivery-policy', '\n    Shipping Policy\n  '],
    ['/pages/frequently-asked-questions', "\n    FAQ's\n  "],
  ];
  for (const row of rows) {
    const li = new El('li');
    li.appendChild(link(row[0], row[1]));
    ul.appendChild(li);
  }
  block.appendChild(ul);
  return block;
};

/** The support block the drawer already reads, so ordering can be asserted. */
const supportBlock = (): El => {
  const box = el('div', 'menu-drawer__utility-links');
  const h2 = new El('h2');
  h2.text = 'Customer Support:';
  box.appendChild(h2);
  box.appendChild(link('tel:9999922020', '9999922020'));
  box.appendChild(link('mailto:support@zigly.com', 'support@zigly.com'));
  return box;
};

interface PostedNode {
  id: string;
  label: string;
  href: string | null;
  children: PostedNode[];
}

interface Posted {
  tag: string;
  found: boolean;
  items: PostedNode[];
}

/**
 * Run the real injected script over a document built from the given blocks.
 *
 * `new Function` is the same parse the WebView does, so a template literal that
 * lost an escape fails here rather than silently executing nothing on a device.
 */
const run = (blocks: El[]): Posted => {
  const doc = el('body');

  // The drawer's own list, with one ordinary leaf so the walk has real work.
  const nav = el('div', 'menu-drawer__navigation');
  const ul = el('ul', 'menu-drawer__menu list-menu');
  const li = new El('li');
  li.appendChild(link('/collections/dogs', 'Dogs'));
  ul.appendChild(li);
  nav.appendChild(ul);
  doc.appendChild(nav);

  for (const block of blocks) {
    doc.appendChild(block);
  }

  let posted: Posted | null = null;
  const win = {
    ReactNativeWebView: {
      postMessage: (json: string) => {
        posted = JSON.parse(json) as Posted;
      },
    },
    // The reader asks for a computed colour; nothing here is highlighted.
    getComputedStyle: () => ({color: 'rgb(0, 0, 0)'}),
    console,
  };

  // eslint-disable-next-line no-new-func
  new Function('window', 'document', READ_MENU_SCRIPT)(win, doc);
  if (!posted) {
    throw new Error('the reader posted nothing');
  }
  return posted;
};

const byId = (items: PostedNode[], id: string): PostedNode | undefined =>
  items.filter(node => node.id === id)[0];

describe('Customer Policies in the drawer', () => {
  it('reads the four policies and the FAQ out of the footer block', () => {
    const policies = byId(run([policiesBlock()]).items, 'policies');
    expect(policies).toBeDefined();
    // A branch: it opens the level below it rather than going anywhere itself.
    expect(policies?.href).toBeNull();
    expect(policies?.children.map(child => child.label)).toEqual([
      'Terms Of Use',
      'Privacy Policy',
      'Refund Policy',
      'Shipping Policy',
      "FAQ's",
    ]);
  });

  it('uses the store’s own pages, not Shopify’s stock policy urls', () => {
    // The assertion that catches a hardcoded list: every one of these is a
    // /pages/ route the store authored, not /policies/privacy-policy.
    const policies = byId(run([policiesBlock()]).items, 'policies');
    expect(policies?.children.map(child => child.href)).toEqual([
      '/pages/terms-of-use',
      '/pages/privacy-and-cookie-policy',
      '/pages/cancellation-and-return-replacement-policy',
      '/pages/shipping-and-delivery-policy',
      '/pages/frequently-asked-questions',
    ]);
    // And no destination is written into the script's code. Stripping the
    // comments first is the point: the block above explains the difference
    // between /pages/... and /policies/..., and naming a url in prose is not
    // the same as shipping one as a fallback.
    const code = READ_MENU_SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain('/policies/');
    expect(code).not.toContain('/pages/');
  });

  it('sits directly above Customer Support', () => {
    const labels = run([policiesBlock(), supportBlock()]).items.map(
      node => node.label,
    );
    expect(labels).toEqual(['Dogs', 'Customer Policies', 'Customer Support']);
  });

  it('shows no row at all when the site has no such block', () => {
    // Nothing invented: a renamed or removed block drops the row rather than
    // falling back to a list written here.
    const items = run([policiesBlock('Useful links'), supportBlock()]).items;
    expect(byId(items, 'policies')).toBeUndefined();
    expect(items.map(node => node.label)).toEqual(['Dogs', 'Customer Support']);
  });
});
