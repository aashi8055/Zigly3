/**
 * That the login is actually made durable, at each of the three moments.
 *
 * ../src/account/cookieJar has its own tests for what it asks the native side
 * for. This file is about the wiring: a durability mechanism nothing calls is
 * exactly as good as no mechanism, and the calls live inside the one screen
 * component that owns eleven WebViews and cannot be rendered in a test. So
 * these are source assertions, on the same terms as the sign-out rules in
 * ./account.test.tsx.
 *
 * The three moments, and why each is the one it is:
 *
 *   CONFIRMED SIGN-IN -- the cookie worth keeping has just been set, and is at
 *   its most fragile: not yet written to disk, and carrying no expiry.
 *
 *   BACKGROUNDING -- the only warning an Android app reliably gets before it is
 *   killed, which is how a mobile app usually ends.
 *
 *   CONFIRMED SIGN-OUT -- the one that keeps this feature honest. A cookie
 *   given a year on disk outlives a Log Out unless the CLEARED jar is written
 *   down too, and a customer who pressed Log Out and came back signed in would
 *   be a worse bug than the one this whole change fixes.
 */
const src = (): string =>
  require('fs').readFileSync('src/screens/ZiglyWebViewScreen.tsx', 'utf8');

/** One `case` arm of the message switch, to the start of the next. */
const arm = (name: string): string => {
  const s = src();
  const at = s.indexOf("case '" + name + "': {");
  expect(at).toBeGreaterThan(-1);
  return s.slice(at, s.indexOf('default:', at));
};

describe('a login that outlasts the process', () => {
  it('makes the session durable as soon as a probe confirms it', () => {
    const s = src();
    const at = s.indexOf("if (state === 'signedIn') {");
    expect(at).toBeGreaterThan(-1);
    // The same branch that latches sessionConfirmed: every route into an auth
    // answer goes through applyAuth, so this catches a login however it landed.
    expect(s.slice(at, at + 1200)).toContain('persistSession()');
  });

  it('does it on every confirmation, not only the first', () => {
    // A cookie Shopify has since renewed needs extending too, so this must not
    // be guarded on the latch it sits next to.
    const s = src();
    const at = s.indexOf("if (state === 'signedIn') {");
    const branch = s.slice(at, at + 1200);
    const call = branch.indexOf('persistSession()');
    expect(branch.slice(0, call)).not.toMatch(/if\s*\(\s*!sessionConfirmed/);
  });
});

describe('the last safe moment before a kill', () => {
  it('listens for the app going to the background', () => {
    const s = src();
    expect(s).toContain("AppState.addEventListener('change'");
    // 'inactive' as well as 'background': a kill does not always announce
    // itself with the tidier of the two.
    const at = s.indexOf("AppState.addEventListener('change'");
    expect(s.slice(at, at + 900)).toContain("next !== 'background'");
  });

  it('extends the session there rather than only flushing it', () => {
    // Flushing alone would faithfully write down a cookie that Android then
    // discards for having no Max-Age, which is the whole second half of the
    // bug. persistSession does the extending and flushes as part of it.
    const s = src();
    const at = s.indexOf("AppState.addEventListener('change'");
    expect(s.slice(at, at + 900)).toContain('persistSession()');
  });

  it('removes the listener when the screen goes away', () => {
    const s = src();
    const at = s.indexOf("AppState.addEventListener('change'");
    expect(s.slice(at, at + 900)).toContain('subscription.remove()');
  });
});

describe('a sign-out that also outlasts the process', () => {
  it('writes the cleared jar down once the site confirms it', () => {
    // Without this, a kill in the gap before Android's own sync reloads the jar
    // from disk -- where the pre-logout cookie is still sitting with the year
    // this feature gave it -- and the customer is signed back in.
    const auth = arm('auth');
    const at = auth.indexOf("applyAuth('signedOut')");
    expect(at).toBeGreaterThan(-1);
    expect(auth.slice(at)).toContain('flushCookies()');
  });

  it('never clears a cookie itself', () => {
    // /account/logout is the site's own route and clearing the session is its
    // job. The app writing the result down is not the same as the app deciding
    // it -- see ../src/webview/accountBridge.
    const s = src();
    expect(s).not.toMatch(/clearCookies|removeCookie|CookieManager\./);
  });
});
