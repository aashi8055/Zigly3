/**
 * The wishlist.
 *
 * Verified on 2026-08-22: Swym is not on this store. No snippet, no app embed,
 * and none of the four extensions the pages load is theirs. The theme still
 * carries Swym's markup, but what implements the wishlist is Zigly's own
 * assets/wishlist.js -- the saved handles live in localStorage under
 * 'zigly_wishlist_handles', with a public reader (window.ziglyWishlist) and one
 * delegated click listener that does the toggling.
 *
 * So these tests pin three things: the bridge reads their list rather than
 * scraping a page, it presses their control rather than writing their storage,
 * and the screen never renders a product it only half knows.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {ActivityIndicator, ScrollView, Text} from 'react-native';
import WishlistScreen from '../src/components/WishlistScreen';
import {
  WISHLIST_LIMIT,
  WISHLIST_SCRIPT,
  removeFromWishlistScript,
} from '../src/webview/wishlistBridge';
import {httpsUrl, parseWishlist} from '../src/wishlist/wishlistItems';
import type {WishlistItem} from '../src/wishlist/wishlistItems';
import {addToCartScript} from '../src/webview/cartBridge';

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
  target.props.onPress();
};

/** One row as the bridge posts it, straight out of /products/{handle}.js. */
const RAW = {
  handle: 'zl-bobo-bear-squeaker-dog-toy',
  title: 'ZL Bobo Bear Squeaker Dog Toy',
  url: '/products/zl-bobo-bear-squeaker-dog-toy',
  image: '//cdn.shopify.com/s/files/1/0923/bobo.jpg?v=1',
  price: 35112,
  compareAt: 39900,
  available: true,
  variantCount: 1,
  variantId: 44123456789,
};

const item = (over: Partial<WishlistItem> = {}): WishlistItem => ({
  ...parseWishlist({items: [RAW]}, ORIGIN).items[0],
  ...over,
});

const noop = () => {};

/** The screen with everything defaulted; pass only what the case is about. */
const screen = (
  props: Partial<React.ComponentProps<typeof WishlistScreen>> = {},
): React.ReactElement => (
  <WishlistScreen
    items={[item()]}
    onOpenItem={noop}
    onAddToBag={noop}
    onRemove={noop}
    {...props}
  />
);

describe('reading the wishlist reply', () => {
  it('keeps the paise Shopify reported, without parsing a rendered price', () => {
    const {items} = parseWishlist({items: [RAW], root: 'swym'}, ORIGIN);
    expect(items).toHaveLength(1);
    // 35112 paise is the ₹351.12 the reference shows.
    expect(items[0].price).toBe(35112);
    expect(items[0].compareAt).toBe(39900);
  });

  it('reports which container the page was read from', () => {
    // So a device run confirms the root instead of leaving it assumed.
    expect(parseWishlist({items: [], root: 'swym'}, ORIGIN).root).toBe('swym');
    expect(parseWishlist({items: []}, ORIGIN).root).toBe('none');
  });

  it('makes protocol-relative Shopify images loadable', () => {
    // Android will not fetch a //cdn.shopify.com url.
    expect(httpsUrl('//cdn.shopify.com/x.jpg')).toBe(
      'https://cdn.shopify.com/x.jpg',
    );
    expect(parseWishlist({items: [RAW]}, ORIGIN).items[0].image).toContain(
      'https://cdn.shopify.com',
    );
  });

  it('absolute-ises the product path', () => {
    expect(parseWishlist({items: [RAW]}, ORIGIN).items[0].url).toBe(
      ORIGIN + RAW.url,
    );
  });

  it('drops a compare-at price that is not higher', () => {
    const {items} = parseWishlist(
      {items: [{...RAW, compareAt: 35112}]},
      ORIGIN,
    );
    expect(items[0].compareAt).toBeNull();
  });

  it('drops a row it only half knows', () => {
    // A partial product fetch must cost a tile, not render a blank price.
    const {items} = parseWishlist(
      {
        items: [
          {...RAW, title: ''},
          {...RAW, price: 0},
          {...RAW, handle: ''},
          RAW,
        ],
      },
      ORIGIN,
    );
    expect(items).toHaveLength(1);
  });

  it('offers no variant id when the product has several', () => {
    // Choosing a size for the customer is worse than one extra tap.
    const {items} = parseWishlist(
      {items: [{...RAW, variantCount: 4}]},
      ORIGIN,
    );
    expect(items[0].variantId).toBeNull();
  });

  it('survives junk rather than throwing', () => {
    expect(parseWishlist({}, ORIGIN).items).toEqual([]);
    expect(parseWishlist({items: 'nope'}, ORIGIN).items).toEqual([]);
    expect(parseWishlist({items: [null, 7, 'x']}, ORIGIN).items).toEqual([]);
  });
});

