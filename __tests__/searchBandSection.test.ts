/**
 * The search band, as a real section of the page.
 *
 * What is defended here is that it is genuinely IN the document -- ordinary
 * flow content at the top of the page's main region -- because that is the only
 * reason it scrolls correctly. Three previous versions drew it natively above
 * the WebView and tried to simulate the scroll; the last of those reserved 64px
 * in the page for a band that was still in native layout, which showed as a
 * collapsible bar with an empty gap underneath it. A test that the node is
 * built, is first, and is static is a test that none of that comes back.
 */
import {
  BAND_ID,
  BAND_TAP_TAG,
  buildSearchBandScript,
  removeSearchBandScript,
  SEARCH_BAND_CSS,
  SEARCH_BAND_H,
} from '../src/webview/searchBandSection';
import {MOBILE_CSS} from '../src/webview/injectedStyles';

/* -------------------------------------------------------------------------- *
 * A very small DOM
 *
 * Only what the script asks for: an id lookup, one class query, createElement,
 * insertBefore and firstChild. Written out rather than pulled in, because jsdom
 * is not a dependency of this project -- the same reasoning as
 * ./facetBridge.test.ts.
 * -------------------------------------------------------------------------- */
interface Listener {
  (ev: {preventDefault: () => void; stopPropagation: () => void}): void;
}

class El {
  tag: string;
  id = '';
  className = '';
  type = '';
  textContent = '';
  children: El[] = [];
  parentNode: El | null = null;
  attrs: {[k: string]: string} = {};
  listeners: {[k: string]: Listener[]} = {};
  // The script parks its typewriter state on the node.
  [key: string]: unknown;

  constructor(tag: string) {
    this.tag = tag.toLowerCase();
  }

  get firstChild(): El | null {
    return this.children.length > 0 ? this.children[0] : null;
  }

  appendChild(child: El): El {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child: El, ref: El | null): El {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at === -1) {
      this.children.push(child);
    } else {
      this.children.splice(at, 0, child);
    }
    return child;
  }

  removeChild(child: El): El {
    const at = this.children.indexOf(child);
    if (at !== -1) {
      this.children.splice(at, 1);
    }
    child.parentNode = null;
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }

  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }

  /** Every node in this subtree, self first. */
  walk(): El[] {
    return this.children.reduce<El[]>(
      (all, c) => all.concat(c.walk()),
      [this as El],
    );
  }

  querySelector(sel: string): El | null {
    if (sel.charAt(0) !== '.') {
      throw new Error('stub only supports class selectors: ' + sel);
    }
    const want = sel.slice(1);
    return (
      this.walk().find(
        el => el.className.split(/\s+/).indexOf(want) !== -1,
      ) || null
    );
  }
}

/**
 * Runs the script against a stub document, returning what it built.
 *
 * `host` stands in for #MainContent and starts with a section already in it, so
 * "the band is first" is a real assertion rather than a tautology.
 */
const run = (
  script: string,
  existing?: {host: El; posted: string[]; timers: Array<() => void>},
) => {
  const state = existing ?? {
    host: (() => {
      const h = new El('div');
      h.id = 'MainContent';
      const firstSection = new El('section');
      firstSection.id = 'home_category_section';
      h.appendChild(firstSection);
      return h;
    })(),
    posted: [] as string[],
    timers: [] as Array<() => void>,
  };

  const byId = (id: string): El | null =>
    state.host.walk().find(el => el.id === id) || null;

  const documentStub = {
    querySelector: (sel: string) => (sel === '#MainContent' ? state.host : null),
    getElementById: byId,
    createElement: (tag: string) => new El(tag),
  };

  // Timers are collected rather than run, so the typewriter's cadence can be
  // stepped deliberately below instead of racing the test.
  const setTimeoutStub = (fn: () => void, _ms: number) => {
    state.timers.push(fn);
    return state.timers.length;
  };

  // eslint-disable-next-line no-new-func
  new Function(
    'document',
    'window',
    'setTimeout',
    'clearTimeout',
    script.replace(/\btrue;\s*$/, ''),
  )(
    documentStub,
    {
      ReactNativeWebView: {
        postMessage: (m: string) => state.posted.push(m),
      },
    },
    setTimeoutStub,
    () => {},
  );

  return {...state, band: byId(BAND_ID)};
};

