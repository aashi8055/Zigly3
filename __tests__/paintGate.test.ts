/**
 * The paint gate.
 *
 * The window it closes: `injectedJavaScript` runs when the document has
 * finished loading, so for a beat before it the page is the mobile *website* --
 * its own grid, its own type scale, its own bottom bar -- and then it visibly
 * becomes this app. The gate holds the document invisible until the app's
 * stylesheet is installed, and the stylesheet lifts it.
 *
 * Two properties matter more than the mechanism, and both are failure modes
 * rather than features:
 *
 *   **It always lifts.** A gate that is not lifted is not a slow page, it is a
 *   blank one. So it is lifted on every path out of the style injection,
 *   including the ones that give up, and it lifts itself on a deadline in case
 *   the injection never ran at all.
 *
 *   **It is never over the money flow.** Nothing in this app styles checkout,
 *   so nothing there would ever lift it -- it would hold a payment page
 *   invisible for the whole deadline, for no benefit whatsoever.
 */
import {
  EARLY_HEADER_CSS,
  PAINT_GATE_ID,
  PAINT_GATE_MAX_MS,
} from '../src/webview/headerBridge';
import {MOBILE_CSS, buildStyleInjection} from '../src/webview/injectedStyles';
import {PAGE_COVER_CAP_MS} from '../src/components/PageCover';

describe('installing the gate', () => {
  it('hides the document rather than removing it', () => {
    // visibility, not display: layout still runs and images still download
    // behind it, so the gate costs nothing in load time -- it only decides when
    // the result is shown.
    expect(EARLY_HEADER_CSS).toContain('html{visibility:hidden!important');
    expect(EARLY_HEADER_CSS).not.toContain('html{display:none');
  });

  it('paints white behind it, not the WebView’s own ground', () => {
    expect(EARLY_HEADER_CSS).toContain('background:#fff!important');
  });

  it('refuses to gate the money flow', () => {
    const at = EARLY_HEADER_CSS.indexOf('paint gate');
    expect(at).toBeGreaterThan(-1);
    const gate = EARLY_HEADER_CSS.slice(at);
    expect(gate).toContain("p.indexOf('/checkouts/') === 0");
    expect(gate).toContain("host.indexOf('gokwik')");
    expect(gate).toContain('!isMoneyFlow');
  });

  it('gates only the document it was loaded with', () => {
    // The payload is injected again on the native onLoadStart as a backstop,
    // and that one lands in the OUTGOING document. Gating there would blank a
    // page the customer is still looking at, and a cancelled navigation would
    // leave it blank until the deadline.
    expect(EARLY_HEADER_CSS).toContain(
      "document.readyState === 'loading'",
    );
  });

  it('survives the parser building the real head', () => {
    // At document-start there may be no <head> yet, so the node can be dropped.
    expect(EARLY_HEADER_CSS).toContain(
      "document.addEventListener('DOMContentLoaded', install, {once: true})",
    );
    // But it is not re-added over a gate that has already been lifted.
    expect(EARLY_HEADER_CSS).toContain('if (window.__ziglyGateLifted) { return; }');
  });
});

describe('lifting the gate', () => {
  const injection = buildStyleInjection(MOBILE_CSS);

  it('lifts when the app’s own stylesheet is installed', () => {
    const at = injection.indexOf('zigly-app-styles');
    expect(at).toBeGreaterThan(-1);
    expect(injection.slice(at)).toContain('liftGate()');
  });

  it('lifts on the paths that give up, too', () => {
    // A page shown unstyled is a bad page; a page never shown at all is a
    // broken app. So: the money-flow bail-out, the already-installed
    // early-return, and the catch.
    expect(injection).toContain('if (isMoneyFlow) { liftGate(); return; }');
    const at = injection.indexOf('existing.textContent !== css');
    expect(at).toBeGreaterThan(-1);
    expect(injection.slice(at, at + 120)).toContain('liftGate()');
    const caught = injection.indexOf('} catch (e) {');
    expect(injection.slice(caught)).toContain('liftGate()');
  });

  it('lifts on the login screen, which gets no mobile stylesheet', () => {
    /*
     * The near-miss this pins. The login WebView is injected with LOGIN_RESTYLE
     * only -- the mobile stylesheet is for shop pages, and this screen is one
     * modal widget on a blank ground -- so nothing there would have lifted the
     * gate, and the form would have sat invisible until the deadline.
     */
    const {LOGIN_RESTYLE} = require('../src/webview/loginRestyle');
    expect(LOGIN_RESTYLE).toContain('__ziglyGateLifted');
    expect(LOGIN_RESTYLE).toContain(PAINT_GATE_ID);
    // After the restyle has run, or the site's own login page shows first.
    expect(LOGIN_RESTYLE.indexOf('run();')).toBeLessThan(
      LOGIN_RESTYLE.indexOf('__ziglyGateLifted'),
    );
  });

  it('names the same node the early payload installed', () => {
    expect(injection).toContain(PAINT_GATE_ID);
    expect(EARLY_HEADER_CSS).toContain(PAINT_GATE_ID);
  });

  it('lifts itself if the injection never ran', () => {
    expect(EARLY_HEADER_CSS).toContain(`}, ${PAINT_GATE_MAX_MS});`);
  });

  it('gives up before the app’s cover does', () => {
    // Otherwise the gate hands the customer a bare website at the very end of
    // the cover -- which is the thing the cover was raised to hide.
    expect(PAINT_GATE_MAX_MS).toBeLessThan(PAGE_COVER_CAP_MS);
  });
});

describe('the gate as executed', () => {
  it('parses, so a mangled escape cannot silently disable it', () => {
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(EARLY_HEADER_CSS);
    }).not.toThrow();
  });
});
