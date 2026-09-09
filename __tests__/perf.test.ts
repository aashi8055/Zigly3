/**
 * Guards on homepage load cost.
 *
 * THIS FILE USED TO GUARD THE OPPOSITE PROPERTY, and the inversion is the
 * point. The dashboard was assembled inside the page out of ~20 of Zigly's
 * theme sections, so what mattered was that those fetches were batched, chunked
 * to Shopify's five-per-call limit, deferred by IntersectionObserver and cached
 * per source page. Six tests here asserted exactly that.
 *
 * ../src/native/NativeDashboard draws that dashboard as React Native
 * components now, reading the Storefront GraphQL API directly, so none of that
 * machinery exists any more -- it was deleted along with the thirteen section
 * modules that used it. Guarding how it batched would be guarding nothing.
 *
 * What replaces it is the guard that it stays gone. 404 KB of dashboard
 * assembly per home load is the kind of thing that comes back one import at a
 * time, each looking locally reasonable, so the assertions below name the
 * modules and the globals rather than a byte count.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {MOBILE_CSS, RESTYLE_REPEAT} from '../src/webview/injectedStyles';

const home = () => getInjectionForUrl('https://zigly.com/') as string;

describe('the dashboard is not built in the page any more', () => {
  it('ships no section fetcher', () => {
    /*
     * `__ziglyFetchSection` was the entry point every section module called,
     * and the one thing that has to be absent for the rest to be dead: a
     * module re-added without it cannot fetch, and a fetcher re-added without
     * a caller is the first half of putting all thirteen back.
     */
    expect(home()).not.toContain('__ziglyFetchSection');
    expect(home()).not.toContain('__ziglySectionIds');
  });

  it('ships no section markup pipeline', () => {
    // The batching, chunking and deferral this file used to assert. Their
    // absence is now the assertion.
    const s = home();
    expect(s).not.toContain("ids.join(',')");
    expect(s).not.toContain('CHUNK = 5');
    expect(s).not.toContain('sectionCache[key]');
  });

  it('creates none of the dashboard section slots', () => {
    /*
     * The transplanted sections announced themselves with `zigly-x-` slot ids,
     * and each was created by the module that filled it -- so the thing to
     * assert gone is the CREATION, not the string.
     *
     * `[id^="zigly-x-"]` rules do still survive in ../src/webview/
     * injectedStyles: about forty of them, now styling slots nothing builds.
     * They are dead weight rather than a defect -- CSS for absent nodes
     * matches nothing -- and trimming them is a separate pass over a 2,279-line
     * stylesheet that has its own uncommitted work in flight. Asserted by
     * construction rather than by substring so that pass is not blocked on
     * rewriting this test.
     */
    const s = home();
    for (const slot of [
      'zigly-x-bestsellers',
      'zigly-x-everything',
      'zigly-x-instagram',
      'zigly-x-coupon',
    ]) {
      // The slot may be styled; it must not be built.
      expect(s).not.toContain(`id = "${slot}"`);
      expect(s).not.toContain(`id="${slot}"`);
      expect(s).not.toContain(`'${slot}'`);
    }
  });

  it('ships no Instagram cover bytes', () => {
    /*
     * The single largest thing in the old payload: 318 KB of base64 covers,
     * inflating ~33% inside a JavaScript string, for a rail the native
     * version loads from ../src/assets/instagram as real JPEGs. If a
     * data: URI ever appears in this payload again it is almost certainly
     * these.
     */
    expect(home()).not.toContain('data:image/jpeg;base64');
  });

  it('is a fraction of the payload it replaced', () => {
    /*
     * A number, because the guards above are all "absent" and absence is
     * satisfied by an empty string too. The old home payload was ~570 KB; the
     * pages still shown in a WebView need the stylesheet and five page
     * modules. The bound is deliberately loose -- this is a smoke test against
     * the whole dashboard reappearing, not a byte budget to be tuned.
     */
    expect(home().length).toBeLessThan(250 * 1024);
    // And it is not empty: the stylesheet and the page modules are still there.
    expect(home().length).toBeGreaterThan(MOBILE_CSS.length);
  });
});

/**
 * What the app hands the WebView, and how many times.
 *
 * The section pipeline above is about the network. This is about the bridge and
 * the JS thread, which is where the dashboard's remaining wait actually was:
 * `applyStyles` used to re-inject the ENTIRE payload on all six RESTYLE_DELAYS
 * entries, so 543 KB crossed the bridge seven times per page load -- 3.8 MB of
 * parse work on the one thread that also has to assemble the sections
 * `dashboard-ready` is waiting for.
 *
 * Every module in the bundle is idempotent and no-ops on a second run (the
 * seven-pass tests across this repo are what prove it), so those six passes
 * bought nothing at all. They now send RESTYLE_REPEAT instead.
 */
describe('the injected payload', () => {
  it('is sent whole exactly once, and repeated cheaply', () => {
    const screen = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    /*
     * The delayed passes must not carry the bundle. This asserts the shape at
     * the call site rather than a byte count, because the failure mode is
     * somebody putting `script` back into the loop -- which reads as a
     * one-word change and silently restores 3.2 MB per load.
     */
    expect(screen).toContain(
      'setTimeout(() => injectInto(target, RESTYLE_REPEAT), ms)',
    );
    expect(screen).not.toContain(
      'setTimeout(() => injectInto(target, script), ms)',
    );
  });

  it('keeps the repeat pass far smaller than the bundle it replaced', () => {
    // An order of magnitude, not a few percent. If RESTYLE_REPEAT ever grows to
    // carry the stylesheet again, this is the assertion that says so.
    expect(RESTYLE_REPEAT.length * 20).toBeLessThan(home().length);
  });

  it('does not re-ship the stylesheet it only has to re-seat', () => {
    /*
     * MOBILE_CSS is 98 KB and the single largest item in the payload. The
     * repeat pass asserts the cascade POSITION of the node that is already
     * there -- a late third-party <style> appended after ours beats us on equal
     * specificity, and moving our node back is the actual repair. Carrying the
     * CSS text to do that would defeat the whole point.
     */
    expect(RESTYLE_REPEAT).toContain('zigly-app-styles');
    expect(RESTYLE_REPEAT).not.toContain(MOBILE_CSS.slice(0, 200));
    expect(RESTYLE_REPEAT.length).toBeLessThan(MOBILE_CSS.length / 20);
  });

  it('asks for the real payload when there is no stylesheet to re-seat', () => {
    // The one case the cheap pass cannot handle: it carries no CSS, so it must
    // escalate rather than leave a page unstyled.
    expect(RESTYLE_REPEAT).toContain('restyle-missing');
    const screen = require('fs').readFileSync(
      'src/screens/ZiglyWebViewScreen.tsx',
      'utf8',
    );
    expect(screen).toContain("data.tag === 'restyle-missing'");
  });
});
