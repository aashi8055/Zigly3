/**
 * Guards on homepage load cost.
 *
 * The transplanted sections pull real markup from other Zigly pages, and the
 * arrival section alone is ~562 KB. These assertions keep the cheap-by-default
 * behaviour from being quietly undone later.
 */
import {getInjectionForUrl} from '../src/webview/injectedScripts';

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