describe('the bridge that reads the page', () => {
  it('reads handles, and does not scrape prices or titles', () => {
    expect(WISHLIST_SCRIPT).toContain('/products/');
    // No money parsing anywhere: prices come from the documented endpoint.
    expect(WISHLIST_SCRIPT).not.toContain('₹');
    expect(WISHLIST_SCRIPT).not.toContain('textContent');
    expect(WISHLIST_SCRIPT).not.toContain('innerText');
  });

  it('prices every item from the documented per-product endpoint', () => {
    expect(WISHLIST_SCRIPT).toContain("'.js'");
    expect(WISHLIST_SCRIPT).toContain("credentials: 'same-origin'");
    expect(WISHLIST_SCRIPT).toContain('compare_at_price');
  });

  it("asks Zigly's own reader for the list, and their key as a fallback", () => {
    // window.ziglyWishlist.getWishlist() is the documented surface of their
    // assets/wishlist.js. The raw key is the same string, only available
    // earlier -- so the fallback cannot disagree with them.
    expect(WISHLIST_SCRIPT).toContain('window.ziglyWishlist.getWishlist');
    expect(WISHLIST_SCRIPT).toContain('zigly_wishlist_handles');
  });

  it('scrapes no page and polls for nothing', () => {
    // It used to mount an ~850 KB page off screen and poll the DOM for up to
    // twelve seconds waiting for Swym to render. There is nothing to wait for:
    // the list is in storage the dashboard already has.
    expect(WISHLIST_SCRIPT).not.toContain('setInterval');
    expect(WISHLIST_SCRIPT).not.toContain('main, #MainContent');
    expect(WISHLIST_SCRIPT).not.toContain('a[href*="/products/"]');
  });

  it('never writes the list while reading it', () => {
    expect(WISHLIST_SCRIPT).not.toContain('localStorage.setItem');
    expect(WISHLIST_SCRIPT).not.toContain('.click()');
  });

  it('answers even when the list is empty, so the screen can settle', () => {
    // Saying "empty" is what lets the screen show the empty state instead of a
    // spinner that never stops.
    expect(WISHLIST_SCRIPT).toContain('if (!capped.length)');
    expect(WISHLIST_SCRIPT).toContain("send({items: [], root: 'storage'");
  });

  it('bounds how many products it will fetch', () => {
    expect(WISHLIST_LIMIT).toBeGreaterThan(0);
    expect(WISHLIST_SCRIPT).toContain('saved.slice(0, LIMIT)');
  });

  it('parses as valid JavaScript', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(WISHLIST_SCRIPT)).not.toThrow();
    expect(WISHLIST_SCRIPT.trimEnd().endsWith('true;')).toBe(true);
  });
});

describe('removing from the wishlist', () => {
  const script = removeFromWishlistScript('zl-bobo-bear-squeaker-dog-toy');

  it("presses the site's own control instead of writing their storage", () => {
    // Their one delegated listener does the toggle, the button sync, the header
    // counters, the theme's wishlistUpdate event and -- for a signed-in
    // customer -- the post to Zigly's wishlist API. A direct write to the key
    // would do the first and skip the rest, leaving the customer's wishlist
    // right on this device and wrong everywhere else.
    expect(script).toContain('.click()');
    expect(script).not.toContain('localStorage.setItem');
    expect(script).not.toContain('api-key');
  });

  it('presses a control carrying exactly that handle', () => {
    // Matched on the attribute their selector keys off, so it can never be a
    // neighbour's button.
    expect(script).toContain('zl-bobo-bear-squeaker-dog-toy');
    expect(script).toContain('data-product-handle');
    expect(script).toContain('.swym-button.swym-add-to-wishlist');
  });

  it('supplies a control when the page is not showing one', () => {
    // The dashboard may hold no card for a saved product. Their handler reads
    // event.target.closest(...) from document, so the element has to be in the
    // document for the click to reach it -- appended, clicked, removed.
    expect(script).toContain('document.createElement');
    expect(script).toContain('document.body.appendChild');
    expect(script).toContain('removeChild');
  });

  it('does nothing when the product is already gone', () => {
    expect(script).toContain("send(true, 'already removed')");
  });

  it('verifies the removal rather than trusting the click', () => {
    // A removal that silently failed would leave the app showing a wishlist
    // that is not the customer's. So the list is re-read after the press and
    // the reply says what it found.
    expect(script).toContain("send(false, 'still saved after pressing the control')");
    expect(script).toContain("send(false, 'storage unreadable')");
    expect(script).toContain('tag: \'wishlist-removed\'');
  });

  it('patches nothing of the page’s', () => {
    // Reading their storage to verify is fine. Writing it, or standing in for
    // their network or their cookies, is not.
    expect(script).not.toContain('window.fetch =');
    expect(script).not.toContain('localStorage.setItem');
    expect(script).not.toContain('document.cookie');
    expect(script).not.toContain('window.confirm =');
  });

  it('parses as valid JavaScript', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(script)).not.toThrow();
    expect(script.trimEnd().endsWith('true;')).toBe(true);
  });
});

