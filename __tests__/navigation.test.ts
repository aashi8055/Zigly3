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
    expect(src).toContain('setPageUrl(`${ZIGLY_ORIGIN}/search?q=');
    expect(src).toContain('setPageUrl(`${ZIGLY_ORIGIN}/pages/swym-wishlist`)');
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
    expect(src).toContain('showBack={pageUrl !== null || showCart}');
  });

  it('carries the header icons the reference carries, per page type', () => {
    // Reference app: collection, product and search pages show the wishlist,
    // the cart and the search band; breed and content pages show only the back
    // arrow and the logo.
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
