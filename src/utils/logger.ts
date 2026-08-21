/**
 * Dev-only logging.
 *
 * The app depends on a DOM we do not control, so "the selector went missing"
 * must be a logged warning, never a crash and never a blank screen.
 * All output is stripped in release builds by the __DEV__ guard.
 */

const TAG = '[ZiglyWebView]';

export const log = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(TAG, ...args);
  }
};

export const warn = (...args: unknown[]): void => {
  if (__DEV__) {
    console.warn(TAG, ...args);
  }
};

export const error = (...args: unknown[]): void => {
  if (__DEV__) {
    console.error(TAG, ...args);
  }
};