describe('adding to the bag from the wishlist', () => {
  it('posts to the same cart endpoint the theme uses', () => {
    const script = addToCartScript(44123456789);
    expect(script).toContain('/cart/add.js');
    expect(script).toContain('44123456789');
    expect(script).toContain("credentials: 'same-origin'");
  });

  it('re-reads the count rather than incrementing its own', () => {
    // The line may have merged with one already in the bag.
    const script = addToCartScript(1);
    expect(script).toContain('/cart.js');
    expect(script).toContain("tag: 'cart-count'");
  });

  it('parses as valid JavaScript', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(addToCartScript(1))).not.toThrow();
  });
});

describe('the wishlist screen', () => {
  it('waits rather than claiming nothing is saved', () => {
    // Swym renders client-side, so null is a real state and it is not "empty".
    const tree = render(screen({items: null}));
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(textOf(tree)).not.toContain('No items');
  });

  it('shows the box and "No items" when nothing is saved', () => {
    const tree = render(screen({items: []}));
    expect(textOf(tree)).toContain('No items');
  });

  it('draws a tile per saved product, priced as the reference prices it', () => {
    const tree = render(screen({items: [item(), item({handle: 'second', title: 'Trixie Carrot'})]}));
    const text = textOf(tree);
    expect(text).toContain('ZL Bobo Bear Squeaker Dog Toy');
    expect(text).toContain('Trixie Carrot');
    expect(text).toContain('₹351.12');
    expect(text).toContain('₹399');
    // Two items is the half-filled screen; the same grid scrolls when longer.
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  });

  it('scrolls rather than truncating a long wishlist', () => {
    const many = Array.from({length: 12}, (_, i) =>
      item({handle: 'h' + i, title: 'Toy ' + i}),
    );
    const tree = render(screen({items: many}));
    expect(textOf(tree)).toContain('Toy 11');
  });

  it('adds a single-variant product straight to the bag', () => {
    const added: string[] = [];
    const tree = render(screen({items: [item()], onAddToBag: product => added.push(product.handle)}));
    press(tree, 'Add to Bag: ' + RAW.title);
    expect(added).toEqual([RAW.handle]);
  });

  it('sends a multi-variant product to its page instead of guessing', () => {
    const added: string[] = [];
    const opened: string[] = [];
    const tree = render(screen({items: [item({variantId: null})], onOpenItem: product => opened.push(product.handle), onAddToBag: product => added.push(product.handle)}));
    press(tree, 'Choose options for ' + RAW.title);
    expect(added).toEqual([]);
    expect(opened).toEqual([RAW.handle]);
  });

  it('does not offer to add something out of stock', () => {
    const tree = render(screen({items: [item({available: false})]}));
    const text = textOf(tree);
    expect(text).toContain('Sold out');
    expect(text).not.toContain('Add to Bag');
  });

  it('un-saves from the heart, and opens the product from the tile', () => {
    const removed: string[] = [];
    const opened: string[] = [];
    const tree = render(
      screen({
        onRemove: product => removed.push(product.handle),
        onOpenItem: product => opened.push(product.handle),
      }),
    );
    press(tree, 'Remove from wishlist: ' + RAW.title);
    expect(removed).toEqual([RAW.handle]);
    // The heart no longer navigates; the image and title still do.
    expect(opened).toEqual([]);
    press(tree, RAW.title);
    expect(opened).toEqual([RAW.handle]);
  });

  it('says so when a removal could not be confirmed', () => {
    // The tile comes back rather than the app showing a wishlist that is not
    // the customer's -- so the screen has to explain why it reappeared.
    const tree = render(screen({notice: 'Could not remove that.'}));
    expect(textOf(tree)).toContain('Could not remove that.');
  });

  it('shows no notice when nothing has gone wrong', () => {
    expect(textOf(render(screen()))).not.toContain('Could not');
  });
});
