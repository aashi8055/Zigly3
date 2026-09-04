/**
 * Guards on homepage load cost.
 *
 * The transplanted sections pull real markup from other Zigly pages, and the
 * arrival section alone is ~562 KB. These assertions keep the cheap-by-default
 * behaviour from being quietly undone later.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';
import {MOBILE_CSS, RESTYLE_REPEAT} from '../src/webview/injectedStyles';

const home = () => getInjectionForUrl('https://zigly.com/') as string;

describe('homepage load cost', () => {
  it('batches section requests instead of one call each', () => {
    // Shopify accepts ?sections=a,b,c; six round trips become two.
    expect(home()).toContain("ids.join(',')");
  });

  it('defers the heavy below-the-fold sections until they near the viewport', () => {
    const s = home();
    expect(s).toContain('IntersectionObserver');
    expect(s).toContain('whenNear');
  });

  it('still loads deferred sections where IntersectionObserver is missing', () => {
    // Degrade to immediate loading rather than showing nothing at all.
    expect(home()).toContain('if (!window.IntersectionObserver) { run(); return; }');
  });

  it('fetches each source page at most once', () => {
    expect(home()).toContain('sectionCache[key]');
    expect(home()).toContain('pageCache[path]');
  });

  it('chunks section requests to Shopify’s five-per-call limit', () => {
    // Six or more ids in one ?sections= call returns HTTP 400.
    expect(home()).toContain('CHUNK = 5');
  });

  it('requests every section from one origin', () => {
    // Sections resolve by id against any page, so '/' serves them all and
    // unrelated sections can share a batch.
    const s = home();
    expect(s).not.toContain("'/pages/dog'");
    expect(s).not.toContain("'/pages/zigly-cat'");
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
