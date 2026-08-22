/**
 * Prefetching trades the user's data for speed, so the guards around it matter
 * as much as the behaviour.
 */
import {PREFETCH_SCRIPT} from '../src/webview/prefetch';

describe('prefetch', () => {
  it('warms images, which is the part that actually caches', () => {
    // Zigly's HTML carries no cache-control and Cloudflare reports it DYNAMIC,
    // so prefetching documents alone would be refetched on navigation anyway.
    expect(PREFETCH_SCRIPT).toContain('cdn.shopify.com');
    expect(PREFETCH_SCRIPT).toContain('img[src]');
  });

  it('runs once per page view', () => {
    expect(PREFETCH_SCRIPT).toContain('__ziglyPrefetched');
  });

  it('waits before starting, so it never competes with the dashboard', () => {
    expect(PREFETCH_SCRIPT).toContain('setTimeout');
  });

  it('never surfaces a failure to the user', () => {
    // A prefetch is opportunistic; a failed one must be silent.
    expect(PREFETCH_SCRIPT).toContain('.catch(function () {})');
  });

  it("warms where the category circles actually go, read off the rail", () => {
    // The circles are the first thing under the search bar, so the first thing
    // tapped, and every one is a fresh Zigly page. Their destinations are
    // Zigly's choice and are read at runtime -- writing them down here would
    // freeze whatever the section happens to ship today.
    expect(PREFETCH_SCRIPT).toContain('home_category_section');
    expect(PREFETCH_SCRIPT).toContain('categoryTargets');
    expect(PREFETCH_SCRIPT).not.toContain('/pages/zigly-cat');
    expect(PREFETCH_SCRIPT).not.toContain('/pages/vet-care-page');
  });

  it('warms nothing off our own origin', () => {
    // A circle pointing at another host is not ours to fetch, and the URL
    // policy would not render it in a layer either.
    expect(PREFETCH_SCRIPT).toContain('window.location.origin');
  });

  it('never warms the page it is already on', () => {
    expect(PREFETCH_SCRIPT).toContain('window.location.pathname');
  });

  it('caps how many pages it will warm', () => {
    // Six circles plus two tabs is already eight pages and up to sixty-four
    // images; a section that shipped twenty circles must not run away with the
    // customer's data.
    expect(PREFETCH_SCRIPT).toContain('.slice(0, MAX)');
  });

  it('parses cleanly', () => {
    // Parsing without executing is the whole point here; the injected payload
    // is a string, so nothing else can catch a syntax error in it.
    // eslint-disable-next-line no-new-func, no-new
    expect(() => new Function(PREFETCH_SCRIPT)).not.toThrow();
  });
});
