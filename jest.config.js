module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // react-native-webview and safe-area-context ship untranspiled sources; Jest
  // must run them through Babel rather than treat them as plain CommonJS.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|react-native-webview|react-native-safe-area-context|@react-native-community)/)',
  ],
};
