/**
 * Making a login outlast the process, not just the app.
 *
 * The requirement is that signing in once lasts until the customer uninstalls
 * or presses Log Out. ../src/webview/webViewConfig's shared, cached cookie jar
 * gets a RELAUNCH right, and a relaunch is not how a mobile app usually ends:
 * it is killed, from Recents or by the system reclaiming memory. Two things
 * fail there, and both are what ../src/account/cookieJar exists for --
 *
 *   - Android syncs the cookie jar to disk lazily, so a login made shortly
 *     before the kill was never written down at all;
 *   - Shopify's customer cookie carries no Max-Age, making it a session cookie
 *     that Android discards on process death however well it was flushed.
 *
 * What is defended here is the shape of the remedy rather than Android's
 * behaviour, which no unit test can observe: that the module asks for the right
 * things, that it stays a DURABILITY mechanism and never becomes an auth state,
 * and above all that it cannot keep a customer signed in against their wishes.
 * That last one is the risk this file introduces -- a cookie given a year on
 * disk is a cookie that outlives a Log Out, unless the clearing is written down
 * too -- so it gets the most tests.
 */

/*
 * `mock`-prefixed because jest.mock is hoisted above these declarations, and
 * the factory may only close over names that survive that. The prefix is the
 * escape hatch Jest itself defines for exactly this.
 */
const mockFlush = jest.fn(() => Promise.resolve(true));
const mockPersist = jest.fn(() => Promise.resolve(2));
const mockHas = jest.fn(() => Promise.resolve(true));

/*
 * The real react-native with two properties intercepted.
 *
 * A Proxy rather than a spread. react-native's index defines its exports as
 * lazy getters, and `{...actual}` evaluates every one of them -- pulling in
 * FlatList, VirtualizedList and the rest of the list stack just to change
 * Platform.OS. Intercepting leaves each getter untouched until something asks.
 */
const mockRN = (os: string, withModule: boolean) => {
  const actual = jest.requireActual('react-native');
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === 'Platform') {
        return {...target.Platform, OS: os};
      }
      if (prop === 'NativeModules') {
        return withModule
          ? {
              ZiglyCookieJar: {
                flush: mockFlush,
                persistSessionCookies: mockPersist,
                hasCookies: mockHas,
              },
            }
          : {};
      }
      return Reflect.get(target, prop, receiver);
    },
  });
};

jest.mock('react-native', () => mockRN('android', true));

const load = () => require('../src/account/cookieJar');

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('writing the jar down', () => {
  it('asks the native side to flush', async () => {
    await load().flushCookies();
    expect(mockFlush).toHaveBeenCalled();
  });

  it('survives a native side that throws', async () => {
    // This sits in front of a session that mostly works without it, so a
    // failure must cost durability and never a crash -- ../src/account/authHint
    // takes the same line about its own store.
    mockFlush.mockRejectedValueOnce(new Error('no webview'));
    await expect(load().flushCookies()).resolves.toBeUndefined();
  });
});

describe('giving the session cookie a lifetime', () => {
  it('extends the cookies for the site, not for some other host', async () => {
    await load().persistSession();
    const [url] = mockPersist.mock.calls[0];
    expect(url).toBe('https://zigly.com');
  });

  it('asks for a lifetime long enough to mean "until they log out"', async () => {
    // Not a guess at Shopify's session length and it does not override it: the
    // server's cookie still decides who is signed in. This is only how long
    // Android is asked to keep the cookie on disk.
    await load().persistSession();
    const [, seconds] = mockPersist.mock.calls[0];
    expect(seconds).toBeGreaterThanOrEqual(365 * 24 * 60 * 60);
  });

  it('survives a native side that throws', async () => {
    mockPersist.mockRejectedValueOnce(new Error('jar locked'));
    await expect(load().persistSession()).resolves.toBeUndefined();
  });
});

describe('what this module refuses to be', () => {
  it('offers no way to clear a cookie', () => {
    // Sign-out stays on the site's own /account/logout. The one reliable way to
    // get the app and the website disagreeing about who is signed in is for the
    // app to start deleting cookies behind the site's back, so the capability
    // is absent rather than merely unused.
    const api = load();
    for (const name of Object.keys(api)) {
      expect(name).not.toMatch(/clear|delete|remove|signOut/i);
    }
  });

  it('reports a non-empty jar without claiming anyone is signed in', async () => {
    // hasSessionCookies is a diagnostic. A cookie can be expired, revoked, or
    // for a customer Shopify no longer recognises; the probe remains the only
    // thing that answers the auth question.
    const api = load();
    await expect(api.hasSessionCookies()).resolves.toBe(true);
    expect(Object.keys(api)).not.toContain('isSignedIn');
  });
});

describe('on a platform with no native module', () => {
  it('does nothing, quietly, rather than throwing', async () => {
    // iOS takes this path: WKWebView persists a session cookie across a
    // relaunch without help, so there is no counterpart to call. An Android
    // build made before the module existed lands here too.
    jest.resetModules();
    jest.doMock('react-native', () => mockRN('ios', false));
    const api = require('../src/account/cookieJar');
    await expect(api.flushCookies()).resolves.toBeUndefined();
    await expect(api.persistSession()).resolves.toBeUndefined();
    await expect(api.hasSessionCookies()).resolves.toBe(false);
    expect(mockFlush).not.toHaveBeenCalled();
  });
});
