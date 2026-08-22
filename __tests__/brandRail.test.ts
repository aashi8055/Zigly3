/**
 * Top Pets Brands, scrollable by thumb.
 *
 * The rail is already styled as a native horizontal scroller. What stopped it
 * moving is that the Swiper the page started on it is still running: unlike the
 * category circles, this section is *moved* rather than copied, and a moved
 * node keeps its live instance. Verified against the live homepage on
 * 2026-08-22 it runs with `autoplay: {delay: 2500}` and Swiper's own touch
 * handling, so the rail neither moved by itself -- the stylesheet pins the
 * transform -- nor moved when pushed.
 *
 * These tests hold the instance to being *stood down*, never destroyed: the
 * Popular / Emerging handler is the site's, and it destroys the current Swiper
 * itself before building the next one.
 */
import {BRAND_RAIL_SCRIPT} from '../src/webview/brandRail';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

interface FakeSwiper {
  destroyed: boolean;
  allowTouchMove: boolean;
  params: {allowTouchMove: boolean};
  autoplay: {stopped: number; stop: () => void};
  disabled: number;
  disable: () => void;
  destroy: () => void;
}

const swiper = (): FakeSwiper => {
  const sw: FakeSwiper = {
    destroyed: false,
    allowTouchMove: true,
    params: {allowTouchMove: true},
    autoplay: {
      stopped: 0,
      stop: () => {
        sw.autoplay.stopped += 1;
      },
    },
    disabled: 0,
    disable: () => {
      sw.disabled += 1;
    },
    destroy: () => {
      sw.destroyed = true;
    },
  };
  return sw;
};

interface FakeSection {
  attrs: Record<string, string>;
  listeners: Array<() => void>;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, fn: () => void) => void;
}

const section = (): FakeSection => {
  const node: FakeSection = {
    attrs: {},
    listeners: [],
    getAttribute: name => node.attrs[name] ?? null,
    setAttribute: (name, value) => {
      node.attrs[name] = value;
    },
    addEventListener: (type, fn) => {
      if (type === 'click') {
        node.listeners.push(fn);
      }
    },
  };
  return node;
};

const run = (options: {
  hasSection: boolean;
  rails: Array<{swiper: FakeSwiper | null}>;
  times?: number;
}) => {
  const host = section();
  const document = {
    querySelector: () => (options.hasSection ? host : null),
    querySelectorAll: () => options.rails,
  };
  const timers: Array<() => void> = [];
  const window = {
    console,
    setTimeout: (fn: () => void) => {
      timers.push(fn);
      return 0;
    },
  };
  // eslint-disable-next-line no-new-func
  const script = new Function('window', 'document', 'setTimeout', BRAND_RAIL_SCRIPT);
  for (let i = 0; i < (options.times ?? 1); i += 1) {
    script(window, document, window.setTimeout);
  }
  return {host, timers};
};

describe('the brand rail', () => {
  it('is valid JavaScript', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(BRAND_RAIL_SCRIPT)).not.toThrow();
  });

  it('stops the autoplay that the stylesheet had already frozen', () => {
    const sw = swiper();
    run({hasSection: true, rails: [{swiper: sw}]});
    expect(sw.autoplay.stopped).toBe(1);
  });

  it('hands touch back to the page, so the rail scrolls natively', () => {
    const sw = swiper();
    run({hasSection: true, rails: [{swiper: sw}]});
    expect(sw.allowTouchMove).toBe(false);
    expect(sw.params.allowTouchMove).toBe(false);
    expect(sw.disabled).toBe(1);
  });

  it('never destroys it, because the site’s own tabs do that', () => {
    // Their handler calls currentSwiper.destroy(true, true) before building the
    // next one. Tearing it down here would leave that call holding a corpse.
    const sw = swiper();
    run({hasSection: true, rails: [{swiper: sw}]});
    expect(sw.destroyed).toBe(false);
    expect(BRAND_RAIL_SCRIPT).not.toContain('destroy(');
  });

  it('stands down the Swiper a tab builds for the panel it opens', () => {
    const first = swiper();
    const rails = [{swiper: first}];
    const {host, timers} = run({hasSection: true, rails});
    expect(host.listeners.length).toBe(1);

    // Popular -> Emerging: the site destroys the old instance and makes a new
    // one on the panel it just showed.
    first.destroyed = true;
    const next = swiper();
    rails[0] = {swiper: next};

    host.listeners[0]();
    expect(next.allowTouchMove).toBe(false);
    expect(next.autoplay.stopped).toBe(1);
    // And the deferred pass, for a handler that initialises out of band.
    timers.forEach(fn => fn());
    expect(next.destroyed).toBe(false);
  });

  it('binds the tab listener once, not once per injected pass', () => {
    const {host} = run({hasSection: true, rails: [{swiper: swiper()}], times: 5});
    expect(host.listeners.length).toBe(1);
  });

  it('leaves an instance that is already gone alone', () => {
    const sw = swiper();
    sw.destroyed = true;
    run({hasSection: true, rails: [{swiper: sw}]});
    expect(sw.autoplay.stopped).toBe(0);
    expect(sw.disabled).toBe(0);
  });

  it('does nothing on a page without the section', () => {
    const sw = swiper();
    const {host} = run({hasSection: false, rails: [{swiper: sw}]});
    expect(sw.autoplay.stopped).toBe(0);
    expect(host.listeners.length).toBe(0);
  });

  it('changes nothing about the cards themselves', () => {
    // The brands, their images, their links and their order are the section's.
    expect(BRAND_RAIL_SCRIPT).not.toContain('innerHTML');
    expect(BRAND_RAIL_SCRIPT).not.toContain('appendChild');
    expect(BRAND_RAIL_SCRIPT).not.toContain('new Swiper');
  });

  it('rides along with the rest of the injection', () => {
    const script = getInjectionForUrl('https://zigly.com/') as string;
    expect(script).toContain('home-shop-brand-swiper-wrapper');
    expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
  });
});
