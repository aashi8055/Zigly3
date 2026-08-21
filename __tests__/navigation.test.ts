/**
 * Two-WebView navigation.
 *
 * The dashboard is expensive to assemble and Zigly's pages carry no
 * cache-control, so navigating back to '/' rebuilt it from scratch. It is now
 * kept mounted while inner pages load in a second view.
 */
import {classifyUrl} from '../src/utils/urlUtils';

describe('dashboard is never navigated away from', () => {
  it('still treats inner pages as loadable, just elsewhere', () => {
    // The routing only diverts URLs the policy already allows; anything the
    // policy rejects must keep being rejected.
    expect(classifyUrl('https://zigly.com/collections/sale').kind).toBe('allow');
    expect(classifyUrl('https://zigly.com/products/x').kind).toBe('allow');
  });

  it('does not divert external or app-intent destinations', () => {
    // These must still leave the app rather than open in the page view.
    expect(classifyUrl('https://www.instagram.com/ziglyforpets/').kind).toBe(
      'external',
    );
    expect(classifyUrl('upi://pay?pa=x').kind).toBe('appIntent');
  });

  it('keeps checkout inside the WebView', () => {
    // Checkout must never be diverted anywhere that loses the session.
    expect(classifyUrl('https://shop.app/checkout').kind).toBe('allow');
    expect(classifyUrl('https://zigly.com/checkouts/c/abc').kind).toBe('allow');
  });
});

describe('header state follows which view is showing', () => {
  it('routes search and wishlist to the page view, not the dashboard', () => {
    // Injecting a navigation into the dashboard left it on a non-home URL with
    // the hamburger still showing and no way back.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain('showPage(`${ZIGLY_ORIGIN}/search?q=');
    expect(src).toContain('showPage(`${ZIGLY_ORIGIN}/pages/swym-wishlist`)');
    expect(src).not.toContain('injectJavaScript(searchScript');
  });

  it('gives each WebView its own navigation handler', () => {
    // Sharing one handler made the page view divert its own taps through a
    // source change, which destroyed its back history.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain('handleHomeShouldStart');
    expect(src).toContain('onShouldStartLoadWithRequest={handleHomeShouldStart}');
    expect(src).toContain('onShouldStartLoadWithRequest={handleShouldStart}');
  });

  it('shows the back arrow whenever the page view is open', () => {
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain('showBack={headerUrl !== null || showCart}');
  });

  it('draws the header outside everything that can cover it', () => {
    // The page layers are positioned absolutely against their container. While
    // that container was the whole screen, opening any inner page covered the
    // header with it -- so every page but the dashboard had no back arrow and
    // no cart. The layers now live in `body`, which starts below the header.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    const header = src.indexOf('<NativeHeader');
    const body = src.indexOf('<View style={styles.body}>');
    expect(header).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(header);
    // Every overlay is inside that container, the offline screen included.
    expect(src.indexOf('styles.pageLayer')).toBeGreaterThan(body);
    expect(src.indexOf('<NetworkErrorScreen')).toBeGreaterThan(body);
  });

  it('has no floating spinner left to cover the page', () => {
    // A spinner sat in the top-right corner of every page, over whatever the
    // page itself puts there, and offered nothing to press. Progress is a
    // hairline under the header now; getting back is the header's job.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).not.toContain('LoadingOverlay');
    expect(src).toContain('<LoadingBar />');
    expect(require('fs').existsSync('src/components/LoadingOverlay.tsx')).toBe(
      false,
    );
  });

  it('carries the header icons the reference carries, per page type', () => {
    // Reference app: collection, product and search pages show the wishlist
    // and the search band; breed and content pages show only the back arrow,
    // the logo and the cart.
    const {isShopUrl} = require('../src/screens/ZiglyWebViewScreen');
    expect(isShopUrl('https://zigly.com/collections/wet-food')).toBe(true);
    expect(isShopUrl('https://zigly.com/products/sheba-tuna?variant=1')).toBe(
      true,
    );
    expect(isShopUrl('https://zigly.com/search?q=food')).toBe(true);
    expect(isShopUrl('https://zigly.com/pages/breed-golden-retriever')).toBe(
      false,
    );
    expect(isShopUrl('https://zigly.com/pages/dog')).toBe(false);
  });
});

describe('pages are kept alive rather than reloaded', () => {
  it('drives inner pages through the keep-alive stack', () => {
    // Zigly's pages carry no cache-control, so a re-mount is a full page load.
    // See src/navigation/pageStack.ts and __tests__/pageStack.test.ts.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain("from '../navigation/pageStack'");
    // A layer's source is assigned once. Reassigning it is what reloads a
    // WebView, which would defeat the entire arrangement.
    expect(src).toContain('source={{uri: layer.source}}');
  });

  it('leaves the dashboard where the user left it', () => {
    // Returning from an inner page used to scroll the dashboard back to the
    // top, which reads as a reload even though the page never left memory. The
    // jump to the top now happens only for a logo tap made while already home,
    // which is a request rather than a side effect.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    const scroll = src.indexOf('window.scrollTo');
    expect(scroll).toBeGreaterThan(-1);
    const guard = src.indexOf('if (onDashboard(stackRef.current))');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(scroll);
  });

  it('injects into the WebView it is aimed at', () => {
    // Every injection went to the dashboard before, including the re-style
    // passes fired after an inner page loaded -- so inner pages were styled
    // once and any late third-party script that restyled them won.
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain('applyStyles(layer.key,');
    expect(src).toContain("applyStyles('home',");
  });
});

describe('native cart', () => {
  it('reads and writes the real Shopify cart, inside the WebView', () => {
    const {READ_CART_SCRIPT, changeQtyScript} = require('../src/webview/cartBridge');
    // Shopify's documented cart endpoints, so there is one cart and one truth.
    expect(READ_CART_SCRIPT).toContain('/cart.js');
    expect(changeQtyScript('abc', 2)).toContain('/cart/change.js');
    // Every request must carry the page's session.
    expect(READ_CART_SCRIPT).toContain("credentials: 'same-origin'");
  });

  it('re-reads after a change instead of doing its own arithmetic', () => {
    const {changeQtyScript} = require('../src/webview/cartBridge');
    // Discounts and totals are Shopify's to calculate.
    expect(changeQtyScript('abc', 2)).toContain('/cart.js');
  });

  it('removes a line by setting quantity zero', () => {
    const {changeQtyScript} = require('../src/webview/cartBridge');
    // Shopify treats quantity 0 as removal, so there is no separate path.
    expect(changeQtyScript('abc', 0)).toContain('quantity: 0');
  });

  it('leaves checkout entirely on the website', () => {
    const src = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(src).toContain('/checkout`');
  });
});
