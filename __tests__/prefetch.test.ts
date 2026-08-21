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

  it('parses cleanly', () => {
    // Parsing without executing is the whole point here; the injected payload
    // is a string, so nothing else can catch a syntax error in it.
    // eslint-disable-next-line no-new-func, no-new
    expect(() => new Function(PREFETCH_SCRIPT)).not.toThrow();
  });
});
