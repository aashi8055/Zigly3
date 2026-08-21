/**
 * Jest setup.
 *
 * The WebView, NetInfo and safe-area modules are native; under Jest there is no
 * TurboModule registry to satisfy them. Mock at the module boundary so the
 * component tree still renders and our own logic stays under test.
 */

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
