/**
 * The section ids kept across launches.
 *
 * The dashboard is built from about twenty of Zigly's theme sections, fetched
 * one-by-id -- 32 KB a section instead of the ~2 MB page each lives on. The ids
 * carry a Shopify suffix that changes whenever the theme is re-saved, so the
 * written-down seeds in ../src/webview/pageCache go stale, and a stale seed costs
 * a whole-page fetch to re-learn. That cost used to be paid on every launch,
 * because what the page learned died with the page view.
 *
 * What is defended here is that this is a CACHE and never a source of truth. The
 * failure mode worth guarding against is not a slow launch, it is a stored value
 * being trusted: this store is read off disk and then pushed into a live page as
 * script, so anything malformed has to be discarded rather than repaired, and a
 * storage error has to cost speed and nothing else.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadSectionIds,
  saveSectionIds,
  seedSectionIdsScript,
} from '../src/webview/sectionIdStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('keeping what the page learned', () => {
  it('reads back what it wrote', async () => {
    await saveSectionIds({'/|coupon_slider': 'template--1__coupon_abc'}, {});
    await expect(loadSectionIds()).resolves.toEqual({
      '/|coupon_slider': 'template--1__coupon_abc',
    });
  });

  it('starts empty rather than failing when nothing is stored', async () => {
    await expect(loadSectionIds()).resolves.toEqual({});
  });

  it('merges rather than replacing', async () => {
    /*
     * Load bearing. The page reports only the ids IT had to rediscover, which on
     * any given launch is just the sections whose seed had gone stale. Replacing
     * would throw away everything learned on an earlier launch that this launch
     * never needed to ask about -- and the store would never accumulate.
     */
    const first = await saveSectionIds({'/|a': 'id-a'}, {});
    const second = await saveSectionIds({'/|b': 'id-b'}, first);
    expect(second).toEqual({'/|a': 'id-a', '/|b': 'id-b'});
    await expect(loadSectionIds()).resolves.toEqual(second);
  });

  it('lets a fresh id replace the one it already had', async () => {
    // The theme was re-saved: the newly discovered id is the correct one.
    const merged = await saveSectionIds({'/|a': 'new'}, {'/|a': 'old'});
    expect(merged['/|a']).toBe('new');
  });
});

describe('a stored value is never trusted', () => {
  it('discards anything that is not a map of strings', async () => {
    for (const junk of ['[]', '"a string"', '3', 'null', '{"k":{"nested":1}}']) {
      await AsyncStorage.setItem('zigly.sectionIds.v1', junk);
      const ids = await loadSectionIds();
      // Either empty, or containing only string values -- never the junk.
      expect(Object.values(ids).every(v => typeof v === 'string')).toBe(true);
      expect(ids).not.toHaveProperty('nested');
    }
  });

  it('survives unparseable stored content', async () => {
    await AsyncStorage.setItem('zigly.sectionIds.v1', '{not json at all');
    await expect(loadSectionIds()).resolves.toEqual({});
  });

  it('survives storage that throws, at the cost of speed only', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('device storage unavailable'),
    );
    await expect(loadSectionIds()).resolves.toEqual({});

    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('device storage full'),
    );
    // Still answers with the merged map, so the caller's in-memory copy is right
    // even though the write did not land.
    await expect(saveSectionIds({'/|a': 'id-a'}, {})).resolves.toEqual({
      '/|a': 'id-a',
    });
  });

  it('refuses to grow without bound', async () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      many['/|section' + i] = 'id' + i;
    }
    const merged = await saveSectionIds(many, {});
    expect(Object.keys(merged).length).toBeLessThanOrEqual(64);
  });

  it('keeps the app’s own namespace, not the site’s', async () => {
    // ../src/webview/pageCache is explicit that Zigly's storage is Zigly's. This
    // is the app's, on the device, which is what lets that rule survive a cache.
    await saveSectionIds({'/|a': 'id-a'}, {});
    const key = (AsyncStorage.setItem as jest.Mock).mock.calls[0][0];
    expect(key).toContain('zigly.sectionIds');
  });
});

describe('handing the ids to a page', () => {
  const ids = {'/|coupon_slider': 'template--1__coupon_abc'};

  it('sets the global that pageCache reads per lookup', () => {
    const script = seedSectionIdsScript(ids);
    expect(script).toContain('window.__ziglySectionIds');
    expect(script).toContain('template--1__coupon_abc');
  });

  it('merges into whatever is already there', () => {
    /*
     * Because it runs more than once. The injected payload runs seven times per
     * page load, and the app injects this again on every load of the dashboard --
     * a script that assigned over the global would drop ids that arrived by
     * another path.
     */
    const script = seedSectionIdsScript(ids);
    expect(script).toContain('window.__ziglySectionIds || {}');
    expect(script).not.toMatch(/window\.__ziglySectionIds\s*=\s*\{/);
  });

  it('parses, and cannot throw into the page', () => {
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(seedSectionIdsScript(ids));
    }).not.toThrow();
    expect(seedSectionIdsScript(ids)).toContain('catch (e) {}');
  });

  it('cannot be broken by a hostile-looking key', () => {
    /*
     * The map is serialised with JSON.stringify, so a quote in a key is escaped
     * rather than closing the string and becoming syntax.
     *
     * Asserted as "the quote is escaped" rather than "the payload is absent",
     * which is the mistake the first version of this test made: the escaped form
     * still *contains* the unescaped one as a substring, so the absence check
     * passed for the wrong reason and would have passed on a real injection too.
     */
    const script = seedSectionIdsScript({
      '/|a";window.x=1;//': 'id',
    } as Record<string, string>);
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(script);
    }).not.toThrow();
    // Backslash-quote, not a bare quote: the key stayed data.
    expect(script).toContain('\\";window.x=1');
    // And the statement never appears at the top level of the script.
    expect(script).not.toMatch(/^\s*window\.x=1/m);
  });
});
