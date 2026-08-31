/**
 * Which stored answers are allowed to decide what opens.
 *
 * THE FAULT THIS PINS.
 *
 * Reported after several builds that changed nothing: sign in, and on a later
 * tap of Account the login screen is back -- in the same session, without the
 * app ever being killed. It was not a lost session and not a lost cookie. It
 * was a WRITTEN-DOWN WRONG ANSWER.
 *
 * At commit a34b18c, where the flow worked, `auth` began every launch at
 * 'unknown' and nothing was persisted. openAccount opened the account screen on
 * 'unknown', the probe filled it in, and an answer that came back wrong was
 * corrected by the next probe -- a mistake could not outlive the moment because
 * there was nowhere for it to live.
 *
 * Persisting the hint removed that safety net. A single 'signedOut' -- from a
 * probe racing a cookie flush, or from the confirmation ladder giving up --
 * reached the disk, and from then on every launch seeded `auth` with it and
 * opened the login screen BEFORE any probe ran. One transient misread became
 * permanent.
 *
 * So the rule pinned here is asymmetric on purpose: 'signedIn' may be seeded,
 * 'signedOut' may not. Both end in the same place once the probe answers -- the
 * only difference is which screen shows during the round trip, and openAccount
 * already documents the account screen as the safer of the two. The useful half
 * is kept (a signed-in customer is never shown the login form while waiting) and
 * the half that could strand someone is dropped.
 *
 * These test the RULE, at the same level ../src/screens/ZiglyWebViewScreen
 * applies it. The storage round-trip is `authHint.test.ts`'s subject and is not
 * repeated.
 */
import type {AuthState} from '../src/account/accountData';
import {openAccount} from '../src/navigation/accountStack';

/**
 * The seeding rule as the screen applies it.
 *
 * Kept in step with the `loadAuthHint().then(...)` effect: only 'signedIn'
 * survives, and a hint never overrides an answer already in hand.
 */
const seed = (stored: AuthState, current: AuthState): AuthState => {
  if (stored !== 'signedIn') {
    return current;
  }
  return current === 'unknown' ? stored : current;
};

describe('seeding auth from the stored hint', () => {
  it('seeds a signed-in customer, so the login form is never shown while waiting', () => {
    expect(seed('signedIn', 'unknown')).toBe('signedIn');
    expect(openAccount(seed('signedIn', 'unknown'))).toEqual(['account']);
  });

  /**
   * THE REGRESSION. A stored 'signedOut' must not decide anything.
   *
   * This is the exact state the earlier builds left on the device: the ladder
   * exhausted, 'signedOut' was believed and written, and every launch afterwards
   * opened the login screen from it. Left as 'unknown', the account screen opens
   * and the probe settles it -- which is what the working commit did.
   */
  it('ignores a stored signed-out, which is how one bad probe became permanent', () => {
    expect(seed('signedOut', 'unknown')).toBe('unknown');
    expect(openAccount(seed('signedOut', 'unknown'))).toEqual(['account']);
    expect(openAccount(seed('signedOut', 'unknown'))).not.toEqual(['login']);
  });

  it('leaves an absent hint alone', () => {
    expect(seed('unknown', 'unknown')).toBe('unknown');
  });

  /**
   * The probe outranks the hint, whichever way they disagree. Both are async and
   * either can land first; the stored value is strictly the weaker source.
   */
  it('never overrides an answer the probe has already given', () => {
    expect(seed('signedIn', 'signedOut')).toBe('signedOut');
    expect(seed('signedOut', 'signedIn')).toBe('signedIn');
  });

  /**
   * A real sign-out still works, because it does not come through here.
   *
   * Pressing Log Out clears the session cookie, so the next launch's probe
   * answers 'signedOut' on its own evidence rather than on a remembered one.
   */
  it('still opens login when the probe itself says signed out', () => {
    expect(openAccount('signedOut')).toEqual(['login']);
  });
});