describe('the band is a node in the document', () => {
  it('builds the blue container and its field', () => {
    const {band} = run(buildSearchBandScript(['dog food'], 100));
    expect(band).not.toBeNull();
    expect(band!.querySelector('.zigly-band-field')).not.toBeNull();
    expect(band!.querySelector('.zigly-band-text')).not.toBeNull();
  });

  it('sits first in the page content, above the theme sections', () => {
    // The reference order: search band, then the category circles. Not merely
    // "present somewhere" -- the whole point is where it is.
    const {host, band} = run(buildSearchBandScript(['dog food'], 100));
    expect(host.firstChild).toBe(band);
    expect(host.children[1].id).toBe('home_category_section');
  });

  it('puts itself back if the page reorders around it', () => {
    // ../src/webview/homeLayout moves the dashboard's own sections after this
    // has run, and Shopify re-renders sections wholesale.
    const state = run(buildSearchBandScript(['dog food'], 100));
    const band = state.band!;
    // Something shunts it down the page.
    state.host.removeChild(band);
    state.host.appendChild(band);
    expect(state.host.firstChild).not.toBe(band);

    run(buildSearchBandScript(['dog food'], 100), state);
    expect(state.host.firstChild).toBe(band);
  });

  it('is styled as ordinary flow content, never as furniture', () => {
    // A sticky or fixed value inherited from a template would turn it back
    // into the thing that had to be simulated.
    //
    // Scoped to the container's own rule: the magnifier inside it is drawn
    // with a relative span and an absolute ::after, which is a glyph and not
    // the band's position in the page.
    const container = SEARCH_BAND_CSS.slice(
      SEARCH_BAND_CSS.indexOf(`#${BAND_ID} {`),
    ).split('}')[0];
    expect(container).toContain('position: static !important');
    expect(container).not.toMatch(/position:\s*(sticky|fixed|absolute)/);
  });

  it('carries the same blue and field as the native band', () => {
    // The native band still shows where the injection has not landed, so the
    // two must not be distinguishable.
    const header = require('fs').readFileSync(
      'src/components/NativeHeader.tsx',
      'utf8',
    );
    expect(header).toContain('#BFD3EE');
    expect(SEARCH_BAND_CSS).toContain('#BFD3EE');
    // The field: white, 1px near-black, 8px radius, 44px tall.
    expect(SEARCH_BAND_CSS).toContain('border: 1px solid #1B1B1B');
    expect(SEARCH_BAND_CSS).toContain('border-radius: 8px');
    expect(SEARCH_BAND_CSS).toContain('height: 44px');
  });

  it('adds up to the height the native band reserves', () => {
    // 44px field plus 10px padding top and bottom.
    const pad = Number(
      (SEARCH_BAND_CSS.match(/padding: (\d+)px 14px/) || [])[1],
    );
    const field = Number((SEARCH_BAND_CSS.match(/height: (\d+)px/) || [])[1]);
    expect(field + pad * 2).toBe(SEARCH_BAND_H);
  });

  it('ships its CSS in the stylesheet the page actually gets', () => {
    expect(MOBILE_CSS).toContain(BAND_ID);
  });
});

describe('the tap', () => {
  it('hands the search screen to the app rather than searching', () => {
    // Nothing here searches: the native screen owns suggestions, submission
    // and history.
    const {band, posted} = run(buildSearchBandScript(['dog food'], 100));
    const field = band!.querySelector('.zigly-band-field')!;
    let defaulted = false;
    field.listeners.click[0]({
      preventDefault: () => {
        defaulted = true;
      },
      stopPropagation: () => {},
    });
    expect(posted).toEqual([JSON.stringify({tag: BAND_TAP_TAG})]);
    // The band can sit inside the theme's own form markup.
    expect(defaulted).toBe(true);
  });

  it('is a real button, so the platform gives it a role and a label', () => {
    const {band} = run(buildSearchBandScript(['dog food'], 100));
    const field = band!.querySelector('.zigly-band-field')!;
    expect(field.tag).toBe('button');
    expect(field.type).toBe('button');
    expect(field.getAttribute('aria-label')).toBe('Search Zigly');
  });

  it('hides the animating prompt from assistive tech', () => {
    // A screen reader reading a half-typed phrase letter by letter is noise,
    // and the button is already labelled.
    const {band} = run(buildSearchBandScript(['dog food'], 100));
    expect(
      band!.querySelector('.zigly-band-text')!.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});

describe('running seven times, as it does on a real page load', () => {
  it('builds one band, not seven', () => {
    const state = run(buildSearchBandScript(['dog food'], 100));
    for (let i = 0; i < 6; i++) {
      run(buildSearchBandScript(['dog food'], 100), state);
    }
    expect(state.host.walk().filter(el => el.id === BAND_ID).length).toBe(1);
    expect(state.host.children[1].id).toBe('home_category_section');
  });

  it('keeps one typewriter, not seven writing over each other', () => {
    // Two timers on one node is a visible stutter.
    const state = run(buildSearchBandScript(['dog food'], 100));
    const afterFirst = state.timers.length;
    for (let i = 0; i < 6; i++) {
      run(buildSearchBandScript(['dog food'], 100), state);
    }
    // No re-run armed a second cycle.
    expect(state.timers.length).toBe(afterFirst);
  });

  it('adopts phrases that arrive after the band was built', () => {
    // The band is usually built before the reader has finished measuring the
    // site's own search box, so the later report has to land.
    const state = run(buildSearchBandScript([], 100));
    run(buildSearchBandScript(['cat litter'], 100), state);
    expect(state.band!.__ziglyPhrases).toEqual(['cat litter']);
  });
});

describe('the typewriter', () => {
  it('types the phrase a letter at a time', () => {
    const state = run(buildSearchBandScript(['cat'], 100));
    const text = state.band!.querySelector('.zigly-band-text')!;
    const seen = [text.textContent];
    // Step the collected timers; each one draws the next frame.
    for (let i = 0; i < 3; i++) {
      const next = state.timers.pop()!;
      next();
      seen.push(text.textContent);
    }
    expect(seen).toEqual(['', 'c', 'ca', 'cat']);
  });

  it('does nothing at all when there are no phrases yet', () => {
    // Before the reader reports there is nothing honest to draw.
    const state = run(buildSearchBandScript([], 100));
    expect(state.band).not.toBeNull();
    expect(state.timers.length).toBe(0);
  });
});

describe('removing it', () => {
  it('takes the node out and stops its timer', () => {
    const state = run(buildSearchBandScript(['dog food'], 100));
    const band = state.band!;
    band.__ziglyTimer = 1;

    run(removeSearchBandScript(), state);
    expect(state.host.walk().filter(el => el.id === BAND_ID).length).toBe(0);
    // Or the cycle writes into a detached node for as long as the page lives.
    expect(band.__ziglyTyping).toBe(false);
  });

  it('is safe on a page that never had one', () => {
    const state = run(removeSearchBandScript());
    expect(state.band).toBeNull();
  });
});
