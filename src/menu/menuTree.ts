/**
 * Reading the menu reply.
 *
 * ../webview/menuBridge.ts does the DOM work inside the page; this module is
 * the boundary that turns its message into something a native drawer may
 * render. Pure, so it is tested directly rather than through a WebView -- the
 * same split as the wishlist and the account.
 *
 * Everything here is defensive in one direction only: a row that is missing a
 * label, or a branch with nothing under it, is dropped. Nothing is invented.
 * If Zigly's drawer is empty one day, this returns an empty menu and the
 * drawer says so, rather than falling back to a hardcoded list of categories
 * that would quietly go stale.
 */

export interface MenuNode {
  /** Stable within one read; used as a React key and to track the open path. */
  id: string;
  label: string;
  /**
   * Absolute url, or null for a branch. A branch is a row that only opens the
   * level below it -- Dogs, Cats, Brands -- and the site gives those no href.
   */
  href: string | null;
  /**
   * The icon Zigly puts in the menu title, absolute, or null.
   *
   * Zigly currently serves these as `.svg`, which React Native's `Image`
   * cannot decode, so `isDrawableIcon` filters them out at the point of use.
   * The url is still carried through: the day any of them is a png the row
   * shows it, and until then the field documents where the icon would come
   * from rather than pretending there is none.
   */
  icon: string | null;
  /** The colour the site paints this row, `#rrggbb`, or null for ordinary ink. */
  accent: string | null;
  children: MenuNode[];
}

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/** Shopify serves protocol-relative urls in places; Android will not load those. */
const httpsUrl = (raw: string): string =>
  raw.indexOf('//') === 0 ? 'https:' + raw : raw;

/**
 * Non-http links the drawer must keep verbatim.
 *
 * The support block is `tel:`, `mailto:` and a WhatsApp link. Resolving those
 * against the origin would turn them into broken storefront paths.
 */
const OPAQUE_SCHEMES = ['tel:', 'mailto:', 'sms:', 'whatsapp:'];

const isOpaque = (raw: string): boolean =>
  OPAQUE_SCHEMES.some(scheme => raw.toLowerCase().indexOf(scheme) === 0);

/** Absolute url for a storefront href, or null when there is nothing usable. */
export const absoluteUrl = (raw: string, origin: string): string | null => {
  const href = raw.trim();
  // A `javascript:` href is a theme control, not a destination -- the lint rule
  // below is about *writing* one, and this is the guard that refuses to.
  // eslint-disable-next-line no-script-url
  const SCRIPT_SCHEME = 'javascript:';
  if (!href || href === '#' || href.toLowerCase().indexOf(SCRIPT_SCHEME) === 0) {
    return null;
  }
  if (isOpaque(href)) {
    return href;
  }
  const url = httpsUrl(href);
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
    return url;
  }
  return url.charAt(0) === '/' ? origin + url : origin + '/' + url;
};

const hex2 = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return (clamped < 16 ? '0' : '') + clamped.toString(16);
};

/**
 * The site's own row colour, as `#rrggbb`.
 *
 * The bridge only sends one for a row the theme paints differently from its
 * neighbours -- today the red on Sale -- so anything that arrives here is a
 * highlight the site chose. All this does is put it in a form React Native
 * takes; a colour that is fully transparent is the one thing thrown away,
 * since that is not a colour anyone meant to show.
 */
export const parseAccent = (raw: unknown): string | null => {
  const text = asString(raw);
  const open = text.indexOf('(');
  const close = text.indexOf(')');
  if (open === -1 || close <= open) {
    return null;
  }
  const parts = text
    .slice(open + 1, close)
    .split(',')
    .map(part => Number(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some(n => !Number.isFinite(n))) {
    return null;
  }
  const [r, g, b] = parts;
  if (parts.length > 3 && parts[3] === 0) {
    return null;
  }
  return '#' + hex2(r) + hex2(g) + hex2(b);
};

/**
 * Whether this app can actually draw the icon.
 *
 * `Image` on Android decodes png, jpg, gif and webp. An `.svg` returns a blank
 * box, which reads as a broken row; better to show the label alone.
 */
export const isDrawableIcon = (url: string | null): boolean => {
  if (!url) {
    return false;
  }
  const path = url.split('?')[0].toLowerCase();
  return !path.endsWith('.svg');
};

const parseNode = (
  raw: unknown,
  origin: string,
  depth: number,
): MenuNode | null => {
  if (typeof raw !== 'object' || raw === null || depth > 5) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const label = asString(row.label).trim();
  if (!label) {
    return null;
  }

  const children = Array.isArray(row.children)
    ? row.children
        .map(child => parseNode(child, origin, depth + 1))
        .filter((child): child is MenuNode => child !== null)
    : [];

  const href = absoluteUrl(asString(row.href), origin);
  // A row that neither goes anywhere nor opens anything is not a row.
  if (!href && children.length === 0) {
    return null;
  }

  const icon = asString(row.icon);
  return {
    id: asString(row.id) || label,
    label,
    href,
    icon: icon ? absoluteUrl(icon, origin) : null,
    accent: parseAccent(row.color),
    children,
  };
};

/** The drawer's rows, in the order the site lists them. */
export const parseMenu = (raw: unknown, origin: string): MenuNode[] => {
  if (typeof raw !== 'object' || raw === null) {
    return [];
  }
  const items = (raw as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map(item => parseNode(item, origin, 0))
    .filter((item): item is MenuNode => item !== null);
};

/**
 * Follow a path of ids into the tree.
 *
 * The open drawer holds ids rather than nodes so that a fresh read of the page
 * -- the hamburger re-reads on every tap -- replaces the tree underneath
 * without collapsing the level the customer is looking at.
 */
export const levelsFor = (items: MenuNode[], path: string[]): MenuNode[][] => {
  const levels: MenuNode[][] = [items];
  let current = items;
  for (const id of path) {
    const next = current.find(node => node.id === id);
    if (!next || next.children.length === 0) {
      break;
    }
    levels.push(next.children);
    current = next.children;
  }
  return levels;
};

/** The nodes named by a path, for the titles above each level. */
export const nodesFor = (items: MenuNode[], path: string[]): MenuNode[] => {
  const trail: MenuNode[] = [];
  let current = items;
  for (const id of path) {
    const next = current.find(node => node.id === id);
    if (!next || next.children.length === 0) {
      break;
    }
    trail.push(next);
    current = next.children;
  }
  return trail;
};
