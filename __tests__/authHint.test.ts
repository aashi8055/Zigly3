/**
 * The auth state kept across launches.
 *
 * The session itself already survives a relaunch in the shared cookie jar; what
 * did not survive was the app's KNOWLEDGE of it. `auth` began every launch at
 * 'unknown' and only ACCOUNT_PROBE settled it, which cannot answer until the
 * dashboard has loaded -- so tapping Account inside that window showed a
 * signed-in customer the login form.
 *
 * What is defended here is that this is a HINT and never a session. It decides
 * which screen opens first and nothing else: the probe stays the authority, an
 * unreadable store leaves the app exactly as it was before this file existed,
 * and nothing about the customer is ever written down.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAuthHint,
  loadAuthHint,
  saveAuthHint,
} from '../src/account/authHint';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('remembering the answer the last probe gave', () => {
  it('reads back what it wrote', async () => {
    await saveAuthHint('signedIn');
    await expect(loadAuthHint()).resolves.toBe('signedIn');
  });

  it('remembers signed out too, so login opens without a flicker', async () => {
    // Worth keeping rather than clearing: knowing the customer was signed out
    // opens the login screen directly, instead of the account screen appearing
    // first and being replaced when the probe answers.
    await saveAuthHint('signedOut');
    await expect(loadAuthHint()).resolves.toBe('signedOut');
  });

  it('answers unknown when nothing has ever been stored', async () => {
    // A fresh install. The app then behaves exactly as it did before this
    // module existed, which is the fallback every branch here aims at.
    await expect(loadAuthHint()).resolves.toBe('unknown');
  });

  it('replaces the previous answer rather than accumulating', async () => {
    await saveAuthHint('signedIn');
    await saveAuthHint('signedOut');
    await expect(loadAuthHint()).resolves.toBe('signedOut');
  });

  it('forgets on request', async () => {
    await saveAuthHint('signedIn');
    await clearAuthHint();
    await expect(loadAuthHint()).resolves.toBe('unknown');
  });
});

describe('a hint, never a source of truth', () => {
  it('discards anything it did not write', async () => {
    // A value from an older build, a truncated write, an edited store. Treated
    // as absent rather than repaired or trusted -- the same rule the section id
    // cache is held to.
    await AsyncStorage.setItem('zigly.authHint.v1', 'yes');
    await expect(loadAuthHint()).resolves.toBe('unknown');
  });

  it('discards a stored "unknown", which is not an answer', async () => {
    await AsyncStorage.setItem('zigly.authHint.v1', 'unknown');
    await expect(loadAuthHint()).resolves.toBe('unknown');
  });

  it('survives a read that throws', async () => {
    // A storage failure must cost a little smoothness and nothing else: the app
    // falls back to asking the probe, exactly as it always did.
    const getItem = AsyncStorage.getItem as jest.Mock;
    getItem.mockRejectedValueOnce(new Error('disk gone'));
    await expect(loadAuthHint()).resolves.toBe('unknown');
  });

  it('survives a write that throws', async () => {
    // Nothing on the login path waits for this, so a failed write must not
    // surface as a rejected promise into a screen that cannot act on it.
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveAuthHint('signedIn')).resolves.toBeUndefined();
  });

  it('stores one of two words, and nothing about the customer', async () => {
    // The whole value is a screen decision. A name, an email or a phone number
    // kept here would be the customer's own data sitting on the device for no
    // benefit -- every field is re-read from the theme on each probe anyway.
    await saveAuthHint('signedIn');
    const stored = await AsyncStorage.getItem('zigly.authHint.v1');
    expect(stored).toBe('signedIn');
  });
});
