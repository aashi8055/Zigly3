/**
 * The Breed-verse index, and the eight breeds that were missing from All.
 *
 * Zigly's grid pages itself -- 32 cards, 24 per page, the next page revealed by
 * an IntersectionObserver on the last visible card. Verified on 2026-08-22 the
 * section constructs it as `new IntersectiongalleryObserver(...)`: a typo at the
 * source, where a find-and-replace of `observer` with `galleryObserver` caught
 * the middle of `IntersectionObserver` too. The name is undefined, so the first
 * render throws and page two is never asked for.
 *
 * 25 dogs and 7 cats, so All showed 24 of 32 and Dog showed 24 of 25, while Cat
 * was under the page size and looked fine. That is the bug being fixed.
 *
 * What these tests hold to is that the repair stays a repair: it supplies the
 * name the section's own code asks for and re-runs the section's own render
 * through the section's own control. No grid, no paging and no filter of ours.
 */
import {BREED_GALLERY_SCRIPT} from '../src/webview/breedGallery';
import {getInjectionForUrl} from '../src/webview/injectedScripts';

interface FakeTab {
  className: string;
  clicks: number;
  click: () => void;
}

const tab = (label: string, active: boolean): FakeTab => {
  const node: FakeTab = {
    className: active ? 'active' : '',
    clicks: 0,
    click: () => {
      node.clicks += 1;
    },
  };
  return node;
};

/**
 * Run the script against a page. `grid` false is any page that is not the
 * breed index; the script must not touch it.
 */
const run = (options: {grid: boolean; tabs?: FakeTab[]; times?: number}) => {
  const tabs = options.tabs ?? [tab('All', true), tab('Dog', false)];
  const document = {
    getElementById: (id: string) => (id === 'galleryGrid' && options.grid ? {} : null),
    querySelectorAll: (selector: string) =>
      selector === '.gallery-tabs button' ? tabs : [],
  };
  const window: Record<string, unknown> = {
    IntersectionObserver: function FakeObserver() {},
    console,
  };
  // eslint-disable-next-line no-new-func
  const script = new Function('window', 'document', BREED_GALLERY_SCRIPT);
  for (let i = 0; i < (options.times ?? 1); i += 1) {
    script(window, document);
  }
  return {window, tabs};
};

const MISSPELLED = 'IntersectiongalleryObserver';

describe('the breed grid', () => {
  it('is valid JavaScript', () => {
    // eslint-disable-next-line no-new-func
    expect(() => new Function(BREED_GALLERY_SCRIPT)).not.toThrow();
  });

  it('supplies the observer the section’s own code asks for', () => {
    const {window} = run({grid: true});
    expect(window[MISSPELLED]).toBe(window.IntersectionObserver);
  });

  it('re-runs the render through the tab that is already active', () => {
    // Clicking the active tab keeps the customer's category; the site's
    // handler resets to page one and re-observes, which is the whole repair.
    const tabs = [tab('All', false), tab('Dog', true), tab('Cat', false)];
    run({grid: true, tabs});
    expect(tabs.map(t => t.clicks)).toEqual([0, 1, 0]);
  });

  it('does it once, however many times the page is re-injected', () => {
    // The stylesheet is re-applied on a schedule after load. A second click
    // would send someone who had scrolled back to the first 24 cards.
    const {tabs} = run({grid: true, times: 4});
    expect(tabs[0].clicks).toBe(1);
  });

  it('touches no page but the breed index', () => {
    const {window, tabs} = run({grid: false});
    expect(window[MISSPELLED]).toBeUndefined();
    expect(tabs[0].clicks).toBe(0);
  });

  it('rebuilds none of the section it repairs', () => {
    // No grid, no page size, no category list, no card markup.
    expect(BREED_GALLERY_SCRIPT).not.toContain('perPage');
    expect(BREED_GALLERY_SCRIPT).not.toContain('gallery-card');
    expect(BREED_GALLERY_SCRIPT).not.toContain('data-category');
    expect(BREED_GALLERY_SCRIPT).not.toContain('display');
    expect(BREED_GALLERY_SCRIPT).not.toContain('/pages/');
  });

  it('rides along with the rest of the injection', () => {
    const script = getInjectionForUrl(
      'https://zigly.com/pages/pet-breeds',
    ) as string;
    expect(script).toContain('galleryGrid');
    expect(script).toContain('gallery-tabs button');
    expect(getInjectionForUrl('https://zigly.com/checkouts/c/x')).toBeNull();
  });
});
