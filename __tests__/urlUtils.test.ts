/**
 * URL policy tests.
 *
 * This is the one module where a silent mistake costs real money: misclassify
 * a payment redirect and checkout dead-ends. Every rule gets a case.
 */
import {classifyUrl, isCheckoutUrl, parseUrl} from '../src/utils/urlUtils';

describe('parseUrl', () => {
  it('parses ordinary https urls', () => {
    expect(parseUrl('https://zigly.com/collections/sale?x=1')).toEqual({
      scheme: 'https',
      host: 'zigly.com',
      path: '/collections/sale',
    });
  });

  it('strips port and credentials from the host', () => {
    expect(parseUrl('https://user@zigly.com:443/cart')?.host).toBe('zigly.com');
  });

  it('parses schemes with no authority, such as upi:', () => {
    expect(parseUrl('upi://pay?pa=zigly@icici')?.scheme).toBe('upi');
    expect(parseUrl('mailto:hello@zigly.com')?.scheme).toBe('mailto');
  });
});

describe('classifyUrl — Zigly hosts', () => {
  it.each([
    'https://zigly.com/',
    'https://www.zigly.com/pages/dog',
    'https://stores.zigly.com/',
    'https://franchise.zigly.com/',
  ])('renders %s in the WebView', url => {
    expect(classifyUrl(url).kind).toBe('allow');
  });
});

describe('classifyUrl — corrections', () => {
  it('rewrites the myshopify wishlist link back to the canonical domain', () => {
    // The site's own bottom-nav Wishlist tab points at the raw myshopify host.
    const action = classifyUrl(
      'https://zigly-store.myshopify.com/pages/swym-wishlist',
    );
    expect(action).toEqual({
      kind: 'rewrite',
      url: 'https://zigly.com/pages/swym-wishlist',
    });
  });

  it('upgrades cleartext to https rather than blocking it', () => {
    expect(classifyUrl('http://zigly.com/cart')).toEqual({
      kind: 'rewrite',
      url: 'https://zigly.com/cart',
    });
  });
});

describe('classifyUrl — payment handoff', () => {
  it.each(['upi://pay?pa=x', 'phonepe://pay', 'paytmmp://pay', 'tez://upi/pay'])(
    'hands %s to the OS',
    url => {
      expect(classifyUrl(url).kind).toBe('appIntent');
    },
  );

  it('prefers the browser fallback embedded in an intent:// url', () => {
    const intent =
      'intent://pay#Intent;scheme=upi;S.browser_fallback_url=https%3A%2F%2Fzigly.com%2Fcart;end';
    expect(classifyUrl(intent)).toEqual({
      kind: 'appIntent',
      url: 'https://zigly.com/cart',
    });
  });

  it.each(['tel:+911234567890', 'mailto:care@zigly.com', 'whatsapp://send'])(
    'hands %s to the OS',
    url => {
      expect(classifyUrl(url).kind).toBe('appIntent');
    },
  );

  it('renders known payment hosts in the WebView', () => {
    expect(classifyUrl('https://shop.app/checkout').kind).toBe('allow');
    expect(classifyUrl('https://pdp.gokwik.co/x').kind).toBe('allow');
    expect(classifyUrl('https://api.razorpay.com/v1/x').kind).toBe('allow');
  });
});

describe('classifyUrl — checkout mode', () => {
  const bank = 'https://acs.somerandombank.co.in/3ds/authenticate';

  it('sends an unknown host to the browser while merely browsing', () => {
    expect(classifyUrl(bank, false).kind).toBe('external');
  });

  it('renders that same host inside the WebView during checkout', () => {
    // A 3-D Secure step cannot be enumerated ahead of time; ejecting the user
    // to the browser mid-payment would strand the transaction.
    expect(classifyUrl(bank, true).kind).toBe('allow');
  });

  it('still refuses non-web schemes it does not recognise', () => {
    expect(classifyUrl('ftp://zigly.com/x', true).kind).toBe('block');
  });
});

describe('classifyUrl — external destinations', () => {
  it.each([
    'https://www.instagram.com/ziglyforpets/',
    'https://play.google.com/store/apps/details?id=com.zigly.app',
    'https://wa.me/919999999999',
    'https://maps.app.goo.gl/abc',
  ])('opens %s outside the app', url => {
    expect(classifyUrl(url).kind).toBe('external');
  });
});

describe('isCheckoutUrl', () => {
  it.each([
    'https://zigly.com/checkouts/c/abc123',
    'https://zigly.com/checkout',
    'https://shop.app/pay',
    'https://pdp.gokwik.co/checkout',
  ])('recognises %s as the money flow', url => {
    expect(isCheckoutUrl(url)).toBe(true);
  });

  it.each([
    'https://zigly.com/',
    'https://zigly.com/cart',
    'https://zigly.com/collections/sale',
  ])('does not treat %s as checkout', url => {
    expect(isCheckoutUrl(url)).toBe(false);
  });
});

describe('Zigly sub-properties', () => {
  it('keeps Zigly Prime in the app', () => {
    // Zigly Coins links here and asks for a mobile number; opening it in the
    // browser stranded that flow outside the app's session.
    expect(classifyUrl('https://ziglyprime.erlpaas.com/Login Microsite').kind).toBe(
      'allow',
    );
  });

  it('still keeps the other Zigly properties in the app', () => {
    expect(classifyUrl('https://stores.zigly.com/').kind).toBe('allow');
    expect(classifyUrl('https://franchise.zigly.com/').kind).toBe('allow');
  });
});
