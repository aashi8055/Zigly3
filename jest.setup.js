/* eslint-env jest */
/**
 * Jest setup.
 *
 * The env comment above is not decoration: this file is linted by `eslint .`
 * along with everything else, and without it every `jest.mock` here is an
 * undefined global. That was already true before this file grew its fourth mock;
 * fixing it here means `npm run lint` reports on the app rather than on its own
 * test harness.
 *
 * The WebView, NetInfo, safe-area and AsyncStorage modules are native; under Jest
 * there is no TurboModule registry to satisfy them. Mock at the module boundary so
 * the component tree still renders and our own logic stays under test.
 */

/**
 * AsyncStorage, as a plain in-memory map.
 *
 * The library ships a mock of its own, but it also ships untranspiled sources, so
 * reaching for either means widening `transformIgnorePatterns` to compile a native
 * module this suite never actually exercises. A map is smaller, faster and
 * deterministic -- and it is a real store, so ../src/webview/sectionIdStore can be
 * tested by writing and reading it back rather than by asserting on spies.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const api = {
    getItem: jest.fn(key => Promise.resolve(store.has(key) ? store.get(key) : null)),
    setItem: jest.fn((key, value) => {
      store.set(key, String(value));
      return Promise.resolve();
    }),
    removeItem: jest.fn(key => {
      store.delete(key);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
    /** Not part of the real API; a hatch for tests that need a known start. */
    __reset: () => store.clear(),
  };
  return {__esModule: true, default: api, ...api};
});

jest.mock('react-native-webview', () => {
  const React = require('react');
  const {View} = require('react-native');
  const MockWebView = React.forwardRef((props, ref) =>
    React.createElement(View, {...props, ref, testID: 'mock-webview'}),
  );
  MockWebView.displayName = 'WebView';
  return {__esModule: true, WebView: MockWebView, default: MockWebView};
});

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {addEventListener: jest.fn(() => jest.fn())},
  addEventListener: jest.fn(() => jest.fn()),
}));

// The library ships its own mock, but it imports @jest/globals and is awkward
// to load here. An explicit mock with fixed insets is clearer and deterministic.
jest.mock('react-native-safe-area-context', () => {
  const insets = {top: 24, right: 0, bottom: 16, left: 0};
  const frame = {x: 0, y: 0, width: 390, height: 844};
  return {
    __esModule: true,
    SafeAreaProvider: ({children}) => children,
    SafeAreaView: ({children}) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: {frame, insets},
  };
});
